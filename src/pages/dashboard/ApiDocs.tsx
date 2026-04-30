import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const endpoints = [
  { method: "POST", path: "/api/v1/buy/data", desc: "Purchase a data bundle", body: `{ "package_id": "p1", "recipient": "0244000000" }` },
  { method: "POST", path: "/api/v1/buy/checker", desc: "Purchase a checker PIN", body: `{ "checker_id": "c1", "recipient": "0244000000" }` },
  { method: "GET", path: "/api/v1/balance", desc: "Get wallet balance", body: "" },
  { method: "GET", path: "/api/v1/orders/:ref", desc: "Verify transaction status", body: "" },
  { method: "GET", path: "/api/v1/pricing", desc: "List packages and prices", body: "" },
];

export default function ApiDocs() {
  const { currentUser, regenerateApiKey } = useStore();
  if (!currentUser) return null;

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copied"); };
  const rotate = () => {
    const k = regenerateApiKey(currentUser.id);
    toast.success("API key rotated"); copy(k);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">API & Documentation</h1>
        <p className="text-muted-foreground">Build external apps using your BossuData API key.</p>
      </div>

      <Card className="p-6 shadow-soft bg-gradient-primary text-primary-foreground">
        <div className="text-xs uppercase tracking-wider opacity-80">Your API key</div>
        <div className="mt-2 flex items-center gap-2 bg-white/10 rounded-lg p-3">
          <code className="text-sm flex-1 font-mono break-all">{currentUser.apiKey}</code>
          <Button size="icon" variant="ghost" className="hover:bg-white/20" onClick={() => copy(currentUser.apiKey ?? "")}><Copy className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="hover:bg-white/20" onClick={rotate}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        <div className="mt-3 text-xs opacity-80">Rate limit: 60 req/min · Keep this key secret.</div>
      </Card>

      <Card className="p-6 shadow-soft">
        <h3 className="font-semibold mb-3">Authentication</h3>
        <p className="text-sm text-muted-foreground">Send your API key in the Authorization header:</p>
        <pre className="mt-3 rounded-lg bg-muted p-4 text-xs overflow-x-auto">{`Authorization: Bearer ${currentUser.apiKey}`}</pre>
      </Card>

      <Card className="p-6 shadow-soft">
        <h3 className="font-semibold mb-4">Endpoints</h3>
        <div className="space-y-3">
          {endpoints.map((e) => (
            <div key={e.path} className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <Badge className={e.method === "GET" ? "bg-success" : "bg-primary"}>{e.method}</Badge>
                <code className="font-mono text-sm">{e.path}</code>
              </div>
              <div className="text-sm text-muted-foreground mt-2">{e.desc}</div>
              {e.body && <pre className="mt-2 rounded bg-muted p-3 text-xs overflow-x-auto">{e.body}</pre>}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 shadow-soft">
        <h3 className="font-semibold mb-3">Usage logs</h3>
        <p className="text-sm text-muted-foreground text-center py-6">No API calls yet. Logs will appear here once you start using the API.</p>
      </Card>
    </div>
  );
}