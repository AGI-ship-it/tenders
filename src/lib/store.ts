"use client";

import { useSyncExternalStore } from "react";
import { AGENT_NAME, DEMO_VERSION, PEOPLE, hodLabel, scanBatches, seedState, serviceLineFor, uploadedOpportunity } from "./mock-data";
import { isActive, priorityScore } from "./scoring";
import type { ApprovalRecord, AuditEvent, DemoState, Role, Source, Tender } from "./types";

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

export function currentUser(role: Role) {
  return PEOPLE[role];
}

function event(e: Omit<AuditEvent, "id" | "at">): AuditEvent {
  return { id: uid(), at: now(), ...e };
}

function patchTender(s: DemoState, id: string, fn: (t: Tender) => Tender): Tender[] {
  return s.tenders.map((t) => (t.id === id ? fn(t) : t));
}

export function setRole(role: Role) {
  setState((s) => ({ ...s, role }));
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

export interface ScanResult {
  newTenders: Tender[];
  duplicates: number;
  sourcesScanned: number;
  sourcesSkipped: number;
}

/** Applies the outcome of a simulated scan. Deduplicates on tender ID. */
/**
 * Applies a simulated scan. A discovering scan takes the next batch of fictional tenders not yet in the pipeline
 * (deduplicated on tender ID). A check-in scan (on sign-in) finds nothing new and reports the open opportunities it
 * matched instead.
 */
export function completeScan({ discover = true }: { discover?: boolean } = {}): ScanResult {
  const s = getSnapshot();
  const at = now();
  const active = s.sources.filter((src) => isScannable(src) && src.kind !== "Upload");
  const existing = new Set(s.tenders.map((t) => t.id));
  const batch = discover ? scanBatches(at).find((b) => b.some((t) => !existing.has(t.id))) ?? [] : [];
  const fresh = batch.filter((t) => !existing.has(t.id));
  const matched = [...s.tenders].filter(isActive).sort((x, y) => priorityScore(y) - priorityScore(x));
  // Duplicates are re-postings of opportunities already in the pipeline.
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
      runs: portals.map((src) => ({
        sourceId: src.id,
        outcome: src.status === "Paused" ? "paused" : isScannable(src) ? "scanned" : "sign-in",
      })),
    },
    tenders: [
      ...fresh,
      ...st.tenders.map((t) => ({ ...t, fromLatestScan: false })),
    ],
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
        detail: `${active.length} sources scanned, ${fresh.length} new tenders, ${duplicates} duplicates skipped (simulated).`,
      }),
      ...fresh.map((t) =>
        event({ actor: AGENT_NAME, role: "agent", action: "Tender discovered and scored", tenderId: t.id }),
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

export function markUnderReview(id: string) {
  setState((s) => {
    const t = s.tenders.find((x) => x.id === id);
    if (!t || t.status !== "New") return s;
    return {
      ...s,
      tenders: patchTender(s, id, (x) => ({ ...x, status: "Under Review" })),
      audit: [
        event({ actor: PEOPLE[s.role].name, role: s.role, action: "Opened for review", tenderId: id }),
        ...s.audit,
      ],
    };
  });
}

/** Submits an opportunity for prequalification; it is routed to the HoD of its service line. */
export function submitForApproval(id: string, input: { proposed: ApprovalRecord["proposed"]; note: string }) {
  setState((s) => {
    const by = PEOPLE[s.role].name;
    const category = s.tenders.find((t) => t.id === id)?.category;
    const reviewer = category ? hodLabel(category) : "HoD";
    return {
      ...s,
      tenders: patchTender(s, id, (t) => ({
        ...t,
        status: "Awaiting HoD",
        approval: { ...input, reviewer, submittedBy: by, submittedAt: now() },
      })),
      audit: [
        event({
          actor: by,
          role: s.role,
          action: `Routed to ${reviewer.split(" (")[0]} for prequalification (proposed: ${input.proposed})`,
          tenderId: id,
          detail: input.note || undefined,
        }),
        ...s.audit,
      ],
    };
  });
}

export function decide(
  id: string,
  decision: NonNullable<ApprovalRecord["decision"]>,
  comment: string,
) {
  setState((s) => {
    const t = s.tenders.find((x) => x.id === id);
    // In the demo, the HoD role acts on behalf of whichever HoD the opportunity is routed to.
    const by = s.role === "approver" && t ? serviceLineFor(t.category).hod : PEOPLE[s.role].name;
    const proposed = t?.approval?.proposed ?? "Bid";
    const status: Tender["status"] =
      decision === "Changes Requested"
        ? "Changes Requested"
        : decision === "Rejected"
          ? "Not qualified"
          : proposed === "Bid"
            ? "Prequalified"
            : "No-bid";
    const action =
      decision === "Changes Requested"
        ? "Requested changes"
        : decision === "Rejected"
          ? "Marked not qualified"
          : proposed === "Bid"
            ? "Prequalified"
            : "Approved no-bid";
    return {
      ...s,
      tenders: patchTender(s, id, (x) => ({
        ...x,
        status,
        approval: x.approval && {
          ...x.approval,
          decision,
          decidedBy: by,
          decidedAt: now(),
          decisionComment: comment,
        },
      })),
      audit: [
        event({ actor: by, role: s.role, action, tenderId: id, detail: comment || undefined }),
        ...s.audit,
      ],
    };
  });
}

export function addComment(id: string, text: string) {
  setState((s) => {
    const by = PEOPLE[s.role].name;
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
      event({ actor: PEOPLE[s.role].name, role: s.role, action: "Connected source portal", detail: `${src.name} (simulated)` }),
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
            status:
              src.status !== "Paused" ? "Paused" : src.accessState === "Action needed" ? "Needs attention" : "Connected",
            statusNote:
              src.status !== "Paused" ? "Paused by user (simulated)." : accessNote(src.access, src.accessState === "Ready"),
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
        x.id === id
          ? { ...x, accessState: "Ready", status: "Connected", statusNote: accessNote(x.access, true) }
          : x,
      ),
      audit: [
        event({
          actor: PEOPLE[s.role].name,
          role: s.role,
          action: src.access === "UAE PASS" ? "Approved UAE PASS sign-in" : "Saved portal credentials to vault",
          detail: `${src.name} (simulated)`,
        }),
        ...s.audit,
      ],
    };
  });
}

