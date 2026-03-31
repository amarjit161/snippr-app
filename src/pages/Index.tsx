import { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import {
  BrowseByServicesSection,
  FinalCtaSection,
  HeroSection,
  HowItWorksSection,
  LiveQueueStatusSection,
  TestimonialsSection,
  TopRatedSalonsSection,
} from "@/components/home/HomeSections";

gsap.registerPlugin(ScrollTrigger);

const Index = () => {
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".hero-reveal", {
        opacity: 0,
        y: 34,
        duration: 0.9,
        stagger: 0.12,
        ease: "power3.out",
      });

      gsap.to(".hero-bg", {
        yPercent: 15,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero-section",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      gsap.utils.toArray<HTMLElement>(".reveal-up").forEach((section) => {
        gsap.from(section, {
          y: 40,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: {
            trigger: section,
            start: "top 82%",
          },
        });
      });

      gsap.utils.toArray<HTMLElement>(".stagger-cards").forEach((container) => {
        const items = container.querySelectorAll(".stagger-item");
        if (items.length === 0) return;

        gsap.from(items, {
          y: 28,
          duration: 0.7,
          stagger: 0.1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: container,
            start: "top 85%",
          },
        });
      });

      gsap.from(".how-step", {
        y: 26,
        duration: 0.7,
        stagger: 0.14,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".how-step",
          start: "top 86%",
        },
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="min-h-screen bg-background pb-4">
      <Header />
      <HeroSection
        onFindSalon={() => navigate("/auth?role=customer")}
        onOwnerSignup={() => navigate("/auth?role=owner")}
      />
      <BrowseByServicesSection />
      <TopRatedSalonsSection />
      <LiveQueueStatusSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <FinalCtaSection onJoin={() => navigate("/auth?role=customer")} />
    </div>
  );
};

export default Index;
