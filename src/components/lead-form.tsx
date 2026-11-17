"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Ban, CheckCircle2, ChevronDown, Mail, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { createLead, dismissDraft, useDemo, type LeadEdits } from "@/lib/store";
import { aiPrequalified } from "@/lib/scoring";
import { formatAED, formatDate, formatDateTime } from "@/lib/format";
import type { Category, Emirate, Tender, TenderAction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { channelOf, mailboxOfTender, senderOf } from "@/lib/mailbox";
import { Button } from "@/components/ui/button";
import { boldD365 } from "@/components/shared";
import { AiSpark } from "@/components/ai-spark";

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
}: {
  tender: Tender;
  /** Other drafts still to review. */
  waiting: number;
  /** Called after the draft is created or dismissed, to move on to the next one. */
  onDone: () => void;
  onOpenEmail?: () => void;
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
      {/* Command bar */}
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border bg-card px-3 text-[13px] text-foreground/90">
        {onOpenEmail && (
          <button onClick={onOpenEmail} className="flex items-center gap-1.5 rounded px-2.5 py-1.5 hover:bg-muted">
            <Mail className="size-4 text-primary" /> View email
          </button>
        )}
        {draft && (
          <span className="ml-auto pr-2 text-xs text-muted-foreground">
            {waiting ? `${waiting} more draft${waiting === 1 ? "" : "s"} to review` : "Last draft to review"}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Record header */}
        <div className="relative border-b border-border bg-card px-4 py-4 pr-14 @2xl:px-5 @2xl:pr-16">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-primary">{f.title || "Untitled lead"}</h1>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {draft ? "Lead draft · not in D365 yet" : dismissed ? "Draft dismissed · not a tender" : `Lead · ${t.lead.state}`}
              </div>
            </div>
            <dl className="flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
              <HeaderField
                label="Lead number"
                value={
                  draft || dismissed ? (
                    <span className="font-normal text-muted-foreground">Given on create</span>
                  ) : (
                    <span className="font-mono">{t.lead.leadId}</span>
                  )
                }
              />
              <HeaderField label="Date bid received" value={formatDate(t.discoveredAt)} />
              <HeaderField
                label={draft || dismissed ? "Prepared by" : "Created by"}
                value={draft || dismissed ? "AI agent" : t.lead.createdBy}
              />
              <HeaderField label="Owner" value={t.lead.owner} />
            </dl>
            {draft && (
              <AiSpark label="How the AI prepared this draft" className="absolute top-4 right-4 @2xl:right-5">
                <span className="block font-semibold">Draft prepared by the AI from {mailboxOfTender(t, demo.mailboxes)}</span>
                <span className="block opacity-80">
                  From the email {sender.name} sent {formatDateTime(t.discoveredAt)}. Check the details it filled in, correct anything, then
                  create the lead. Nothing is in D365 until you do.
                </span>
              </AiSpark>
            )}
          </div>
        </div>

        <div className="space-y-4 p-4 @2xl:p-5">
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

          <div className="grid gap-4 @3xl:grid-cols-2">
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

            <div className="space-y-4">
              <Section title="Dates">
                <Field label="Date bid received">
                  <ReadOnly>{formatDate(t.discoveredAt)}</ReadOnly>
                </Field>
                <Field label="Opening date" ai edited={edited("publishedAt")}>
                  <TextInput type="date" value={f.publishedAt} onChange={(v) => set("publishedAt", v)} disabled={!draft} />
                </Field>
                <Field label="Closing date" ai edited={edited("deadline")}>
                  <TextInput type="date" value={f.deadline} onChange={(v) => set("deadline", v)} disabled={!draft} />
                </Field>
              </Section>

              <Section title="Scope">
                <div className="px-4 py-3">
                  <textarea
                    value={f.summary}
                    disabled={!draft}
                    onChange={(e) => set("summary", e.target.value)}
                    rows={4}
                    className="w-full resize-y rounded border border-input bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-ring focus:ring-1 focus:ring-ring disabled:border-transparent disabled:bg-muted"
                  />
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
                    {t.scope.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              </Section>
            </div>
          </div>

          <Section title="Actions found by the AI" hint={lowConfidence ? `${lowConfidence} to check` : `${t.actions.length} items`}>
            <ul className="divide-y divide-border">
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
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-card px-4 py-3 sm:px-6">
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
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border bg-card px-4 py-3 sm:px-6">
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
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg bg-zinc-50 ring-1 ring-border/70 dark:bg-white/[0.03]">
      <div className="flex items-baseline justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-bold text-primary">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, ai, edited, children }: { label: string; ai?: boolean; edited?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-center gap-3 border-b border-border/60 px-4 py-2 last:border-0">
      <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
        {label}
        {ai &&
          (edited ? (
            <span className="text-[10px] font-semibold text-primary" title="Changed by you">
              edited
            </span>
          ) : (
            <span title="Pre-filled by the AI">
              <Sparkles className="size-3 text-primary/70" />
            </span>
          ))}
      </span>
      {children}
    </div>
  );
}

const INPUT =
  "h-8 w-full min-w-0 rounded border border-input bg-card px-2.5 text-[13px] outline-none focus:border-ring focus:ring-1 focus:ring-ring disabled:border-transparent disabled:bg-muted";

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
  return <span className={cn("truncate px-2.5 text-[13px] text-foreground", mono && "font-mono")}>{children}</span>;
}

function ActionRow({ a }: { a: TenderAction }) {
  return (
    <li className="flex items-start gap-3 px-4 py-2.5 text-[13px]">
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
