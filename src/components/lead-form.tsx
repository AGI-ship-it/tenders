"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Ban, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Mail, Upload } from "lucide-react";
import { toast } from "sonner";
import { createLead, dismissDraft, useDemo, type LeadEdits } from "@/lib/store";
import { aiPrequalified } from "@/lib/scoring";
import { formatAED, formatDate, formatDateTime } from "@/lib/format";
import type { Category, Emirate, Tender, TenderAction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { channelOf, mailboxOfTender, senderOf } from "@/lib/mailbox";
import { Button } from "@/components/ui/button";
import { boldD365 } from "@/components/shared";
import { AiStar, FitPill } from "@/components/fit-pill";

const CATEGORIES: Category[] = [
  "Integrated FM",
  "Hard FM / MEP",
  "Cleaning & Hygiene",
  "Landscaping",
  "Security Services",
  "Pest Control",
  "Waste Management",
];
const EMIRATES: Emirate[] = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"];

/**
 * The lead draft the AI prepared from a tender email, shown beside the draft list in the inbox. Nothing is in D365 yet:
 * the Bid Analyst checks the details, corrects anything, and pushes it with "Create lead in D365" (the lead then goes to
 * the BD Head with the AI's prequalification), or dismisses it as not a tender, with a reason. Once created or
 * dismissed, it shows read-only.
 */
export function LeadForm({
  tender: t,
  waiting,
  onDone,
  onOpenEmail,
  emailSubject,
  position,
}: {
  tender: Tender;
  /** Other drafts still to review. */
  waiting: number;
  /** Called after the draft is created or dismissed, to move on to the next one. */
  onDone: () => void;
  onOpenEmail?: () => void;
  emailSubject?: string;
  /** Where this draft sits in the list, with previous / next. */
  position?: { index: number; total: number; go: (delta: number) => void };
}) {
  const demo = useDemo()!;
  const sender = senderOf(
    t,
    demo.sources.find((s) => s.id === t.sourceId),
  );
  const draft = t.status === "Draft";
  const dismissed = t.status === "Not a tender";
  const [dismissing, setDismissing] = useState(false);
  const [f, setF] = useState({
    title: t.title,
    buyer: t.buyer,
    category: t.category,
    emirate: t.emirate,
    location: t.location,
    publishedAt: t.publishedAt.slice(0, 10),
    deadline: t.deadline.slice(0, 10),
    summary: t.summary,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const edited = (k: keyof typeof f) => f[k] !== (k === "publishedAt" || k === "deadline" ? t[k].slice(0, 10) : t[k]);
  const lowConfidence = t.actions.filter((a) => a.confidence === "Low").length;
  const valid = f.title.trim() && f.buyer.trim() && f.deadline;

  function create() {
    const edits: LeadEdits = {};
    (Object.keys(f) as (keyof typeof f)[]).forEach((k) => {
      if (edited(k)) (edits as Record<string, string>)[k] = f[k];
    });
    createLead(t.id, edits);
    const yes = aiPrequalified({ ...t, ...edits });
    toast.success(boldD365(`Lead ${t.lead.leadId} created in D365`), {
      description: `AI pre-qualification: ${yes ? "Yes" : "No"}. Sent to the BD Head.${waiting ? " Next draft opened." : ""}`,
      duration: 8000,
    });
    onDone();
  }

  function dismiss(reason: string) {
    dismissDraft(t.id, reason);
    toast(`Dismissed: not a tender`, { description: `${reason}. No lead created. The AI learns from this.` });
    onDone();
  }

  return (
    <div className="@container flex min-h-0 flex-1 flex-col bg-card text-foreground">
      {/* The email it came from, and previous / next through the drafts */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-black/[0.04] dark:border-white/[0.06] px-4 text-[13px] @2xl:px-6">
        {onOpenEmail ? (
          <button
            onClick={onOpenEmail}
            title="View email"
            className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-primary"
          >
            <Mail className="size-4 shrink-0" />
            <span className="truncate">{emailSubject ?? "View email"}</span>
          </button>
        ) : (
          <span />
        )}
        {position && position.total > 1 && (
          <span className="ml-auto flex shrink-0 items-center gap-1 text-muted-foreground">
            <button
              onClick={() => position.go(-1)}
              aria-label="Previous draft"
              className="rounded p-1 hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="tabular-nums">
              {position.index + 1} of {position.total}
            </span>
            <button onClick={() => position.go(1)} aria-label="Next draft" className="rounded p-1 hover:bg-muted hover:text-foreground">
              <ChevronRight className="size-4" />
            </button>
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Record header */}
        <div className="px-4 pt-6 pb-2 @2xl:px-6">
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
            <FitPill t={t} />
            {draft ? "Lead draft · not in D365 yet" : dismissed ? "Draft dismissed · not a tender" : `Lead · ${t.lead.state}`}
          </div>
          <h1 className="mt-3 text-xl leading-tight font-bold tracking-tight text-primary">
            {f.title || "Untitled lead"}
          </h1>
          <div className="mt-1 text-[15px] text-muted-foreground">{f.buyer}</div>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm @2xl:grid-cols-4">
            <HeaderField
              label="Lead number"
              value={
                draft || dismissed ? (
                  <span className="font-normal text-muted-foreground">Given on create</span>
                ) : (
                  <span className="tabular-nums">{t.lead.leadId}</span>
                )
              }
            />
            <HeaderField label="Bid received" value={formatDate(t.discoveredAt)} />
            <HeaderField
              label={draft || dismissed ? "Prepared by" : "Created by"}
              value={
                draft || dismissed ? (
                  <span
                    className="flex items-center gap-1.5"
                    title={`From the email ${sender.name} sent to ${mailboxOfTender(t, demo.mailboxes)}`}
                  >
                    <AiStar className="size-3.5 text-primary" /> AI agent
                  </span>
                ) : (
                  t.lead.createdBy
                )
              }
            />
            <HeaderField label="Owner" value={t.lead.owner} />
          </dl>
        </div>

        <div className="space-y-8 px-4 pt-6 pb-6 @2xl:px-6">
          {draft ? null : dismissed ? (
            <div className="flex items-center gap-3 rounded-md bg-muted px-4 py-3 text-sm text-foreground/90 ring-1 ring-border">
              <Ban className="size-4 shrink-0" />
              <span className="flex-1">Dismissed by the Bid Analyst as not a tender. No lead was created in D365.</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-md bg-teal-50 px-4 py-3 text-sm text-teal-800 ring-1 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900">
              <CheckCircle2 className="size-4 shrink-0" />
              <span className="flex-1">
                Lead created in D365 by {t.lead.createdBy} · {formatDateTime(t.lead.createdAt)}.
              </span>
              <Link href={`/opportunity?id=${encodeURIComponent(t.id)}&from=pipeline`} className="font-semibold hover:underline">
                View prequalification →
              </Link>
            </div>
          )}

          <div className="grid gap-8 @3xl:grid-cols-2 @3xl:gap-x-10">
            <Section title="Tender details">
              <Field label="Topic" ai edited={edited("title")}>
                <TextInput value={f.title} onChange={(v) => set("title", v)} disabled={!draft} />
              </Field>
              <Field label="Client name" ai edited={edited("buyer")}>
                <TextInput value={f.buyer} onChange={(v) => set("buyer", v)} disabled={!draft} />
              </Field>
              <Field label="Client type">
                <ReadOnly>{t.buyerType}</ReadOnly>
              </Field>
              <Field label="Tender no.">
                <ReadOnly mono>{t.sourceRef}</ReadOnly>
              </Field>
              <Field label="Source">
                <ReadOnly>
                  {channelOf(t)} · {sender.name} · to {mailboxOfTender(t, demo.mailboxes)}
                </ReadOnly>
              </Field>
              <Field label="Service" ai edited={edited("category")}>
                <SelectInput value={f.category} options={CATEGORIES} onChange={(v) => set("category", v as Category)} disabled={!draft} />
              </Field>
              <Field label="Emirate" ai edited={edited("emirate")}>
                <SelectInput value={f.emirate} options={EMIRATES} onChange={(v) => set("emirate", v as Emirate)} disabled={!draft} />
              </Field>
              <Field label="Location" ai edited={edited("location")}>
                <TextInput value={f.location} onChange={(v) => set("location", v)} disabled={!draft} />
              </Field>
            </Section>

            <div className="space-y-8">
              <Section title="Dates">
                <Field label="Bid received">
                  <ReadOnly>{formatDate(t.discoveredAt)}</ReadOnly>
                </Field>
                <Field label="Opening" ai edited={edited("publishedAt")}>
                  <TextInput type="date" value={f.publishedAt} onChange={(v) => set("publishedAt", v)} disabled={!draft} />
                </Field>
                <Field label="Closing" ai edited={edited("deadline")}>
                  <TextInput type="date" value={f.deadline} onChange={(v) => set("deadline", v)} disabled={!draft} />
                </Field>
              </Section>

              <Section title="Scope" ai hint="summarised by AI">
                <div className="py-1">
                  <textarea
                    value={f.summary}
                    disabled={!draft}
                    onChange={(e) => set("summary", e.target.value)}
                    rows={4}
                    className="w-full resize-y rounded-md bg-transparent px-0 py-1 text-[13px] leading-relaxed outline-none focus:ring-1 focus:ring-ring"
                  />
                  <ul className="mt-2 list-disc space-y-1 pr-1 pl-6 text-[13px] text-muted-foreground">
                    {t.scope.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              </Section>
            </div>
          </div>

          <Section title="Actions found by the AI" hint={lowConfidence ? `${lowConfidence} to check` : `${t.actions.length} items`}>
            <ul className="space-y-1">
              {t.actions.map((a) => (
                <ActionRow key={a.id} a={a} />
              ))}
            </ul>
          </Section>
        </div>
      </div>

      {/* Push bar: create the lead in D365, or dismiss the draft */}
      {draft &&
        (dismissing ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-black/[0.04] dark:border-white/[0.06] bg-card px-4 py-3 sm:px-6">
            <span className="mr-1 text-sm font-semibold">Why is it not a tender?</span>
            {["Newsletter or marketing", "Supplier offer", "Existing contract mail", "Already a lead", "Other"].map((r) => (
              <button
                key={r}
                onClick={() => dismiss(r)}
                className="rounded-full bg-card px-3 py-1 text-xs ring-1 ring-border transition-colors hover:bg-rose-50 hover:text-rose-700 hover:ring-rose-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 dark:hover:ring-rose-900"
              >
                {r}
              </button>
            ))}
            <Button variant="ghost" size="lg" className="ml-auto" onClick={() => setDismissing(false)}>
              Back
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-black/[0.04] dark:border-white/[0.06] bg-card px-4 py-3 sm:px-6">
            <Button variant="outline" size="lg" className="ml-auto" onClick={() => setDismissing(true)}>
              <Ban /> Not a tender
            </Button>
            <Button size="lg" onClick={create} disabled={!valid}>
              <Upload /> Create lead in D365
            </Button>
          </div>
        ))}
    </div>
  );
}

function HeaderField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function Section({ title, hint, ai, children }: { title: string; hint?: string; ai?: boolean; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5">
        <h2 className="text-sm font-bold text-primary">{title}</h2>
        {ai && <AiStar className="size-3 text-primary" />}
        {hint && <span className="ml-1 text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function Field({ label, ai, edited, children }: { label: string; ai?: boolean; edited?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid min-h-9 grid-cols-[112px_1fr] items-center gap-3">
      <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
        {label}
        {ai &&
          (edited ? (
            <span className="text-[10px] font-semibold text-primary" title="Changed by you">
              edited
            </span>
          ) : (
            <span title="Pre-filled by the AI">
              <AiStar className="size-2.5 text-primary" />
            </span>
          ))}
      </span>
      {children}
    </div>
  );
}

const INPUT =
  "h-8 w-full min-w-0 rounded-lg border border-transparent bg-muted/70 px-3 text-[13px] outline-none transition-colors hover:bg-muted focus:border-ring focus:bg-card focus:ring-1 focus:ring-ring disabled:bg-transparent disabled:px-0";

function TextInput({
  value,
  onChange,
  type = "text",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return <input type={type} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={INPUT} />;
}

function SelectInput({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative min-w-0">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(INPUT, "cursor-pointer appearance-none truncate pr-8")}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      {!disabled && (
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      )}
    </div>
  );
}

function ReadOnly({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <span className={cn("truncate px-3 text-[13px] text-foreground", mono && "tabular-nums")}>{children}</span>;
}

function ActionRow({ a }: { a: TenderAction }) {
  return (
    <li className="flex items-start gap-3 rounded-lg px-0 py-2 text-[13px]">
      {a.confidence === "Low" ? (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
      ) : (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
      )}
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          {a.label}
          {a.amountAED !== undefined && <span className="font-normal text-muted-foreground"> · {formatAED(a.amountAED, false)}</span>}
        </div>
        <div className="text-xs text-muted-foreground">
          {a.kind} · found in {a.foundIn}
          {a.confidence === "Low" && <span className="font-semibold text-amber-700 dark:text-amber-400"> · AI unsure, please check</span>}
        </div>
      </div>
      <span className={cn("shrink-0 text-xs", a.due ? "text-foreground/90" : "text-muted-foreground/70")}>
        {a.due ? formatDate(a.due) : "No date"}
      </span>
    </li>
  );
}
