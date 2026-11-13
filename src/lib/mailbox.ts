import { formatAED, formatDate } from "./format";
import type { MailboxConnection, Source, Tender } from "./types";

// The shared sales mailbox as the agent sees it. Tenders arrive mixed in with everyday sales mail, from portal alerts
// and straight from clients (often with the RFP attached). The agent decides which emails are tenders and pulls out
// the details. All senders, addresses and messages are FICTIONAL.

export const MAILBOX_NAME = "Sales mailbox (shared)";
export const MAILBOX_ADDRESS = "sales@agfs.demo.example";
export const TENDERS_ADDRESS = "tenders@agfs.demo.example";

/** How a tender reached the mailbox. */
export type Channel = "Portal alert" | "Client email";

/** The agent's call on an email. */
export type MailKind = "tender" | "possible" | "duplicate" | "other";

export interface Attachment {
  name: string;
  size: string;
}

/** One detail the agent extracted, with where in the email it found it. */
export interface Extracted {
  label: string;
  value: string;
  source: string;
}

export interface MailItem {
  id: string;
  kind: MailKind;
  from: string;
  address: string;
  subject: string;
  preview: string;
  at: string;
  attachments: Attachment[];
  /** The tender this email is (kind tender / possible) or repeats (kind duplicate). */
  tenderId?: string;
  /** The agent's one-line reason for its call. */
  note?: string;
  /** Plain-text body for non-tender mail and duplicates. */
  body?: string[];
  /** How a tender email arrived; unset for non-tender mail. */
  channel?: Channel;
  /** The connected mailbox the email arrived in. */
  mailbox: string;
}

type Box = Pick<MailboxConnection, "address" | "kind">;

/** "sales@agfs.demo.example" → "sales@", for tags. */
export const shortMailbox = (address: string) => `${address.split("@")[0]}@`;

/**
 * Which connected mailbox an email arrived in. Portal alerts go to a tenders/bids mailbox, a consultant's forward to
 * someone's personal mailbox, client RFPs and everyday mail to sales@; anything without a better home lands in the
 * main shared mailbox (the first one connected). With one mailbox connected, everything is in it.
 */
export function mailboxFor(kind: MailKind, channel: Channel | undefined, boxes: Box[]): string {
  if (boxes.length === 0) return MAILBOX_ADDRESS;
  const local = (b: Box) => b.address.split("@")[0].toLowerCase();
  const primary = boxes.find((b) => b.kind === "Shared") ?? boxes[0];
  const pick =
    kind === "duplicate"
      ? boxes.find((b) => b.kind === "Personal")
      : channel === "Portal alert"
        ? boxes.find((b) => /tender|bid|rfp|procure/.test(local(b)))
        : boxes.find((b) => /sales/.test(local(b)));
  return (pick ?? primary).address;
}

/** The mailbox a tender's email arrived in. */
export const mailboxOfTender = (t: Tender, boxes: Box[]) => mailboxFor("tender", channelOf(t), boxes);

/** Emails the agent was not sure were tenders: the Bid Analyst should check before creating the lead. */
const POSSIBLE: Record<string, string> = {
  "TND-2026-0329":
    "Reads like a request for quotation, but the email has no tender number and calls it a \"pricing request\". The AI prepared a draft anyway; check it is a real tender before creating the lead. Closing date and scope come from the attachment.",
};

const CONTACTS: Record<string, [string, string]> = {
  "Meridian Properties": ["Hana Qureshi", "procurement@meridian-properties.example"],
  "Harbourline Developments": ["Tariq Bakr", "t.bakr@harbourline.example"],
};

export function channelOf(t: Tender): Channel {
  return t.buyerType === "Private client" ? "Client email" : "Portal alert";
}

