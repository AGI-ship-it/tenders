import type { Category, Emirate, Recommendation, Tender } from "./types";

// AGFS pre-qualification criteria (illustrative, to be refined with Commercial).
// The pre-qualification score is a transparent weighted sum: every point is traceable to one of four criteria.

export const CRITERIA_WEIGHTS = {
  service: 40,
  geography: 20,
  size: 20,
  iso: 20,
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

export function sizeScore(valueAED: number): [number, string] {
  const m = valueAED / 1_000_000;
  if (m < 5) return [25, "Below the AGFS minimum contract value (AED 5M)."];
  if (m < 10) return [70, "Within range but below the AED 10M sweet spot."];
  if (m <= 150) return [100, "Inside the AGFS target band (AED 10M to 150M)."];
  return [60, "Above the target band; would need a JV or consortium."];
}

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
  const [size, sizeNote] = sizeScore(t.valueAED);
  const [iso, isoNote] = isoScore(t);
  const rows: Omit<CriterionResult, "points">[] = [
    { key: "service", label: "Service coverage", weight: CRITERIA_WEIGHTS.service, score: svc, rationale: svcNote },
    { key: "geography", label: "Geography", weight: CRITERIA_WEIGHTS.geography, score: geo, rationale: geoNote },
    { key: "size", label: "Contract size", weight: CRITERIA_WEIGHTS.size, score: size, rationale: sizeNote },
    { key: "iso", label: "ISO certifications", weight: CRITERIA_WEIGHTS.iso, score: iso, rationale: isoNote },
  ];
  return rows.map((r) => ({ ...r, points: Math.round((r.score * r.weight) / 10) / 10 }));
}

/** AI pre-qualification score, 0 to 100. */
export function fitScore(t: Tender): number {
  return Math.round(fitBreakdown(t).reduce((s, r) => s + r.points, 0));
}

export function recommendation(t: Tender): Recommendation {
  const score = fitScore(t);
  // Hard gate: below the AGFS minimum contract value is always a no-bid.
  if (t.valueAED < 5_000_000) return "No-bid";
  // A missing ISO certificate or an unmet mandatory requirement means bidding needs conditions (e.g. a partner).
  const blocking = missingIso(t).length > 0 || t.eligibility.some((e) => e.status === "unmet");
  if (score >= 75 && !blocking) return "Bid";
  if (score >= 60) return "Bid with conditions";
  if (score >= 45) return "Review";
  return "No-bid";
}

/** Ordering for the pipeline: pre-qualification score, nudged by deal size. */
export function priorityScore(t: Tender): number {
  const sizeFactor = Math.min(t.valueAED / 100_000_000, 1) * 100;
  return Math.round(fitScore(t) * 0.85 + sizeFactor * 0.15);
}

export const ACTIVE_STATUSES = ["New", "Under Review", "Awaiting HoD", "Changes Requested", "Prequalified", "Lead in D365"] as const;

export function isActive(t: Tender) {
  return (ACTIVE_STATUSES as readonly string[]).includes(t.status);
}
