"use client";

import { useSyncExternalStore } from "react";
import {
  AGENT_NAME,
  BIDDING_AGENT,
  DEMO_VERSION,
  PEOPLE,
  VP_LABEL,
  actingPerson,
  autoOppId,
  scanBatches,
  seedState,
  serviceLineFor,
  tenderHistory,
} from "./mock-data";
import { aiPrequalified, isActive, priorityScore } from "./scoring";
import type { ApprovalRecord, AuditEvent, DemoState, MailboxConnection, OpsInput, Role, Source, Tender } from "./types";
import { MAILBOX_ADDRESS, TENDERS_ADDRESS } from "./mailbox";

const KEY = "agfs-tender-intelligence-demo";

let state: DemoState | null = null;
const listeners = new Set<() => void>();

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed.version === DEMO_VERSION) return parsed;
    }
  } catch {
    // Storage unavailable or corrupt; fall back to seed data.
  }
  return seedState();
}

function getSnapshot(): DemoState {
  if (!state) state = load();
  return state;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setState(update: (s: DemoState) => DemoState) {
  state = update(getSnapshot());
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Non-fatal: the demo still works for this session.
  }
  listeners.forEach((l) => l());
}

/** Returns null during server render / hydration, then the client state. */
export function useDemo(): DemoState | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

// ---------------------------------------------------------------------------

const now = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);

export function currentUser(s: Pick<DemoState, "role" | "opsLine">) {
  return actingPerson(s.role, s.opsLine);
}

function event(e: Omit<AuditEvent, "id" | "at">): AuditEvent {
  return { id: uid(), at: now(), ...e };
}

function patchTender(s: DemoState, id: string, fn: (t: Tender) => Tender): Tender[] {
  return s.tenders.map((t) => (t.id === id ? fn(t) : t));
}

/** Switches the demo role; for the HoD role, opsLine picks which service line's HoD to act as. */
export function setRole(role: Role, opsLine?: string) {
  setState((s) => ({ ...s, role, opsLine: opsLine ?? s.opsLine }));
}

export function resetDemo() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  state = seedState();
  listeners.forEach((l) => l());
}

/** A source is scanned only when it is not paused and no sign-in is outstanding. */
export function isScannable(src: Source) {
  return src.status !== "Paused" && src.accessState === "Ready";
}

/**
 * Tenders the portal scan also finds that already arrived as email alerts. They are matched to the existing lead,
 * so no second lead is created (shown in the scan log and results).
 */
export function alreadyLeadsFromEmail(tenders: Tender[]): Tender[] {
  return tenders
    .filter((t) => t.intake === "Email alert" && isActive(t))
    .sort((a, b) => b.lead.createdAt.localeCompare(a.lead.createdAt))
    .slice(0, 2);
}

export interface ScanResult {
  newTenders: Tender[];
  duplicates: number;
  sourcesScanned: number;
  sourcesSkipped: number;
}

/** Applies the outcome of a simulated scan. Deduplicates on tender ID. */
/**
 * Applies a simulated scan. A discovering scan takes the next batch of fictional tenders not yet in the pipeline
 * (deduplicated on tender ID). A check-in scan (on sign-in) finds nothing new and reports the open prospects it
 * matched instead.
 */
export function completeScan({ discover = true }: { discover?: boolean } = {}): ScanResult {
  const s = getSnapshot();
  const at = now();
  const active = s.sources.filter((src) => isScannable(src) && src.kind !== "Upload");
  const existing = new Set(s.tenders.map((t) => t.id));
  const batch = discover ? (scanBatches(at).find((b) => b.some((t) => !existing.has(t.id))) ?? []) : [];
  // Each new tender becomes a D365 lead straight away, with its dates, fees and NDAs logged as actions.
  const fresh = batch.filter((t) => !existing.has(t.id));
  const alreadyLeads = discover ? alreadyLeadsFromEmail(s.tenders) : [];
  const matched = [...s.tenders].filter(isActive).sort((x, y) => priorityScore(y) - priorityScore(x));
  // Duplicates are re-postings of prospects already in the pipeline.
  const duplicates = Math.min(matched.length, 4) + (batch.length - fresh.length);

  const portals = s.sources.filter((src) => src.kind !== "Upload");
  setState((st) => ({
    ...st,
    scanCount: st.scanCount + 1,
    lastScanAt: at,
    lastScan: {
      at,
      scanned: active.length,
      duplicates,
      newIds: fresh.map((t) => t.id),
      foundIds: fresh.length ? [] : matched.slice(0, 5).map((t) => t.id),
      alreadyLeadIds: alreadyLeads.map((t) => t.id),
      runs: portals.map((src) => ({
        sourceId: src.id,
        outcome: src.status === "Paused" ? "paused" : isScannable(src) ? "scanned" : "sign-in",
      })),
    },
    tenders: [...fresh, ...st.tenders.map((t) => ({ ...t, fromLatestScan: false }))],
    sources: st.sources.map((src) =>
      !isScannable(src)
        ? src
        : {
            ...src,
            lastScanAt: at,
            tendersFound: src.tendersFound + fresh.filter((t) => t.sourceId === src.id).length,
          },
    ),
    audit: [
      event({
        actor: AGENT_NAME,
        role: "agent",
        action: "AI scan completed",
        detail: `${active.length} sources checked, ${fresh.length} new tenders, ${fresh.length} leads created in D365, ${duplicates} duplicates skipped (simulated).`,
      }),
      ...fresh.flatMap(tenderHistory).map((e) => ({ ...e, id: uid() })),
      ...alreadyLeads.map((t) =>
        event({
          actor: AGENT_NAME,
          role: "agent",
          action: `Found on portal scan; already lead ${t.lead.leadId} from email alert`,
          tenderId: t.id,
        }),
      ),
      ...st.audit,
    ],
  }));

  return {
    newTenders: fresh,
    duplicates,
    sourcesScanned: active.length,
    sourcesSkipped: s.sources.length - active.length,
  };
}

