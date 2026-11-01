import type {
  ApprovalRecord,
  AuditEvent,
  Category,
  Emirate,
  CheckStatus,
  DemoState,
  EligibilityItem,
  Role,
  Source,
  Tender,
} from "./types";

// ---------------------------------------------------------------------------
// All organisations, portals, URLs, people and tenders below are FICTIONAL.
// URLs use the reserved .example domain so they can never resolve.
// ---------------------------------------------------------------------------

export const PEOPLE = {
  analyst: { name: "Cassandra Haddad", title: "Bid Analyst, Commercial", initials: "CH" },
  approver: { name: "Omar Rahman", title: "HoD, Integrated FM", initials: "OR" },
} as const;

/** Service lines and their Heads of Department. Prospects are routed by service category. */
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

/** The person the demo user is acting as: the Bid Analyst, or the HoD of the chosen service line. */
export function actingPerson(role: Role, hodLine?: string): { name: string; title: string; initials: string } {
  if (role === "analyst") return PEOPLE.analyst;
  const l = SERVICE_LINES.find((x) => x.id === hodLine) ?? SERVICE_LINES[0];
  return { name: l.hod, title: `HoD, ${l.name}`, initials: l.initials };
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
 * Builds a prospect from an uploaded RFP file. Only the file name is used: category and emirate are guessed
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
    evidence: [{ label: "Source file", location: fileName, excerpt: "Uploaded manually to Prospect Scanning." }],
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
        "Strong match to AGFS core integrated FM capability in a priority geography and inside the target value band. Technical-weighted evaluation favours AGFS healthcare references. The main open point is the second healthcare reference (AED 11M vs AED 15M threshold); a clarification is recommended before it goes to D365.",
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
        "Good service and geography fit with a high-value, strategic government buyer. However, the ICV threshold is a hard eligibility gate that AGFS does not currently meet. Pre-qualifies only if a JV partner or ICV route is confirmed within 10 days.",
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
        "Below the AGFS minimum contract value of AED 5M, outside priority geography and evaluated on lowest price. Does not pre-qualify; consider a relationship note to the client offering IFM bundling on future packages.",
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
          aiNarrative: "Strong IFM fit in an active market, inside the value band. Education references are strong; vendor registration needs renewal.",
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
          aiNarrative: "Below the AGFS minimum contract value. Does not pre-qualify; pest control could be offered as part of a wider FM bundle.",
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
        proposed: "Prequalify",
        submittedBy: "Cassandra Haddad",
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
        proposed: "Prequalify",
        submittedBy: "Cassandra Haddad",
        submittedAt: hoursAgo(24 * 30),
        reviewer: "Faisal Karim (HoD, Soft Services)",
        note: "Strong fit, existing client.",
        decision: "Approved",
        decidedBy: "Faisal Karim",
        decidedAt: hoursAgo(24 * 29),
        decisionComment: "Approved. Relevant for Soft Services; push to D365 as a lead.",
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
        proposed: "Reject",
        submittedBy: "Cassandra Haddad",
        submittedAt: hoursAgo(24 * 27),
        reviewer: "Faisal Karim (HoD, Soft Services)",
        note: "Below value threshold and outside footprint.",
        decision: "Approved",
        decidedBy: "Faisal Karim",
        decidedAt: hoursAgo(24 * 27 - 3),
        decisionComment: "Agree, not relevant for AGFS.",
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
        proposed: "Prequalify",
        submittedBy: "Cassandra Haddad",
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
    ...ROUTED_CASES.map(routedTender),
  ];
}

// ---------------------------------------------------------------------------
// Routed prospects so that every HoD has each case: pending review, changes requested, prequalified (ready to push),
// pushed to D365 as a lead, and rejected. Ages are in days before now.

type RoutedStatus = "Awaiting HoD" | "Changes Requested" | "Prequalified" | "Lead in D365" | "Not qualified" | "No-bid";

