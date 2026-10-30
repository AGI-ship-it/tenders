import type {
  AuditEvent,
  Category,
  Emirate,
  CheckStatus,
  DemoState,
  EligibilityItem,
  Source,
  Tender,
} from "./types";

// ---------------------------------------------------------------------------
// All organisations, portals, URLs, people and tenders below are FICTIONAL.
// URLs use the reserved .example domain so they can never resolve.
// ---------------------------------------------------------------------------

export const PEOPLE = {
  analyst: { name: "Sara Haddad", title: "Bid Analyst, Commercial", initials: "SH" },
  approver: { name: "Omar Rahman", title: "HoD, Integrated FM", initials: "OR" },
} as const;

/** Service lines and their Heads of Department. Opportunities are routed by service category. */
export const SERVICE_LINES: { id: string; name: string; hod: string; initials: string; categories: Category[] }[] = [
  { id: "ifm", name: "Integrated FM", hod: "Omar Rahman", initials: "OR", categories: ["Integrated FM"] },
  { id: "hard", name: "Hard FM & MEP", hod: "Layla Mansour", initials: "LM", categories: ["Hard FM / MEP"] },
  {
    id: "soft",
    name: "Soft Services",
    hod: "Faisal Karim",
    initials: "FK",
    categories: ["Cleaning & Hygiene", "Pest Control", "Waste Management", "Landscaping"],
  },
  { id: "spec", name: "Security & Specialist", hod: "Nadia Yousef", initials: "NY", categories: ["Security Services"] },
];

export function serviceLineFor(category: Category) {
  return SERVICE_LINES.find((l) => l.categories.includes(category)) ?? SERVICE_LINES[0];
}

export function hodLabel(category: Category) {
  const l = serviceLineFor(category);
  return `${l.hod} (HoD, ${l.name})`;
}

export const AGENT_NAME = "Tender Agent";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

export function seedSources(): Source[] {
  return [
    {
      id: "src-fed",
      addedBy: "ai",
      access: "UAE PASS",
      accessState: "Action needed",
      name: "Federal e-Procurement Portal",
      kind: "Government",
      url: "https://federal-procurement.demo.example/tenders",
      method: "Simulated web monitor",
      schedule: "Daily, 06:00 GST",
      lastScanAt: hoursAgo(26),
      status: "Needs attention",
      statusNote: "UAE PASS sign-in expired. A named user must approve on their phone.",
      tendersFound: 14,
    },
    {
      id: "src-dxb",
      addedBy: "ai",
      access: "Password",
      accessState: "Ready",
      name: "Dubai Government Tenders Board",
      kind: "Government",
      url: "https://dxb-tenders.demo.example/opportunities",
      method: "Simulated RSS feed",
      schedule: "Daily, 06:00 GST",
      lastScanAt: hoursAgo(26),
      status: "Connected",
      tendersFound: 22,
    },
    {
      id: "src-auh",
      addedBy: "ai",
      access: "Public",
      accessState: "Ready",
      name: "Abu Dhabi Procurement Hub",
      kind: "Government",
      url: "https://auh-procure.demo.example/rfx",
      method: "Simulated API connector",
      schedule: "Daily, 06:00 GST",
      lastScanAt: hoursAgo(26),
      status: "Connected",
      tendersFound: 17,
    },
    {
      id: "src-shj",
      addedBy: "ai",
      access: "CAPTCHA",
      accessState: "Ready",
      name: "Sharjah Municipal e-Tendering",
      kind: "Semi-government",
      url: "https://shj-etender.demo.example/public",
      method: "Simulated web monitor",
      schedule: "Daily, 06:30 GST",
      lastScanAt: hoursAgo(50),
      status: "Connected",
      statusNote: "Portal shows a CAPTCHA. Agent uses the portal's email alerts instead.",
      tendersFound: 9,
    },
    {
      id: "src-ajm",
      addedBy: "ai",
      access: "Password",
      accessState: "Action needed",
      name: "Ajman e-Procurement Portal",
      kind: "Government",
      url: "https://ajm-eprocure.demo.example/tenders",
      method: "Simulated supplier-portal connector",
      schedule: "Daily, 06:00 GST",
      lastScanAt: hoursAgo(74),
      status: "Needs attention",
      statusNote: "Saved login expired. Sign in again with the portal's two-step verification.",
      tendersFound: 3,
    },
    {
      id: "src-meridian",
      addedBy: "ai",
      access: "Password",
      accessState: "Ready",
      name: "Meridian Properties Supplier Portal",
      kind: "Client portal",
      url: "https://suppliers.meridian-properties.demo.example",
      method: "Simulated supplier-portal connector",
      schedule: "Daily, 07:00 GST",
      lastScanAt: hoursAgo(25),
      status: "Connected",
      tendersFound: 6,
    },
    {
      id: "src-inbox",
      addedBy: "ai",
      access: "Password",
      accessState: "Ready",
      name: "Tender invitations mailbox",
      kind: "Email",
      url: "tenders@agfs.demo.example",
      method: "Simulated email parser",
      schedule: "Every 4 hours",
      lastScanAt: hoursAgo(120),
      status: "Paused",
      statusNote: "Paused by administrator for mailbox migration (simulated).",
      tendersFound: 4,
    },
  ];
}

