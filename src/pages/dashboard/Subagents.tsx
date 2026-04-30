import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cedi, shortDate } from "@/lib/format";
import { Plus, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function Subagents() {
  const { state, currentUser, signupSubagent } = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  if (!currentUser) return null;

  const list = state.users.filter((u) => u.parentAgentId === currentUser.id);

  const create = () => {
    if (!form.name || !form.email || !form.phone) { toast.error("Fill in all fields"); return; }
    if (!/^0\d{9}$/.test(form.phone)) { toast.error("Invalid phone"); return; }
    signupSubagent({ ...form, parentAgentId: currentUser.id });
    toast.success(`Sub-agent ${form.name} added`);
    setForm({ name: "", email: "", phone: "" });
    setOpen(false);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sub-agents</h1>
          <p className="text-muted-foreground">Build your team. They sell under your network.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Add sub-agent</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add a sub-agent</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={10} /></div>
              <Button className="w-full" onClick={create}>Create sub-agent</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {list.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">No sub-agents yet. Click "Add sub-agent" to start your team.</Card>
        ) : list.map((s) => (
          <Card key={s.id} className="p-4 shadow-soft flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary"><UserCircle className="h-5 w-5" /></div>
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.email} · {s.phone}</div>
              </div>
            </div>
            <div className="text-right">
              <Badge variant={s.active ? "default" : "secondary"}>{s.active ? "Active" : "Suspended"}</Badge>
              <div className="text-xs text-muted-foreground mt-1">Wallet: {cedi(s.walletBalance)}</div>
              <div className="text-xs text-muted-foreground">Joined {shortDate(s.createdAt)}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}