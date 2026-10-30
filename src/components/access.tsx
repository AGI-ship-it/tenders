"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, CheckCircle2, FileUp, Fingerprint, Sparkles, Globe, KeyRound, Loader2, ScanFace, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { authoriseSource } from "@/lib/store";
import { PEOPLE } from "@/lib/mock-data";
import type { AccessType, Source } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const ACCESS_INFO: Record<AccessType, { icon: typeof Globe; label: string; how: string }> = {
  Public: {
    icon: Globe,
    label: "Public",
    how: "No sign-in. The agent reads public notices automatically.",
  },
  Password: {
    icon: KeyRound,
    label: "Password",
    how: "Stored once in a credential vault. The agent uses it without seeing it.",
  },
  "UAE PASS": {
    icon: Fingerprint,
    label: "UAE PASS",
    how: "Personal digital ID. A named person approves sign-in on their phone; the agent never signs in alone.",
  },
  CAPTCHA: {
    icon: ScanFace,
    label: "CAPTCHA",
    how: "The agent does not solve CAPTCHAs. It uses the portal's email alerts and hands notices to a person.",
  },
};

export function AccessBadge({ source }: { source: Source }) {
  const info = ACCESS_INFO[source.access];
  const needs = source.accessState === "Action needed";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "inline-flex cursor-help items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
              needs ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-muted/60 text-foreground/80 ring-border",
            )}
          />
        }
      >
        <info.icon className="size-3.5" />
        {info.label}
        {needs && <span className="text-amber-700">· sign-in needed</span>}
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{info.how}</TooltipContent>
    </Tooltip>
  );
}

/** Simulated human-in-the-loop sign-in. Nothing is sent anywhere. */
export function SignInDialog({
  source,
  open,
  onOpenChange,
}: {
  source: Source | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [phase, setPhase] = useState<"form" | "waiting" | "otp" | "done">("form");
  const [user, setUser] = useState("");

  function close(o: boolean) {
    onOpenChange(o);
    if (!o) window.setTimeout(() => setPhase("form"), 200);
  }

  function finish() {
    if (!source) return;
    authoriseSource(source.id);
    setPhase("done");
    toast.success(`${source.name} ready to scan`, { description: "Simulated sign-in recorded in audit trail." });
  }

  function start() {
    if (source?.access === "UAE PASS") {
      setPhase("waiting");
      window.setTimeout(finish, 2600);
    } else {
      // Password portals then ask for their own second factor.
      setPhase("otp");
    }
  }

  if (!source) return null;
  const uaePass = source.access === "UAE PASS";

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{uaePass ? "Approve with UAE PASS" : "Sign in to portal"}</DialogTitle>
          <DialogDescription>
            {source.name}. Simulated: no request is sent and nothing is stored.
          </DialogDescription>
        </DialogHeader>

        {phase === "form" &&
          (uaePass ? (
            <div className="space-y-3 text-sm">
              <div className="flex gap-3 rounded-lg border bg-muted/30 p-3">
                <Smartphone className="mt-0.5 size-5 shrink-0 text-primary" />
                <p className="text-muted-foreground">
                  A sign-in request goes to <span className="font-medium text-foreground">{PEOPLE.analyst.name}</span>
                  ’s UAE PASS app. Once approved, the agent can scan this portal until the session expires.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="u">Portal username</Label>
                <Input id="u" placeholder="agfs.bidding" value={user} onChange={(e) => setUser(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p">Password</Label>
                <Input id="p" type="password" placeholder="••••••••" autoComplete="off" />
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5" /> Goes to the credential vault. The agent never sees it.
              </p>
            </div>
          ))}

        {phase === "waiting" && (
          <div className="flex flex-col items-center py-6 text-center">
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
              className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"
            >
              <Fingerprint className="size-7" />
            </motion.div>
            <p className="mt-4 text-sm font-medium">Waiting for approval on phone…</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Simulated. Approves automatically in a moment.
            </p>
          </div>
        )}

        {phase === "otp" && <PortalOtp portal={source.name} onVerified={finish} />}

        {phase === "done" && (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="size-10 text-emerald-600" />
            <p className="mt-3 text-sm font-medium">Connected. Included in the next scan.</p>
          </div>
        )}

        <DialogFooter>
          {phase === "form" && (
            <>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button onClick={start} disabled={!uaePass && !user.trim()}>
                {uaePass ? (
                  <>
                    <Fingerprint /> Send request
                  </>
                ) : (
                  <>
                    <KeyRound /> Sign in
                  </>
                )}
              </Button>
            </>
          )}
          {phase === "otp" && (
            <Button variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
          )}
          {phase === "done" && <Button onClick={() => close(false)}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const SOURCE_STATUS_STYLE: Record<Source["status"], string> = {
  Connected: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Needs attention": "bg-amber-50 text-amber-800 ring-amber-200",
  Paused: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

/** Source connection status, as shown on Scan Portal and in first-time setup. The note shows on hover. */
export function SourceStatusBadge({ source }: { source: Source }) {
  return (
    <span
      title={source.statusNote}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        source.statusNote && "cursor-help",
        SOURCE_STATUS_STYLE[source.status],
      )}
    >
      {source.status === "Needs attention" ? (
        <AlertTriangle className="size-3" />
      ) : (
        <span className="size-1.5 rounded-full bg-current" />
      )}
      {source.status}
    </span>
  );
}

/** Access type for a portal, or "File upload" for uploaded RFP files. */
export function SourceAccess({ source }: { source: Source }) {
  if (source.kind === "Upload") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-0.5 text-xs font-medium ring-1 ring-border ring-inset">
        <FileUp className="size-3.5" /> File upload
      </span>
    );
  }
  return <AccessBadge source={source} />;
}

/** Marks a source the AI agent found and connected itself. */
export function AiSourceTag({ source }: { source: Source }) {
  if (source.addedBy !== "ai") return null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex shrink-0 cursor-help items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary" />
        }
      >
        <Sparkles className="size-3" /> AI
      </TooltipTrigger>
      <TooltipContent className="max-w-60">
        Found and connected by the AI agent from AGFS tender history and known buyer portals (simulated).
      </TooltipContent>
    </Tooltip>
  );
}

const DEMO_OTP = "482913";

/**
 * The portal's own second-factor prompt after a password sign-in (simulated). Any 6 digits verify.
 * In production the agent asks the named person for a code whenever the portal requires one.
 */
export function PortalOtp({ portal, onVerified }: { portal: string; onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  function verify() {
    setBusy(true);
    window.setTimeout(onVerified, 700);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3 text-sm">
        <Smartphone className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <div className="font-medium">Verification required by {portal}</div>
          <p className="text-xs text-muted-foreground">The portal sent a 6-digit code to +971 •• ••• 4821.</p>
        </div>
      </div>
      <Input
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="••••••"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        className="tabular h-11 bg-card text-center text-lg tracking-[0.5em]"
        aria-label="Portal verification code"
      />
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setCode(DEMO_OTP)} className="text-xs font-medium text-primary hover:underline">
          Use demo code
        </button>
        <Button size="sm" disabled={code.length !== 6 || busy} onClick={verify}>
          {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Verify
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        When the portal asks for a code again, the agent asks {PEOPLE.analyst.name} rather than signing in alone.
      </p>
    </div>
  );
}
