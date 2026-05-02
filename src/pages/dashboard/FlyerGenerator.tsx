import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { Download, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

const formats = [
  { id: "whatsapp", name: "WhatsApp", w: 800, h: 800 },
  { id: "instagram", name: "Instagram Post", w: 1080, h: 1080 },
  { id: "story", name: "Story", w: 1080, h: 1920 },
] as const;

export default function FlyerGenerator() {
  const { currentUser } = useStore();
  const [storeName, setStoreName] = useState(currentUser?.storeBrand ?? "");
  const [promo, setPromo] = useState("Best data prices in town! 1GB @ ₵5");
  const [format, setFormat] = useState<typeof formats[number]>(formats[0]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = format.w; canvas.height = format.h;
    const ctx = canvas.getContext("2d")!;
    // gradient bg
    const grad = ctx.createLinearGradient(0, 0, format.w, format.h);
    grad.addColorStop(0, "#0f1f5c"); grad.addColorStop(0.6, "#1f3da8"); grad.addColorStop(1, "#2c4dc7");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, format.w, format.h);
    // gold circle
    ctx.fillStyle = "rgba(245, 180, 30, 0.18)";
    ctx.beginPath(); ctx.arc(format.w * 0.85, format.h * 0.15, format.w * 0.3, 0, Math.PI * 2); ctx.fill();
    // store name
    ctx.fillStyle = "#f5b41e"; ctx.font = `bold ${Math.floor(format.w / 16)}px sans-serif`;
    ctx.fillText(storeName || "My Store", format.w * 0.08, format.h * 0.18);
    // promo
    ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.floor(format.w / 22)}px sans-serif`;
    wrapText(ctx, promo, format.w * 0.08, format.h * 0.4, format.w * 0.85, format.w / 18);
    // CTA
    const ctaY = format.h * 0.78;
    ctx.fillStyle = "#f5b41e";
    ctx.fillRect(format.w * 0.08, ctaY, format.w * 0.55, format.w / 12);
    ctx.fillStyle = "#0f1f5c"; ctx.font = `bold ${Math.floor(format.w / 28)}px sans-serif`;
    ctx.fillText("Order on WhatsApp", format.w * 0.11, ctaY + format.w / 17);
    // footer
    ctx.fillStyle = "#fff"; ctx.font = `${Math.floor(format.w / 38)}px sans-serif`;
    ctx.fillText("Powered by GetEasyData", format.w * 0.08, format.h - format.w / 18);
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(" ");
    let line = "";
    for (const w of words) {
      const test = line + w + " ";
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y); line = w + " "; y += lineHeight;
      } else line = test;
    }
    ctx.fillText(line, x, y);
  };

  const generate = () => { draw(); toast.success("Flyer generated. Click download."); };

  const download = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `geteasydata-flyer-${format.id}.png`;
    a.click();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Flyer generator</h1>
        <p className="text-muted-foreground">Create branded flyers for WhatsApp, Instagram, and Stories.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 shadow-soft space-y-4">
          <div><Label>Store name</Label><Input value={storeName} onChange={(e) => setStoreName(e.target.value)} /></div>
          <div><Label>Promo text</Label><Input value={promo} onChange={(e) => setPromo(e.target.value)} /></div>
          <div>
            <Label>Format</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {formats.map((f) => (
                <button key={f.id} onClick={() => setFormat(f)}
                  className={`p-3 rounded-lg border text-sm ${format.id === f.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}>
                  {f.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 bg-gradient-primary" onClick={generate}><ImageIcon className="h-4 w-4 mr-1" /> Generate</Button>
            <Button variant="outline" onClick={download}><Download className="h-4 w-4 mr-1" /> Download</Button>
          </div>
        </Card>
        <Card className="p-4 shadow-soft bg-muted/40 grid place-items-center min-h-[300px]">
          <canvas ref={canvasRef} className="max-w-full max-h-[500px] rounded-lg shadow-elegant border border-border" />
        </Card>
      </div>
    </div>
  );
}