export function senderOf(t: Tender, source?: Source): { name: string; address: string } {
  if (channelOf(t) === "Client email") {
    const [name, address] = CONTACTS[t.buyer] ?? ["Procurement team", `procurement@${t.buyer.toLowerCase().replace(/[^a-z]+/g, "-")}.example`];
    return { name: `${name} · ${t.buyer}`, address };
  }
  const host = source?.url.replace(/^https?:\/\//, "").split("/")[0] ?? "portal.example";
  return { name: source?.name ?? "Tender portal", address: `alerts@${host}` };
}

export function attachmentsOf(t: Tender): Attachment[] {
  if (channelOf(t) !== "Client email") return [];
  return [
    { name: `${t.sourceRef} RFP.pdf`, size: "2.4 MB" },
    { name: "Bill of quantities.xlsx", size: "180 KB" },
  ];
}

export function subjectOf(t: Tender): string {
  if (t.id in POSSIBLE) return `Pricing request: ${t.title.toLowerCase()}`;
  return channelOf(t) === "Client email" ? `Request for proposal: ${t.title}` : `New tender: ${t.title}`;
}

/** The details the agent pulled out of the email, each with where it found it. */
export function extractedFields(t: Tender): Extracted[] {
  const client = channelOf(t) === "Client email";
  const rfp = attachmentsOf(t)[0]?.name ?? "";
  const body = "Email body";
  const doc = (section: string) => (client ? `${rfp}, ${section}` : body);
  const fee = t.actions.find((a) => a.kind === "Tender fee");
  const nda = t.actions.find((a) => a.kind === "NDA");
  const visit = t.actions.find((a) => a.kind === "Site visit");
  const out: Extracted[] = [
    { label: "Client", value: t.buyer, source: client ? "Email signature" : body },
    { label: "Tender no.", value: t.sourceRef, source: doc("cover page") },
    { label: "Service", value: `${t.category} · ${t.emirate}`, source: doc("section 1") },
    { label: "Scope", value: t.summary, source: doc("section 3") },
    { label: "Opening date", value: formatDate(t.publishedAt), source: client ? "Email date" : body },
    { label: "Closing date", value: formatDate(t.deadline), source: doc("section 2.2") },
  ];
  if (visit?.due) out.push({ label: "Site visit", value: formatDate(visit.due), source: visit.foundIn });
  if (fee?.amountAED) out.push({ label: "Tender fee", value: formatAED(fee.amountAED, false), source: fee.foundIn });
  if (nda) out.push({ label: "NDA", value: "Required before documents are released", source: nda.foundIn });
  return out;
}

const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

/** Everyday sales mail around the tenders. The agent leaves these alone. */
function otherMail(): Omit<MailItem, "mailbox">[] {
  return [
    {
      id: "m-invoice",
      kind: "other",
      from: "Accounts · Oasis Retail Holdings",
      address: "accounts@oasis-retail.example",
      subject: "Invoice INV-20931 query",
      preview: "Could you resend the October invoice with the PO number on it?",
      at: ago(2),
      attachments: [],
      note: "Invoice query from an existing client.",
      body: ["Hello,", "Could you resend the October invoice with our PO number on it? Our system rejected the copy we received.", "Thanks, Accounts team"],
    },
    {
      id: "m-newsletter",
      kind: "other",
      from: "FM Middle East Weekly",
      address: "news@fm-weekly.example",
      subject: "This week: district cooling demand rises",
      preview: "Market news, events and the latest contract awards across the GCC…",
      at: ago(5),
      attachments: [],
      note: "Newsletter. Mentions contract awards, but no invitation to bid.",
      body: ["This week: district cooling demand rises across the region, a new FM standards consultation, and the latest contract awards."],
    },
    {
      id: "m-supplier",
      kind: "other",
      from: "BrightClean Supplies",
      address: "sales@brightclean.example",
      subject: "Special offer on microfibre consumables",
      preview: "Bulk pricing for Q1 orders placed before 30 November…",
      at: ago(8),
      attachments: [{ name: "Price list Q1.pdf", size: "640 KB" }],
      note: "Supplier offer to AGFS, not a client asking for a bid.",
      body: ["Dear partner,", "We're pleased to offer bulk pricing on microfibre consumables for Q1 orders placed before 30 November. Price list attached."],
    },
    {
      id: "m-meeting",
      kind: "other",
      from: "Rania Saleh",
      address: "rania.saleh@agfs.demo.example",
      subject: "Pipeline review moved to Thursday",
      preview: "Moving our weekly pipeline review to Thursday 10:00…",
      at: ago(26),
      attachments: [],
      note: "Internal email.",
      body: ["Hi team,", "Moving our weekly pipeline review to Thursday 10:00. Same room.", "Rania"],
    },
    {
      id: "m-client",
      kind: "other",
      from: "Facilities · Capital Transit Authority",
      address: "facilities@cta.example",
      subject: "Re: Monthly KPI report",
      preview: "Thanks for the report. A few questions on the helpdesk response times…",
      at: ago(30),
      attachments: [],
      note: "Existing-contract correspondence.",
      body: ["Thanks for the report. A few questions on the helpdesk response times in week 3; can we discuss on Monday?"],
    },
  ];
}

/** A consultant forwarding a tender that is already a lead: the agent matches it instead of drafting a second one. */
function duplicateMail(tenders: Tender[]): Omit<MailItem, "mailbox">[] {
  const t = tenders.find((x) => x.id === "TND-2026-0302" && x.status !== "Draft");
  if (!t) return [];
  return [
    {
      id: "m-dup-0302",
      kind: "duplicate",
      from: "Yusuf Harb · Crestline Consultants",
      address: "y.harb@crestline-consult.example",
      subject: `Fwd: Invitation to tender – ${t.title}`,
      preview: `Forwarding the invitation for ${t.buyer} in case you have not seen it…`,
      at: ago(3),
      attachments: [{ name: `${t.sourceRef} Invitation.pdf`, size: "1.1 MB" }],
      tenderId: t.id,
      note: `Same tender as lead ${t.lead.leadId} (tender no. ${t.sourceRef}). Linked to that lead instead of creating a second one.`,
      body: [
        "Hi,",
        `Forwarding the invitation to tender from ${t.buyer} in case you have not seen it. Closing ${formatDate(t.deadline)}.`,
        "Best, Yusuf",
      ],
    },
  ];
}

/**
 * Every connected mailbox together: tender emails (new and handled), duplicates, and everyday mail, newest first. Each
 * email is tagged with the mailbox it arrived in.
 */
export function buildMailbox(tenders: Tender[], sources: Source[], boxes: Box[], handledShown = 6): MailItem[] {
  const byNewest = (a: { at: string }, b: { at: string }) => b.at.localeCompare(a.at);
  const asMail = (t: Tender): Omit<MailItem, "mailbox"> => {
    const from = senderOf(t, sources.find((s) => s.id === t.sourceId));
    return {
      channel: channelOf(t),
      id: `m-${t.id}`,
      kind: t.id in POSSIBLE && t.status === "Draft" ? "possible" : "tender",
      from: from.name,
      address: from.address,
      subject: subjectOf(t),
      preview: t.buyer,
      at: t.discoveredAt,
      attachments: attachmentsOf(t),
      tenderId: t.id,
      note: POSSIBLE[t.id],
    };
  };
  const fresh = tenders.filter((t) => t.status === "Draft").map(asMail);
  const handled = tenders
    .filter((t) => t.status !== "Draft")
    .sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt))
    .slice(0, handledShown)
    .map(asMail);
  return [...fresh, ...handled, ...duplicateMail(tenders), ...otherMail()]
    .map((m) => ({ ...m, mailbox: mailboxFor(m.kind, m.channel, boxes) }))
    .sort(byNewest);
}
