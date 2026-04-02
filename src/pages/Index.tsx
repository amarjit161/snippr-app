import { CalendarCheck2, Clock3, Scissors, ShieldCheck, Star, Users2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Clock3,
      title: "Live Queue Tracking",
      text: "See wait times in real time and get notified before your turn.",
    },
    {
      icon: CalendarCheck2,
      title: "Smart Booking",
      text: "Book preferred slots faster with a smooth, no-call flow.",
    },
    {
      icon: Users2,
      title: "Staff Management",
      text: "Assign barbers, monitor load, and run operations in one view.",
    },
  ];

  const steps = [
    {
      count: "01",
      title: "Pick a salon",
      text: "Browse verified salons and compare queue times instantly.",
    },
    {
      count: "02",
      title: "Join or schedule",
      text: "Join the live queue or reserve a slot that works for you.",
    },
    {
      count: "03",
      title: "Arrive on time",
      text: "Get timely updates so you walk in exactly when needed.",
    },
  ];

  const testimonials = [
    {
      quote: "Snippr reduced our walk-out rate by 31% in three weeks.",
      name: "Rohit Sharma",
      role: "Owner, Fade District",
    },
    {
      quote: "No more waiting outside. I join the queue and show up at the right time.",
      name: "Sana Khan",
      role: "Customer",
    },
    {
      quote: "The dashboard is clean and staff assignment is finally effortless.",
      name: "Nabeel Ahmed",
      role: "Manager, Trim & Tone",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(79,55,138,0.22),_transparent_38%),radial-gradient(circle_at_85%_20%,_rgba(171,53,0,0.18),_transparent_42%)]" />
        <div className="container relative">
          <header className="flex items-center justify-between py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-elevation-2">
                <Scissors className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display text-xl font-bold tracking-tight">Snippr</p>
                <p className="text-xs text-muted-foreground">Premium Salon Queue Platform</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={() => navigate("/owner-login")}>Owner Login</Button>
              <Button variant="outline" onClick={() => navigate("/owner-register")}>Owner Signup</Button>
              <Button onClick={() => navigate("/login?role=customer")}>Get Started</Button>
            </div>
          </header>

          <section className="grid items-center gap-10 pb-14 pt-8 md:grid-cols-2 md:pb-20 md:pt-12">
            <div className="space-y-6">
              <span className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                Skip the wait at premium salons
              </span>
              <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-6xl">
                Skip the wait
                <span className="block text-primary">at premium salons.</span>
              </h1>
              <p className="max-w-xl text-base text-muted-foreground md:text-lg">
                Precision in every second. Real-time queue tracking, smarter bookings,
                and staff flow built for modern salons.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" className="rounded-xl px-7" onClick={() => navigate("/login?role=customer")}>Join Queue</Button>
                <Button size="lg" variant="outline" className="rounded-xl px-7" onClick={() => navigate("/login")}>Login</Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Salon owner? <button className="font-semibold text-primary underline-offset-4 hover:underline" onClick={() => navigate("/owner-login")}>Login</button> or <button className="font-semibold text-primary underline-offset-4 hover:underline" onClick={() => navigate("/owner-register")}>create your salon account</button>.
              </p>
            </div>

            <Card className="rounded-3xl bg-white/80 backdrop-blur shadow-elevation-3">
              <CardContent className="p-6">
                <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/85 p-4 text-primary-foreground">
                  <p className="text-sm/none text-primary-foreground/80">Live Now</p>
                  <p className="font-display text-3xl font-bold">Token A-27</p>
                  <p className="mt-2 text-sm text-primary-foreground/85">Estimated wait at Luxe Studio</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-muted/60 p-4">
                    <p className="text-xs text-muted-foreground">Active Queues</p>
                    <p className="font-display text-2xl font-bold">18</p>
                  </div>
                  <div className="rounded-xl bg-muted/60 p-4">
                    <p className="text-xs text-muted-foreground">Daily Bookings</p>
                    <p className="font-display text-2xl font-bold">142</p>
                  </div>
                </div>
                <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Secure sign-in and verified salon listings.
                </p>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      <section className="container py-10 md:py-14">
        <div className="mb-7 flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-bold md:text-3xl">Explore Salons</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="group rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-elevation-3">
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex rounded-xl bg-secondary p-3 transition-transform duration-300 group-hover:scale-110">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.text}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="bg-secondary/30 py-12 md:py-16">
        <div className="container">
          <h2 className="font-display text-2xl font-bold md:text-3xl">How It Works</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <Card key={step.count} className="rounded-2xl shadow-sm">
                <CardContent className="p-6">
                  <p className="font-display text-4xl font-extrabold text-primary/30">{step.count}</p>
                  <h3 className="mt-3 font-display text-xl font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-12 md:py-16">
          <h2 className="font-display text-2xl font-bold md:text-3xl">Ready to cut the queue?</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {testimonials.map((item) => (
            <Card key={item.name} className="rounded-2xl">
              <CardContent className="p-6">
                <div className="mb-3 flex items-center gap-1 text-warning">
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">"{item.quote}"</p>
                <p className="mt-4 font-semibold">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.role}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="bg-card/40">
        <div className="container flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">© 2026 Snippr. Built for modern salons.</p>
          <div className="flex gap-5 text-sm text-muted-foreground">
            <button className="transition-colors hover:text-foreground">Privacy</button>
            <button className="transition-colors hover:text-foreground">Terms</button>
            <button className="transition-colors hover:text-foreground">Support</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
