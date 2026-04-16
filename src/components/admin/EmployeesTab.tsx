import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Employee } from "@/lib/types";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit2, Loader2, Plus, RefreshCw, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";

export function EmployeesTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("employees").select("*").order("name");
    if (error) toast.error("Failed to load employees");
    setEmployees((data ?? []) as Employee[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleToggleActive(emp: Employee) {
    const { error } = await supabase
      .from("employees")
      .update({ is_active: !emp.is_active })
      .eq("id", emp.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(emp.is_active ? "Employee deactivated" : "Employee reactivated");
    void load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-2xl font-bold uppercase tracking-tight">Employees</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled
            title="Coming soon — will be implemented by Claude Code"
          >
            <RefreshCw className="w-4 h-4 mr-1" /> Sync from HouseCall Pro
          </Button>
          <Button onClick={() => setCreating(true)} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Plus className="w-4 h-4 mr-1" /> Add Employee
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50">
                <TableHead>Name</TableHead>
                <TableHead>HCP Employee ID</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : employees.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No employees yet.</TableCell></TableRow>
              ) : (
                employees.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-muted/50">
                    <TableCell className="font-semibold">{emp.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{emp.hcp_employee_id ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={emp.role === "admin" ? "border-accent text-accent-foreground bg-accent/15" : "border-border"}>
                        {emp.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {emp.is_active ? (
                        <span className="inline-flex items-center gap-1.5 text-success font-semibold text-xs uppercase tracking-wide">
                          <span className="w-1.5 h-1.5 rounded-full bg-success" /> Active
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs uppercase tracking-wide">Inactive</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(emp)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleToggleActive(emp)}>
                        {emp.is_active ? <UserX className="w-3.5 h-3.5 text-destructive" /> : <UserCheck className="w-3.5 h-3.5 text-success" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <EmployeeDialog
        open={creating || !!editing}
        employee={editing}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSaved={() => {
          setEditing(null);
          setCreating(false);
          void load();
        }}
      />
    </div>
  );
}

function EmployeeDialog({
  open,
  employee,
  onClose,
  onSaved,
}: {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [hcpId, setHcpId] = useState("");
  const [role, setRole] = useState<"technician" | "admin">("technician");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(employee?.name ?? "");
      setHcpId(employee?.hcp_employee_id ?? "");
      setRole((employee?.role as "technician" | "admin") ?? "technician");
    }
  }, [open, employee]);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      hcp_employee_id: hcpId.trim() || null,
      role,
    };
    const { error } = employee
      ? await supabase.from("employees").update(payload).eq("id", employee.id)
      : await supabase.from("employees").insert({ ...payload, is_active: true });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(employee ? "Employee updated" : "Employee added");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{employee ? "Edit Employee" : "Add Employee"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Carlos Ramirez" />
          </div>
          <div>
            <Label>HCP Employee ID (optional)</Label>
            <Input value={hcpId} onChange={(e) => setHcpId(e.target.value)} placeholder="HCP-EMP-001" />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "technician" | "admin")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="technician">Technician</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
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
