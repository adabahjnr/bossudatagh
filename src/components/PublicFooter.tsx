import { Link } from "react-router-dom";
import { Logo } from "./Logo";

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-muted/30 mt-20">
      <div className="container mx-auto px-4 py-12 grid gap-8 md:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground">Ghana's fastest data bundles & result checker platform. Built for everyone.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Products</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/products?network=MTN" className="hover:text-foreground">MTN Data</Link></li>
            <li><Link to="/products?network=Telecel" className="hover:text-foreground">Telecel Data</Link></li>
            <li><Link to="/products?network=AirtelTigo" className="hover:text-foreground">AirtelTigo Data</Link></li>
            <li><Link to="/products?tab=checkers" className="hover:text-foreground">Result Checkers</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Company</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/become-agent" className="hover:text-foreground">Become an Agent</Link></li>
            <li><Link to="/track" className="hover:text-foreground">Track Order</Link></li>
            <li><Link to="/login" className="hover:text-foreground">Agent Login</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Support</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>WhatsApp: tap the floating button</li>
            <li>Available 24/7</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} GetEasyData. All rights reserved.
      </div>
    </footer>
  );
}