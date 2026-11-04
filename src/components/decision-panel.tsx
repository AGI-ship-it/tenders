"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CloudUpload, ExternalLink, Send, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { decide, submitForApproval, useDemo } from "@/lib/store";
import { PEOPLE, hodLabel, serviceLineFor } from "@/lib/mock-data";
import { aiPrequalified } from "@/lib/scoring";
import { formatDateTime } from "@/lib/format";
import type { ApprovalRecord, Tender } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { D365, PrequalBadge, StatusBadge, boldD365 } from "@/components/shared";
import { openHodEmail } from "@/components/hod-email";

const SUBMITTABLE: Tender["status"][] = ["New", "Under Review"];

/** The single "what happens next" panel for a tender, adapted to role and status. */
export function DecisionPanel({ tender }: { tender: Tender }) {
  const demo = useDemo()!;
  const [submitOpen, setSubmitOpen] = useState(false);
  const role = demo.role;
  const a = tender.approval;
  const line = serviceLineFor(tender.category);
  const lead = tender.lead;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Status</span>
        <StatusBadge status={tender.status} />
      </div>

      {a && <ApprovalSummary approval={a} />}

      {SUBMITTABLE.includes(tender.status) &&
        (role === "analyst" ? (
          <Button className="w-full" size="lg" onClick={() => setSubmitOpen(true)}>
            <Send /> Submit for prequalification
          </Button>
        ) : (
          <RoleHint text={`Waiting for the Bid Analyst to submit this prospect for prequalification.`} />
        ))}

      {tender.status === "Awaiting HoD" &&
        (role === "approver" && demo.hodLine === line.id ? (
          <DecisionActions tender={tender} />
        ) : (
          <RoleHint
            text={
              role === "approver"
                ? `Routed to ${line.hod}, HoD ${line.name}. Only they can prequalify it.`
                : `Waiting for ${line.hod} to prequalify.`
            }
          />
        ))}

      {lead && (
        <div className="space-y-3 rounded-xl bg-teal-50 p-4 text-sm text-teal-700">
          <div className="flex items-center gap-1.5 font-semibold">
            <CloudUpload className="size-4" /> Lead {lead.leadId} in <D365 />
          </div>
          <div className="text-xs leading-relaxed">
            Pushed automatically when {a?.decidedBy ?? lead.owner} prequalified · {formatDateTime(lead.pushedAt)} · Owner{" "}
            {lead.owner}
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
            Open in <D365 /> <ExternalLink />
          </Button>
        </div>
      )}

      <SubmitDialog tender={tender} open={submitOpen} onOpenChange={setSubmitOpen} />
    </div>
  );
}

function RoleHint({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">{text}</p>;
}

function ApprovalSummary({ approval: a }: { approval: ApprovalRecord }) {
  return (
    <div className="space-y-3.5 rounded-xl border bg-card px-4 py-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Submitted by</span>
        <span>{a.submittedBy}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Routed to</span>
        <span>{a.reviewer.split(" (")[0]}</span>
      </div>
      {a.note && <p className="border-t pt-3.5 text-sm text-muted-foreground italic">“{a.note}”</p>}
      {a.decision && (
        <div
          className={cn(
            "rounded-md p-2.5 text-xs",
            a.decision === "Approved" && "bg-emerald-50 text-emerald-900",
            a.decision === "Rejected" && "bg-rose-50 text-rose-900",
          )}
        >
          <div className="font-semibold">
            {a.decision === "Approved" ? "Prequalified" : a.decision === "Rejected" ? "Rejected" : a.decision} by{" "}
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
    const leadId = decide(tender.id, d, comment.trim());
    setComment("");
    setNeedComment(false);
    if (leadId) {
      toast.success(boldD365("Prequalified & pushed to D365"), {
        description: boldD365(`Lead ${leadId} created in D365 · owner ${serviceLineFor(tender.category).hod}. ${PEOPLE.analyst.name.split(" ")[0]} sees it as approved.`),
        duration: 8000,
      });
      return;
    }
    toast.success("Rejected", { description: `${tender.id} pipeline status updated.` });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`c-${tender.id}`} className="text-xs text-muted-foreground">
          HoD comment {needComment && <span className="text-rose-600">(required to reject)</span>}
        </Label>
        <Textarea
          id={`c-${tender.id}`}
          rows={3}
          placeholder="Add context for the Bid Analyst…"
          value={comment}
          aria-invalid={needComment && !comment.trim()}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      {/* Reject on the left, Prequalify (the primary action) on the right. */}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="destructive" size="lg" onClick={() => act("Rejected")}>
          <X /> Reject
        </Button>
        <Button variant="success" size="lg" onClick={() => act("Approved")}>
          <Check /> Prequalify
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
  const aiYes = aiPrequalified(tender);
  const line = serviceLineFor(tender.category);
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const router = useRouter();

  function submit() {
    submitForApproval(tender.id, { note: note.trim() });
    toast.success(`Sent to ${line.hod} · email delivered`, {
      description: `HoD, ${line.name}. See what lands in their inbox.`,
      duration: 12000,
      action: { label: `Preview ${line.hod.split(" ")[0]}'s email`, onClick: () => openHodEmail(tender.id) },
    });
    onOpenChange(false);
    setNote("");
    setConfirmed(false);
    router.push(`/approvals?id=${encodeURIComponent(tender.id)}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit for prequalification</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="divide-y rounded-xl bg-muted/50">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-pink-100 text-xs font-semibold text-pink-800">
                {line.initials}
              </span>
              <div className="min-w-0 text-sm">
                <div className="text-xs text-muted-foreground">Routed to</div>
                <div className="font-semibold">{hodLabel(tender.category)}</div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="text-muted-foreground">AI pre-qualification</span>
              <PrequalBadge yes={aiYes} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">
              Note to HoD <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea id="note" rows={4} placeholder="Your view, key points, conditions or clarifications…" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(c) => setConfirmed(Boolean(c))} className="mt-0.5" />
            <span className="text-muted-foreground">I have reviewed the AI reasoning and eligibility.</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!confirmed} onClick={submit}>
            <ShieldCheck /> Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
