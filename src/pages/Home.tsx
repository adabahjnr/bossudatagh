import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Shield, Wallet, Zap, Smartphone, Users, Star } from "lucide-react";

const products = [
  { title: "MTN Data", color: "from-yellow-400 to-yellow-600", icon: Smartphone, desc: "Fast MTN bundles, instant delivery", to: "/products?network=MTN" },
  { title: "Telecel Data", color: "from-red-500 to-red-700", icon: Smartphone, desc: "Affordable Telecel bundles", to: "/products?network=Telecel" },
  { title: "AirtelTigo Data", color: "from-blue-500 to-blue-700", icon: Smartphone, desc: "Smooth AirtelTigo offers", to: "/products?network=AirtelTigo" },
];

const testimonials = [
  { name: "Esi K.", text: "I bought data in 10 seconds. GetEasyData is the real deal.", role: "Customer" },
  { name: "Kojo M.", text: "Joined as agent and made back my ₵50 in 3 days. Wallet system is smooth.", role: "Agent" },
  { name: "Adwoa P.", text: "My mini-store runs itself. Customers buy and I earn — easiest setup ever.", role: "Sub-agent" },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero text-primary-foreground">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, hsl(43 90% 55% / 0.4), transparent 40%), radial-gradient(circle at 80% 80%, hsl(222 80% 60% / 0.4), transparent 40%)" }} />
        <div className="container mx-auto px-4 py-20 md:py-28 relative">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-4 py-1.5 text-sm font-medium border border-white/20 mb-6">
              <Star className="h-4 w-4 text-accent" /> Ghana's #1 data platform
            </span>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
              Buy Data Instantly. <br />
              <span className="text-gradient-gold">Earn as an Agent.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl opacity-90 max-w-2xl">
              Get MTN, Telecel & AirtelTigo bundles in seconds — or join thousands of agents earning daily with their own mini-store.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gradient-gold text-accent-foreground hover:opacity-90 shadow-gold">
                <Link to="/products">Buy data now <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-white/10 border-white/30 text-primary-foreground hover:bg-white/20">
                <Link to="/become-agent">Become an agent · ₵50</Link>
              </Button>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
              {[
                { v: "10K+", l: "Agents" },
                { v: "1M+", l: "Orders" },
                { v: "<10s", l: "Delivery" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="text-2xl md:text-3xl font-bold">{s.v}</div>
                  <div className="text-xs uppercase tracking-wider opacity-70">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Everything you need</h2>
          <p className="mt-3 text-muted-foreground">All major networks. One platform.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => {
            const Icon = p.icon;
            return (
              <Link key={p.title} to={p.to} className="group">
                <Card className="h-full p-6 transition-smooth hover:shadow-elegant hover:-translate-y-1 cursor-pointer">
                  <div className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${p.color} text-white shadow-soft mb-4`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-lg">{p.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{p.desc}</p>
                  <div className="mt-4 inline-flex items-center text-sm text-primary font-medium group-hover:gap-2 transition-all gap-1">
                    Browse <ArrowRight className="h-4 w-4" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Become Agent CTA */}
      <section className="container mx-auto px-4 py-16">
        <Card className="overflow-hidden bg-gradient-primary text-primary-foreground border-0 shadow-elegant">
          <div className="grid md:grid-cols-2 gap-8 p-8 md:p-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wider">
                <Wallet className="h-3 w-3" /> Earn daily
              </span>
              <h3 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">Become an Agent for just ₵50</h3>
              <p className="mt-3 opacity-90">Get your own branded mini-store, wallet, API access, and a referral system. Start earning the same day.</p>
              <Button asChild size="lg" className="mt-6 bg-gradient-gold text-accent-foreground hover:opacity-90 shadow-gold">
                <Link to="/become-agent">Get started <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Wallet, title: "Wallet system", desc: "Top up & sell instantly" },
                { icon: Users, title: "Sub-agents", desc: "Build your own team" },
                { icon: Shield, title: "Secure API", desc: "Build external tools" },
                { icon: Zap, title: "Mini-store", desc: "Your own brand page" },
              ].map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="rounded-xl bg-white/10 backdrop-blur p-4 border border-white/10">
                    <Icon className="h-5 w-5 text-accent mb-2" />
                    <div className="font-semibold">{f.title}</div>
                    <div className="text-xs opacity-80">{f.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </section>

      {/* Track */}
      <section className="container mx-auto px-4 py-16">
        <Card className="p-8 md:p-12 text-center shadow-soft">
          <h3 className="text-2xl md:text-3xl font-bold">Need to track an order?</h3>
          <p className="mt-2 text-muted-foreground">Enter your reference and phone number to see live status.</p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/track">Track my order <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </Card>
      </section>

      {/* Testimonials */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-10">Loved by thousands</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <Card key={t.name} className="p-6 shadow-soft">
              <div className="flex gap-1 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                ))}
              </div>
              <p className="text-sm">{t.text}</p>
              <div className="mt-4 text-sm font-semibold">{t.name}</div>
              <div className="text-xs text-muted-foreground">{t.role}</div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}