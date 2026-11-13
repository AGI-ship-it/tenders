"use client";

import Link from "next/link";
import { AlertTriangle, Copy, ExternalLink, FilePlus2, Forward, Paperclip, Reply, ReplyAll, Sparkles } from "lucide-react";
import { channelOf, extractedFields, shortMailbox, type MailItem } from "@/lib/mailbox";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Tender } from "@/lib/types";
import { cn } from "@/lib/utils";
import { D365 } from "@/components/shared";

const TAG_TONES = [
  "bg-sky-50 text-sky-800 ring-sky-200",
  "bg-violet-50 text-violet-800 ring-violet-200",
  "bg-amber-50 text-amber-800 ring-amber-200",
  "bg-emerald-50 text-emerald-800 ring-emerald-200",
  "bg-rose-50 text-rose-800 ring-rose-200",
];

/** A small tag naming the mailbox an email arrived in, coloured per mailbox. */
export function MailboxTag({ address, className }: { address: string; className?: string }) {
  const tone = TAG_TONES[[...address].reduce((n, c) => n + c.charCodeAt(0), 0) % TAG_TONES.length];
  return (
    <span title={`Arrived in ${address}`} className={cn("inline-flex shrink-0 items-center rounded px-1.5 py-px font-mono text-[10px] font-medium ring-1 ring-inset", tone, className)}>
      {shortMailbox(address)}
    </span>
  );
}

