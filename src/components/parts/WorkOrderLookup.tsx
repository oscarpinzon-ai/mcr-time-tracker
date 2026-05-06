import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search } from "lucide-react";
import { lookupHcpWorkOrder, importWorkOrder, createManualWorkOrder } from "@/lib/work-orders.functions";

type Preview = {
  hcp_id: string;
  hcp_type: "job" | "estimate";
  number: string;
  customer_name: string | null;
  address: string | null;
  description: string | null;
  hcp_status: string | null;
  scheduled_date: string | null;
  assigned_to: string | null;
};

export function WorkOrderLookup({ onImported }: { onImported?: (id: string) => void }) {
  const router = useRouter();
  const [type, setType] = useState<"job" | "estimate">("job");
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [showManual, setShowManual] = useState(false);

  async function doLookup() {
    if (!number.trim()) return;
    setLoading(true);
    setPreview(null);
    setShowManual(false);
    const res = await lookupHcpWorkOrder({ data: { type, number: number.trim() } });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      setShowManual(true);
      return;
    }
    setPreview(res.data as Preview);
  }

  async function doImport() {
    setLoading(true);
    const res = await importWorkOrder({ data: { type, number: number.trim() } });
    setLoading(false);
    if (!res.ok || !res.data) {
      toast.error(res.error ?? "Import failed");
      return;
    }
    toast.success(`Imported ${type} #${res.data.number}`);
    setPreview(null);
    setNumber("");
    if (onImported) onImported(res.data.id);
    else router.navigate({ to: "/work-orders/$id", params: { id: res.data.id } });
  }

  async function doManual() {
    setLoading(true);
    const res = await createManualWorkOrder({ data: { type, number: number.trim() } });
    setLoading(false);
    if (!res.ok || !res.data) {
      toast.error(res.error ?? "Create failed");
      return;
    }
    toast.success("Manual entry created");
    router.navigate({ to: "/work-orders/$id", params: { id: res.data.id } });
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Tabs value={type} onValueChange={(v) => setType(v as "job" | "estimate")}>
            <TabsList>
              <TabsTrigger value="job">Job</TabsTrigger>
              <TabsTrigger value="estimate">Estimate</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex-1 min-w-48">
            <Label htmlFor="hcp-number" className="text-xs uppercase tracking-wider text-muted-foreground">
              {type === "job" ? "Job #" : "Estimate #"}
            </Label>
            <Input
              id="hcp-number"
              className="mt-1"
              placeholder="e.g. 12345"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doLookup()}
            />
          </div>
          <Button onClick={doLookup} disabled={loading || !number.trim()}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
            Look up
          </Button>
        </div>

        {preview && (
          <div className="border rounded-md p-4 bg-muted/30 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-lg">
                  {preview.hcp_type === "job" ? "Job" : "Estimate"} #{preview.number}
                </p>
                <p className="text-sm">{preview.customer_name || "—"}</p>
                <p className="text-xs text-muted-foreground">{preview.address || ""}</p>
                {preview.hcp_status && (
                  <p className="text-xs mt-1">
                    Status: <span className="font-semibold">{preview.hcp_status}</span>
                    {preview.scheduled_date && ` · Scheduled ${preview.scheduled_date}`}
                  </p>
                )}
              </div>
              <Button onClick={doImport} disabled={loading}>
                Import & track parts
              </Button>
            </div>
          </div>
        )}

        {showManual && (
          <div className="text-sm flex items-center gap-2 pt-2 border-t">
            <span className="text-muted-foreground">Not in HCP?</span>
            <button className="underline font-medium" onClick={doManual} disabled={loading}>
              Create manual entry for {type} #{number}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
