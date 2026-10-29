import type { Category, Emirate, Recommendation, Tender } from "./types";

// AGFS screening criteria (illustrative, configurable by Commercial).
// The fit score is a transparent weighted sum: every point is traceable to a criterion.

export const CRITERIA_WEIGHTS = {
  service: 30,
  geography: 15,
  size: 15,
  eligibility: 20,
  strategic: 10,
  capacity: 10,
} as const;

const SERVICE_STRENGTH: Record<Category, [number, string]> = {
  "Integrated FM": [95, "Core AGFS offering with multi-site integrated FM references."],
  "Cleaning & Hygiene": [90, "Established in-house soft-services workforce and supervision model."],
  "Hard FM / MEP": [85, "Strong MEP maintenance capability; specialist plant may need subcontracting."],
  Landscaping: [65, "Delivered as part of IFM bundles; limited standalone references."],
  "Pest Control": [60, "Provided via approved subcontractor network."],
  "Waste Management": [55, "Adjacent service; typically partnered."],
  "Security Services": [45, "Not a self-delivered AGFS service line; requires licensed partner."],
};

const GEO_PRIORITY: Record<Emirate, [number, string]> = {
  Dubai: [100, "Priority market; existing mobilisation base and labour camps."],
  "Abu Dhabi": [90, "Priority market; regional office in place."],
  Sharjah: [85, "Active market; served from Dubai base."],
  Ajman: [75, "Serviceable from Sharjah operations."],
  "Umm Al Quwain": [50, "Secondary market; thin site coverage."],
  "Ras Al Khaimah": [50, "Secondary market; mobilisation cost uplift expected."],
  Fujairah: [40, "Outside current operating footprint."],
};

export function sizeScore(valueAED: number): [number, string] {
  const m = valueAED / 1_000_000;
  if (m < 5) return [25, "Below AGFS minimum contract value (AED 5M)."];
  if (m < 10) return [70, "Within range but below the AED 10M sweet spot."];
  if (m <= 150) return [100, "Inside AGFS target band (AED 10M to 150M)."];
  return [60, "Above target band; would require JV or consortium."];
}

export function eligibilityScore(t: Tender): number {
  const pts = t.eligibility.reduce(
    (sum, e) => sum + (e.status === "met" ? 1 : e.status === "partial" ? 0.5 : 0),
    0,
  );
  return Math.round((pts / Math.max(t.eligibility.length, 1)) * 100);
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
  const [svc, svcNote] = SERVICE_STRENGTH[t.category];
  const [geo, geoNote] = GEO_PRIORITY[t.emirate];
  const [size, sizeNote] = sizeScore(t.valueAED);
  const elig = eligibilityScore(t);
  const met = t.eligibility.filter((e) => e.status === "met").length;
  const rows: Omit<CriterionResult, "points">[] = [
    { key: "service", label: "Service fit", weight: CRITERIA_WEIGHTS.service, score: svc, rationale: svcNote },
    { key: "geography", label: "Geography", weight: CRITERIA_WEIGHTS.geography, score: geo, rationale: geoNote },
    { key: "size", label: "Contract size", weight: CRITERIA_WEIGHTS.size, score: size, rationale: sizeNote },
    {
      key: "eligibility",
      label: "Eligibility",
      weight: CRITERIA_WEIGHTS.eligibility,
      score: elig,
      rationale: `${met} of ${t.eligibility.length} mandatory requirements fully met.`,
    },
    { key: "strategic", label: "Strategic value", weight: CRITERIA_WEIGHTS.strategic, score: t.strategicScore, rationale: t.strategicNote },
    { key: "capacity", label: "Delivery capacity", weight: CRITERIA_WEIGHTS.capacity, score: t.capacityScore, rationale: t.capacityNote },
  ];
  return rows.map((r) => ({ ...r, points: Math.round((r.score * r.weight) / 10) / 10 }));
}

export function fitScore(t: Tender): number {
  return Math.round(fitBreakdown(t).reduce((s, r) => s + r.points, 0));
}

export function recommendation(t: Tender): Recommendation {
  const fit = fitScore(t);
  const blocking = t.eligibility.some((e) => e.status === "unmet");
  // Hard gate: below the AGFS minimum contract value is always a no-bid.
  if (t.valueAED < 5_000_000) return "No-bid";
  if (fit >= 75 && !blocking) return "Bid";
  if (fit >= 60) return "Bid with conditions";
  if (fit >= 45) return "Review";
  return "No-bid";
}

/** Ordering for the pipeline: fit and win likelihood, nudged by deal size. */
export function priorityScore(t: Tender): number {
  const sizeFactor = Math.min(t.valueAED / 100_000_000, 1) * 100;
  return Math.round(fitScore(t) * 0.5 + t.winProbability * 0.35 + sizeFactor * 0.15);
}

export const ACTIVE_STATUSES = ["New", "Under Review", "Awaiting HoD", "Changes Requested", "Prequalified", "Lead in D365"] as const;

export function isActive(t: Tender) {
  return (ACTIVE_STATUSES as readonly string[]).includes(t.status);
}

// Demo planning assumptions, surfaced in the UI wherever they are used.
/** Analyst time to find, read and log one RFP by hand. */
export const MANUAL_HOURS_PER_RFP = 1.5;
