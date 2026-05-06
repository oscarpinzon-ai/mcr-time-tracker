import { useCurrentUser } from "@/lib/current-user";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Department } from "@/lib/types";

export function DepartmentSelector() {
  const [user, setUser] = useCurrentUser();
  return (
    <div className="flex items-end gap-2">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Department</Label>
        <Select
          value={user.department}
          onValueChange={(v) => setUser({ ...user, department: v as Department })}
        >
          <SelectTrigger className="w-36 mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dispatch">Dispatch</SelectItem>
            <SelectItem value="parts">Parts</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Your name</Label>
        <Input
          className="w-44 mt-1"
          placeholder="e.g. Maria"
          value={user.name}
          onChange={(e) => setUser({ ...user, name: e.target.value })}
        />
      </div>
    </div>
  );
}
