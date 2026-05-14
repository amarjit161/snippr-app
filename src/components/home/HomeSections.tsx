import heroImage from "@/assets/salon-1.jpg";
import salon2 from "@/assets/salon-2.jpg";
import salon3 from "@/assets/salon-3.jpg";
import salon4 from "@/assets/salon-4.jpg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ComponentType } from "react";
import {
  BadgeCheck,
  Clock3,
  MapPin,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  UserRoundCheck,
  WandSparkles,
} from "lucide-react";

type HeroSectionProps = {
  onFindSalon: () => void;
  onOwnerSignup: () => void;
};

type ServiceItem = {
  title: string;
  icon: ComponentType<{ className?: string }>;
};

type SalonItem = {
  name: string;
  rating: string;
  wait: string;
  location: string;
  image: string;
};

type QueueItem = {
  salon: string;
  status: "Available" | "Busy" | "Full";
  eta: string;
};

const services: ServiceItem[] = [
  { title: "Haircut", icon: Scissors },
  { title: "Beard Trim", icon: UserRoundCheck },
  { title: "Facial", icon: Sparkles },
  { title: "Hair Spa", icon: WandSparkles },
  { title: "Groom Package", icon: BadgeCheck },
  { title: "Bridal Styling", icon: Star },
];

const topSalons: SalonItem[] = [
  { name: "Trim Theory Studio", rating: "4.9", wait: "12 min", location: "Sector 22", image: salon2 },
  { name: "Fade District", rating: "4.8", wait: "18 min", location: "Model Town", image: salon3 },
  { name: "Velvet Blades", rating: "4.7", wait: "9 min", location: "Civil Lines", image: salon4 },
];

const queueStatuses: QueueItem[] = [
  { salon: "Trim Theory Studio", status: "Available", eta: "5-10 min" },
  { salon: "Fade District", status: "Busy", eta: "20-30 min" },
  { salon: "Velvet Blades", status: "Full", eta: "40-50 min" },
];

const testimonials = [
  {
    name: "Riya Kapoor",
    text: "Joined queue before leaving office and got seated in 7 minutes. This feels like quick-commerce for grooming.",
    rating: 5,
  },
  {
    name: "Harsh Mehta",
    text: "The live ETA is shockingly accurate. No more waiting at salons with no clue when my turn comes.",
    rating: 5,
  },
  {
    name: "Anaya Singh",
    text: "Booked for my dad and tracked his queue remotely. Smooth UX and super fast updates.",
    rating: 4,
  },
];

if (import.meta.env.DEV) {
  console.log("HOME DATA:", {
    services: services.length,
    topSalons: topSalons.length,
    queueStatuses: queueStatuses.length,
    testimonials: testimonials.length,
  });
}

const queueBadgeClass: Record<QueueItem["status"], string> = {
  Available: "bg-emerald-500 text-white",
  Busy: "bg-amber-400 text-amber-950",
  Full: "bg-rose-500 text-white",
};

export function HeroSection({ onFindSalon, onOwnerSignup }: HeroSectionProps) {
  return (
    <section className="hero-section relative min-h-[86vh] overflow-hidden">
      <img
        src={heroImage}
        alt="Modern salon interior"
        className="hero-bg absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-foreground/90 via-foreground/70 to-primary/35" />

      <div className="container relative z-10 mx-auto flex min-h-[86vh] max-w-7xl items-center px-6 py-20">
        <div className="max-w-3xl text-white">
          <span className="hero-reveal mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-xl">
            <Sparkles className="h-4 w-4" /> AI Queueing For Modern Salons
          </span>
          <h1 className="hero-reveal text-balance text-4xl font-extrabold tracking-tight md:text-6xl">
            Book Smart. Walk In Right.
            <span className="block bg-gradient-to-r from-primary via-emerald-300 to-cyan-200 bg-clip-text text-transparent">
              Skip The Queue Drama.
            </span>
          </h1>
          <p className="hero-reveal mt-6 max-w-2xl text-lg text-slate-200 md:text-xl">
            Discover top-rated salons, check real-time rush, and join live queues in one tap.
            Inspired by the speed of food-delivery apps, built for self-care.
          </p>
          <div className="hero-reveal mt-8 flex flex-col gap-4 sm:flex-row">
            <Button size="lg" onClick={onFindSalon} className="h-12 rounded-xl px-8 text-base shadow-xl opacity-100">
              <Search className="mr-2 h-5 w-5" /> Find a Salon
            </Button>
            <Button
              size="lg"
              onClick={onOwnerSignup}
              className="h-12 rounded-xl border border-slate-200 bg-white px-8 text-base text-black shadow-xl hover:bg-slate-100 opacity-100"
            >
              <Scissors className="mr-2 h-5 w-5" /> I&apos;m a Salon Owner
            </Button>
          </div>
          <div className="hero-reveal mt-10 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-md">
              <p className="text-xl font-bold">500+</p>
              <p className="text-xs text-slate-200">Partner Salons</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-md">
              <p className="text-xl font-bold">4.8/5</p>
              <p className="text-xs text-slate-200">Avg Experience</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-md">
              <p className="text-xl font-bold">-42%</p>
              <p className="text-xs text-slate-200">Wait Time Cut</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function BrowseByServicesSection() {
  return (
    <section className="reveal-up py-14 md:py-20">
      <div className="container mx-auto max-w-7xl px-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Discover</p>
            <h2 className="text-2xl font-bold md:text-3xl">Browse by Services</h2>
          </div>
        </div>

        <div className="stagger-cards scrollbar-hide flex gap-6 overflow-x-auto pb-4 scroll-smooth snap-x">
          {services.length > 0 ? services.map((service) => {
            const Icon = service.icon;
            return (
              <article
                key={service.title}
                className="stagger-item group min-w-[250px] snap-start rounded-2xl border border-border bg-white p-5 shadow-md opacity-100 transition-all duration-300 hover:scale-105 hover:shadow-xl"
              >
                <div className="mb-4 inline-flex rounded-xl bg-primary/15 p-3 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold">{service.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">Verified stylists and transparent wait estimates.</p>
              </article>
            );
          }) : <p className="text-gray-400">No data available</p>}
        </div>
      </div>
    </section>
  );
}

export function TopRatedSalonsSection() {
  return (
    <section className="reveal-up py-14 md:py-20">
      <div className="container mx-auto max-w-7xl px-6">
        <h2 className="mb-8 text-2xl font-bold md:text-3xl">Top Rated Salons</h2>

        <div className="stagger-cards grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {topSalons.length > 0 ? topSalons.map((salon) => (
            <article
              key={salon.name}
              className="stagger-item overflow-hidden rounded-2xl border border-border bg-white shadow-md opacity-100 transition-all duration-300 hover:scale-105 hover:shadow-xl"
            >
              <img src={salon.image} alt={salon.name} className="h-48 w-full object-cover" />
              <div className="space-y-3 p-5">
                <h3 className="text-lg font-semibold">{salon.name}</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-1 text-amber-500">
                    <Star className="h-4 w-4 fill-current" /> {salon.rating}
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Clock3 className="h-4 w-4" /> {salon.wait}
                  </span>
                </div>
                <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {salon.location}
                </p>
              </div>
            </article>
          )) : <p className="text-gray-400">No data available</p>}
        </div>
      </div>
    </section>
  );
}

