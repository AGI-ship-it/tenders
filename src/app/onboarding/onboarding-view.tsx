"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Fingerprint, Plus } from "lucide-react";
import { completeOnboarding, requestScan, setRole, useDemo } from "@/lib/store";
import type { Source } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { AiSourceTag, SignInDialog, SourceAccess, SourceStatusBadge } from "@/components/access";
import { AddSourceWizard } from "@/components/add-source-wizard";

/**
 * First-time setup, shown inside the normal app layout (top bar, step circles) with Scan Portal selected.
 * Connect portals here, then start scanning.
 */
export function OnboardingView() {
  const demo = useDemo()!;
  const router = useRouter();
  const [signIn, setSignIn] = useState<Source | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const sources = demo.sources.filter((s) => s.status !== "Paused");
  const connected = sources.filter((s) => s.status === "Connected").length;

  function finish() {
    // First-time setup is for the Bid Analyst; the HoD role is available from the profile menu.
    setRole("analyst");
    completeOnboarding();
    requestScan("discover");
    router.push("/sources");
  }

  return (
    <section className="overflow-hidden rounded-3xl bg-card shadow-soft">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b px-6 pt-5 pb-4">
        <div>
          <h2 className="text-base font-semibold">Connect your tender portals</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            The AI agent has found and connected these portals. Portals with a login or UAE PASS need you once.
          </p>
        </div>
        <Button variant="outline" onClick={() => setAddOpen(true)}>
          <Plus /> Add source
        </Button>
      </header>

      <ul className="divide-y">
        {sources.map((s) => (
          <li key={s.id} className="grid grid-cols-[1fr_auto_120px] items-center gap-4 px-6 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium">{s.name}</span>
              <AiSourceTag source={s} />
              {s.accessState === "Action needed" && (
                <Button size="xs" onClick={() => setSignIn(s)}>
                  <Fingerprint /> Sign in
                </Button>
              )}
            </div>
            <SourceAccess source={s} />
            <div className="flex justify-end">
              <SourceStatusBadge source={s} />
            </div>
          </li>
        ))}
      </ul>

      <footer className="flex items-center justify-between gap-3 border-t bg-muted/30 px-6 py-3">
        <span className="text-xs text-muted-foreground">
          {connected} of {sources.length} connected · anything not connected is skipped during scans
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" nativeButton={false} render={<Link href="/sources" />}>
            Skip for now
          </Button>
          <Button size="lg" onClick={finish}>
            Start scanning <ArrowRight />
          </Button>
        </div>
      </footer>

      <SignInDialog source={signIn} open={!!signIn} onOpenChange={(o) => !o && setSignIn(null)} />
      <AddSourceWizard open={addOpen} onOpenChange={setAddOpen} />
    </section>
  );
}
