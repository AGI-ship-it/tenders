"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, Check, Circle, Clock, CloudUpload, ExternalLink, FastForward, FilePlus2, ThumbsDown, ThumbsUp, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { bypassHod, decide, recordHodReply, useDemo } from "@/lib/store";
import { PEOPLE } from "@/lib/mock-data";
import { formatDateTime, hoursLeft, timeAgo } from "@/lib/format";
import type { ApprovalRecord, OpsInput, Tender } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { D365, StatusBadge, boldD365 } from "@/components/shared";

/**
 * The single "what happens next" panel for a lead, adapted to role and status. The chain is HoD (interested or not,
 * 24 h) → BD Head (approve, reject, or bypass the HoD) → Bid Head (final approval creates the D365 opportunity).
 */
export function DecisionPanel({ tender }: { tender: Tender }) {
  const demo = useDemo()!;
  const role = demo.role;
  const a = tender.approval;
  const s = tender.status;
  const bd = PEOPLE.vp;
  const bid = PEOPLE.bid;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Status</span>
        <StatusBadge status={s} />
      </div>

      {s === "Draft" &&
        (role === "analyst" ? (
          <Button className="w-full" size="lg" nativeButton={false} render={<Link href={`/lead?id=${encodeURIComponent(tender.id)}`} />}>
            <FilePlus2 /> Review draft & create lead
          </Button>
        ) : (
          <RoleHint text="The AI prepared a lead draft. Waiting for the Bid Analyst to review it and create the lead in D365." />
        ))}

      {a && <ApprovalChain tender={tender} approval={a} ops={tender.opsInput} />}

      {s === "Awaiting HoD" && tender.opsInput && (
        <HodWait tender={tender} ops={tender.opsInput} canSimulate={role === "vp" || role === "bid"} />
      )}
      {s === "Awaiting HoD" &&
        (role === "vp" ? (
          <BypassHod tender={tender} />
        ) : (
          <RoleHint text={`Waiting for the HoD. After the reply, ${bd.name} (BD Head) reviews it; ${bd.name.split(" ")[0]} can also bypass the HoD.`} />
        ))}

      {s === "BD Head review" &&
        (role === "vp" ? (
          <DecisionActions tender={tender} step="bd" />
        ) : (
          <RoleHint text={`Waiting for ${bd.name}, BD Head, to approve it for the Bid Head or reject it.`} />
        ))}

      {s === "Bid Head approval" &&
        (role === "bid" ? (
          <DecisionActions tender={tender} step="bid" />
        ) : (
          <RoleHint text={`Approved by the BD Head. Waiting for ${bid.name}, Bid Head, to give the final go.`} />
        ))}

      {tender.opportunity && (
        <div className="space-y-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200 ring-inset">
          <div className="flex items-center gap-1.5 font-semibold">
            <Trophy className="size-4" />
            <span>
              Opportunity {tender.opportunity.oppId} in <D365 />
            </span>
          </div>
          <div className="text-xs leading-relaxed text-emerald-900/80">
            Created by {tender.opportunity.createdBy} · {formatDateTime(tender.opportunity.createdAt)}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Bot className="size-3.5" /> Handed to the {tender.opportunity.handedTo} for the bid / no-bid work
          </div>
        </div>
      )}

      <LeadCard tender={tender} />
    </div>
  );
}

function LeadCard({ tender }: { tender: Tender }) {
  const lead = tender.lead;
  const unconfirmed = !lead.confirmedBy;
  return (
    <div className="space-y-3 rounded-xl bg-teal-50 p-4 text-sm text-teal-700">
      <div className="flex items-center justify-between gap-2 font-semibold">
        <span className="flex items-center gap-1.5">
          <CloudUpload className="size-4" />
          <span>{unconfirmed ? "Lead draft · not in D365 yet" : <>Lead {lead.leadId} in <D365 /></>}</span>
        </span>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">{lead.state}</span>
      </div>
      <div className="text-xs leading-relaxed">
        {unconfirmed ? (
          <>Prepared by the AI from the mailbox · {formatDateTime(tender.discoveredAt)} · {tender.actions.length} actions found · to review</>
        ) : (
          <>
            Created by {lead.createdBy} from the AI draft · {formatDateTime(lead.createdAt)} · {tender.actions.length} actions logged
          </>
        )}
      </div>
      <Button
        variant="outline"
        size="lg"
        className="mt-1 w-full"
        onClick={() =>
          toast(boldD365(`Opening lead ${lead.leadId} in D365`), {
            description: "Simulated: in the live solution this opens the lead record in Dynamics 365.",
          })
        }
      >
        <span>Open in <D365 /></span> <ExternalLink />
      </Button>
    </div>
  );
}

