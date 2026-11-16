"use client";

import Link from "next/link";
import { AlertTriangle, Copy, ExternalLink, Paperclip, Sparkles } from "lucide-react";
import { channelOf, extractedFields, shortMailbox, type MailItem } from "@/lib/mailbox";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Tender } from "@/lib/types";
import { cn } from "@/lib/utils";

const TAG_TONES = [
  "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-800/70",
  "bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-800/70",
  "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800/70",
  "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800/70",
  "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800/70",
];

/** A small tag naming the mailbox an email arrived in, coloured per mailbox. */
export function MailboxTag({ address, className }: { address: string; className?: string }) {
  const tone = TAG_TONES[[...address].reduce((n, c) => n + c.charCodeAt(0), 0) % TAG_TONES.length];
  return (
    <span
      title={`Arrived in ${address}`}
      className={cn(
        "inline-flex shrink-0 items-center rounded px-1.5 py-px font-mono text-[10px] font-medium ring-1 ring-inset",
        tone,
        className,
      )}
    >
      {shortMailbox(address)}
    </span>
  );
}

/** One email as the agent saw it: header, attachments, the agent's verdict and extracted details, then the message. */
export function EmailView({ m, t, className }: { m: MailItem; t?: Tender; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col bg-card text-foreground", className)}>
      <div className="shrink-0 border-b px-5 pt-4 pb-3 pr-12">
        <h2 className="truncate text-base font-semibold" title={m.subject}>
          {m.subject}
        </h2>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 truncate" title={`${m.from} <${m.address}> · to ${m.mailbox}`}>
            <span className="font-semibold text-foreground">{m.from}</span> → <MailboxTag address={m.mailbox} />
          </span>
          <span className="ml-auto shrink-0">{formatDateTime(m.at)}</span>
        </div>
        {m.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {m.attachments.map((a) => (
              <span key={a.name} className="flex items-center gap-1.5 rounded border border-border px-2 py-0.5 text-[11px]" title={a.size}>
                <Paperclip className="size-3 text-muted-foreground" />
                {a.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/40 p-4">
        <AgentPanel m={m} t={t} />
        {t && m.kind !== "duplicate" ? (
          channelOf(t) === "Client email" ? (
            <ClientEmail t={t} attachment={m.attachments[0]?.name} />
          ) : (
            <PortalNotice t={t} from={m.from} />
          )
        ) : (
          <PlainEmail lines={m.body ?? []} />
        )}
      </div>
    </div>
  );
}

/** What the agent made of the email: tender or not, the details it pulled out, and what to do next. */
export function AgentPanel({ m, t }: { m: MailItem; t?: Tender }) {
  const shell = "mx-auto mb-4 max-w-2xl overflow-hidden rounded-lg ring-1";

  if (m.kind === "other")
    return (
      <div className={cn(shell, "flex items-center gap-2.5 bg-card px-4 py-2.5 text-xs text-muted-foreground ring-border")}>
        <Sparkles className="size-3.5 shrink-0 text-primary/60" />
        <span>
          <span className="font-semibold text-foreground/90">Not a tender.</span> {m.note}
        </span>
      </div>
    );

  if (m.kind === "duplicate" && t)
    return (
      <div className={cn(shell, "flex flex-wrap items-center gap-3 bg-card px-4 py-3 ring-border")}>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Copy className="size-4" />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-bold text-foreground">Matches an existing lead</div>
          <div className="text-xs text-muted-foreground">{m.note}</div>
        </div>
        <Link
          href={`/opportunity?id=${encodeURIComponent(t.id)}&from=inbox`}
          className="inline-flex h-9 items-center rounded-md border border-primary/30 bg-card px-4 text-sm font-semibold text-primary hover:bg-primary/5"
        >
          View {t.lead.leadId}
        </Link>
      </div>
    );

  if (!t) return null;
  const draft = t.status === "Draft";
  const possible = m.kind === "possible";
  const fields = extractedFields(t);

  return (
    <div
      className={cn(
        shell,
        "flex items-center gap-2.5 px-3.5 py-2.5 text-xs",
        possible && draft
          ? "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900"
          : "bg-primary/5 text-primary ring-primary/15",
      )}
    >
      {possible && draft ? <AlertTriangle className="size-3.5 shrink-0" /> : <Sparkles className="size-3.5 shrink-0" />}
      <span className="font-semibold">
        {t.status === "Not a tender"
          ? "Dismissed · not a tender"
          : possible && draft
            ? "Possible tender · please check"
            : draft
              ? `Tender · lead draft prepared${fields.length ? ` · ${fields.length} details read` : ""}`
              : `Tender · lead ${t.lead.leadId} created`}
      </span>
    </div>
  );
}

/** A portal's own notification email. */
function PortalNotice({ t, from }: { t: Tender; from: string }) {
  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-md bg-card text-foreground shadow-sm ring-1 ring-border">
      <div className="bg-zinc-800 px-4 py-2 text-xs dark:bg-zinc-700 font-semibold text-white">{from}</div>
      <div className="space-y-3 p-4 text-[13px]">
        <p>Dear Supplier,</p>
        <p className="text-muted-foreground">A new tender matching your registered categories has been published.</p>
        <table className="w-full border-collapse">
          <tbody>
            {[
              [
                "Tender no.",
                <span key="r" className="font-mono">
                  {t.sourceRef}
                </span>,
              ],
              ["Client", t.buyer],
              ["Title", t.title],
              ["Location", t.location],
              ["Opening date", formatDate(t.publishedAt)],
              [
                "Closing date",
                <span key="d" className="font-semibold">
                  {formatDate(t.deadline)}
                </span>,
              ],
            ].map(([k, v]) => (
              <tr key={k as string} className="border-b border-border last:border-0">
                <th className="w-28 py-1.5 pr-3 text-left align-top font-semibold text-muted-foreground">{k}</th>
                <td className="py-1.5">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          <div className="mb-1.5 font-semibold text-muted-foreground">Scope</div>
          <p className="text-foreground/90">{t.summary}</p>
        </div>
        <p>
          <span className="inline-flex items-center gap-1 font-semibold text-primary">
            View the tender on the portal <ExternalLink className="size-3.5" />
          </span>
        </p>
      </div>
    </div>
  );
}

/** A client writing to AGFS directly: a short note, with the details in the attached RFP. */
function ClientEmail({ t, attachment }: { t: Tender; attachment?: string }) {
  return (
    <div className="mx-auto max-w-2xl space-y-2.5 rounded-md bg-card p-4 text-[13px] text-foreground shadow-sm ring-1 ring-border">
      <p>Dear AGFS Sales team,</p>
      <p>
        {t.buyer} invites you to submit a proposal for {t.title.charAt(0).toLowerCase() + t.title.slice(1)} at {t.location}.
      </p>
      <p>
        Please find our request for proposal attached{attachment && <> ({attachment})</>}, with the scope of services and submission
        requirements. Kindly confirm your intention to bid at your earliest convenience.
      </p>
      <p>Best regards,</p>
      <p className="text-muted-foreground">
        Procurement
        <br />
        {t.buyer}
      </p>
    </div>
  );
}

function PlainEmail({ lines }: { lines: string[] }) {
  return (
    <div className="mx-auto max-w-2xl space-y-2.5 rounded-md bg-card p-4 text-[13px] text-foreground shadow-sm ring-1 ring-border">
      {lines.map((l, i) => (
        <p key={i}>{l}</p>
      ))}
    </div>
  );
}
