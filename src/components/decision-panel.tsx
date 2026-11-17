"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, Check, Circle, Clock, CloudUpload, ExternalLink, FilePlus2, Send, ThumbsDown, ThumbsUp, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { askHod, currentUser, decide, recordHodReply, useDemo } from "@/lib/store";
import { PEOPLE, serviceLineFor } from "@/lib/mock-data";
import { formatDateTime, hoursLeft, timeAgo } from "@/lib/format";
import type { ApprovalRecord, OpsInput, Tender } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { D365, StatusBadge, boldD365 } from "@/components/shared";

/**
 * The single "what happens next" panel for a lead, adapted to role and status. The BD Head approves (creates the D365
 * opportunity) or rejects; when they want a service line's view first, they ask its HoD, who replies interested or not
 * (24 h), and the lead comes back to the BD Head.
 */
export function DecisionPanel({ tender }: { tender: Tender }) {
  const demo = useDemo()!;
  const role = demo.role;
  const me = currentUser(demo);
  const a = tender.approval;
  const s = tender.status;
  const bd = PEOPLE.vp;
  const ops = tender.opsInput;
  const iAmTheHod = role === "ops" && ops?.person === me.name;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Status</span>
        <StatusBadge status={s} />
      </div>

      {s === "Draft" &&
        (role === "analyst" ? (
          <Button className="w-full" size="lg" nativeButton={false} render={<Link href={`/inbox?id=${encodeURIComponent(tender.id)}`} />}>
            <FilePlus2 /> Review draft & create lead
          </Button>
        ) : (
          <RoleHint text="The AI prepared a lead draft. Waiting for the Bid Analyst to review it and create the lead in D365." />
        ))}

      {a && <ApprovalChain tender={tender} approval={a} ops={ops} />}

      {s === "Awaiting HoD" && ops && (iAmTheHod ? <HodReply tender={tender} ops={ops} /> : <HodWait ops={ops} />)}
      {s === "Awaiting HoD" && role === "vp" && (
        <details className="group rounded-xl border bg-card px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-muted-foreground group-open:mb-3 hover:text-foreground">
            Decide now without waiting for {ops?.person.split(" ")[0] ?? "the HoD"}
          </summary>
          <DecisionActions tender={tender} />
        </details>
      )}
      {s === "Awaiting HoD" && role === "analyst" && <RoleHint text={`Waiting for the HoD's reply. Then ${bd.name} (BD Head) decides.`} />}

      {s === "BD Head review" &&
        (role === "vp" ? (
          <>
            {ops?.reply && (
              <div
                className={cn(
                  "rounded-xl px-4 py-3 text-sm ring-1 ring-inset",
                  ops.reply === "Interested" ? "bg-emerald-50 text-emerald-900 ring-emerald-200" : "bg-rose-50 text-rose-900 ring-rose-200",
                )}
              >
                <span className="font-semibold">{ops.person}</span> replied <span className="font-semibold">{ops.reply.toLowerCase()}</span>
                . It&apos;s yours to decide.
              </div>
            )}
            <DecisionActions tender={tender} />
            {!ops && <AskHod tender={tender} />}
          </>
        ) : (
          <RoleHint text={`Waiting for ${bd.name}, BD Head, to approve or reject it${ops ? "" : ", or ask the HoD first"}.`} />
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
          <span>
            {unconfirmed ? (
              "Lead draft · not in D365 yet"
            ) : (
              <>
                Lead {lead.leadId} in <D365 />
              </>
            )}
          </span>
        </span>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">{lead.state}</span>
      </div>
      <div className="text-xs leading-relaxed">
        {unconfirmed ? (
          <>
            Prepared by the AI from the mailbox · {formatDateTime(tender.discoveredAt)} · {tender.actions.length} actions found · to review
          </>
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
        <span>
          Open in <D365 />
        </span>{" "}
        <ExternalLink />
      </Button>
    </div>
  );
}

function RoleHint({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">{text}</p>;
}

export function hodText(o: OpsInput): string {
  if (o.reply) return o.repliedAt ? `${o.reply} · ${timeAgo(o.repliedAt).toLowerCase()}` : o.reply;
  return hoursLeft(o.dueAt) > 0
    ? `Awaiting reply · ${hoursLeft(o.dueAt)} h left`
    : `Overdue · ${o.remindersSent} reminder${o.remindersSent === 1 ? "" : "s"} sent`;
}

type StepState = "done" | "rejected" | "current" | "next";

/** Who has the lead: the conflict-of-interest check comes first, then approval. The HoD row appears only when the BD Head asked them. Each response is logged on the D365 lead. */
function ApprovalChain({ tender, approval: a, ops }: { tender: Tender; approval: ApprovalRecord; ops?: OpsInput }) {
  const s = tender.status;
  const bdState: StepState =
    a.decision === "Approved" ? "done" : a.decision === "Rejected" ? "rejected" : s === "BD Head review" ? "current" : "next";
  const rows: { who: string; role: string; state: StepState; text: string; tone?: string; note?: string; detail?: string }[] = [];
  // First, before anyone approves: the AI's conflict-of-interest check, run when the lead is created.
  rows.push({
    who: "Conflict of interest",
    role: "AI check",
    state: "done",
    text: "Clear",
    tone: "text-emerald-700",
    detail: "No ties to AGFS staff, clients or partners",
  });
  if (ops) {
    rows.push({
      who: ops.person,
      role: `HoD, ${ops.line}`,
      state: ops.reply ? "done" : s === "Awaiting HoD" ? "current" : "next",
      text: ops.reply || s === "Awaiting HoD" ? hodText(ops) : "Not needed",
      tone: ops.reply === "Interested" ? "text-emerald-700" : ops.reply === "Not interested" ? "text-rose-700" : undefined,
      note: ops.note ? `${PEOPLE.vp.name.split(" ")[0]}: ${ops.note}` : undefined,
    });
  }
  rows.push({
    who: a.decidedBy ?? PEOPLE.vp.name,
    role: "BD Head",
    state: bdState,
    text: a.decision
      ? `${a.decision} · ${a.decidedAt ? formatDateTime(a.decidedAt) : ""}`
      : bdState === "current"
        ? "Deciding"
        : "Decides next",
    tone: a.decision === "Approved" ? "text-emerald-700" : a.decision === "Rejected" ? "text-rose-700" : undefined,
    note: a.decisionComment || undefined,
  });
  return (
    <div className="overflow-hidden rounded-xl border bg-card text-sm">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
        <span className="truncate">Lead created by {a.submittedBy}</span>
        <span className="flex shrink-0 items-center gap-1">
          <CloudUpload className="size-3.5" /> Logged in <D365 />
        </span>
      </div>
      <ol className="px-4 pt-3.5 pb-1">
        {rows.map((r, i) => (
          <li key={r.role} className="flex gap-3">
            <span className="flex flex-col items-center">
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full",
                  r.state === "done" && "bg-emerald-100 text-emerald-700",
                  r.state === "rejected" && "bg-rose-100 text-rose-700",
                  r.state === "current" && "bg-amber-100 text-amber-800 ring-2 ring-amber-200",
                  r.state === "next" && "bg-muted text-muted-foreground",
                )}
              >
                {r.state === "done" ? (
                  <Check className="size-3.5" />
                ) : r.state === "rejected" ? (
                  <X className="size-3.5" />
                ) : (
                  <Circle className="size-2 fill-current" />
                )}
              </span>
              {i < rows.length - 1 && <span className="my-1 w-px flex-1 bg-border" />}
            </span>
            <div className="min-w-0 flex-1 pb-3.5">
              <div className="flex min-h-6 items-center justify-between gap-2">
                <span className="truncate font-medium">
                  {r.who} <span className="text-xs font-normal text-muted-foreground">· {r.role}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    r.state === "done" && (r.tone === "text-rose-700" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"),
                    r.state === "rejected" && "bg-rose-50 text-rose-700",
                    r.state === "current" && "bg-amber-50 text-amber-800",
                    r.state === "next" && "bg-muted text-muted-foreground",
                  )}
                >
                  {r.text}
                </span>
              </div>
              {r.detail && <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{r.detail}</div>}
              {r.note && <div className="mt-0.5 text-xs text-muted-foreground italic">“{r.note}”</div>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The HoD's 24-hour window, as the BD Head and the Bid Analyst see it. */
function HodWait({ ops }: { ops: OpsInput }) {
  const left = hoursLeft(ops.dueAt);
  const pct = Math.min(100, Math.max(0, ((24 - left) / 24) * 100));
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
          : `24 h passed · ${ops.remindersSent} reminder${ops.remindersSent === 1 ? "" : "s"} sent`}
      </div>
    </div>
  );
}

/** The HoD's own answer, signed in as the HoD: interested or not. It goes back to the BD Head. */
function HodReply({ tender, ops }: { tender: Tender; ops: OpsInput }) {
  const left = hoursLeft(ops.dueAt);
  function reply(r: NonNullable<OpsInput["reply"]>) {
    recordHodReply(tender.id, r);
    toast.success(`You replied: ${r.toLowerCase()}`, { description: `Logged in D365. Back to ${PEOPLE.vp.name} to decide.` });
  }
  return (
    <div className="space-y-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200 ring-inset">
      <div className="font-semibold">{PEOPLE.vp.name} asked whether you&apos;re interested in bidding</div>
      {ops.note && <p className="text-xs italic">“{ops.note}”</p>}
      <div className="text-xs text-amber-900/80">{left > 0 ? `Reply within ${left} h` : "Your reply is overdue"}</div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" className="bg-white" onClick={() => reply("Not interested")}>
          <ThumbsDown /> Not interested
        </Button>
        <Button variant="success" size="lg" onClick={() => reply("Interested")}>
          <ThumbsUp /> Interested
        </Button>
      </div>
    </div>
  );
}

/** The BD Head forwards the lead to the service line's HoD for their interest before deciding. */
function AskHod({ tender }: { tender: Tender }) {
  const line = serviceLineFor(tender.category);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("Are we interested in bidding for this one?");
  if (!open) {
    return (
      <div className="space-y-1.5">
        <Button variant="secondary" size="lg" className="w-full" onClick={() => setOpen(true)}>
          <Send /> Ask {line.opsHead} (HoD) first
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">Optional · if you want {line.name}&apos;s view before deciding</p>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border bg-card p-4">
      <Label htmlFor={`h-${tender.id}`} className="text-xs text-muted-foreground">
        Message to {line.opsHead} (HoD, {line.name}) · reply within 24 h
      </Label>
      <Textarea id={`h-${tender.id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" size="lg" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          size="lg"
          onClick={() => {
            askHod(tender.id, note.trim());
            toast.success(`Sent to ${line.opsHead}`, { description: "Logged in D365. It comes back to you with their reply." });
          }}
        >
          <Send /> Send to HoD
        </Button>
      </div>
    </div>
  );
}

/** The BD Head's decision: approve (creates the D365 opportunity and hands it to the bidding agent) or reject. */
export function DecisionActions({ tender }: { tender: Tender }) {
  const [comment, setComment] = useState("");
  const [needComment, setNeedComment] = useState(false);

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
          placeholder="Add context for the bid team…"
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
          <Check /> Approve
        </Button>
      </div>
      <p className="-mt-2 text-center text-[11px] text-muted-foreground">
        Approving creates the <D365 /> opportunity and hands it to the bidding agent.
      </p>
    </div>
  );
}