interface RoutedCase {
  id: string;
  title: string;
  buyer: string;
  buyerType: Tender["buyerType"];
  sourceId: string;
  sourceRef: string;
  category: Category;
  emirate: Emirate;
  location: string;
  valueAED: number;
  durationMonths: number;
  publishedAt: string;
  deadline: string;
  summary: string;
  scope: string[];
  eligibility: CheckStatus[];
  aiNarrative: string;
  status: RoutedStatus;
  note: string;
  /** Days ago the Bid Analyst submitted it. */
  submitted: number;
  /** Days ago the HoD decided (omit while pending). */
  decided?: number;
  comment?: string;
  /** Lead number and days ago it was pushed to D365. */
  lead?: [string, number];
}

const daysAgo = (d: number) => hoursAgo(d * 24);

function routedTender(c: RoutedCase): Tender {
  const line = serviceLineFor(c.category);
  const decision: ApprovalRecord["decision"] =
    c.status === "Awaiting HoD"
      ? undefined
      : c.status === "Changes Requested"
        ? "Changes Requested"
        : c.status === "Not qualified"
          ? "Rejected"
          : "Approved";
  return tender({
    id: c.id,
    title: c.title,
    buyer: c.buyer,
    buyerType: c.buyerType,
    sourceId: c.sourceId,
    sourceRef: c.sourceRef,
    category: c.category,
    emirate: c.emirate,
    location: c.location,
    valueAED: c.valueAED,
    durationMonths: c.durationMonths,
    publishedAt: c.publishedAt,
    deadline: c.deadline,
    summary: c.summary,
    scope: c.scope,
    eligibility: genericEligibility(c.eligibility),
    aiNarrative: c.aiNarrative,
    status: c.status,
    discoveredAt: daysAgo(c.submitted + 2),
    approval: {
      proposed: c.status === "No-bid" ? "Reject" : "Prequalify",
      submittedBy: PEOPLE.analyst.name,
      submittedAt: daysAgo(c.submitted),
      reviewer: hodLabel(c.category),
      note: c.note,
      ...(decision && {
        decision,
        decidedBy: line.hod,
        decidedAt: daysAgo(c.decided ?? 0),
        decisionComment: c.comment ?? "",
      }),
    },
    ...(c.lead && {
      lead: { leadId: c.lead[0], pushedBy: line.hod, pushedAt: daysAgo(c.lead[1]), owner: line.hod },
    }),
  });
}