const GENERIC_REQS = [
  "Valid UAE trade licence covering facilities management",
  "ISO 9001, 14001 and 45001 certifications",
  "Three comparable contracts in the last five years",
  "Bid bond of 2% of tender value",
  "Registered vendor with the issuing authority",
];

const NOTES: Record<CheckStatus, string> = {
  met: "Confirmed against AGFS compliance register (demo).",
  partial: "Partially evidenced; Commercial to confirm before submission.",
  unmet: "Not currently held by AGFS.",
  unknown: "Requirement not clearly stated in RFP; clarification needed.",
};

function genericEligibility(statuses: CheckStatus[]): EligibilityItem[] {
  return GENERIC_REQS.map((requirement, i) => ({
    requirement,
    status: statuses[i] ?? "met",
    note: NOTES[statuses[i] ?? "met"],
  }));
}

type Base = Omit<Tender, "risks" | "assumptions" | "evidence" | "comments" | "isoRequired"> &
  Partial<Pick<Tender, "risks" | "assumptions" | "evidence" | "isoRequired">>;

/** ISO certifications most FM tenders ask for. */
const STANDARD_ISO = ["ISO 9001", "ISO 14001", "ISO 45001"];

function tender(b: Base): Tender {
  return {
    risks: [
      { title: "Price-led evaluation", severity: "Medium", mitigation: "Validate labour rates against latest cost book before pricing." },
      { title: "Mobilisation timeline", severity: "Low", mitigation: "Confirm resource availability with Operations." },
    ],
    assumptions: [
      "Labour rates per AGFS 2026 cost book (demo).",
      "No TUPE-style transfer of incumbent staff assumed.",
      "Consumables priced on a pass-through basis.",
    ],
    evidence: [
      { label: "Scope of services", location: "RFP Section 3", excerpt: b.scope[0] ?? "" },
      { label: "Contract term", location: "RFP Section 1.4", excerpt: `Contract duration of ${b.durationMonths} months.` },
    ],
    comments: [],
    isoRequired: STANDARD_ISO,
    ...b,
  };
}

const FILE_HINTS: [RegExp, Category][] = [
  [/clean|hygien|housekeep/i, "Cleaning & Hygiene"],
  [/mep|hvac|hard|chiller|electric|plumb/i, "Hard FM / MEP"],
  [/secur|guard|cctv/i, "Security Services"],
  [/landscap|irrigat/i, "Landscaping"],
  [/pest/i, "Pest Control"],
  [/waste|recycl/i, "Waste Management"],
];
const EMIRATE_HINTS: [RegExp, Emirate][] = [
  [/abu.?dhabi|auh/i, "Abu Dhabi"],
  [/sharjah|shj/i, "Sharjah"],
  [/ajman/i, "Ajman"],
  [/ras.?al.?khaimah|rak/i, "Ras Al Khaimah"],
  [/fujairah/i, "Fujairah"],
  [/umm.?al.?quwain|uaq/i, "Umm Al Quwain"],
];

/**
 * Builds an opportunity from an uploaded RFP file. Only the file name is used: category and emirate are guessed
 * from it, and everything else is a clearly labelled placeholder until the document is reviewed.
 */
export function uploadedOpportunity(fileName: string, id: string, sourceId: string, nowISO: string): Tender {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  const title = base ? base.charAt(0).toUpperCase() + base.slice(1) : "Uploaded RFP";
  const category = FILE_HINTS.find(([re]) => re.test(fileName))?.[1] ?? "Integrated FM";
  const emirate = EMIRATE_HINTS.find(([re]) => re.test(fileName))?.[1] ?? "Dubai";
  const deadline = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  return tender({
    id,
    title,
    buyer: "To be confirmed from document",
    buyerType: "Government",
    sourceId,
    sourceRef: fileName,
    category,
    emirate,
    location: `${emirate} (from file name)`,
    valueAED: 20_000_000,
    valueDisclosed: false,
    durationMonths: 36,
    publishedAt: nowISO.slice(0, 10),
    deadline,
    summary: `Extracted from the uploaded file “${fileName}” (simulated). Confirm buyer, scope, value and dates against the original document.`,
    scope: ["Scope to be confirmed from the uploaded document."],
    eligibility: genericEligibility(["met", "met", "unknown", "met", "unknown"]),
    evidence: [{ label: "Source file", location: fileName, excerpt: "Uploaded manually to Opportunity Scanning." }],
    aiNarrative: `Service line and emirate inferred from the file name. Review the document to confirm before submitting for prequalification.`,
    status: "New",
    discoveredAt: nowISO,
    fromLatestScan: true,
  });
}