/** One email as the agent saw it: header, attachments, the agent's verdict and extracted details, then the message. */
export function EmailView({ m, t, className }: { m: MailItem; t?: Tender; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col bg-white text-zinc-900 [font-family:'Segoe_UI',system-ui,sans-serif]", className)} style={{ "--border": "#e1dfdd", colorScheme: "light" } as React.CSSProperties}>
      <div className="shrink-0 border-b px-6 pt-5 pb-4">
        <h2 className="text-xl font-semibold">{m.subject}</h2>
        <div className="mt-4 flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-zinc-200 text-sm font-bold text-zinc-700">
            {m.from.split(/[\s·]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0 flex-1 text-[13px] leading-snug">
            <div className="font-semibold">
              {m.from} <span className="font-normal text-[#605e5c]">&lt;{m.address}&gt;</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#605e5c]">
              To: {m.mailbox} <MailboxTag address={m.mailbox} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-zinc-500">
            {[Reply, ReplyAll, Forward].map((I, i) => (
              <span key={i} className="grid size-8 place-items-center rounded">
                <I className="size-4 text-[#0f6cbd]" />
              </span>
            ))}
            <span className="ml-2 text-xs">{formatDateTime(m.at)}</span>
          </div>
        </div>
        {m.attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {m.attachments.map((a) => (
              <span key={a.name} className="flex items-center gap-2 rounded border border-[#e1dfdd] px-2.5 py-1.5 text-xs">
                <Paperclip className="size-3.5 text-zinc-500" />
                <span className="font-medium">{a.name}</span>
                <span className="text-zinc-500">{a.size}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f5f5f5] px-4 py-5 sm:px-8">
        <AgentPanel m={m} t={t} />
        {t && m.kind !== "duplicate" ? (
          channelOf(t) === "Client email" ? <ClientEmail t={t} attachment={m.attachments[0]?.name} /> : <PortalNotice t={t} from={m.from} />
        ) : (
          <PlainEmail lines={m.body ?? []} />
        )}
      </div>
    </div>
  );
}

/** What the agent made of the email: tender or not, the details it pulled out, and what to do next. */
export function AgentPanel({ m, t }: { m: MailItem; t?: Tender }) {
  const shell = "mx-auto mb-4 max-w-2xl overflow-hidden rounded-lg ring-1 [font-family:var(--font-sans)]";

  if (m.kind === "other")
    return (
      <div className={cn(shell, "flex items-center gap-2.5 bg-white px-4 py-2.5 text-xs text-zinc-500 ring-black/5")}>
        <Sparkles className="size-3.5 shrink-0 text-[#410266]/60" />
        <span>
          <span className="font-semibold text-zinc-700">Not a tender.</span> {m.note}
        </span>
      </div>
    );

  if (m.kind === "duplicate" && t)
    return (
      <div className={cn(shell, "flex flex-wrap items-center gap-3 bg-white px-4 py-3 ring-black/5")}>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-600">
          <Copy className="size-4" />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-bold text-zinc-800">Matches an existing lead</div>
          <div className="text-xs text-zinc-600">{m.note}</div>
        </div>
        <Link
          href={`/opportunity?id=${encodeURIComponent(t.id)}&from=inbox`}
          className="inline-flex h-9 items-center rounded-md border border-[#410266]/30 bg-white px-4 text-sm font-semibold text-[#410266] hover:bg-[#410266]/5"
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
    <div className={cn(shell, possible && draft ? "bg-amber-50/60 ring-amber-200" : "bg-[#f6f0fb] ring-[#410266]/15")}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-white", possible && draft ? "bg-amber-500" : "bg-[#410266]")}>
          {possible && draft ? <AlertTriangle className="size-4" /> : <Sparkles className="size-4" />}
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <div className={cn("font-bold", possible && draft ? "text-amber-900" : "text-[#410266]")}>
            {t.status === "Not a tender"
              ? "Dismissed by the Bid Analyst · not a tender"
              : possible && draft
                ? "Possible tender · draft prepared, please check"
                : draft
                  ? "Tender detected · lead draft prepared"
                  : "Tender detected · lead created"}
          </div>
          <div className="text-xs text-zinc-600">
            {draft ? (
              possible ? (
                m.note
              ) : (
                <>
                  The AI prepared a lead draft with the details below
                  {m.attachments.length > 0 && <>, including from {m.attachments[0].name}</>}. Nothing is in <D365 /> until you create it.
                </>
              )
            ) : (
              <>
                Lead <span className="font-mono font-semibold">{t.lead.leadId}</span> created in <D365 /> by {t.lead.createdBy} from the AI
                draft
              </>
            )}
          </div>
        </div>
        {draft ? (
          <Link
            href={`/lead?id=${encodeURIComponent(t.id)}`}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[#410266] px-5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <FilePlus2 className="size-4" /> Review & create lead
          </Link>
        ) : (
          <Link
            href={`/opportunity?id=${encodeURIComponent(t.id)}&from=inbox`}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[#410266]/30 bg-white px-4 text-sm font-semibold text-[#410266] hover:bg-[#410266]/5"
          >
            View lead
          </Link>
        )}
      </div>

      {/* Extracted details, each with where the AI found it. */}
      <dl className="divide-y divide-[#410266]/10 border-t border-[#410266]/10 bg-white/70">
        {fields.map((f) => (
          <div key={f.label} className="grid grid-cols-[110px_1fr_auto] items-start gap-3 px-4 py-2 text-[13px]">
            <dt className="text-zinc-500">{f.label}</dt>
            <dd className={cn("min-w-0 text-zinc-900", f.label === "Scope" && "line-clamp-2")}>{f.value}</dd>
            <dd className="max-w-48 truncate rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600" title={`Found in: ${f.source}`}>
              {f.source}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A portal's own notification email. */
function PortalNotice({ t, from }: { t: Tender; from: string }) {
  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-md bg-white text-zinc-800 shadow-sm ring-1 ring-black/5">
      <div className="bg-zinc-800 px-6 py-3 text-sm font-semibold text-white">{from}</div>
      <div className="space-y-4 p-6 text-sm">
        <p>Dear Supplier,</p>
        <p className="text-[#605e5c]">A new tender matching your registered categories has been published.</p>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {[
              ["Tender no.", <span key="r" className="font-mono">{t.sourceRef}</span>],
              ["Client", t.buyer],
              ["Title", t.title],
              ["Location", t.location],
              ["Opening date", formatDate(t.publishedAt)],
              ["Closing date", <span key="d" className="font-semibold">{formatDate(t.deadline)}</span>],
            ].map(([k, v]) => (
              <tr key={k as string} className="border-b border-[#e1dfdd] last:border-0">
                <th className="w-32 py-2 pr-3 text-left align-top font-semibold text-zinc-500">{k}</th>
                <td className="py-2">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          <div className="mb-1.5 font-semibold text-zinc-500">Scope</div>
          <p className="text-zinc-700">{t.summary}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600">
            {t.scope.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <p>
          <span className="inline-flex items-center gap-1 font-semibold text-[#0f6cbd]">
            View the tender on the portal <ExternalLink className="size-3.5" />
          </span>
        </p>
        <p className="border-t border-[#e1dfdd] pt-3 text-xs text-zinc-400">This is an automated notification. Please do not reply to this email.</p>
      </div>
    </div>
  );
}

/** A client writing to AGFS directly: a short note, with the details in the attached RFP. */
function ClientEmail({ t, attachment }: { t: Tender; attachment?: string }) {
  return (
    <div className="mx-auto max-w-2xl space-y-3 rounded-md bg-white p-6 text-sm text-zinc-800 shadow-sm ring-1 ring-black/5">
      <p>Dear AGFS Sales team,</p>
      <p>
        {t.buyer} invites you to submit a proposal for {t.title.charAt(0).toLowerCase() + t.title.slice(1)} at {t.location}.
      </p>
      <p>
        Please find our request for proposal attached{attachment && <> ({attachment})</>}, with the scope of services and
        submission requirements. Kindly confirm your intention to bid at your earliest convenience.
      </p>
      <p>Best regards,</p>
      <p className="text-zinc-600">
        Procurement
        <br />
        {t.buyer}
      </p>
    </div>
  );
}

function PlainEmail({ lines }: { lines: string[] }) {
  return (
    <div className="mx-auto max-w-2xl space-y-3 rounded-md bg-white p-6 text-sm text-zinc-800 shadow-sm ring-1 ring-black/5">
      {lines.map((l, i) => (
        <p key={i}>{l}</p>
      ))}
    </div>
  );
}
