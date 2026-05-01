import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function Login() {
  const { signIn, resetPassword, user, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgot, setForgot] = useState(false);

  useEffect(() => {
    if (!loading && user) nav(isAdmin ? "/admin" : "/dashboard", { replace: true });
  }, [loading, user, isAdmin, nav]);

  const submit = async () => {
    if (!email || !password) return toast.error("Enter your email and password");
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) return toast.error(error);
    toast.success("Welcome back");
  };

  const sendReset = async () => {
    if (!email) return toast.error("Enter your email above first");
    const { error } = await resetPassword(email);
    if (error) return toast.error(error);
    toast.success("Check your email for a reset link");
    setForgot(false);
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <Card className="p-8 shadow-elegant">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Agents and admins only. Public buyers don't need to sign in.
        </p>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          {!forgot && (
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>
          )}
          {forgot ? (
            <>
              <Button className="w-full bg-gradient-primary" onClick={sendReset}>
                Send reset link
              </Button>
              <button className="text-sm text-muted-foreground hover:text-foreground w-full text-center" onClick={() => setForgot(false)}>
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <Button className="w-full bg-gradient-primary" disabled={submitting} onClick={submit}>
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
              <button className="text-sm text-primary hover:underline w-full text-center" onClick={() => setForgot(true)}>
                Forgot password?
              </button>
            </>
          )}
        </div>
        <div className="mt-6 text-center text-sm">
          New here?{" "}
          <Link to="/become-agent" className="text-primary font-medium hover:underline">
            Become an agent
          </Link>
        </div>
      </Card>
    </div>
  );
}