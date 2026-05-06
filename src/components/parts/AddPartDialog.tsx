import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { addPart } from "@/lib/parts.functions";
import { useCurrentUser } from "@/lib/current-user";

export function AddPartDialog({ workOrderId, onAdded }: { workOrderId: string; onAdded: () => void }) {
  const [user] = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    const res = await addPart({
      data: {
        workOrderId,
        name: name.trim(),
        description: description.trim() || null,
        quantity: Number(quantity) || 1,
        requested_by: user.name || null,
        department: user.department,
      },
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Part added");
    setName("");
    setDescription("");
    setQuantity("1");
    setOpen(false);
    onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-1" /> Add part needed
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a part needed</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="part-name">Part name *</Label>
            <Input
              id="part-name"
              autoFocus
              placeholder='e.g. "Hydraulic seal kit, model X"'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Type what you need now — Parts will fill in vendor, part #, and pricing later.
            </p>
          </div>
          <div>
            <Label htmlFor="part-desc">Description / context</Label>
            <Textarea
              id="part-desc"
              placeholder="Symptoms, model #, photo links…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="w-32">
            <Label htmlFor="part-qty">Quantity</Label>
            <Input
              id="part-qty"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !name.trim()}>
            Add part
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
