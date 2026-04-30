import { Zap } from "lucide-react";
import { Link } from "react-router-dom";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-bold text-lg ${className}`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
        <Zap className="h-5 w-5" />
      </span>
      <span className="tracking-tight">
        Bossu<span className="text-gradient-gold">Data</span>
      </span>
    </Link>
  );
}