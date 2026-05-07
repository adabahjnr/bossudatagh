import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

export default function AccountSettings() {
  const { currentUser, setState } = useStore();
  const [name, setName] = useState(currentUser?.name ?? "");
  const [phone, setPhone] = useState(currentUser?.phone ?? "");
  const [saving, setSaving] = useState(false);

  if (!currentUser) {
    return (
      <Card className="p-6 shadow-soft">
        <p className="text-sm text-muted-foreground">Restoring your account settings...</p>
      </Card>
    );
  }

  const save = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (phone && !/^0\d{9}$/.test(phone)) { toast.error("Invalid phone number"); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name: name.trim(), phone: phone.trim() || null })
        .eq("id", currentUser.id);

      if (error) throw error;

      // Keep local state in sync
      setState((s) => ({
        ...s,
        users: s.users.map((u) => u.id === currentUser.id ? { ...u, name: name.trim(), phone: phone.trim() } : u),
      }));
      toast.success("Profile updated");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save profile";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Account settings</h1>
      <Card className="p-6 shadow-soft space-y-4">
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label>Email</Label><Input value={currentUser.email} disabled /></div>
        <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={10} /></div>
        <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
      </Card>
    </div>
  );
}