/** Tenders the agent finds on the next "AI scan". */
export function scanTenders(nowISO: string): Tender[] {
  return [
    tender({
      id: "TND-2026-0412",
      isoRequired: ["ISO 9001", "ISO 14001", "ISO 45001", "ISO 41001"],
      title: "Integrated FM services for 14 primary health clinics",
      buyer: "Gulf Crescent Healthcare Network",
      buyerType: "Semi-government",
      sourceId: "src-dxb",
      sourceRef: "GCHN/FM/2026/118",
      category: "Integrated FM",
      emirate: "Dubai",
      location: "Dubai (14 sites across Deira, Al Barsha, Mirdif and Jebel Ali)",
      valueAED: 48_500_000,
      durationMonths: 36,
      publishedAt: "2026-10-28",
      deadline: "2026-12-10",
      summary:
        "Three-year integrated FM contract covering hard and soft services across 14 operational primary-care clinics. Includes planned and reactive MEP maintenance, infection-control cleaning, waste segregation, pest control and a 24/7 helpdesk with CAFM reporting. Evaluation is 60% technical and 40% commercial.",
      scope: [
        "Planned preventive and reactive maintenance of HVAC, electrical, plumbing and medical-gas support systems.",
        "Healthcare-grade cleaning with infection-control protocols and audit trails.",
        "Clinical and general waste segregation and handover to licensed carrier.",
        "24/7 helpdesk, CAFM system and monthly KPI reporting.",
      ],
      eligibility: [
        { requirement: "Valid UAE trade licence covering integrated FM", status: "met", note: "Licence on file (demo register)." },
        { requirement: "ISO 9001, 14001, 45001 and ISO 41001", status: "met", note: "All four certificates current (demo)." },
        { requirement: "Two healthcare FM references, min. AED 15M each", status: "partial", note: "One qualifying reference; second is AED 11M. Confirm if acceptable." },
        { requirement: "Infection-control trained supervisors (min. 6)", status: "met", note: "8 certified supervisors in HR records (demo)." },
        { requirement: "Bid bond 2% of tender value", status: "met", note: "Within Treasury pre-approved limits." },
      ],
      risks: [
        { title: "Healthcare reference threshold", severity: "Medium", mitigation: "Raise a clarification on aggregation of references before 18 Nov." },
        { title: "Mobilisation of 45 new hires in 30 days", severity: "Medium", mitigation: "Pre-engage recruitment agency; phase site takeover over 6 weeks." },
        { title: "Liquidated damages capped at 15% of annual value", severity: "Low", mitigation: "Within AGFS standard risk appetite." },
      ],
      assumptions: [
        "Labour rates per AGFS 2026 cost book; healthcare cleaning premium of 8%.",
        "Medical equipment maintenance excluded (buyer retains OEM contracts).",
        "CAFM delivered on the existing AGFS platform licence.",
        "Consumables priced on pass-through basis with 5% handling fee.",
      ],
      evidence: [
        { label: "Scope", location: "RFP Section 3.1, p. 12", excerpt: "The Contractor shall provide integrated facilities management services across fourteen (14) primary healthcare centres…" },
        { label: "Evaluation weighting", location: "RFP Section 6.2, p. 31", excerpt: "Technical 60%, Commercial 40%. Minimum technical pass mark 70%." },
        { label: "Reference requirement", location: "RFP Annex B, p. 44", excerpt: "Minimum two (2) healthcare FM contracts, each of value not less than AED 15,000,000." },
        { label: "Submission deadline", location: "Tender notice", excerpt: "Closing date: 10 December 2026, 14:00 GST, via e-portal." },
      ],
      aiNarrative:
        "Strong match to AGFS core integrated FM capability in a priority geography and inside the target value band. Technical-weighted evaluation favours AGFS healthcare references. The main open point is the second healthcare reference (AED 11M vs AED 15M threshold); a clarification is recommended before committing bid resources.",
      status: "New",
      discoveredAt: nowISO,
      fromLatestScan: true,
    }),
    tender({
      id: "TND-2026-0418",
      isoRequired: ["ISO 9001", "ISO 14001", "ISO 45001", "ISO 50001"],
      title: "Hard FM and MEP maintenance for government office towers",
      buyer: "Emirates Civic Facilities Authority",
      buyerType: "Government",
      sourceId: "src-auh",
      sourceRef: "ECFA-RFP-26-0931",
      category: "Hard FM / MEP",
      emirate: "Abu Dhabi",
      location: "Abu Dhabi (6 towers, Al Maryah and Al Reem)",
      valueAED: 112_000_000,
      valueDisclosed: false,
      durationMonths: 60,
      publishedAt: "2026-10-27",
      deadline: "2026-12-03",
      summary:
        "Five-year hard FM contract for six government office towers including chillers, BMS, fire-life-safety systems, vertical transportation oversight and energy-performance reporting. Requires an In-Country Value (ICV) certificate above a minimum score.",
      scope: [
        "Operation and maintenance of central chilled-water plant and BMS.",
        "Fire-life-safety systems maintenance and civil-defence compliance.",
        "Oversight of OEM lift and escalator maintenance contracts.",
        "Quarterly energy performance reporting with savings targets.",
      ],
      eligibility: [
        { requirement: "Valid UAE trade licence covering MEP maintenance", status: "met", note: "Licence on file (demo register)." },
        { requirement: "ICV certificate score of at least 40", status: "unmet", note: "Current AGFS ICV score 32 (demo). Mandatory for award." },
        { requirement: "Civil-defence approved fire contractor", status: "met", note: "Approved (demo)." },
        { requirement: "Three high-rise MEP references", status: "met", note: "Four qualifying references (demo)." },
        { requirement: "Performance bond 10%", status: "partial", note: "Above standard limit; Treasury approval needed." },
      ],
      risks: [
        { title: "ICV certificate below threshold", severity: "High", mitigation: "Explore JV with higher-ICV partner or ICV improvement plan; otherwise no-bid." },
        { title: "10% performance bond", severity: "Medium", mitigation: "Seek Treasury exception before bid decision." },
        { title: "Energy savings guarantee with penalties", severity: "Medium", mitigation: "Cap exposure in commercial qualifications." },
      ],
      assumptions: [
        "Specialist chiller subcontractor at 18% of hard FM cost.",
        "OEM lift contracts remain with buyer; AGFS oversight only.",
        "No capital replacement included.",
      ],
      evidence: [
        { label: "ICV requirement", location: "RFP Section 2.6, p. 9", excerpt: "Bidders must hold a valid ICV certificate with a minimum score of 40%." },
        { label: "Scope", location: "RFP Section 4, p. 15", excerpt: "Operation and maintenance of central chilled-water plants serving six towers…" },
        { label: "Bond", location: "Conditions of Contract, Cl. 4.2", excerpt: "Performance security of ten percent (10%) of the contract price." },
      ],
      aiNarrative:
        "Good service and geography fit with a high-value, strategic government buyer. However, the ICV threshold is a hard eligibility gate that AGFS does not currently meet. Recommend bidding only if a JV partner or ICV route is confirmed within 10 days.",
      status: "New",
      discoveredAt: nowISO,
      fromLatestScan: true,
    }),
    tender({
      id: "TND-2026-0421",
      isoRequired: ["ISO 9001", "ISO 14001"],
      title: "Landscaping and irrigation maintenance for residential community",
      buyer: "Meridian Properties",
      buyerType: "Private client",
      sourceId: "src-meridian",
      sourceRef: "MP-SUP-2026-077",
      category: "Landscaping",
      emirate: "Ras Al Khaimah",
      location: "Ras Al Khaimah (single gated community)",
      valueAED: 3_200_000,
      durationMonths: 24,
      publishedAt: "2026-10-28",
      deadline: "2026-11-20",
      summary:
        "Two-year landscaping, irrigation and pool-area maintenance for a 420-villa gated community. Lowest-price evaluation.",
      scope: [
        "Soft and hard landscaping maintenance across 38,000 m².",
        "Irrigation network maintenance and water-use reporting.",
        "Pool-deck cleaning and seasonal planting.",
      ],
      eligibility: [
        { requirement: "Valid trade licence including landscaping", status: "met", note: "Licence on file (demo)." },
        { requirement: "Registered on Meridian supplier portal", status: "met", note: "Active since 2024 (demo)." },
        { requirement: "Two residential landscaping references", status: "partial", note: "References are IFM bundles, not standalone landscaping." },
        { requirement: "Ras Al Khaimah municipality landscaping permit", status: "unmet", note: "Not held by AGFS." },
      ],
      risks: [
        { title: "Below minimum contract value", severity: "High", mitigation: "Decline; offer to include in future IFM bundle for this client." },
        { title: "Missing local permit", severity: "High", mitigation: "Would need local subcontractor." },
      ],
      evidence: [
        { label: "Value", location: "Tender notice", excerpt: "Estimated contract value AED 3.2 million over 24 months." },
        { label: "Evaluation", location: "RFQ Section 5", excerpt: "Award will be made to the lowest technically compliant bidder." },
      ],
      aiNarrative:
        "Below the AGFS minimum contract value of AED 5M, outside priority geography and evaluated on lowest price. Recommend no-bid and a relationship note to the client offering IFM bundling on future packages.",
      status: "New",
      discoveredAt: nowISO,
      fromLatestScan: true,
    }),
  ];
}

