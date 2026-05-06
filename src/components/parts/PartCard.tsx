import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Save, MessageSquarePlus } from "lucide-react";
import {
  type Part,
  type PartEvent,
  PART_STATUSES,
  PRICING_STATUSES,
  STATUS_LABELS,
  type PartStatus,
  type PricingStatus,
} from "@/lib/types";
import { PartStatusBadge } from "./PartStatusBadge";
import { PartTimeline } from "./PartTimeline";
import { useCurrentUser } from "@/lib/current-user";
import {
  updatePart,
  updatePartStatus,
  addPartNote,
  deletePart,
} from "@/lib/parts.functions";

export function PartCard({
  part,
  events,
  onChanged,
}: {
  part: Part;
  events: PartEvent[];
  onChanged: () => void;
}) {
  const [user] = useCurrentUser();
  const [vendor, setVendor] = useState(part.vendor ?? "");
  const [partNumber, setPartNumber] = useState(part.part_number ?? "");
  const [unitPrice, setUnitPrice] = useState(part.unit_price?.toString() ?? "");
  const [pricingStatus, setPricingStatus] = useState<PricingStatus>(part.pricing_status);
  const [trackingCarrier, setTrackingCarrier] = useState(part.tracking_carrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(part.tracking_number ?? "");
  const [eta, setEta] = useState(part.eta ?? "");
  const [note, setNote] = useState("");
  const [savingPricing, setSavingPricing] = useState(false);
  const [savingTracking, setSavingTracking] = useState(false);
  const [postingNote, setPostingNote] = useState(false);

  async function changeStatus(status: PartStatus) {
    const res = await updatePartStatus({
      data: {
        id: part.id,
        status,
        author: user.name || null,
        department: user.department,
      },
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(`Marked ${STATUS_LABELS[status]}`);
      onChanged();
    }
  }

  async function savePricing() {
    setSavingPricing(true);
    const res = await updatePart({
      data: {
        id: part.id,
        author: user.name || null,
        department: user.department,
        fields: {
          vendor: vendor || null,
          part_number: partNumber || null,
          unit_price: unitPrice ? Number(unitPrice) : null,
          pricing_status: pricingStatus,
        },
      },
    });
    setSavingPricing(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Pricing updated");
      onChanged();
    }
  }

  async function saveTracking() {
    setSavingTracking(true);
    const res = await updatePart({
      data: {
        id: part.id,
        author: user.name || null,
        department: user.department,
        fields: {
          tracking_carrier: trackingCarrier || null,
          tracking_number: trackingNumber || null,
          eta: eta || null,
        },
      },
    });
    setSavingTracking(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Tracking updated");
      onChanged();
    }
  }

  async function postNote() {
    if (!note.trim()) return;
    setPostingNote(true);
    const res = await addPartNote({
      data: {
        partId: part.id,
        message: note.trim(),
        author: user.name || null,
        department: user.department,
      },
    });
    setPostingNote(false);
    if (!res.ok) toast.error(res.error);
    else {
      setNote("");
      onChanged();
    }
  }

  async function remove() {
    if (!confirm(`Delete part "${part.name}"?`)) return;
    const res = await deletePart({ data: { id: part.id } });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Part deleted");
      onChanged();
    }
  }

  const showTracking =
    ["ordered", "shipped", "received", "installed", "backordered"].includes(part.status) ||
    !!trackingNumber ||
    !!trackingCarrier;

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-56">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold">{part.name}</h3>
              <PartStatusBadge status={part.status} />
              {part.pricing_status !== "confirmed" && (
                <Badge variant="outline" className="text-xs">
                  Pricing {part.pricing_status}
                </Badge>
              )}
            </div>
            {part.description && <p className="text-sm text-muted-foreground mt-1">{part.description}</p>}
            <p className="text-xs text-muted-foreground mt-1">
              Qty {Number(part.quantity)}
              {part.requested_by ? ` · requested by ${part.requested_by}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={part.status} onValueChange={(v) => changeStatus(v as PartStatus)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PART_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={remove} title="Delete">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Pricing block */}
        <div className="grid sm:grid-cols-5 gap-2 border-t pt-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Vendor</label>
            <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Part #</label>
            <Input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Unit price</label>
            <Input
              type="number"
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="$"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Pricing status</label>
            <Select value={pricingStatus} onValueChange={(v) => setPricingStatus(v as PricingStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICING_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button size="sm" onClick={savePricing} disabled={savingPricing} className="w-full">
              <Save className="w-4 h-4 mr-1" /> Save pricing
            </Button>
          </div>
        </div>

        {/* Tracking block */}
        {showTracking && (
          <div className="grid sm:grid-cols-4 gap-2 border-t pt-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Carrier</label>
              <Input value={trackingCarrier} onChange={(e) => setTrackingCarrier(e.target.value)} placeholder="UPS, FedEx…" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Tracking #</label>
              <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">ETA</label>
              <Input type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button size="sm" variant="outline" onClick={saveTracking} disabled={savingTracking} className="w-full">
                Save tracking
              </Button>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="border-t pt-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Activity</p>
          <PartTimeline events={events} />
          <div className="flex gap-2 mt-3">
            <Textarea
              rows={2}
              placeholder="Add a note for the team…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button onClick={postNote} disabled={postingNote || !note.trim()}>
              <MessageSquarePlus className="w-4 h-4 mr-1" /> Post
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