const ROUTED_CASES: RoutedCase[] = [
  // Omar Rahman · Integrated FM
  {
    id: "TND-2026-0302",
    title: "Integrated FM for a university campus",
    buyer: "Gulf Polytechnic University",
    buyerType: "Semi-government",
    sourceId: "src-auh",
    sourceRef: "GPU-FM-2026-04",
    category: "Integrated FM",
    emirate: "Abu Dhabi",
    location: "Abu Dhabi (main campus, 41 buildings)",
    valueAED: 64_000_000,
    durationMonths: 48,
    publishedAt: "2026-10-08",
    deadline: "2026-12-04",
    summary: "Hard and soft FM across academic buildings, student housing and sports facilities.",
    scope: ["Planned and reactive MEP maintenance.", "Cleaning of academic and residential buildings.", "CAFM helpdesk."],
    eligibility: ["met", "met", "met", "partial", "met"],
    aiNarrative: "Core IFM scope in a priority market and inside the value band. Student-housing references should be confirmed.",
    status: "Changes Requested",
    note: "Strong IFM fit; education references attached.",
    submitted: 6,
    decided: 4,
    comment: "Add the student-housing references and the CAFM approach before I prequalify.",
  },
  {
    id: "TND-2026-0296",
    title: "Integrated FM for a government headquarters tower",
    buyer: "Federal Services Authority",
    buyerType: "Government",
    sourceId: "src-fed",
    sourceRef: "FSA-IFM-26-11",
    category: "Integrated FM",
    emirate: "Dubai",
    location: "Dubai (HQ tower, 38 floors)",
    valueAED: 52_000_000,
    durationMonths: 36,
    publishedAt: "2026-10-03",
    deadline: "2026-11-20",
    summary: "Total FM for a 38-floor headquarters, including front-of-house and energy management.",
    scope: ["MEP and BMS maintenance.", "Soft services and front-of-house.", "Monthly energy reporting."],
    eligibility: ["met", "met", "met", "met", "met"],
    aiNarrative: "Excellent fit: core IFM, priority geography, target value band and all eligibility met.",
    status: "Prequalified",
    note: "All criteria met; similar tower contracts in portfolio.",
    submitted: 5,
    decided: 2,
    comment: "Prequalified. Ready to push to D365.",
  },
  {
    id: "TND-2026-0289",
    title: "Integrated FM for a waterfront residential community",
    buyer: "Marina Gate Communities",
    buyerType: "Private client",
    sourceId: "src-dxb",
    sourceRef: "MGC-IFM-0826",
    category: "Integrated FM",
    emirate: "Dubai",
    location: "Dubai (1,200 units, 6 towers)",
    valueAED: 38_500_000,
    durationMonths: 36,
    publishedAt: "2026-09-14",
    deadline: "2026-11-12",
    summary: "Community FM including tower maintenance, common-area cleaning and pool operations.",
    scope: ["Tower MEP maintenance.", "Common-area cleaning and landscaping.", "Pool and amenity operations."],
    eligibility: ["met", "met", "met", "met", "partial"],
    aiNarrative: "Good IFM fit with a repeat developer client in Dubai.",
    status: "Lead in D365",
    note: "Repeat client; recommend prequalifying.",
    submitted: 20,
    decided: 18,
    comment: "Prequalified. Pushed to D365.",
    lead: ["LEAD-48211", 17],
  },
  {
    id: "TND-2026-0284",
    title: "Integrated FM for remote border posts",
    buyer: "Coastal Districts Municipality",
    buyerType: "Government",
    sourceId: "src-fed",
    sourceRef: "CDM-IFM-26-03",
    category: "Integrated FM",
    emirate: "Fujairah",
    location: "Fujairah (9 remote sites)",
    valueAED: 6_400_000,
    durationMonths: 24,
    publishedAt: "2026-09-25",
    deadline: "2026-11-18",
    summary: "IFM for nine remote border facilities with on-site accommodation for staff.",
    scope: ["Reactive maintenance at remote sites.", "Cleaning and accommodation services."],
    eligibility: ["met", "partial", "met", "met", "unmet"],
    aiNarrative: "Outside the operating footprint and below the target value band.",
    status: "Not qualified",
    note: "Borderline; HoD to decide on remote-site appetite.",
    submitted: 12,
    decided: 10,
    comment: "Not qualified. Remote sites outside our footprint.",
  },
  // Layla Mansour · Hard FM & MEP
  {
    id: "TND-2026-0310",
    title: "HVAC and BMS maintenance for a hospital cluster",
    buyer: "Northern Emirates Health Services",
    buyerType: "Government",
    sourceId: "src-shj",
    sourceRef: "NEHS-MEP-26-09",
    category: "Hard FM / MEP",
    emirate: "Sharjah",
    location: "Sharjah and Ajman (3 hospitals)",
    valueAED: 41_000_000,
    durationMonths: 48,
    publishedAt: "2026-10-12",
    deadline: "2026-12-08",
    summary: "Critical HVAC, medical gas and BMS maintenance across three hospitals.",
    scope: ["24/7 HVAC maintenance for clinical areas.", "BMS monitoring and upgrades.", "Medical gas maintenance."],
    eligibility: ["met", "met", "partial", "met", "met"],
    aiNarrative: "Strong hard FM fit in an active market. Medical gas competence certificate needs checking.",
    status: "Awaiting HoD",
    note: "Clinical HVAC references attached; medical gas via approved specialist.",
    submitted: 1,
  },
  {
    id: "TND-2026-0307",
    title: "Electrical maintenance for a logistics hub",
    buyer: "Harbourline Developments",
    buyerType: "Private client",
    sourceId: "src-dxb",
    sourceRef: "HLD-ELC-204",
    category: "Hard FM / MEP",
    emirate: "Dubai",
    location: "Dubai (logistics hub)",
    valueAED: 12_800_000,
    durationMonths: 36,
    publishedAt: "2026-10-09",
    deadline: "2026-11-27",
    summary: "HV/LV electrical maintenance and generator servicing for a logistics hub.",
    scope: ["HV/LV switchgear maintenance.", "Standby generator servicing."],
    eligibility: ["met", "met", "met", "partial", "met"],
    aiNarrative: "Good hard FM fit in a priority market, at the lower end of the value band.",
    status: "Changes Requested",
    note: "Recommend prequalifying; HV competence in-house.",
    submitted: 7,
    decided: 5,
    comment: "Confirm the HV-authorised engineers we would assign.",
  },
  {
    id: "TND-2026-0299",
    title: "MEP maintenance for a mixed-use tower",
    buyer: "Skyline Estates",
    buyerType: "Private client",
    sourceId: "src-meridian",
    sourceRef: "SKY-MEP-0910",
    category: "Hard FM / MEP",
    emirate: "Dubai",
    location: "Dubai (mixed-use tower)",
    valueAED: 22_000_000,
    durationMonths: 36,
    publishedAt: "2026-10-02",
    deadline: "2026-11-22",
    summary: "Planned and reactive MEP for a 55-floor mixed-use tower.",
    scope: ["Chiller plant and AHU maintenance.", "Fire-life-safety systems.", "Vertical transport coordination."],
    eligibility: ["met", "met", "met", "met", "met"],
    aiNarrative: "Strong hard FM fit; all eligibility criteria met.",
    status: "Prequalified",
    note: "All criteria met.",
    submitted: 4,
    decided: 1,
    comment: "Prequalified.",
  },
  {
    id: "TND-2026-0291",
    title: "Chiller plant maintenance for a theme park",
    buyer: "Desert Rose Hospitality",
    buyerType: "Private client",
    sourceId: "src-meridian",
    sourceRef: "DRH-CHL-2026-1",
    category: "Hard FM / MEP",
    emirate: "Dubai",
    location: "Dubai (theme park)",
    valueAED: 29_000_000,
    durationMonths: 60,
    publishedAt: "2026-09-10",
    deadline: "2026-11-09",
    summary: "Five-year maintenance of central chiller plants and thermal storage.",
    scope: ["Chiller and thermal storage maintenance.", "Energy performance reporting."],
    eligibility: ["met", "met", "met", "met", "partial"],
    aiNarrative: "Good hard FM fit with an existing hospitality client.",
    status: "Lead in D365",
    note: "Existing client; recommend prequalifying.",
    submitted: 25,
    decided: 23,
    comment: "Prequalified. Pushed to D365.",
    lead: ["LEAD-47630", 22],
  },
  {
    id: "TND-2026-0286",
    title: "Lift and escalator modernisation",
    buyer: "Emirates Civic Facilities Authority",
    buyerType: "Government",
    sourceId: "src-shj",
    sourceRef: "ECFA-LFT-26-05",
    category: "Hard FM / MEP",
    emirate: "Ras Al Khaimah",
    location: "Ras Al Khaimah (12 buildings)",
    valueAED: 8_200_000,
    durationMonths: 18,
    publishedAt: "2026-09-28",
    deadline: "2026-11-15",
    summary: "Replacement and modernisation of lifts and escalators in 12 civic buildings.",
    scope: ["Lift replacement works.", "Escalator modernisation."],
    eligibility: ["partial", "met", "unmet", "met", "met"],
    aiNarrative: "Specialist OEM works outside AGFS self-delivered scope, in a secondary market.",
    status: "No-bid",
    note: "Specialist OEM scope; propose rejecting.",
    submitted: 14,
    decided: 13,
    comment: "Agree. OEM-led works, not for us.",
  },
  // Faisal Karim · Soft Services
  {
    id: "TND-2026-0312",
    title: "Landscaping and irrigation for a public park network",
    buyer: "Dubai Parks Directorate",
    buyerType: "Government",
    sourceId: "src-dxb",
    sourceRef: "DPD-LND-26-17",
    category: "Landscaping",
    emirate: "Dubai",
    location: "Dubai (14 parks)",
    valueAED: 16_500_000,
    durationMonths: 36,
    publishedAt: "2026-10-15",
    deadline: "2026-12-10",
    summary: "Soft landscaping, irrigation maintenance and playground inspections for 14 parks.",
    scope: ["Soft landscaping and tree care.", "Irrigation network maintenance.", "Playground safety inspections."],
    eligibility: ["met", "met", "met", "met", "partial"],
    aiNarrative: "Acceptable fit in a priority market; landscaping usually sits inside IFM bundles.",
    status: "Awaiting HoD",
    note: "Recommend prequalifying; can be delivered with our landscaping subcontractor.",
    submitted: 2,
  },
  {
    id: "TND-2026-0305",
    title: "Housekeeping for a serviced-apartment portfolio",
    buyer: "Oasis Retail Holdings",
    buyerType: "Private client",
    sourceId: "src-inbox",
    sourceRef: "ORH-HK-1026",
    category: "Cleaning & Hygiene",
    emirate: "Dubai",
    location: "Dubai (3 buildings, 640 units)",
    valueAED: 14_200_000,
    durationMonths: 24,
    publishedAt: "2026-10-10",
    deadline: "2026-11-25",
    summary: "Daily housekeeping and laundry coordination for serviced apartments.",
    scope: ["Daily housekeeping of units.", "Public-area cleaning.", "Laundry coordination."],
    eligibility: ["met", "met", "met", "met", "met"],
    aiNarrative: "Strong soft-services fit with an existing client.",
    status: "Changes Requested",
    note: "Existing client; recommend prequalifying.",
    submitted: 5,
    decided: 3,
    comment: "Please add staffing ratios before I prequalify.",
  },
  {
    id: "TND-2026-0293",
    title: "Cleaning services for a government office campus",
    buyer: "Federal Services Authority",
    buyerType: "Government",
    sourceId: "src-fed",
    sourceRef: "FSA-CLN-26-08",
    category: "Cleaning & Hygiene",
    emirate: "Abu Dhabi",
    location: "Abu Dhabi (office campus)",
    valueAED: 19_800_000,
    durationMonths: 36,
    publishedAt: "2026-09-18",
    deadline: "2026-11-14",
    summary: "Office cleaning, washroom hygiene and window cleaning for a government campus.",
    scope: ["Daily office cleaning.", "Washroom hygiene.", "Quarterly facade cleaning."],
    eligibility: ["met", "met", "met", "met", "met"],
    aiNarrative: "Excellent soft-services fit in a priority market.",
    status: "Lead in D365",
    note: "All criteria met.",
    submitted: 18,
    decided: 16,
    comment: "Prequalified. Pushed to D365.",
    lead: ["LEAD-48004", 15],
  },
  // Nadia Yousef · Security & Specialist
  {
    id: "TND-2026-0314",
    title: "Security guarding for a business park",
    buyer: "Skyline Estates",
    buyerType: "Private client",
    sourceId: "src-meridian",
    sourceRef: "SKY-SEC-1012",
    category: "Security Services",
    emirate: "Dubai",
    location: "Dubai (business park, 9 buildings)",
    valueAED: 11_400_000,
    durationMonths: 36,
    publishedAt: "2026-10-16",
    deadline: "2026-12-06",
    summary: "Manned guarding, access control and CCTV monitoring for a business park.",
    scope: ["24/7 manned guarding.", "Access control and visitor management.", "CCTV monitoring."],
    eligibility: ["partial", "met", "met", "met", "met"],
    aiNarrative: "Not a self-delivered AGFS service; viable only with a licensed security partner.",
    status: "Awaiting HoD",
    note: "Existing FM client; propose prequalifying with our licensed partner.",
    submitted: 1,
  },
  {
    id: "TND-2026-0298",
    title: "Security and access control for a hospital",
    buyer: "Northern Emirates Health Services",
    buyerType: "Government",
    sourceId: "src-shj",
    sourceRef: "NEHS-SEC-26-04",
    category: "Security Services",
    emirate: "Sharjah",
    location: "Sharjah (hospital campus)",
    valueAED: 13_600_000,
    durationMonths: 36,
    publishedAt: "2026-10-04",
    deadline: "2026-11-26",
    summary: "Guarding and access control for a hospital, bundled with our existing FM contract.",
    scope: ["Manned guarding.", "Access control for clinical areas."],
    eligibility: ["partial", "met", "met", "met", "met"],
    aiNarrative: "Security is partner-delivered; the bundle with our existing FM contract strengthens the case.",
    status: "Prequalified",
    note: "Bundles with our FM contract at the same hospital.",
    submitted: 4,
    decided: 2,
    comment: "Prequalified with the licensed partner named.",
  },
  {
    id: "TND-2026-0288",
    title: "Security services for a retail destination",
    buyer: "Oasis Retail Holdings",
    buyerType: "Private client",
    sourceId: "src-inbox",
    sourceRef: "ORH-SEC-0826",
    category: "Security Services",
    emirate: "Dubai",
    location: "Dubai (2 malls)",
    valueAED: 15_000_000,
    durationMonths: 36,
    publishedAt: "2026-09-08",
    deadline: "2026-11-11",
    summary: "Guarding and control-room services for two malls, alongside our soft-services contract.",
    scope: ["Manned guarding.", "Control-room operations."],
    eligibility: ["partial", "met", "met", "met", "met"],
    aiNarrative: "Partner-delivered service with an existing client.",
    status: "Lead in D365",
    note: "Existing client; partner agreed.",
    submitted: 22,
    decided: 20,
    comment: "Prequalified. Pushed to D365.",
    lead: ["LEAD-47912", 19],
  },
  {
    id: "TND-2026-0282",
    title: "Cash-in-transit services for a bank branch network",
    buyer: "Emirates Commercial Bank",
    buyerType: "Private client",
    sourceId: "src-meridian",
    sourceRef: "ECB-CIT-26-02",
    category: "Security Services",
    emirate: "Abu Dhabi",
    location: "Abu Dhabi (34 branches)",
    valueAED: 21_000_000,
    durationMonths: 36,
    publishedAt: "2026-09-22",
    deadline: "2026-11-19",
    summary: "Armoured cash-in-transit and ATM replenishment services.",
    scope: ["Armoured cash collection.", "ATM replenishment."],
    eligibility: ["unmet", "met", "met", "met", "partial"],
    aiNarrative: "Cash-in-transit needs a specialist licence AGFS does not hold.",
    status: "Not qualified",
    note: "Large value; checking appetite with a partner.",
    submitted: 11,
    decided: 9,
    comment: "Not qualified. Cash-in-transit is outside our services.",
  },
];