type Brief = Pick<
  Tender,
  | "id" | "title" | "buyer" | "buyerType" | "sourceId" | "sourceRef" | "category" | "emirate" | "location"
  | "valueAED" | "durationMonths" | "deadline" | "summary" | "aiNarrative"
> & { scope: string[]; checks: CheckStatus[]; isoRequired?: string[] };

/** Shorter fictional tenders used for re-runs of the scan. */
function briefTender(b: Brief, nowISO: string): Tender {
  const { checks, ...rest } = b;
  return tender({
    ...rest,
    publishedAt: nowISO.slice(0, 10),
    eligibility: genericEligibility(checks),
    status: "New",
    discoveredAt: nowISO,
    fromLatestScan: true,
  });
}

/**
 * What each successive discovering scan finds. The first batch is the original three; "Run again" works through
 * the later batches, after which scans find nothing new.
 */
export function scanBatches(nowISO: string): Tender[][] {
  return [
    scanTenders(nowISO),
    [
      briefTender(
        {
          id: "TND-2026-0425",
          title: "Integrated FM for a university campus",
          buyer: "Emirates Institute of Applied Sciences",
          buyerType: "Semi-government",
          sourceId: "src-shj",
          sourceRef: "EIAS/IFM/26/09",
          category: "Integrated FM",
          emirate: "Sharjah",
          location: "Sharjah (main campus, 31 buildings)",
          valueAED: 64_000_000,
          durationMonths: 48,
          deadline: "2026-12-14",
          summary: "Four-year integrated FM for a 31-building campus including student housing, labs and sports facilities.",
          scope: ["Hard and soft services across academic and residential buildings.", "Lab and cleanroom environment maintenance.", "Events and term-break deep cleaning."],
          checks: ["met", "met", "met", "met", "partial"],
          aiNarrative: "Strong IFM fit in an active market, inside the value band. Education references support the bid; vendor registration needs renewal.",
        },
        nowISO,
      ),
      briefTender(
        {
          id: "TND-2026-0428",
          title: "Cleaning and hygiene for logistics free-zone offices",
          buyer: "Northgate Logistics Free Zone",
          buyerType: "Semi-government",
          sourceId: "src-dxb",
          sourceRef: "NLFZ-CL-1142",
          category: "Cleaning & Hygiene",
          emirate: "Dubai",
          location: "Dubai (12 office blocks)",
          valueAED: 14_500_000,
          durationMonths: 36,
          deadline: "2026-12-08",
          summary: "Daily cleaning, washroom hygiene and pantry services for twelve free-zone office blocks.",
          scope: ["Daily office and washroom cleaning.", "Pantry and consumables management.", "Quarterly deep cleans."],
          checks: ["met", "met", "met", "met", "met"],
          aiNarrative: "Good soft-services fit in Dubai with all eligibility met. Price-led evaluation is expected.",
        },
        nowISO,
      ),
      briefTender(
        {
          id: "TND-2026-0431",
          title: "MEP maintenance for residential towers",
          buyer: "Meridian Properties",
          buyerType: "Private client",
          sourceId: "src-meridian",
          sourceRef: "MP-SUP-2026-091",
          category: "Hard FM / MEP",
          emirate: "Dubai",
          location: "Dubai Marina (4 towers)",
          valueAED: 22_000_000,
          durationMonths: 36,
          deadline: "2026-12-18",
          summary: "Planned and reactive MEP maintenance for four residential towers, including chillers and fire systems.",
          scope: ["HVAC, chiller and pump maintenance.", "Fire-life-safety system upkeep.", "24/7 reactive call-outs."],
          checks: ["met", "met", "met", "partial", "met"],
          aiNarrative: "Existing client relationship and strong MEP fit in a priority location. Bond terms need Treasury confirmation.",
        },
        nowISO,
      ),
    ],
    [
      briefTender(
        {
          id: "TND-2026-0436",
          isoRequired: ["ISO 9001", "ISO 14001", "ISO 45001", "ISO 41001"],
          title: "Integrated FM for government service centres",
          buyer: "Emirates Civic Facilities Authority",
          buyerType: "Government",
          sourceId: "src-auh",
          sourceRef: "ECFA-RFP-26-1004",
          category: "Integrated FM",
          emirate: "Abu Dhabi",
          location: "Abu Dhabi (9 customer service centres)",
          valueAED: 38_000_000,
          durationMonths: 36,
          deadline: "2026-12-21",
          summary: "Integrated FM for nine customer service centres with high public footfall.",
          scope: ["Front-of-house cleaning and hygiene.", "MEP maintenance and helpdesk.", "Security system upkeep (excludes guarding)."],
          checks: ["met", "met", "met", "met", "met"],
          aiNarrative: "High-fit government IFM in a priority market with all eligibility met. Good anchor for the Abu Dhabi pipeline.",
        },
        nowISO,
      ),
      briefTender(
        {
          id: "TND-2026-0439",
          title: "Pest control for hospitality portfolio",
          buyer: "Desert Rose Hospitality",
          buyerType: "Private client",
          sourceId: "src-meridian",
          sourceRef: "DRH-PC-2026-2",
          category: "Pest Control",
          emirate: "Dubai",
          location: "Dubai (7 hotels)",
          valueAED: 2_400_000,
          durationMonths: 24,
          deadline: "2026-12-02",
          summary: "Integrated pest management across seven hotels.",
          scope: ["Monthly integrated pest management.", "Emergency call-outs within 4 hours."],
          checks: ["met", "met", "partial", "met", "met"],
          aiNarrative: "Below the AGFS minimum contract value. Recommend no-bid and offer pest control as part of a wider FM bundle.",
        },
        nowISO,
      ),
      briefTender(
        {
          id: "TND-2026-0442",
          isoRequired: ["ISO 9001", "ISO 14001"],
          title: "Landscaping and irrigation for community parks",
          buyer: "Coastal Districts Municipality",
          buyerType: "Government",
          sourceId: "src-auh",
          sourceRef: "CDM-LS-26-07",
          category: "Landscaping",
          emirate: "Abu Dhabi",
          location: "Abu Dhabi (14 community parks)",
          valueAED: 11_800_000,
          durationMonths: 36,
          deadline: "2026-12-11",
          summary: "Soft landscaping, irrigation and play-area maintenance for fourteen community parks.",
          scope: ["Soft landscaping and seasonal planting.", "Irrigation network maintenance.", "Play-area safety inspections."],
          checks: ["met", "met", "partial", "met", "met"],
          aiNarrative: "Moderate fit: landscaping is usually delivered inside IFM bundles. Worth reviewing given the government client.",
        },
        nowISO,
      ),
    ],
  ];
}

