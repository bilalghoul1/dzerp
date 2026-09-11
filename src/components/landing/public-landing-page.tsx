"use client";

import * as React from "react";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingShowcase } from "@/components/landing/landing-showcase";
import { LandingModules } from "@/components/landing/landing-modules";
import { LandingWorkflow } from "@/components/landing/landing-workflow";
import { LandingTaxes } from "@/components/landing/landing-taxes";
import { LandingSecurity } from "@/components/landing/landing-security";
import { LandingDemo } from "@/components/landing/landing-demo";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { LandingSocial } from "@/components/landing/landing-social";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingFinalCta } from "@/components/landing/landing-final-cta";
import { LandingFooter } from "@/components/landing/landing-footer";
import { FloatingWhatsApp } from "@/components/landing/whatsapp-button";

export function PublicLandingPage() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((json) => {
        if (active) setIsAuthenticated(!!json?.data?.authenticated);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const isAuthed = isAuthenticated;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav isAuthed={isAuthed} />
      <main>
        <LandingHero isAuthed={isAuthed} />
        <LandingShowcase />
        <LandingWorkflow />
        <LandingModules />
        <LandingTaxes />
        <LandingDemo />
        <LandingSecurity />
        <LandingPricing isAuthed={isAuthed} />
        <LandingSocial />
        <LandingFaq />
        <LandingFinalCta isAuthed={isAuthed} />
      </main>
      <LandingFooter />
      <FloatingWhatsApp />
    </div>
  );
}