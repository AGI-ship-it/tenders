import type { Category, Emirate, Priority, ProspectStatus, Recommendation, Tender, TenderStatus } from "./types";

// AGFS pre-qualification criteria (illustrative, to be refined with Commercial): service, geography and ISO.
// The pre-qualification score is a transparent weighted sum: every point is traceable to one of four criteria.

export const CRITERIA_WEIGHTS = {
  service: 50,
  geography: 25,
  iso: 25,
} as const;

/** ISO certifications AGFS currently holds (demo values). */
export const AGFS_ISO = ["ISO 9001", "ISO 14001", "ISO 45001", "ISO 41001"];

const SERVICE_COVERAGE: Record<Category, [number, string]> = {
  "Integrated FM": [95, "Core AGFS service with multi-site integrated FM references."],
  "Cleaning & Hygiene": [90, "Self-delivered with an established soft-services workforce."],
  "Hard FM / MEP": [85, "Self-delivered MEP maintenance; specialist plant may need subcontracting."],
  Landscaping: [65, "Covered inside IFM bundles; limited standalone references."],
  "Pest Control": [60, "Covered through approved subcontractors."],
  "Waste Management": [55, "Adjacent service; usually partnered."],
  "Security Services": [45, "Not a self-delivered AGFS service; needs a licensed partner."],
};

const GEO_PRIORITY: Record<Emirate, [number, string]> = {
  Dubai: [100, "Priority market with existing mobilisation base."],
  "Abu Dhabi": [90, "Priority market with a regional office."],
  Sharjah: [85, "Active market served from the Dubai base."],
  Ajman: [75, "Serviceable from Sharjah operations."],
  "Umm Al Quwain": [50, "Secondary market with thin site coverage."],
  "Ras Al Khaimah": [50, "Secondary market; mobilisation cost uplift expected."],
  Fujairah: [40, "Outside the current operating footprint."],
};

export function missingIso(t: Tender): string[] {
  return t.isoRequired.filter((c) => !AGFS_ISO.includes(c));
}

export function isoScore(t: Tender): [number, string] {
  const required = t.isoRequired.length;
  if (!required) return [100, "No ISO certification required."];
  const missing = missingIso(t);
  const held = required - missing.length;
  return [
    Math.round((held / required) * 100),
    missing.length
      ? `Holds ${held} of ${required} required; missing ${missing.join(", ")}.`
      : `Holds all ${required} required (${t.isoRequired.join(", ")}).`,
  ];
}

export interface CriterionResult {
  key: keyof typeof CRITERIA_WEIGHTS;
  label: string;
  weight: number;
  score: number;
  points: number;
  rationale: string;
}

export function fitBreakdown(t: Tender): CriterionResult[] {
  const [svc, svcNote] = SERVICE_COVERAGE[t.category];
  const [geo, geoNote] = GEO_PRIORITY[t.emirate];
  const [iso, isoNote] = isoScore(t);
  const rows: Omit<CriterionResult, "points">[] = [
    { key: "service", label: "Service coverage", weight: CRITERIA_WEIGHTS.service, score: svc, rationale: svcNote },
    { key: "geography", label: "Geography", weight: CRITERIA_WEIGHTS.geography, score: geo, rationale: geoNote },
    { key: "iso", label: "ISO certifications", weight: CRITERIA_WEIGHTS.iso, score: iso, rationale: isoNote },
  ];
  return rows.map((r) => ({ ...r, points: Math.round((r.score * r.weight) / 10) / 10 }));
}

/** How well a prospect scores on one criterion, by band: 100% full, above 50% high, 25–50% mid, 25% or below low. */
export type CriterionBand = "full" | "high" | "mid" | "low";

export function criterionBand(c: CriterionResult): CriterionBand {
  if (c.score >= 100) return "full";
  if (c.score > 50) return "high";
  if (c.score > 25) return "mid";
  return "low";
}

/** Internal ranking value, 0 to 100. Not shown to users: the pre-qualification they see is Yes / No. */
export function fitScore(t: Tender): number {
  return Math.round(fitBreakdown(t).reduce((s, r) => s + r.points, 0));
}

export function recommendation(t: Tender): Recommendation {
  const score = fitScore(t);
  // A missing ISO certificate or an unmet mandatory requirement means bidding needs conditions (e.g. a partner).
  const blocking = missingIso(t).length > 0 || t.eligibility.some((e) => e.status === "unmet");
  if (score >= 75 && !blocking) return "Bid";
  if (score >= 60) return "Bid with conditions";
  if (score >= 45) return "Review";
  return "No-bid";
}

/** AI pre-qualification recommendation as a plain yes / no: Bid and Bid with conditions count as yes. */
export function aiPrequalified(t: Tender): boolean {
  const r = recommendation(t);
  return r === "Bid" || r === "Bid with conditions";
}

/** Ordering for the pipeline: pre-qualification score, nudged by deal size. */
export function priorityScore(t: Tender): number {
  const sizeFactor = Math.min(t.valueAED / 100_000_000, 1) * 100;
  return Math.round(fitScore(t) * 0.85 + sizeFactor * 0.15);
}

/**
 * AI priority (workshop step 5): how strongly the tender fits, weighed against how soon it closes. Not-recommended
 * tenders are always Low.
 */
export function aiPriority(t: Tender, now = Date.now()): Priority {
  if (!aiPrequalified(t)) return "Low";
  const days = (new Date(t.deadline).getTime() - now) / 86_400_000;
  const score = fitScore(t);
  if (score >= 75 && days <= 30) return "High";
  if (score >= 75 || days <= 21) return "Medium";
  return "Low";
}

/** Still being worked: not yet an opportunity and not rejected. */
export const ACTIVE_STATUSES: readonly TenderStatus[] = ["Draft", "BD Head review", "Awaiting HoD"];

/** With the BD Head, or with an HoD the BD Head asked: not yet decided. */
export const IN_APPROVAL: readonly TenderStatus[] = ["BD Head review", "Awaiting HoD"];

export function isActive(t: Tender) {
  return ACTIVE_STATUSES.includes(t.status);
}

/** Every status, in journey order, as listed in the Lead Pipeline: drafts, the approval chain and its outcomes. */
export const PROSPECT_STATUSES: ProspectStatus[] = [
  "Draft",
  "BD Head review",
  "Awaiting HoD",
  "Opportunity created",
  "Rejected",
  "Not a tender",
];

/** Statuses of D365 leads in the approval chain and its outcomes, as listed in Approvals. */
export const APPROVAL_STATUSES: ProspectStatus[] = PROSPECT_STATUSES.filter((s) => s !== "Draft" && s !== "Not a tender");

/** In D365: pushed by the Bid Analyst (not a draft, not dismissed). */
export const inD365 = (t: Tender) => t.status !== "Draft" && t.status !== "Not a tender";

/** The status shown to users is the workflow status. */
export function prospectStatus(status: TenderStatus): ProspectStatus {
  return status;
}
