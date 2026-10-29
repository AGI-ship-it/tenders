"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Check, CloudUpload, MessageSquareWarning, Send, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { decide, setRole, submitForApproval, useDemo } from "@/lib/store";
import { PEOPLE, hodLabel, serviceLineFor } from "@/lib/mock-data";
import { recommendation } from "@/lib/scoring";
import { formatDateTime } from "@/lib/format";
import type { ApprovalRecord, Tender } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared";
import { PushToD365Button } from "@/components/d365-push";

const SUBMITTABLE: Tender["status"][] = ["New", "Under Review", "Changes Requested"];

/** The single "what happens next" panel for a tender, adapted to role and status. */
export function DecisionPanel({ tender }: { tender: Tender }) {
  const demo = useDemo()!;
  const [submitOpen, setSubmitOpen] = useState(false);
  const role = demo.role;
  const a = tender.approval;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Status</span>
        <StatusBadge status={tender.status} />
      </div>

      {a && <ApprovalSummary approval={a} />}

      {SUBMITTABLE.includes(tender.status) &&
        (role === "analyst" ? (
          <Button className="w-full" size="lg" onClick={() => setSubmitOpen(true)}>
            <Send /> {tender.status === "Changes Requested" ? "Resubmit to HoD" : "Submit for prequalification"}
          </Button>
        ) : (
          <RoleHint text="Only the Bid Analyst can submit for prequalification." target="analyst" />
        ))}

      {tender.status === "Awaiting HoD" &&
        (role === "approver" ? (
          <DecisionActions tender={tender} />
        ) : (
          <RoleHint text={`Waiting for ${a?.reviewer.split(" (")[0] ?? "the HoD"} to prequalify.`} target="approver" />
        ))}

      {tender.status === "Prequalified" && <PushToD365Button tender={tender} />}

      {tender.lead && (
        <div className="space-y-1 rounded-lg bg-teal-50 p-3 text-sm text-teal-700">
          <div className="flex items-center gap-1.5 font-semibold">
            <CloudUpload className="size-4" /> Lead {tender.lead.leadId} in D365
          </div>
          <div className="text-xs">
            Owner {tender.lead.owner} · pushed by {tender.lead.pushedBy} · {formatDateTime(tender.lead.pushedAt)}
          </div>
        </div>
      )}

      <SubmitDialog tender={tender} open={submitOpen} onOpenChange={setSubmitOpen} />
    </div>
  );
}

function RoleHint({ text, target }: { text: string; target: "analyst" | "approver" }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
      <p className="text-muted-foreground">{text}</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-2.5 w-full"
        onClick={() => {
          setRole(target);
          toast.success(`Now acting as ${PEOPLE[target].name}`, { description: "Demo role switched." });
        }}
      >
        <ArrowLeftRight /> Switch to {target === "approver" ? "HoD" : "Bid Analyst"} role
      </Button>
    </div>
  );
}

function ApprovalSummary({ approval: a }: { approval: ApprovalRecord }) {
  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Proposed</span>
        <span className="font-medium">{a.proposed}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Submitted by</span>
        <span>{a.submittedBy}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Routed to</span>
        <span>{a.reviewer.split(" (")[0]}</span>
      </div>
      {a.note && <p className="border-t pt-2.5 text-xs text-muted-foreground italic">“{a.note}”</p>}
      {a.decision && (
        <div
          className={cn(
            "rounded-md p-2.5 text-xs",
            a.decision === "Approved" && "bg-emerald-50 text-emerald-900",
            a.decision === "Rejected" && "bg-rose-50 text-rose-900",
            a.decision === "Changes Requested" && "bg-orange-50 text-orange-900",
          )}
        >
          <div className="font-semibold">
            {a.decision === "Approved" ? "Prequalified" : a.decision === "Rejected" ? "Not qualified" : a.decision} by{" "}
            {a.decidedBy} · {a.decidedAt && formatDateTime(a.decidedAt)}
          </div>
          {a.decisionComment && <div className="mt-1">{a.decisionComment}</div>}
        </div>
      )}
    </div>
  );
}

export function DecisionActions({ tender }: { tender: Tender }) {
  const [comment, setComment] = useState("");
  const [needComment, setNeedComment] = useState(false);

  function act(d: NonNullable<ApprovalRecord["decision"]>) {
    if (d !== "Approved" && !comment.trim()) {
      setNeedComment(true);
      return;
    }
    decide(tender.id, d, comment.trim());
    setComment("");
    setNeedComment(false);
    const proposed = tender.approval?.proposed ?? "Bid";
    toast.success(
      d === "Approved" ? (proposed === "Bid" ? "Prequalified" : "No-bid approved") : d === "Rejected" ? "Marked not qualified" : "Changes requested",
      { description: `${tender.id} pipeline status updated.` },
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`c-${tender.id}`} className="text-xs text-muted-foreground">
          HoD comment {needComment && <span className="text-rose-600">(required unless prequalifying)</span>}
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
      <Button className="w-full bg-emerald-700 hover:bg-emerald-700/90" size="lg" onClick={() => act("Approved")}>
        <Check /> {tender.approval?.proposed === "No-bid" ? "Approve no-bid" : "Prequalify"}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => act("Changes Requested")}>
          <MessageSquareWarning /> Request changes
        </Button>
        <Button variant="destructive" onClick={() => act("Rejected")}>
          <X /> Not qualified
        </Button>
      </div>
    </div>
  );
}

function SubmitDialog({
  tender,
  open,
  onOpenChange,
}: {
  tender: Tender;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const ai = recommendation(tender);
  const [proposed, setProposed] = useState<"Bid" | "No-bid">(ai === "No-bid" ? "No-bid" : "Bid");
  const line = serviceLineFor(tender.category);
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const router = useRouter();
  const overrides = (ai === "No-bid" && proposed === "Bid") || (ai !== "No-bid" && proposed === "No-bid");

  function submit() {
    submitForApproval(tender.id, { proposed, note: note.trim() });
    toast.success(`Routed to ${line.hod}`, {
      description: `HoD, ${line.name}. Switch to the HoD role to continue the demo.`,
    });
    onOpenChange(false);
    setNote("");
    setConfirmed(false);
    router.push(`/approvals?view=hod&id=${encodeURIComponent(tender.id)}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit for prequalification</DialogTitle>
          <DialogDescription>
            The AI recommends <span className="font-medium text-foreground">{ai}</span>. You make the proposal; the
            service-line HoD decides.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Your proposal</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["Bid", "No-bid"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setProposed(p)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-sm font-medium transition-all",
                    proposed === p
                      ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                      : "text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            {overrides && <p className="text-xs text-orange-700">This differs from the AI recommendation. Please explain why in the note.</p>}
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-pink-100 text-xs font-semibold text-pink-800">
              {line.initials}
            </span>
            <div className="text-sm">
              <div className="text-xs text-muted-foreground">Routed automatically to</div>
              <div className="font-medium">{hodLabel(tender.category)}</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Note to HoD</Label>
            <Textarea id="note" rows={3} placeholder="Key points, conditions or clarifications…" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(c) => setConfirmed(Boolean(c))} className="mt-0.5" />
            <span className="text-muted-foreground">I have reviewed the AI reasoning, eligibility and risks.</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!confirmed || (overrides && !note.trim())} onClick={submit}>
            <ShieldCheck /> Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