export function seedTenders(): Tender[] {
  return [
    tender({
      id: "TND-2026-0377",
      title: "Cleaning and hygiene services for 22 public schools",
      buyer: "Northern Emirates Schools Directorate",
      buyerType: "Government",
      sourceId: "src-fed",
      sourceRef: "NESD/CLN/26/044",
      category: "Cleaning & Hygiene",
      emirate: "Sharjah",
      location: "Sharjah and Ajman (22 schools)",
      valueAED: 18_600_000,
      durationMonths: 36,
      publishedAt: "2026-10-14",
      deadline: "2026-11-24",
      summary:
        "Daily cleaning, washroom hygiene and deep-clean cycles across 22 schools during term and holiday periods.",
      scope: [
        "Daily cleaning of classrooms, corridors and washrooms across 22 campuses.",
        "Holiday deep-clean programme and floor restoration.",
        "Supply of consumables and hygiene products.",
      ],
      eligibility: genericEligibility(["met", "met", "met", "met", "partial"]),
      aiNarrative:
        "Strong soft-services fit in an active market and within the value band. Vendor registration with the directorate needs renewal before submission.",
      status: "Under Review",
      discoveredAt: hoursAgo(24 * 14),
    }),
    tender({
      id: "TND-2026-0362",
      title: "Integrated FM for metro stations and depots",
      buyer: "Capital Transit Authority",
      buyerType: "Government",
      sourceId: "src-auh",
      sourceRef: "CTA-IFM-2026-07",
      category: "Integrated FM",
      emirate: "Abu Dhabi",
      location: "Abu Dhabi (18 stations, 2 depots)",
      valueAED: 140_000_000,
      durationMonths: 60,
      publishedAt: "2026-10-02",
      deadline: "2026-11-16",
      summary:
        "Five-year IFM for transit stations and depots, including 24/7 operations support and passenger-area cleaning.",
      scope: [
        "24/7 station cleaning and passenger-area hygiene.",
        "MEP maintenance for station buildings and depots.",
        "Helpdesk integrated with operator control centre.",
      ],
      eligibility: genericEligibility(["met", "met", "partial", "met", "met"]),
      aiNarrative:
        "Solid IFM fit in a priority market and inside the value band. Limited transit references; the HoD should confirm a transit-specialist partner.",
      status: "Awaiting HoD",
      discoveredAt: hoursAgo(24 * 26),
      approval: {
        proposed: "Bid",
        submittedBy: "Sara Haddad",
        submittedAt: hoursAgo(20),
        reviewer: "Omar Rahman (HoD, Integrated FM)",
        note: "Recommend bidding with a transit-specialist subcontractor for station systems. Mobilisation plan attached in bid folder.",
      },
    }),
    tender({
      id: "TND-2026-0351",
      title: "Soft services for a four-mall retail portfolio",
      buyer: "Oasis Retail Holdings",
      buyerType: "Private client",
      sourceId: "src-inbox",
      sourceRef: "ORH-SS-0926",
      category: "Cleaning & Hygiene",
      emirate: "Dubai",
      location: "Dubai (4 malls)",
      valueAED: 26_400_000,
      durationMonths: 36,
      publishedAt: "2026-09-21",
      deadline: "2026-11-06",
      summary: "Cleaning, waste handling and washroom attendant services across four community malls.",
      scope: [
        "Mall cleaning across public areas, car parks and food courts.",
        "Waste collection to central compactors.",
        "Washroom attendants during trading hours.",
      ],
      eligibility: genericEligibility(["met", "met", "met", "met", "met"]),
      aiNarrative: "Excellent fit with an existing client in Dubai. All eligibility criteria met.",
      status: "Prequalified",
      discoveredAt: hoursAgo(24 * 37),
      approval: {
        proposed: "Bid",
        submittedBy: "Sara Haddad",
        submittedAt: hoursAgo(24 * 30),
        reviewer: "Faisal Karim (HoD, Soft Services)",
        note: "Strong fit, existing client.",
        decision: "Approved",
        decidedBy: "Faisal Karim",
        decidedAt: hoursAgo(24 * 29),
        decisionComment: "Approved. Prioritise bid team allocation; keep pricing within 10% of last renewal.",
      },
    }),
    tender({
      id: "TND-2026-0340",
      title: "Pest control services for municipal markets",
      buyer: "Coastal Districts Municipality",
      buyerType: "Government",
      sourceId: "src-fed",
      sourceRef: "CDM-PC-26-12",
      category: "Pest Control",
      emirate: "Fujairah",
      location: "Fujairah (5 markets)",
      valueAED: 1_800_000,
      durationMonths: 24,
      publishedAt: "2026-09-30",
      deadline: "2026-11-10",
      summary: "Integrated pest management for five municipal fish and produce markets.",
      scope: ["Monthly integrated pest management.", "Emergency call-outs within 4 hours."],
      eligibility: genericEligibility(["met", "met", "partial", "met", "unmet"]),
      aiNarrative: "Below minimum contract value and outside operating footprint.",
      status: "No-bid",
      discoveredAt: hoursAgo(24 * 29),
      approval: {
        proposed: "No-bid",
        submittedBy: "Sara Haddad",
        submittedAt: hoursAgo(24 * 27),
        reviewer: "Faisal Karim (HoD, Soft Services)",
        note: "Below value threshold and outside footprint.",
        decision: "Approved",
        decidedBy: "Faisal Karim",
        decidedAt: hoursAgo(24 * 27 - 3),
        decisionComment: "Agree, no-bid.",
      },
    }),
    tender({
      id: "TND-2026-0333",
      isoRequired: ["ISO 9001", "ISO 45001", "ISO 18788"],
      title: "Security guarding for hotel portfolio",
      buyer: "Desert Rose Hospitality",
      buyerType: "Private client",
      sourceId: "src-meridian",
      sourceRef: "DRH-SEC-2026-3",
      category: "Security Services",
      emirate: "Dubai",
      location: "Dubai (7 hotels)",
      valueAED: 9_500_000,
      durationMonths: 24,
      publishedAt: "2026-10-05",
      deadline: "2026-11-28",
      summary: "Licensed security guarding and CCTV monitoring for seven hotels.",
      scope: ["Licensed guarding 24/7.", "CCTV monitoring room staffing.", "Event security support."],
      eligibility: genericEligibility(["partial", "met", "partial", "met", "met"]),
      aiNarrative: "Service is outside AGFS self-delivered lines; viable only with a licensed partner.",
      status: "Changes Requested",
      discoveredAt: hoursAgo(24 * 24),
      approval: {
        proposed: "Bid",
        submittedBy: "Sara Haddad",
        submittedAt: hoursAgo(24 * 6),
        reviewer: "Nadia Yousef (HoD, Security & Specialist)",
        note: "Propose bidding with a licensed security partner.",
        decision: "Changes Requested",
        decidedBy: "Nadia Yousef",
        decidedAt: hoursAgo(24 * 5),
        decisionComment: "Please name the partner and confirm margin split before resubmitting.",
      },
    }),
    tender({
      id: "TND-2026-0329",
      title: "Waste management and recycling for free-zone logistics park",
      buyer: "Harbourline Developments",
      buyerType: "Private client",
      sourceId: "src-dxb",
      sourceRef: "HLD-WM-118",
      category: "Waste Management",
      emirate: "Dubai",
      location: "Dubai (logistics park)",
      valueAED: 7_200_000,
      durationMonths: 36,
      publishedAt: "2026-10-18",
      deadline: "2026-12-01",
      summary: "Collection, segregation and recycling reporting for a 60-tenant logistics park.",
      scope: ["Scheduled collection and segregation.", "Monthly recycling and diversion reporting."],
      eligibility: genericEligibility(["met", "met", "partial", "met", "met"]),
      aiNarrative: "Moderate fit; partner-delivered service in a priority geography.",
      status: "New",
      discoveredAt: hoursAgo(24 * 10),
    }),
    tender({
      id: "TND-2026-0318",
      title: "MEP maintenance for district cooling plants",
      buyer: "Emirates Civic Facilities Authority",
      buyerType: "Government",
      sourceId: "src-shj",
      sourceRef: "ECFA-DC-26-02",
      category: "Hard FM / MEP",
      emirate: "Sharjah",
      location: "Sharjah (3 plants)",
      valueAED: 33_000_000,
      durationMonths: 48,
      publishedAt: "2026-10-01",
      deadline: "2026-11-30",
      summary: "Planned and reactive maintenance for three district cooling plants.",
      scope: ["Chiller and cooling-tower maintenance.", "Water treatment and performance reporting."],
      eligibility: genericEligibility(["met", "met", "met", "partial", "met"]),
      aiNarrative: "Good hard FM fit; bid bond requires Treasury confirmation.",
      status: "Under Review",
      discoveredAt: hoursAgo(24 * 28),
    }),
  ];
}