/** Lead fields the Bid Analyst can correct on the D365 lead form before confirming. */
export type LeadEdits = Partial<
  Pick<Tender, "title" | "buyer" | "summary" | "category" | "emirate" | "location" | "publishedAt" | "deadline">
>;

/**
 * Screen 2: the Bid Analyst checks the draft the AI prepared and pushes it: the lead is created in D365 with their
 * corrections, the AI prequalifies it, and it goes to the BD Head.
 */
export function createLead(id: string, edits: LeadEdits) {
  setState((s) => {
    const by = currentUser(s).name;
    const at = now();
    const t = s.tenders.find((x) => x.id === id);
    if (!t || t.status !== "Draft") return s;
    const next: Tender = {
      ...t,
      ...edits,
      status: "BD Head review",
      fromLatestScan: false,
      actions: t.actions.map((a) => ({ ...a, confirmed: true })),
      lead: { ...t.lead, createdBy: by, createdAt: at, confirmedBy: by, confirmedAt: at },
      approval: { submittedBy: by, submittedAt: at, reviewer: VP_LABEL, note: "" },
    };
    return {
      ...s,
      tenders: s.tenders.map((x) => (x.id === id ? next : x)),
      audit: [
        event({
          actor: AGENT_NAME,
          role: "agent",
          action: `AI prequalified: ${aiPrequalified(next) ? "Yes" : "No"}; sent to ${PEOPLE.vp.name} (BD Head)`,
          tenderId: id,
        }),
        event({
          actor: by,
          role: s.role,
          action: `Created lead ${t.lead.leadId} in D365 from the AI draft`,
          tenderId: id,
          detail: Object.keys(edits).length ? `Corrected: ${Object.keys(edits).join(", ")}` : undefined,
        }),
        ...s.audit,
      ],
    };
  });
}

/** The Bid Analyst dismisses a draft: it is not a tender, so no lead is created. The reason teaches the AI. */
export function dismissDraft(id: string, reason: string) {
  setState((s) => {
    const t = s.tenders.find((x) => x.id === id);
    if (!t || t.status !== "Draft") return s;
    return {
      ...s,
      tenders: s.tenders.map((x) => (x.id === id ? { ...x, status: "Not a tender" as const, fromLatestScan: false } : x)),
      audit: [
        event({ actor: currentUser(s).name, role: s.role, action: "Dismissed the draft: not a tender", tenderId: id, detail: reason }),
        ...s.audit,
      ],
    };
  });
}

/** The BD Head asks the service line's HoD whether they are interested (reply within 24 h), logged on the D365 lead. */
export function askHod(id: string, note: string) {
  setState((s) => {
    const t = s.tenders.find((x) => x.id === id);
    if (!t || t.status !== "BD Head review") return s;
    const line = serviceLineFor(t.category);
    const at = now();
    return {
      ...s,
      tenders: patchTender(s, id, (x) => ({
        ...x,
        status: "Awaiting HoD",
        opsInput: {
          person: line.opsHead,
          line: line.name,
          askedAt: at,
          dueAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
          remindersSent: 0,
          note: note || undefined,
        },
      })),
      audit: [
        event({
          actor: currentUser(s).name,
          role: s.role,
          action: `Asked ${line.opsHead} (HoD, ${line.name}) if interested; reply within 24 h`,
          tenderId: id,
          detail: [note, "Logged in D365"].filter(Boolean).join(" · "),
        }),
        ...s.audit,
      ],
    };
  });
}