function RoleHint({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">{text}</p>;
}

export function hodText(o: OpsInput): string {
  if (o.reply) return o.repliedAt ? `${o.reply} · ${timeAgo(o.repliedAt).toLowerCase()}` : o.reply;
  if (o.bypassed) return "Bypassed by the BD Head";
  return hoursLeft(o.dueAt) > 0
    ? `Awaiting reply · ${hoursLeft(o.dueAt)} h left`
    : `Overdue · escalated to the BD Head · ${o.remindersSent} reminder${o.remindersSent === 1 ? "" : "s"}`;
}

type StepState = "done" | "rejected" | "current" | "next";

/** The approval chain, one row per step, each response logged on the D365 lead. */
function ApprovalChain({ tender, approval: a, ops }: { tender: Tender; approval: ApprovalRecord; ops?: OpsInput }) {
  const s = tender.status;
  const hodState: StepState = ops?.reply || ops?.bypassed ? "done" : s === "Awaiting HoD" ? "current" : "next";
  const bdState: StepState =
    a.bdDecision === "Approved" ? "done" : a.bdDecision === "Rejected" ? "rejected" : s === "BD Head review" ? "current" : "next";
  const bidState: StepState =
    a.decision === "Approved" ? "done" : a.decision === "Rejected" && a.decidedBy === PEOPLE.bid.name ? "rejected" : s === "Bid Head approval" ? "current" : "next";
  const rows: { who: string; role: string; state: StepState; text: string; tone?: string; note?: string }[] = [
    {
      who: ops?.person ?? "HoD",
      role: `HoD${ops ? `, ${ops.line}` : ""}`,
      state: hodState,
      text: ops ? hodText(ops) : "Not asked",
      tone: ops?.reply === "Interested" ? "text-emerald-700" : ops?.reply === "Not interested" ? "text-rose-700" : undefined,
      note: ops?.bypassReason,
    },
    {
      who: a.bdBy ?? PEOPLE.vp.name,
      role: "BD Head",
      state: bdState,
      text: a.bdDecision ? `${a.bdDecision} · ${a.bdAt ? formatDateTime(a.bdAt) : ""}` : bdState === "current" ? "Reviewing" : "Next",
      tone: a.bdDecision === "Approved" ? "text-emerald-700" : a.bdDecision === "Rejected" ? "text-rose-700" : undefined,
      note: a.bdComment,
    },
    {
      who: PEOPLE.bid.name,
      role: "Bid Head",
      state: a.bdDecision === "Rejected" ? "next" : bidState,
      text:
        a.bdDecision === "Rejected"
          ? "Not needed"
          : bidState === "done" || bidState === "rejected"
            ? `${a.decision} · ${a.decidedAt ? formatDateTime(a.decidedAt) : ""}`
            : bidState === "current"
              ? "Final approval"
              : "Next",
      tone: bidState === "done" ? "text-emerald-700" : bidState === "rejected" ? "text-rose-700" : undefined,
      note: bidState === "done" || bidState === "rejected" ? a.decisionComment : undefined,
    },
  ];
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5 text-sm">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Lead created by {a.submittedBy}</span>
        <span className="flex items-center gap-1">
          <CloudUpload className="size-3.5" /> Each response logged in <D365 />
        </span>
      </div>
      <ol>
        {rows.map((r, i) => (
          <li key={r.role} className="flex gap-3">
            <span className="flex flex-col items-center">
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full",
                  r.state === "done" && "bg-emerald-100 text-emerald-700",
                  r.state === "rejected" && "bg-rose-100 text-rose-700",
                  r.state === "current" && "bg-amber-100 text-amber-800 ring-2 ring-amber-300",
                  r.state === "next" && "bg-muted text-muted-foreground",
                )}
              >
                {r.state === "done" ? <Check className="size-3.5" /> : r.state === "rejected" ? <X className="size-3.5" /> : <Circle className="size-2.5 fill-current" />}
              </span>
              {i < rows.length - 1 && <span className="my-1 w-px flex-1 bg-border" />}
            </span>
            <div className="min-w-0 flex-1 pb-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">
                  {r.who} <span className="text-xs font-normal text-muted-foreground">· {r.role}</span>
                </span>
                <span className={cn("shrink-0 text-xs", r.tone ?? "text-muted-foreground")}>{r.text}</span>
              </div>
              {r.note && <div className="mt-0.5 text-xs text-muted-foreground italic">“{r.note}”</div>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The HoD's 24-hour window, with demo buttons standing in for the HoD's emailed reply. */
function HodWait({ tender, ops, canSimulate }: { tender: Tender; ops: OpsInput; canSimulate: boolean }) {
  const left = hoursLeft(ops.dueAt);
  const pct = Math.min(100, Math.max(0, ((24 - left) / 24) * 100));
  function reply(r: NonNullable<OpsInput["reply"]>) {
    recordHodReply(tender.id, r);
    toast.success(`${ops.person} replied: ${r.toLowerCase()}`, {
      description: "Logged in D365. On to the BD Head.",
    });
  }
  return (
    <div className="space-y-3 rounded-xl bg-orange-50 p-4 text-sm text-orange-900 ring-1 ring-orange-200 ring-inset">
      <div className="flex items-center gap-1.5 font-semibold">
        <Clock className="size-4" /> Waiting for {ops.person} (HoD, {ops.line})
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-orange-200/70">
        <div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-orange-900/80">
        {left > 0
          ? `${left} h left of 24 h to say interested or not`
          : `24 h passed · ${ops.remindersSent} reminder${ops.remindersSent === 1 ? "" : "s"} sent · escalated to the BD Head`}
      </div>
      {canSimulate && (
        <div className="border-t border-orange-200 pt-3">
          <div className="mb-2 text-[11px] font-semibold tracking-wide text-orange-900/70 uppercase">Demo · simulate the HoD&apos;s reply</div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="bg-white" onClick={() => reply("Not interested")}>
              <ThumbsDown /> Not interested
            </Button>
            <Button variant="outline" size="sm" className="bg-white" onClick={() => reply("Interested")}>
              <ThumbsUp /> Interested
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The BD Head moves the lead on without the HoD's reply. A reason is required; it is logged on the D365 lead. */
function BypassHod({ tender }: { tender: Tender }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const overdue = tender.opsInput ? hoursLeft(tender.opsInput.dueAt) <= 0 : false;
  if (!open) {
    return (
      <div className="space-y-2">
        <Button variant={overdue ? "default" : "secondary"} size="lg" className="w-full" onClick={() => setOpen(true)}>
          <FastForward /> Bypass HoD and decide
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          {overdue ? "The 24 hours have passed; it's escalated to you." : "Or wait for the HoD's reply."}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Label htmlFor={`b-${tender.id}`} className="text-xs text-muted-foreground">
        Why go ahead without the HoD? (logged in D365)
      </Label>
      <Textarea id={`b-${tender.id}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Closing date is close; I know this client." />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" size="lg" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          size="lg"
          disabled={!reason.trim()}
          onClick={() => {
            bypassHod(tender.id, reason.trim());
            toast.success("HoD bypassed", { description: "Logged in D365. It's yours to approve or reject." });
          }}
        >
          <FastForward /> Bypass
        </Button>
      </div>
    </div>
  );
}

/**
 * The approver's choices at their step. BD Head: approve (on to the Bid Head) or reject. Bid Head: approve (creates
 * the D365 opportunity and hands it to the bidding agent) or reject.
 */
export function DecisionActions({ tender, step }: { tender: Tender; step: "bd" | "bid" }) {
  const [comment, setComment] = useState("");
  const [needComment, setNeedComment] = useState(false);
  const bid = PEOPLE.bid;

  function act(d: NonNullable<ApprovalRecord["decision"]>) {
    if (d === "Rejected" && !comment.trim()) {
      setNeedComment(true);
      return;
    }
    decide(tender.id, d, comment.trim());
    setComment("");
    setNeedComment(false);
    if (d === "Rejected") {
      toast.success("Rejected", { description: boldD365(`Lead ${tender.lead.leadId} disqualified in D365.`) });
    } else if (step === "bd") {
      toast.success(`Sent to ${bid.name}, Bid Head`, { description: boldD365("Your approval is logged in D365. The Bid Head gives the final go.") });
    } else {
      toast.success("Opportunity created", {
        description: boldD365(`Lead ${tender.lead.leadId} converted to an opportunity in D365 and handed to the bidding agent.`),
        duration: 8000,
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`c-${tender.id}`} className="text-xs text-muted-foreground">
          Comment {needComment && <span className="text-rose-600">(required to reject)</span>}
        </Label>
        <Textarea
          id={`c-${tender.id}`}
          rows={3}
          placeholder={step === "bd" ? "Add context for the Bid Head…" : "Add context for the bid team…"}
          value={comment}
          aria-invalid={needComment && !comment.trim()}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      {/* Reject on the left, Approve (the primary action) on the right. */}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="destructive" size="lg" onClick={() => act("Rejected")}>
          <X /> Reject
        </Button>
        <Button variant="success" size="lg" onClick={() => act("Approved")}>
          <Check /> {step === "bd" ? "Approve" : "Final approve"}
        </Button>
      </div>
      <p className="-mt-2 text-center text-[11px] text-muted-foreground">
        {step === "bd" ? (
          <>Approving sends it to {bid.name}, Bid Head, for the final go.</>
        ) : (
          <>
            Approving creates the <D365 /> opportunity and hands it to the bidding agent.
          </>
        )}
      </p>
    </div>
  );
}