export function LiveQueueStatusSection() {
  return (
    <section className="reveal-up py-14 md:py-20">
      <div className="container mx-auto max-w-7xl rounded-2xl border border-border bg-white p-6 px-6 shadow-md md:p-8">
        <h2 className="mb-6 text-2xl font-bold md:text-3xl">Live Queue Status</h2>
        <div className="stagger-cards grid gap-4 md:grid-cols-3">
          {queueStatuses.length > 0 ? queueStatuses.map((queue) => (
            <article key={queue.salon} className="stagger-item rounded-2xl border border-border bg-white p-4 shadow-md opacity-100 transition-all duration-300 hover:shadow-xl">
              <p className="font-semibold">{queue.salon}</p>
              <div className="mt-3 flex items-center justify-between">
                <Badge className={queueBadgeClass[queue.status]}>{queue.status}</Badge>
                <span className="text-sm text-muted-foreground">ETA: {queue.eta}</span>
              </div>
            </article>
          )) : <p className="text-gray-400">No data available</p>}
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  const steps = [
    {
      icon: Search,
      title: "Find nearby salons",
      text: "Browse verified salons with transparent ratings and queue speed.",
    },
    {
      icon: Clock3,
      title: "Join live queue",
      text: "Choose your service and lock your spot in the queue instantly.",
    },
    {
      icon: UserRoundCheck,
      title: "Walk in on time",
      text: "Get updates until your turn is close, then walk in without waiting.",
    },
  ];

  return (
    <section className="reveal-up py-14 md:py-20">
      <div className="container mx-auto max-w-7xl px-6">
        <h2 className="mb-8 text-2xl font-bold md:text-3xl">How It Works</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.title} className="how-step rounded-2xl border border-border bg-white p-6 shadow-md opacity-100 transition-all duration-300 hover:shadow-xl">
                <div className="mb-4 inline-flex rounded-xl bg-primary/15 p-3 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function TestimonialsSection() {
  return (
    <section className="reveal-up py-14 md:py-20">
      <div className="container mx-auto max-w-7xl px-6">
        <h2 className="mb-8 text-2xl font-bold md:text-3xl">What Customers Say</h2>
        <div className="stagger-cards grid gap-6 md:grid-cols-3">
          {testimonials.length > 0 ? testimonials.map((review) => (
            <article key={review.name} className="stagger-item rounded-2xl border border-border bg-white p-6 shadow-md opacity-100 transition-all duration-300 hover:shadow-xl">
              <div className="mb-4 flex items-center gap-1 text-amber-500">
                {Array.from({ length: review.rating }).map((_, index) => (
                  <Star key={`${review.name}-${index}`} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="text-sm leading-6 text-muted-foreground">“{review.text}”</p>
              <p className="mt-4 font-semibold">{review.name}</p>
            </article>
          )) : <p className="text-gray-400">No data available</p>}
        </div>
      </div>
    </section>
  );
}

export function FinalCtaSection({ onJoin }: { onJoin: () => void }) {
  return (
    <section className="reveal-up pb-20 pt-12 md:pt-16">
      <div className="container mx-auto max-w-7xl px-6">
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary to-emerald-500 p-8 text-center shadow-xl md:p-14">
          <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-white" />
          <h2 className="text-3xl font-extrabold text-white md:text-5xl">Your Chair Is A Tap Away</h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/90">
            Stop waiting in crowded lobbies. Join your next salon queue from anywhere.
          </p>
          <Button
            size="lg"
            onClick={onJoin}
            className="mt-8 rounded-xl border border-white/40 bg-white px-8 text-black shadow-xl hover:bg-slate-100 opacity-100"
          >
            Join Queue Now
          </Button>
        </div>
      </div>
    </section>
  );
}

