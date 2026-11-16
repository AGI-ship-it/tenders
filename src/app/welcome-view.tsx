"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, KeyRound, Loader2, Mail, Radar, ShieldCheck, Users, UserRound } from "lucide-react";
import { ensureReturningMailboxes, requestScan, resetDemo, setRole, useDemo } from "@/lib/store";
import { PEOPLE, SERVICE_LINES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * One sign-in per persona. The Bid Analyst lands on the inbox; the BD Head (VP Commercial) on the leads to decide; an
 * HoD on the requests the BD Head sent them.
 */
export function WelcomeView() {
  const demo = useDemo()!;
  const router = useRouter();
  const analyst = PEOPLE.analyst;
  const vp = PEOPLE.vp;
  // Arriving from the "Review & decide" link in VP Commercial's email.
  const params = useSearchParams();
  const fromEmail = params.get("from") === "email";
  const emailProspect = demo.tenders.find((t) => t.id === params.get("prospect"));
  const [otherAccount, setOtherAccount] = useState(false);

  /**
   * First time: a fresh start with no mailbox connected, so the first screen walks through connecting one or more.
   * Returning: the mailboxes are already connected, so signing in starts the AI's run straight away.
   */
  function signInAnalyst(firstTime: boolean) {
    if (firstTime) resetDemo();
    else ensureReturningMailboxes();
    setRole("analyst");
    requestScan("discover");
    router.push("/inbox");
  }

  function signInVp() {
    setRole("vp");
    router.push("/approvals");
  }

  // HoDs with a request from the BD Head waiting for them; the busiest one is preselected.
  const openFor = (name: string) => demo.tenders.filter((t) => t.status === "Awaiting HoD" && t.opsInput?.person === name).length;
  const busiest = [...SERVICE_LINES].sort((a, b) => openFor(b.opsHead) - openFor(a.opsHead))[0];
  const [hodLine, setHodLine] = useState(busiest.id);
  const hod = SERVICE_LINES.find((l) => l.id === hodLine) ?? busiest;

  function signInHod() {
    setRole("ops", hod.id);
    router.push("/approvals");
  }

  if (fromEmail && !otherAccount) {
    return (
      <EmailSignIn
        prospectTitle={emailProspect?.title}
        onSignedIn={() => {
          setRole("vp");
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

        <div className="mt-10 grid w-full max-w-4xl gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
          <LoginCard
            icon={<UserRound className="size-5" />}
            tone="bg-purple-100 text-purple-900"
            title="Bid Analyst"
            description="Review the lead drafts the AI prepared from the mailboxes and create each lead in D365."
            footer={<p className="text-xs text-muted-foreground">Signs in as {analyst.name}</p>}
            actions={
              <div className="mt-4 grid min-w-0 gap-2">
                <Button size="xl" onClick={() => signInAnalyst(false)} className="w-full">
                  Sign in <ArrowRight />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => signInAnalyst(true)}
                  className="w-full"
                  title="Starts the demo fresh, with no mailbox connected"
                >
                  <Mail /> First time? Connect mailboxes
                </Button>
              </div>
            }
          />
          <LoginCard
            icon={<ShieldCheck className="size-5" />}
            tone="bg-pink-100 text-pink-800"
            title="BD Head"
            description="Approve or reject each lead. Approving creates the D365 opportunity. Ask the service line's HoD first if needed."
            footer={<p className="text-xs text-muted-foreground">Signs in as {vp.name} · VP Commercial</p>}
            onSignIn={signInVp}
          />
          <LoginCard
            icon={<Users className="size-5" />}
            tone="bg-amber-100 text-amber-800"
            title="Head of Department"
            description={`When ${vp.name.split(" ")[0]} asks, say whether your service line is interested in bidding.`}
            footer={
              <div className="flex flex-wrap gap-1.5">
                {SERVICE_LINES.map((l) => {
                  const n = openFor(l.opsHead);
                  return (
                    <button
                      key={l.id}
                      onClick={() => setHodLine(l.id)}
                      title={`HoD, ${l.name}`}
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors",
                        hodLine === l.id
                          ? "bg-primary text-primary-foreground ring-primary"
                          : "bg-card text-muted-foreground ring-border hover:text-foreground",
                      )}
                    >
                      {l.opsHead.split(" ")[0]}
                      {n > 0 && (
                        <span
                          className={cn(
                            "tabular rounded-full px-1.5 text-[10px]",
                            hodLine === l.id ? "bg-white/20" : "bg-amber-100 text-amber-800",
                          )}
                        >
                          {n}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            }
            onSignIn={signInHod}
          />
        </div>
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
  actions,
  onSignIn,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  description: string;
  footer: React.ReactNode;
  /** Replaces the single Sign in button. */
  actions?: React.ReactNode;
  onSignIn?: () => void;
}) {
  return (
    <div className="flex flex-col rounded-2xl bg-card p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}>{icon}</span>
        <h2 className="text-base font-bold text-primary">{title}</h2>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4">{footer}</div>
      {actions ?? (
        <Button size="xl" onClick={onSignIn} className="mt-4 w-full">
          Sign in <ArrowRight />
        </Button>
      )}
    </div>
  );
}

/**
 * Sign-in reached from VP Commercial's email: the account is already known, so it is one step with the work account.
 * The context strip reminds them why they are here.
 */
function EmailSignIn({
  prospectTitle,
  onSignedIn,
  onOtherAccount,
}: {
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
              {PEOPLE.vp.initials}
            </span>
            <div className="min-w-0 leading-tight">
              <div className="font-bold">{PEOPLE.vp.name}</div>
              <div className="text-xs text-muted-foreground">{PEOPLE.vp.title}</div>
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
          Not {PEOPLE.vp.name.split(" ")[0]}? Use another account
        </button>
      </motion.div>
    </div>
  );
}