/** The HoD replies interested or not, logged on the D365 lead. The lead goes back to the BD Head to decide. */
export function recordHodReply(id: string, reply: NonNullable<OpsInput["reply"]>) {
  setState((s) => {
    const t = s.tenders.find((x) => x.id === id);
    if (!t?.opsInput || t.status !== "Awaiting HoD") return s;
    return {
      ...s,
      tenders: patchTender(s, id, (x) => ({
        ...x,
        status: "BD Head review",
        opsInput: x.opsInput && { ...x.opsInput, reply, repliedAt: now() },
      })),
      audit: [
        event({
          actor: t.opsInput.person,
          role: "ops",
          action: `HoD: ${reply.toLowerCase()} to bid; back to ${PEOPLE.vp.name}`,
          tenderId: id,
          detail: "Logged in D365",
        }),
        ...s.audit,
      ],
    };
  });
}

/**
 * The BD Head's decision, logged on the D365 lead. Approving converts the lead into a D365 opportunity and hands it to
 * the bidding agent; rejecting disqualifies it. They can decide while an HoD's reply is still open.
 */
export function decide(id: string, decision: NonNullable<ApprovalRecord["decision"]>, comment: string) {
  setState((s) => {
    const by = currentUser(s).name;
    const at = now();
    const t = s.tenders.find((x) => x.id === id);
    if (!t || (t.status !== "BD Head review" && t.status !== "Awaiting HoD")) return s;
    const base = t.approval ?? { submittedBy: PEOPLE.analyst.name, submittedAt: at, reviewer: VP_LABEL, note: "" };
    const approved = decision === "Approved";
    const oppId = autoOppId(id);
    return {
      ...s,
      tenders: patchTender(s, id, (x) => ({
        ...x,
        status: approved ? "Opportunity created" : "Rejected",
        approval: { ...base, decision, decidedBy: by, decidedAt: at, decisionComment: comment },
        lead: { ...x.lead, state: approved ? "Qualified" : "Disqualified" },
        opportunity: approved ? { oppId, createdBy: by, createdAt: at, handedTo: BIDDING_AGENT } : undefined,
      })),
      audit: [
        ...(approved ? [event({ actor: AGENT_NAME, role: "agent", action: `Handed to the ${BIDDING_AGENT}`, tenderId: id })] : []),
        event({
          actor: by,
          role: s.role,
          action: approved ? `BD Head approved; opportunity ${oppId} created in D365` : "BD Head rejected; lead disqualified",
          tenderId: id,
          detail: comment || undefined,
        }),
        ...s.audit,
      ],
    };
  });
}

export function addComment(id: string, text: string) {
  setState((s) => {
    const by = currentUser(s).name;
    return {
      ...s,
      tenders: patchTender(s, id, (t) => ({
        ...t,
        comments: [...t.comments, { id: uid(), author: by, role: s.role, at: now(), text }],
      })),
      audit: [event({ actor: by, role: s.role, action: "Added reviewer comment", tenderId: id, detail: text }), ...s.audit],
    };
  });
}

export function addSource({
  authorised = false,
  ...src
}: Omit<Source, "id" | "lastScanAt" | "status" | "tendersFound" | "accessState"> & { authorised?: boolean }) {
  // UAE PASS always needs a person; a source added through the wizard has already been signed in.
  const ready = authorised || src.access !== "UAE PASS";
  setState((s) => ({
    ...s,
    sources: [
      ...s.sources,
      {
        ...src,
        id: `src-${uid()}`,
        lastScanAt: null,
        tendersFound: 0,
        addedBy: "user",
        accessState: ready ? "Ready" : "Action needed",
        status: ready ? "Connected" : "Needs attention",
        statusNote: accessNote(src.access, ready),
      },
    ],
    audit: [
      event({ actor: currentUser(s).name, role: s.role, action: "Connected source portal", detail: `${src.name} (simulated)` }),
      ...s.audit,
    ],
  }));
}

export function toggleSource(id: string) {
  setState((s) => ({
    ...s,
    sources: s.sources.map((src) =>
      src.id === id
        ? {
            ...src,
            status: src.status !== "Paused" ? "Paused" : src.accessState === "Action needed" ? "Needs attention" : "Connected",
            statusNote: src.status !== "Paused" ? "Paused by user (simulated)." : accessNote(src.access, src.accessState === "Ready"),
          }
        : src,
    ),
  }));
}