export function completeOnboarding() {
  setState((s) => ({ ...s, onboarded: true }));
}

/** Simulated push of a prequalified opportunity to Dynamics 365 lead management. No real API call. */
export function pushToD365(id: string): string {
  const leadId = `LEAD-${Math.floor(10000 + Math.random() * 89999)}`;
  setState((s) => {
    const t = s.tenders.find((x) => x.id === id);
    if (!t) return s;
    const by = s.role === "approver" ? serviceLineFor(t.category).hod : PEOPLE[s.role].name;
    return {
      ...s,
      tenders: patchTender(s, id, (x) => ({
        ...x,
        status: "Lead in D365",
        lead: { leadId, pushedBy: by, pushedAt: now(), owner: serviceLineFor(x.category).hod },
      })),
      audit: [
        event({ actor: by, role: s.role, action: `Pushed to D365 as lead ${leadId}`, tenderId: id, detail: "Simulated" }),
        ...s.audit,
      ],
    };
  });
  return leadId;
}

const UPLOAD_SOURCE_ID = "src-uploads";

/** Adds uploaded RFP files as opportunities. Only file names are used; no content leaves the browser. */
export function addUploadedFiles(fileNames: string[]): Tender[] {
  const at = now();
  let added: Tender[] = [];
  setState((s) => {
    const max = Math.max(500, ...s.tenders.map((t) => Number(t.id.split("-").pop()) || 0));
    added = fileNames.map((f, i) => uploadedOpportunity(f, `TND-2026-${String(max + 1 + i).padStart(4, "0")}`, UPLOAD_SOURCE_ID, at));
    const existing = s.sources.find((x) => x.id === UPLOAD_SOURCE_ID);
    const uploadSource: Source = existing
      ? { ...existing, lastScanAt: at, tendersFound: existing.tendersFound + added.length }
      : {
          id: UPLOAD_SOURCE_ID,
          name: "Uploaded RFP files",
          kind: "Upload",
          addedBy: "user",
          access: "Public",
          accessState: "Ready",
          url: "Manual upload",
          method: "File upload",
          schedule: "On upload",
          lastScanAt: at,
          status: "Connected",
          tendersFound: added.length,
        };
    const by = PEOPLE[s.role].name;
    return {
      ...s,
      tenders: [...added, ...s.tenders.map((t) => ({ ...t, fromLatestScan: false }))],
      sources: existing ? s.sources.map((x) => (x.id === UPLOAD_SOURCE_ID ? uploadSource : x)) : [...s.sources, uploadSource],
      audit: [
        event({
          actor: by,
          role: s.role,
          action: `Uploaded ${added.length} RFP file${added.length === 1 ? "" : "s"}`,
          detail: fileNames.join(", "),
        }),
        ...added.map((t) => event({ actor: AGENT_NAME, role: "agent", action: "Extracted and scored uploaded file", tenderId: t.id })),
        ...s.audit,
      ],
    };
  });
  return added;
}

export type ScanMode = "discover" | "checkin";
let pendingScan: ScanMode | null = null;

/** Asks Scan Portal to start a scan as soon as it opens (after sign-in or first-time setup). */
export function requestScan(mode: ScanMode) {
  pendingScan = mode;
}

export function peekPendingScan(): ScanMode | null {
  return pendingScan;
}

export function clearPendingScan() {
  pendingScan = null;
}
