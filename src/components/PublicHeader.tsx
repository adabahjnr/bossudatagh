import { Link, NavLink } from "react-router-dom";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";
import { useStore } from "@/lib/store";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";

const links = [
  { to: "/", label: "Home" },
  { to: "/products", label: "Products" },
  { to: "/track", label: "Track Order" },
  { to: "/become-agent", label: "Become Agent" },
];

export function PublicHeader() {
  const { currentUser } = useStore();
  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Logo />
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-smooth ${
                  isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {currentUser ? (
            <Button asChild size="sm" className="hidden md:inline-flex">
              <Link to={currentUser.role === "admin" ? "/admin" : "/dashboard"}>Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="hidden md:inline-flex bg-gradient-primary hover:opacity-90">
                <Link to="/become-agent">Become Agent</Link>
              </Button>
            </>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <div className="mt-8 space-y-2">
                {links.map((l) => (
                  <NavLink key={l.to} to={l.to} end={l.to === "/"}
                    className={({ isActive }) =>
                      `block px-4 py-3 rounded-lg font-medium ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`
                    }>
                    {l.label}
                  </NavLink>
                ))}
                {currentUser ? (
                  <Link to={currentUser.role === "admin" ? "/admin" : "/dashboard"} className="block px-4 py-3 rounded-lg bg-gradient-primary text-primary-foreground font-medium text-center">
                    Dashboard
                  </Link>
                ) : (
                  <>
                    <Link to="/login" className="block px-4 py-3 rounded-lg hover:bg-muted">Sign in</Link>
                    <Link to="/become-agent" className="block px-4 py-3 rounded-lg bg-gradient-primary text-primary-foreground font-medium text-center">Become Agent</Link>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}