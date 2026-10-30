"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, Radar } from "lucide-react";
import { completeOnboarding, requestScan, setRole, useDemo } from "@/lib/store";
import { PEOPLE } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

/**
 * Single sign-in. The app decides where to land: first-time setup until portals have been set up,
 * Scan Portal after that. "Reset demo" in the profile menu replays first-time setup.
 */
export function WelcomeView() {
  const demo = useDemo()!;
  const router = useRouter();
  const analyst = PEOPLE.analyst;

  function signIn() {
    setRole("analyst");
    // Signing in always runs a scan. A fresh workspace discovers new prospects; after that, sign-in re-checks
    // portals and shows what's already tracked. (First-time setup can be replayed with Reset demo.)
    requestScan(demo.onboarded ? "checkin" : "discover");
    if (!demo.onboarded) completeOnboarding();
    router.push("/sources");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center text-center"
      >
        <div className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md">
          <Radar className="size-6" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">AGFS Tender Intelligence</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Scan tender portals every day, rank the prospects that fit, and prequalify them with service-line HoDs.
        </p>

        <Button
          size="lg"
          onClick={signIn}
          className="mt-10 h-12 gap-2 rounded-xl px-8 text-[15px] shadow-md shadow-primary/20 [&_svg:not([class*='size-'])]:size-[18px]"
        >
          Sign in <ArrowRight />
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Demo: signs in as {analyst.name} · {analyst.title}
        </p>
      </motion.div>
    </div>
  );
}
