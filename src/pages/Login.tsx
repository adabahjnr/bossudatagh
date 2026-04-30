import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { Shield } from "lucide-react";

export default function Login() {
  const { login, loginAsAdmin, state } = useStore();
  const nav = useNavigate();
  const [id, setId] = useState("");

  const submit = () => {
    const u = login(id);
    if (!u) { toast.error("No account found. Try a demo account below."); return; }
    toast.success(`Welcome back, ${u.name}`);
    nav(u.role === "admin" ? "/admin" : "/dashboard");
  };

  const adminLogin = () => {
    loginAsAdmin();
    toast.success("Logged in as Admin");
    nav("/admin");
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <Card className="p-8 shadow-elegant">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="text-muted-foreground text-sm mt-1">Agents and sub-agents only. Public buyers don't need to sign in.</p>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>Email or phone</Label>
            <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="kwame@example.com" />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" placeholder="••••••••" />
          </div>
          <Button className="w-full bg-gradient-primary" onClick={submit}>Sign in</Button>
        </div>
        <div className="my-6 border-t border-border" />
        <Button variant="outline" className="w-full" onClick={adminLogin}>
          <Shield className="h-4 w-4 mr-2" /> Sign in as Admin (demo)
        </Button>
        <div className="mt-6 text-sm text-muted-foreground">Demo agents:
          <ul className="mt-2 space-y-1">
            {state.users.filter((u) => u.role === "agent" || u.role === "subagent").slice(0, 4).map((u) => (
              <li key={u.id}><button className="text-primary hover:underline" onClick={() => setId(u.email)}>{u.email}</button> <span className="opacity-60">({u.role})</span></li>
            ))}
          </ul>
        </div>
        <div className="mt-6 text-center text-sm">
          New here? <Link to="/become-agent" className="text-primary font-medium hover:underline">Become an agent</Link>
        </div>
      </Card>
    </div>
  );
}