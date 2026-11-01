"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, ChevronDown, KeyRound, Loader2, Mail, Radar, ShieldCheck, UserRound } from "lucide-react";
import { completeOnboarding, requestScan, setRole, useDemo } from "@/lib/store";
import { PEOPLE, SERVICE_LINES } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

/**
 * Two sign-ins, one per persona. The Bid Analyst lands on first-time setup until portals have been set up, then on
 * Scan Portal. An HoD picks which service line they head and lands on the prospects routed to them.
 * "Reset demo" in the profile menu replays first-time setup.
 */
export function WelcomeView() {
  const demo = useDemo()!;
  const router = useRouter();
  const analyst = PEOPLE.analyst;
  const [hodLine, setHodLine] = useState(demo?.hodLine ?? SERVICE_LINES[0].id);
  // Arriving from the "Review & decide" link in an HoD's email.
  const params = useSearchParams();
  const emailLine = params.get("from") === "email" ? SERVICE_LINES.find((l) => l.id === params.get("line")) : undefined;
  const emailProspect = demo.tenders.find((t) => t.id === params.get("prospect"));
  const [otherAccount, setOtherAccount] = useState(false);

  function signInAnalyst() {
    setRole("analyst");
    // Signing in always runs a scan. A fresh workspace discovers new prospects; after that, sign-in re-checks
    // portals and shows what's already tracked. (First-time setup can be replayed with Reset demo.)
    requestScan(demo.onboarded ? "checkin" : "discover");
    if (!demo.onboarded) completeOnboarding();
    router.push("/sources");
  }

  function signInHod() {
    setRole("approver", hodLine);
    router.push("/approvals");
  }

  if (emailLine && !otherAccount) {
    return (
      <EmailSignIn
        line={emailLine}
        prospectTitle={emailProspect?.title}
        onSignedIn={() => {
          setRole("approver", emailLine.id);
          const focus = emailProspect ? `&focus=${encodeURIComponent(emailProspect.id)}` : "";
          router.push(`/approvals?via=email${focus}`);
        }}
        onOtherAccount={() => setOtherAccount(true)}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex w-full flex-col items-center text-center"
      >
        <div className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md">
          <Radar className="size-6" />
        </div>
        <h1 className="mt-6 text-3xl font-bold text-primary tracking-tight sm:text-4xl">AGFS Tender Intelligence</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Scan tender portals every day, rank the prospects that fit, and prequalify them with service-line HoDs.
        </p>

        <div className="mt-10 grid w-full max-w-2xl gap-4 text-left sm:grid-cols-2">
          <LoginCard
            icon={<UserRound className="size-5" />}
            tone="bg-purple-100 text-purple-900"
            title="Bid Analyst"
            description="Scan portals, review AI pre-qualification and track every prospect in the register."
            footer={
              <p className="text-xs text-muted-foreground">
                Signs in as {analyst.name}
              </p>
            }
            onSignIn={signInAnalyst}
          />
          <LoginCard
            icon={<ShieldCheck className="size-5" />}
            tone="bg-pink-100 text-pink-800"
            title="Head of Department"
            description="Review the prospects routed to your service line and prequalify or reject them."
            footer={
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Sign in as</span>
                <span className="relative block">
                  <select
                    value={hodLine}
                    onChange={(e) => setHodLine(e.target.value)}
                    className="h-9 w-full cursor-pointer appearance-none rounded-lg border bg-card pr-9 pl-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    {SERVICE_LINES.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.hod} · HoD, {l.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
                </span>
              </label>
            }
            onSignIn={signInHod}
          />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Demo sign-in · no password needed</p>
      </motion.div>
    </div>
  );
}

function LoginCard({
  icon,
  tone,
  title,
  description,
  footer,
  onSignIn,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  description: string;
  footer: React.ReactNode;
  onSignIn: () => void;
}) {
  return (
    <div className="flex flex-col rounded-2xl bg-card p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}>{icon}</span>
        <h2 className="text-base font-bold text-primary">{title}</h2>
      </div>
      <p className="mt-3 flex-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4">{footer}</div>
      <Button size="xl" onClick={onSignIn} className="mt-4 w-full">
        Sign in <ArrowRight />
      </Button>
    </div>
  );
}

/**
 * Sign-in reached from the HoD's email: the account is already known, so it is one step with the work account.
 * The context strip reminds them why they are here.
 */
function EmailSignIn({
  line,
  prospectTitle,
  onSignedIn,
  onOtherAccount,
}: {
  line: (typeof SERVICE_LINES)[number];
  prospectTitle?: string;
  onSignedIn: () => void;
  onOtherAccount: () => void;
}) {
  const [busy, setBusy] = useState(false);
  function signIn() {
    setBusy(true);
    // Simulated single sign-on.
    window.setTimeout(onSignedIn, 1100);
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex w-full max-w-sm flex-col items-center text-center"
      >
        <div className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md">
          <Radar className="size-6" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-primary">Sign in to review</h1>
        <p className="mt-2 text-sm text-muted-foreground">AGFS Tender Intelligence</p>

        {prospectTitle && (
          <div className="mt-6 flex w-full items-start gap-3 rounded-xl bg-secondary px-4 py-3 text-left text-sm text-secondary-foreground">
            <Mail className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-semibold">From your email</div>
              <div className="truncate font-medium text-foreground">{prospectTitle}</div>
            </div>
          </div>
        )}

        <div className="mt-4 w-full rounded-2xl bg-card p-5 text-left shadow-soft">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-pink-100 text-sm font-semibold text-pink-800">
              {line.initials}
            </span>
            <div className="min-w-0 leading-tight">
              <div className="font-bold">{line.hod}</div>
              <div className="text-xs text-muted-foreground">HoD, {line.name}</div>
            </div>
          </div>
          <Button size="xl" className="mt-5 w-full" onClick={signIn} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="animate-spin" /> Signing in…
              </>
            ) : (
              <>
                <KeyRound /> Sign in with work account
              </>
            )}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">Single sign-on · no separate password</p>
        </div>

        <button onClick={onOtherAccount} className="mt-5 text-xs font-medium text-muted-foreground hover:text-primary hover:underline">
          Not {line.hod.split(" ")[0]}? Use another account
        </button>
      </motion.div>
    </div>
  );
}
