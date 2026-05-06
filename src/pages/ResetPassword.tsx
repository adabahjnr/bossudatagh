import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ResetPassword() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated successfully.");
    nav("/dashboard");
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <Card className="p-8 shadow-elegant">
        <h1 className="text-2xl font-bold">Set a new password</h1>
        <p className="text-muted-foreground text-sm mt-2">
          Enter your new password to complete account recovery.
        </p>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>New password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Confirm password</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button className="w-full bg-gradient-primary" disabled={saving} onClick={submit}>
            {saving ? "Saving..." : "Update password"}
          </Button>
          </div>
      </Card>
    </div>
  );
}