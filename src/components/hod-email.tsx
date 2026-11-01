"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Archive, FileText, Forward, Grip, Inbox, KeyRound, Loader2, Reply, ReplyAll, Search, Send, Sparkles, SquarePen, Trash2, X } from "lucide-react";
import { setRole, useDemo } from "@/lib/store";
import { aiPrequalified } from "@/lib/scoring";
import { formatDate, formatDateTime, formatTime, formatValue, isToday } from "@/lib/format";
import { cn } from "@/lib/utils";
import { serviceLineFor } from "@/lib/mock-data";
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
  // Other prospects still waiting for this HoD; they appear as earlier emails in the inbox.
  const waiting = tender
    ? demo.tenders.filter((t) => t.id !== tender.id && t.status === "Awaiting HoD" && line?.categories.includes(t.category))
    : [];
  const sentAt = tender?.approval?.submittedAt ?? new Date(0).toISOString();
  const dueBy = new Date(new Date(sentAt).getTime() + DECISION_SLA_DAYS * 86_400_000).toISOString();
  const when = (iso: string) => (isToday(iso) ? formatTime(iso) : formatDate(iso));

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

  const inbox: InboxItem[] = tender
    ? [
        {
          id: tender.id,
          from: "AGFS Tender Intelligence",
          subject: `Prequalification needed · due ${formatDate(dueBy)}`,
          preview: tender.title,
          time: when(sentAt),
          unread: true,
          selected: true,
          brand: true,
        },
        ...waiting.slice(0, 2).map((t) => ({
          id: t.id,
          from: "AGFS Tender Intelligence",
          subject: "Prequalification needed",
          preview: t.title,
          time: t.approval ? when(t.approval.submittedAt) : "",
          unread: true,
          brand: true,
        })),
        ...FILLER,
      ]
    : [];

  return (
    <Dialog
      open={!!tender}
      onOpenChange={(o) => {
        if (!o && !signingIn) closeHodEmail();
      }}
    >
      <DialogContent
        showCloseButton={false}
        // Mail always renders in its own light theme, whatever the app's appearance.
        style={{ "--border": "#e1dfdd", colorScheme: "light" } as React.CSSProperties}
        className="flex bg-white text-zinc-900 h-[85vh] max-h-[760px] flex-col gap-0 overflow-hidden rounded-xl p-0 [font-family:'Segoe_UI',system-ui,sans-serif] sm:max-w-6xl"
      >
        <DialogTitle className="sr-only">Email to {line?.hod}</DialogTitle>

        {/* App bar */}
        <div className="flex h-12 shrink-0 items-center gap-3 bg-[#0f6cbd] px-3 text-white">
          <Grip className="size-5 opacity-90" />
          <span className="text-[15px] font-semibold">Mail</span>
          <div className="mx-auto hidden h-8 w-full max-w-md items-center gap-2 rounded-md bg-white/95 px-3 text-sm text-zinc-500 md:flex">
            <Search className="size-4" /> Search
          </div>
          <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">Simulated</span>
          <span className="grid size-8 place-items-center rounded-full bg-white/20 text-xs font-semibold">{line?.initials}</span>
          <button
            aria-label="Close email"
            onClick={closeHodEmail}
            disabled={signingIn}
            className="grid size-8 place-items-center rounded hover:bg-white/15"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Command bar */}
        <div className="flex h-11 shrink-0 items-center gap-1 border-b bg-[#faf9f8] px-3 text-[13px] text-zinc-700">
          <span className="flex items-center gap-1.5 rounded bg-[#0f6cbd] px-3 py-1.5 font-semibold text-white">
            <SquarePen className="size-4" /> New mail
          </span>
          {[
            [Trash2, "Delete"],
            [Archive, "Archive"],
            [Reply, "Reply"],
            [ReplyAll, "Reply all"],
            [Forward, "Forward"],
          ].map(([Icon, label]) => {
            const I = Icon as typeof Trash2;
            return (
              <span key={label as string} className="hidden items-center gap-1.5 rounded px-2.5 py-1.5 hover:bg-[#edebe9] sm:flex">
                <I className="size-4 text-[#0f6cbd]" /> {label as string}
              </span>
            );
          })}
        </div>

        {tender && line && (
          <div className="relative flex min-h-0 flex-1">
            {/* Folder pane */}
            <nav className="hidden w-48 shrink-0 flex-col gap-0.5 border-r bg-[#faf9f8] p-2 text-[13px] text-zinc-700 lg:flex">
              <div className="px-2 py-1.5 text-xs font-semibold text-zinc-500">Favourites</div>
              {[
                [Inbox, "Inbox", waiting.length + 1],
                [Send, "Sent items", 0],
                [FileText, "Drafts", 0],
                [Archive, "Archive", 0],
                [Trash2, "Deleted items", 0],
              ].map(([Icon, label, n]) => {
                const I = Icon as typeof Inbox;
                const on = label === "Inbox";
                return (
                  <span
                    key={label as string}
                    className={cn("flex items-center gap-2.5 rounded px-2 py-1.5", on ? "bg-[#cfe4fa] font-semibold text-zinc-900" : "hover:bg-[#edebe9]")}
                  >
                    <I className={cn("size-4", on ? "text-[#0f6cbd]" : "text-zinc-500")} />
                    {label as string}
                    {(n as number) > 0 && <span className="ml-auto text-xs font-semibold text-[#0f6cbd]">{n as number}</span>}
                  </span>
                );
              })}
            </nav>

            {/* Message list */}
            <div className="hidden w-80 shrink-0 flex-col border-r bg-white md:flex">
              <div className="flex items-center gap-4 border-b px-4 py-2.5 text-[13px]">
                <span className="border-b-2 border-[#0f6cbd] pb-1 font-semibold text-zinc-900">Focused</span>
                <span className="pb-1 text-zinc-500">Other</span>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {inbox.map((m) => (
                  <li
                    key={m.id}
                    className={cn(
                      "relative border-b px-4 py-2.5 text-[13px]",
                      m.selected ? "bg-[#cfe4fa]/70" : "hover:bg-[#f3f2f1]",
                      m.unread && "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[#0f6cbd]",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("min-w-0 flex-1 truncate", m.unread ? "font-semibold text-zinc-900" : "text-zinc-700")}>{m.from}</span>
                      <span className={cn("shrink-0 text-xs", m.unread ? "font-semibold text-[#0f6cbd]" : "text-zinc-500")}>{m.time}</span>
                    </div>
                    <div className={cn("truncate", m.unread ? "font-semibold text-[#0f6cbd]" : "text-zinc-800")}>{m.subject}</div>
                    <div className="truncate text-zinc-500">{m.preview}</div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Reading pane */}
            <div className="flex min-w-0 flex-1 flex-col bg-white">
              <div className="shrink-0 border-b px-6 pt-5 pb-4">
                <h2 className="text-xl font-semibold text-zinc-900">Prequalification needed · due {formatDate(dueBy)}</h2>
                <div className="mt-4 flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">AT</span>
                  <div className="min-w-0 flex-1 text-[13px] leading-snug">
                    <div className="font-semibold text-zinc-900">AGFS Tender Intelligence</div>
                    <div className="text-[#605e5c]">To: {line.hod}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-zinc-500">
                    {[Reply, ReplyAll, Forward].map((I, i) => (
                      <span key={i} className="grid size-8 place-items-center rounded hover:bg-[#f3f2f1]">
                        <I className="size-4 text-[#0f6cbd]" />
                      </span>
                    ))}
                    <span className="ml-2 text-xs">{isToday(sentAt) ? `Today ${formatTime(sentAt)}` : formatDateTime(sentAt)}</span>
                  </div>
                </div>
              </div>

              {/* HTML email body */}
              <div className="min-h-0 flex-1 overflow-y-auto bg-[#f5f5f5] px-4 py-6 sm:px-8">
                <div className="mx-auto max-w-xl overflow-hidden rounded-md bg-white text-zinc-800 shadow-sm ring-1 ring-black/5 [font-family:var(--font-sans)]">
                  <div className="flex items-center gap-2 bg-[#410266] px-6 py-3.5 text-white">
                    <Sparkles className="size-4" />
                    <span className="text-sm font-bold tracking-tight">AGFS Tender Intelligence</span>
                  </div>
                  <div className="space-y-5 p-6">
                    <p className="text-sm">Dear {line.hod.split(" ")[0]},</p>
                    <p className="text-sm text-[#605e5c]">
                      {tender.approval?.submittedBy ?? "The Bid Analyst"} has routed a prospect to you for prequalification.
                    </p>

                    <div className="rounded-lg border border-[#e1dfdd] p-4">
                      <div className="font-bold text-zinc-900">{tender.title}</div>
                      <div className="mt-0.5 text-sm text-zinc-500">
                        {tender.buyer} · {formatValue(tender)} · due {formatDate(tender.deadline)}
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                        AI pre-qualification <PrequalBadge yes={aiPrequalified(tender)} />
                      </div>
                      <p className="mt-1.5 text-sm text-[#605e5c]">{tender.aiNarrative}</p>
                    </div>

                    {tender.approval?.note && (
                      <div className="rounded-r-lg border-l-2 border-[#410266]/50 bg-[#f6f0fb] py-2.5 pr-3 pl-4 text-sm">
                        <div className="text-xs font-semibold text-zinc-500">
                          Note from {tender.approval.submittedBy} · proposes {tender.approval.proposed.toLowerCase()}
                        </div>
                        <p className="mt-1 text-zinc-800 italic">“{tender.approval.note}”</p>
                      </div>
                    )}

                    <div className="text-center">
                      <button
                        onClick={reviewAndDecide}
                        disabled={signingIn}
                        className="inline-flex h-11 items-center rounded-md bg-[#410266] px-8 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        Review & decide
                      </button>
                    </div>

                    <p className="border-t border-[#e1dfdd] pt-4 text-xs text-zinc-500">
                      Decision needed by <span className="font-semibold text-zinc-800">{formatDate(dueBy)}</span>
                      {waiting.length > 0 && (
                        <>
                          {" "}
                          · {waiting.length} other prospect{waiting.length === 1 ? "" : "s"} waiting for you
                        </>
                      )}
                    </p>
                  </div>
                  <div className="bg-[#faf9f8] px-6 py-3 text-[11px] text-zinc-400">
                    Sent by AGFS Tender Intelligence. You receive this because you are the HoD for {line.name}.
                  </div>
                </div>
              </div>
            </div>

            {/* Simulated single sign-on */}
            {signingIn && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 grid place-items-center bg-white/95 backdrop-blur-sm"
              >
                <div className="flex flex-col items-center text-center text-zinc-900">
                  <span className="grid size-12 place-items-center rounded-full bg-[#410266]/10 text-[#410266]">
                    <KeyRound className="size-6" />
                  </span>
                  <div className="mt-4 font-bold">Signing in as {line.hod}</div>
                  <div className="mt-1 text-sm text-zinc-500">AGFS work account · single sign-on</div>
                  <Loader2 className="mt-4 size-5 animate-spin text-[#410266]" />
                </div>
              </motion.div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface InboxItem {
  id: string;
  from: string;
  subject: string;
  preview: string;
  time: string;
  unread?: boolean;
  selected?: boolean;
  brand?: boolean;
}

/** Everyday mail around the AGFS notifications, so the inbox reads as real. All names are fictional. */
const FILLER: InboxItem[] = [
  { id: "f1", from: "Facilities Operations", subject: "Weekly FM operations report", preview: "Attached is this week's KPI summary across all sites…", time: "Yesterday" },
  { id: "f2", from: "Rania Saleh", subject: "Re: Q4 budget review", preview: "Thanks. I've updated the mobilisation line as discussed…", time: "Yesterday" },
  { id: "f3", from: "HR Services", subject: "Reminder: performance reviews due", preview: "Please complete reviews for your direct reports by the end of…", time: "Mon" },
  { id: "f4", from: "Karim Haddad", subject: "Site visit notes – Al Reem", preview: "Sharing the photos and snag list from today's walkthrough…", time: "Mon" },
  { id: "f5", from: "IT Service Desk", subject: "Scheduled maintenance this weekend", preview: "Some systems will be unavailable on Saturday between 22:00 and…", time: "Sun" },
];