function seedAudit(): AuditEvent[] {
  const e = (h: number, actor: string, role: AuditEvent["role"], action: string, tenderId?: string, detail?: string): AuditEvent => ({
    id: `seed-${h}-${action}`,
    at: hoursAgo(h),
    actor,
    role,
    action,
    tenderId,
    detail,
  });
  return [
    e(20, "Sara Haddad", "analyst", "Submitted for approval (proposed: Bid)", "TND-2026-0362", "Recommend bidding with a transit-specialist subcontractor."),
    e(26, AGENT_NAME, "agent", "Daily scan completed", undefined, "4 sources scanned, 2 new tenders, 4 duplicates skipped (simulated)."),
    e(24 * 5, "Nadia Yousef", "approver", "Requested changes", "TND-2026-0333", "Please name the partner and confirm margin split."),
    e(24 * 6, "Sara Haddad", "analyst", "Submitted for approval (proposed: Bid)", "TND-2026-0333"),
    e(24 * 27 - 3, "Faisal Karim", "approver", "Approved no-bid", "TND-2026-0340", "Agree, no-bid."),
    e(24 * 29, "Faisal Karim", "approver", "Prequalified", "TND-2026-0351", "Prioritise bid team allocation."),
  ];
}

export const DEMO_VERSION = 12;

export function seedState(): DemoState {
  return {
    version: DEMO_VERSION,
    role: "analyst",
    tenders: seedTenders(),
    sources: seedSources(),
    audit: seedAudit(),
    scanCount: 0,
    lastScanAt: hoursAgo(26),
    // Yesterday's daily run, matching the "Daily scan completed" audit entry.
    lastScan: {
      at: hoursAgo(26),
      scanned: 4,
      duplicates: 4,
      newIds: ["TND-2026-0329", "TND-2026-0318"],
      runs: [
        { sourceId: "src-fed", outcome: "sign-in" },
        { sourceId: "src-dxb", outcome: "scanned" },
        { sourceId: "src-auh", outcome: "scanned" },
        { sourceId: "src-shj", outcome: "scanned" },
        { sourceId: "src-ajm", outcome: "sign-in" },
        { sourceId: "src-meridian", outcome: "scanned" },
        { sourceId: "src-inbox", outcome: "paused" },
      ],
    },
    onboarded: false,
  };
}