export function accessNote(access: Source["access"], ready: boolean): string | undefined {
  switch (access) {
    case "UAE PASS":
      return ready
        ? "Signed in via UAE PASS by a named user (simulated). Renews every 30 days."
        : "UAE PASS sign-in needed. A named user must approve on their phone.";
    case "Password":
      return "Credentials held in AGFS vault (simulated). The agent never sees the password.";
    case "CAPTCHA":
      return "Portal shows a CAPTCHA. Agent uses the portal's email alerts instead.";
    default:
      return undefined;
  }
}

/** A person completes a sign-in (UAE PASS approval or vault credentials). Simulated. */
export function authoriseSource(id: string) {
  setState((s) => {
    const src = s.sources.find((x) => x.id === id);
    if (!src) return s;
    return {
      ...s,
      sources: s.sources.map((x) =>
        x.id === id ? { ...x, accessState: "Ready", status: "Connected", statusNote: accessNote(x.access, true) } : x,
      ),
      audit: [
        event({
          actor: currentUser(s).name,
          role: s.role,
          action: src.access === "UAE PASS" ? "Approved UAE PASS sign-in" : "Saved portal credentials to vault",
          detail: `${src.name} (simulated)`,
        }),
        ...s.audit,
      ],
    };
  });
}

/** Connects an Outlook mailbox (simulated sign-in) and sets which folders the agent reads. */
export function connectMailbox(m: Pick<MailboxConnection, "address" | "kind" | "folders">) {
  setState((s) => {
    const by = currentUser(s).name;
    const conn: MailboxConnection = { ...m, connectedBy: by, connectedAt: now() };
    return {
      ...s,
      mailboxes: [...s.mailboxes.filter((x) => x.address !== m.address), conn],
      audit: [
        event({
          actor: by,
          role: s.role,
          action: `Connected Outlook mailbox ${m.address}`,
          detail: `Reading: ${m.folders.join(", ")} (simulated)`,
        }),
        ...s.audit,
      ],
    };
  });
}

/**
 * A returning Bid Analyst set up their mailboxes on an earlier visit. If this demo has none yet, connects the usual
 * two (sales@ and tenders@) as if done two weeks ago, so sign-in goes straight to the run.
 */
export function ensureReturningMailboxes() {
  setState((s) => {
    if (s.mailboxes.length) return s;
    const by = actingPerson("analyst").name;
    const at = new Date(Date.now() - 14 * 86_400_000).toISOString();
    return {
      ...s,
      mailboxes: [
        { address: MAILBOX_ADDRESS, kind: "Shared", folders: ["Inbox", "Inbox / Tenders"], connectedBy: by, connectedAt: at },
        { address: TENDERS_ADDRESS, kind: "Shared", folders: ["Inbox", "Junk Email"], connectedBy: by, connectedAt: at },
      ],
    };
  });
}

export function setMailboxFolders(address: string, folders: string[]) {
  setState((s) => ({
    ...s,
    mailboxes: s.mailboxes.map((x) => (x.address === address ? { ...x, folders } : x)),
    audit: [
      event({ actor: currentUser(s).name, role: s.role, action: `Changed folders read in ${address}`, detail: folders.join(", ") }),
      ...s.audit,
    ],
  }));
}

export function disconnectMailbox(address: string) {
  setState((s) => ({
    ...s,
    mailboxes: s.mailboxes.filter((x) => x.address !== address),
    audit: [event({ actor: currentUser(s).name, role: s.role, action: `Disconnected Outlook mailbox ${address}` }), ...s.audit],
  }));
}

export function completeOnboarding() {
  setState((s) => ({ ...s, onboarded: true }));
}

export type ScanMode = "discover" | "checkin";
const PENDING_SCAN_KEY = "agfs-pending-scan";
let pendingScan: ScanMode | null = null;

/**
 * Asks Scan Portal to start a scan as soon as it opens (after sign-in or first-time setup). Also kept in
 * sessionStorage, because on static hosting the move to Scan Portal can be a full page load.
 */
export function requestScan(mode: ScanMode) {
  pendingScan = mode;
  try {
    sessionStorage.setItem(PENDING_SCAN_KEY, mode);
  } catch {}
}

export function peekPendingScan(): ScanMode | null {
  if (pendingScan) return pendingScan;
  try {
    const v = sessionStorage.getItem(PENDING_SCAN_KEY);
    if (v === "discover" || v === "checkin") return v;
  } catch {}
  return null;
}

export function clearPendingScan() {
  pendingScan = null;
  try {
    sessionStorage.removeItem(PENDING_SCAN_KEY);
  } catch {}
}
