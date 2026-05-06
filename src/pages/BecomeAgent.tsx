import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Check, Wallet, Users, Code, Store } from "lucide-react";

export default function BecomeAgent() {
  const { signUp } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", storeSlug: "" });
  const [pending, setPending] = useState(false);

  const createAccount = async () => {
    if (!form.name || !form.email || !form.phone || !form.password || !form.storeSlug) {
      toast.error("Please fill in all fields");
      return;
    }
    if (!/^0\d{9}$/.test(form.phone)) {
      toast.error("Invalid phone number");
      return;
    }

    setPending(true);
    const { error } = await signUp({
      email: form.email,
      password: form.password,
      name: form.name,
      phone: form.phone,
      storeSlug: form.storeSlug.toLowerCase(),
    });
    setPending(false);
    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Account created! Complete your activation to start selling.");
    nav("/activate-agent", { replace: true });
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <Card className="p-8 shadow-elegant">
            <h1 className="text-2xl font-bold">Create your agent account</h1>
            <p className="text-muted-foreground mt-1">Create your account and start selling instantly.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Full name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={10} placeholder="0244000000" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Store URL</Label>
                <div className="flex items-center rounded-md border border-input bg-background overflow-hidden">
                  <span className="px-3 text-sm text-muted-foreground bg-muted">/store/</span>
                  <Input className="border-0" value={form.storeSlug} onChange={(e) => setForm({ ...form, storeSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="yourname" />
                </div>
              </div>
            </div>
            <Button className="w-full mt-6 bg-gradient-primary" disabled={pending} onClick={createAccount}>
              {pending ? "Creating account..." : "Create agent account"}
            </Button>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="p-6 shadow-soft sticky top-20">
            <h3 className="font-bold text-lg">What you get</h3>
            <ul className="mt-4 space-y-3">
              {[
                { icon: Wallet, t: "Wallet system", d: "Top up, sell, withdraw" },
                { icon: Store, t: "Branded mini-store", d: "Your own URL & design" },
                { icon: Users, t: "Sub-agents", d: "Build your team" },
                { icon: Code, t: "API access", d: "Build external apps" },
              ].map((f) => {
                const Icon = f.icon;
                return (
                  <li key={f.t} className="flex gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
                    <div>
                      <div className="font-semibold text-sm">{f.t}</div>
                      <div className="text-xs text-muted-foreground">{f.d}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 flex items-center gap-2 text-sm text-success font-medium">
              <Check className="h-4 w-4" /> Activate same day
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}