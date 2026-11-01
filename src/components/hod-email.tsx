"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { KeyRound, Loader2, Mail, X } from "lucide-react";
import { setRole, useDemo } from "@/lib/store";
import { aiPrequalified } from "@/lib/scoring";
import { formatDate, formatDateTime, formatTime, formatValue, isToday } from "@/lib/format";
import { serviceLineFor } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PrequalBadge } from "@/components/shared";

/** Days an HoD has to decide; shown in the email as "Decision needed by". */
const DECISION_SLA_DAYS = 3;

// Which prospect's HoD email is being previewed. A tiny store so any screen can open it.
let previewId: string | null = null;
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

/** Open the simulated email the HoD receives for this prospect. */
export function openHodEmail(tenderId: string) {
  previewId = tenderId;
  emit();
}

function closeHodEmail() {
  previewId = null;
  emit();
}

function usePreviewId() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => previewId,
    () => null,
  );
}

/**
 * The email an HoD gets when a prospect is routed to them, shown as a simulated Outlook window.
 * "Review & decide" signs in as that HoD and opens the prospect in the Approval Center.
 */
export function HodEmailHost() {
  const id = usePreviewId();
  const demo = useDemo();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);
  const tender = demo?.tenders.find((t) => t.id === id);
  if (!demo) return null;

  const line = tender ? serviceLineFor(tender.category) : null;
  const others = tender
    ? demo.tenders.filter(
        (t) => t.id !== tender.id && t.status === "Awaiting HoD" && line?.categories.includes(t.category),
      ).length
    : 0;
  const sentAt = tender?.approval?.submittedAt ?? new Date(0).toISOString();
  const dueBy = new Date(new Date(sentAt).getTime() + DECISION_SLA_DAYS * 86_400_000).toISOString();

  function reviewAndDecide() {
    if (!tender || !line) return;
    setSigningIn(true);
    // Simulated single sign-on, then straight to the prospect.
    window.setTimeout(() => {
      setRole("approver", line.id);
      closeHodEmail();
      setSigningIn(false);
      router.push(`/approvals?id=${encodeURIComponent(tender.id)}&via=email`);
    }, 1400);
  }

  return (
    <Dialog
      open={!!tender}
      onOpenChange={(o) => {
        if (!o && !signingIn) closeHodEmail();
      }}
    >
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogTitle className="sr-only">Email to {line?.hod}</DialogTitle>
        {/* Window chrome */}
        <div className="flex items-center gap-2 bg-[#0f4c81] px-4 py-2.5 text-white">
          <Mail className="size-4" />
          <span className="text-sm font-semibold">Inbox · {line?.hod}</span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">Simulated email</span>
          <button
            aria-label="Close email"
            onClick={closeHodEmail}
            disabled={signingIn}
            className="ml-auto grid size-7 place-items-center rounded-md hover:bg-white/15"
          >
            <X className="size-4" />
          </button>
        </div>

        {tender && line && (
          <div className="relative">
            {/* Message header */}
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-bold tracking-tight">
                Prequalification needed · due {formatDate(dueBy)}
              </h2>
              <div className="mt-3 flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  AG
                </span>
                <div className="min-w-0 flex-1 text-sm leading-tight">
                  <div className="font-semibold">AGFS Tender Intelligence</div>
                  <div className="text-xs text-muted-foreground">To: {line.hod}</div>
                </div>
                <span className="text-xs text-muted-foreground">{isToday(sentAt) ? `Today ${formatTime(sentAt)}` : formatDateTime(sentAt)}</span>
              </div>
            </div>

            {/* Message body */}
            <div className="max-h-[60vh] overflow-y-auto bg-zinc-50/60 px-6 py-6">
              <div className="mx-auto max-w-lg space-y-5 rounded-xl bg-card p-6 shadow-soft">
                <p className="text-sm">Dear {line.hod.split(" ")[0]},</p>
                <p className="text-sm text-foreground/80">
                  {tender.approval?.submittedBy ?? "The Bid Analyst"} has routed a prospect to you for prequalification.
                </p>

                <div className="rounded-lg border p-4">
                  <div className="font-bold">{tender.title}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {tender.buyer} · {formatValue(tender)} · due {formatDate(tender.deadline)}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm font-semibold">
                    AI pre-qualification <PrequalBadge yes={aiPrequalified(tender)} />
                  </div>
                  <p className="mt-1.5 text-sm text-foreground/80">{tender.aiNarrative}</p>
                </div>

                {tender.approval?.note && (
                  <div className="rounded-lg border-l-2 border-primary/50 bg-secondary/50 py-2.5 pr-3 pl-4 text-sm">
                    <div className="text-xs font-semibold text-muted-foreground">
                      Note from {tender.approval.submittedBy} · proposes {tender.approval.proposed.toLowerCase()}
                    </div>
                    <p className="mt-1 italic">“{tender.approval.note}”</p>
                  </div>
                )}

                <div className="text-center">
                  <Button size="lg" className="px-8" onClick={reviewAndDecide} disabled={signingIn}>
                    Review & decide
                  </Button>
                </div>

                <p className="border-t pt-4 text-xs text-muted-foreground">
                  Decision needed by <span className="font-semibold text-foreground">{formatDate(dueBy)}</span>
                  {others > 0 && (
                    <>
                      {" "}
                      · {others} other prospect{others === 1 ? "" : "s"} waiting for you
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Simulated single sign-on */}
            {signingIn && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 grid place-items-center bg-card/95 backdrop-blur-sm"
              >
                <div className="flex flex-col items-center text-center">
                  <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                    <KeyRound className="size-6" />
                  </span>
                  <div className="mt-4 font-bold">Signing in as {line.hod}</div>
                  <div className="mt-1 text-sm text-muted-foreground">AGFS work account · single sign-on</div>
                  <Loader2 className="mt-4 size-5 animate-spin text-primary" />
                </div>
              </motion.div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
