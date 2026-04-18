import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AdminEditLog, Employee, PauseLog, TimeEntry } from "@/lib/types";
import { JOB_TYPES } from "@/lib/types";
import { formatHoursMinutes, totalPauseMinutes, workedSeconds } from "@/lib/time";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { JobTypeBadge } from "@/components/JobTypeBadge";
import { ChevronDown, ChevronRight, Edit2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Row = {
  entry: TimeEntry;
  employee: Employee | null;
  pauses: PauseLog[];
  edits: AdminEditLog[];
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInput(local: string): string {
  return new Date(local).toISOString();
}

export function TimeEntriesTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [jobTypeFilter, setJobTypeFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Row | null>(null);

  async function load() {
    setLoading(true);
    const { data: emps } = await supabase.from("employees").select("*").order("name");
    const employeesData = (emps ?? []) as Employee[];
    setEmployees(employeesData);

    let q = supabase
      .from("time_entries")
      .select("*")
      .gte("clock_in", new Date(from).toISOString())
      .lte("clock_in", new Date(to + "T23:59:59").toISOString())
      .order("clock_in", { ascending: false });
    if (employeeFilter !== "all") q = q.eq("employee_id", employeeFilter);
    if (jobTypeFilter !== "all") q = q.eq("job_type", jobTypeFilter);

    const { data: entries, error } = await q;
    if (error) toast.error("Failed to load entries");
    const entriesData = (entries ?? []) as TimeEntry[];

    const ids = entriesData.map((e) => e.id);
    let pauses: PauseLog[] = [];
    let edits: AdminEditLog[] = [];
    if (ids.length > 0) {
      const [{ data: p }, { data: e }] = await Promise.all([
        supabase.from("pause_logs").select("*").in("time_entry_id", ids),
        supabase
          .from("admin_edits_log")
          .select("*")
          .in("time_entry_id", ids)
          .order("edited_at", { ascending: false }),
      ]);
      pauses = (p ?? []) as PauseLog[];
      edits = (e ?? []) as AdminEditLog[];
    }

    const result: Row[] = entriesData.map((entry) => ({
      entry,
      employee: employeesData.find((e) => e.id === entry.employee_id) ?? null,
      pauses: pauses.filter((p) => p.time_entry_id === entry.id),
      edits: edits.filter((e) => e.time_entry_id === entry.id),
    }));
    setRows(result);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, employeeFilter, jobTypeFilter]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="bg-card border border-border rounded-lg p-4 mb-4 shadow-card">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs uppercase font-semibold tracking-wide text-muted-foreground mb-1.5 block">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase font-semibold tracking-wide text-muted-foreground mb-1.5 block">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase font-semibold tracking-wide text-muted-foreground mb-1.5 block">Employee</Label>
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase font-semibold tracking-wide text-muted-foreground mb-1.5 block">Job Type</Label>
            <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {JOB_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50">
                <TableHead className="w-8" />
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Job #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead className="text-right">Pauses</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={11} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">No time entries found.</TableCell></TableRow>
              ) : (
                rows.map((row) => {
                  const totalMin =
                    row.entry.total_minutes ??
                    Math.round(workedSeconds(row.entry, row.pauses, row.entry.clock_out ? new Date(row.entry.clock_out).getTime() : Date.now()) / 60);
                  const pauseMin = totalPauseMinutes(row.pauses);
                  const isOpen = expanded.has(row.entry.id);
                  return (
                    <>
                      <TableRow key={row.entry.id} className="hover:bg-muted/50">
                        <TableCell className="p-1">
                          {row.edits.length > 0 && (
                            <button
                              onClick={() => toggleExpand(row.entry.id)}
                              className="p-1 hover:bg-secondary rounded"
                              aria-label="Toggle history"
                            >
                              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {new Date(row.entry.clock_in).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </TableCell>
                        <TableCell className="font-medium">{row.employee?.name ?? "—"}</TableCell>
                        <TableCell className="font-bold">#{row.entry.job_number}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{row.entry.customer_name}</TableCell>
                        <TableCell><JobTypeBadge type={row.entry.job_type} /></TableCell>
                        <TableCell className="font-mono text-xs">
                          {new Date(row.entry.clock_in).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.entry.clock_out
                            ? new Date(row.entry.clock_out).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                            : <span className="text-success font-bold">Active</span>}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {pauseMin > 0 ? `${pauseMin}m` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-bold tabular-nums">
                          {formatHoursMinutes(totalMin)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(row)}
                            disabled={row.entry.status !== "completed"}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isOpen && row.edits.length > 0 && (
                        <TableRow key={row.entry.id + "-history"} className="bg-muted/30">
                          <TableCell colSpan={11} className="py-3">
                            <div className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-2">Edit History</div>
                            <div className="space-y-1">
                              {row.edits.map((ed) => (
                                <div key={ed.id} className="text-xs font-mono bg-card border border-border rounded px-2 py-1">
                                  <span className="text-muted-foreground">
                                    {new Date(ed.edited_at).toLocaleString()} · {ed.edited_by} ·
                                  </span>{" "}
                                  <span className="font-bold">{ed.field_changed}</span>:{" "}
                                  <span className="text-destructive">{ed.old_value}</span> →{" "}
                                  <span className="text-success">{ed.new_value}</span>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <EditDialog
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
      />
    </div>
  );
}

function EditDialog({
  row,
  onClose,
  onSaved,
}: {
  row: Row | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [jobType, setJobType] = useState("");
  const [editor, setEditor] = useState("Admin");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (row) {
      setClockIn(toLocalInput(row.entry.clock_in));
      setClockOut(toLocalInput(row.entry.clock_out));
      setJobType(row.entry.job_type ?? "");
    }
  }, [row]);

  const original = useMemo(() => {
    if (!row) return null;
    return {
      clock_in: row.entry.clock_in,
      clock_out: row.entry.clock_out,
      job_type: row.entry.job_type,
    };
  }, [row]);

  async function handleSave() {
    if (!row || !original) return;
    setSaving(true);
    const newIn = fromLocalInput(clockIn);
    const newOut = clockOut ? fromLocalInput(clockOut) : null;

    const changes: { field: string; oldV: string | null; newV: string | null }[] = [];
    if (newIn !== original.clock_in) changes.push({ field: "clock_in", oldV: original.clock_in, newV: newIn });
    if (newOut !== original.clock_out) changes.push({ field: "clock_out", oldV: original.clock_out, newV: newOut });
    if (jobType !== (original.job_type ?? "")) changes.push({ field: "job_type", oldV: original.job_type ?? null, newV: jobType || null });

    if (changes.length === 0) {
      toast.message("No changes");
      setSaving(false);
      return;
    }

    // Recalculate total_minutes
    const newEntry = { ...row.entry, clock_in: newIn, clock_out: newOut };
    const totalSec = workedSeconds(
      newEntry,
      row.pauses,
      newOut ? new Date(newOut).getTime() : Date.now()
    );
    const newTotalMin = Math.round(totalSec / 60);
    const oldTotalMin = row.entry.total_minutes;

    const { error } = await supabase
      .from("time_entries")
      .update({ clock_in: newIn, clock_out: newOut, total_minutes: newTotalMin, job_type: jobType || null })
      .eq("id", row.entry.id);

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    if (newTotalMin !== oldTotalMin) {
      changes.push({
        field: "total_minutes",
        oldV: oldTotalMin?.toString() ?? null,
        newV: newTotalMin.toString(),
      });
    }

    await supabase.from("admin_edits_log").insert(
      changes.map((c) => ({
        time_entry_id: row.entry.id,
        edited_by: editor || "Admin",
        field_changed: c.field,
        old_value: c.oldV,
        new_value: c.newV,
      }))
    );

    toast.success("Time entry updated");
    setSaving(false);
    onSaved();
  }

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Edit Time Entry · #{row?.entry.job_number}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Clock In</Label>
            <Input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
          </div>
          <div>
            <Label>Clock Out</Label>
            <Input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
          </div>
          <div>
            <Label>Job Type</Label>
            <Select value={jobType} onValueChange={setJobType}>
              <SelectTrigger>
                <SelectValue placeholder="Select job type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {JOB_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Edited by</Label>
            <Input value={editor} onChange={(e) => setEditor(e.target.value)} placeholder="Your name" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