function seedAudit(): AuditEvent[] {
  const e = (h: number, actor: string, role: AuditEvent["role"], action: string, tenderId?: string, detail?: string): AuditEvent => ({
    id: `seed-${h}-${action}-${tenderId ?? ""}`,
    at: hoursAgo(h),
    actor,
    role,
    action,
    tenderId,
    detail,
  });
  const routed = ROUTED_CASES.flatMap((c) => {
    const hod = serviceLineFor(c.category).hod;
    const proposed = c.status === "No-bid" ? "Reject" : "Prequalify";
    const out = [e(c.submitted * 24, PEOPLE.analyst.name, "analyst", `Submitted for approval (proposed: ${proposed})`, c.id)];
    if (c.decided !== undefined) {
      const action =
        c.status === "Changes Requested"
          ? "Requested changes"
          : c.status === "Not qualified"
            ? "Marked not qualified"
            : c.status === "No-bid"
              ? "Confirmed rejection"
              : "Prequalified";
      out.push(e(c.decided * 24, hod, "approver", action, c.id, c.comment));
    }
    if (c.lead) out.push(e(c.lead[1] * 24, hod, "approver", `Pushed to D365 as lead ${c.lead[0]}`, c.id));
    return out;
  });
  return [
    ...routed,
    e(20, "Cassandra Haddad", "analyst", "Submitted for approval (proposed: Prequalify)", "TND-2026-0362", "Recommend bidding with a transit-specialist subcontractor."),
    e(26, AGENT_NAME, "agent", "Daily scan completed", undefined, "4 sources scanned, 2 new tenders, 4 duplicates skipped (simulated)."),
    e(24 * 5, "Nadia Yousef", "approver", "Requested changes", "TND-2026-0333", "Please name the partner and confirm margin split."),
    e(24 * 6, "Cassandra Haddad", "analyst", "Submitted for approval (proposed: Prequalify)", "TND-2026-0333"),
    e(24 * 27 - 3, "Faisal Karim", "approver", "Confirmed rejection", "TND-2026-0340", "Agree, not relevant for AGFS."),
    e(24 * 29, "Faisal Karim", "approver", "Prequalified", "TND-2026-0351", "Relevant for Soft Services."),
  ].sort((x, y) => y.at.localeCompare(x.at));
}

export const DEMO_VERSION = 15;

export function seedState(): DemoState {
  return {
    version: DEMO_VERSION,
    role: "analyst",
    hodLine: "ifm",
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
