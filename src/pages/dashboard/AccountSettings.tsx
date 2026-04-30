import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { useState } from "react";
import { toast } from "sonner";

export default function AccountSettings() {
  const { currentUser, setState } = useStore();
  const [name, setName] = useState(currentUser?.name ?? "");
  const [phone, setPhone] = useState(currentUser?.phone ?? "");
  if (!currentUser) return null;

  const save = () => {
    setState((s) => ({ ...s, users: s.users.map((u) => (u.id === currentUser.id ? { ...u, name, phone } : u)) }));
    toast.success("Profile updated");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Account settings</h1>
      <Card className="p-6 shadow-soft space-y-4">
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label>Email</Label><Input value={currentUser.email} disabled /></div>
        <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={10} /></div>
        <Button onClick={save}>Save changes</Button>
      </Card>
    </div>
  );
}