import { Zap } from "lucide-react";
import { Link } from "react-router-dom";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-bold text-lg ${className}`}>
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-foreground text-background shadow-elegant ring-1 ring-primary/40">
        <Zap className="h-5 w-5 text-accent" fill="currentColor" />
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
      </span>
      <span className="tracking-tight">
        Bossu<span className="text-gradient-gold">Data</span>
      </span>
    </Link>
  );
}