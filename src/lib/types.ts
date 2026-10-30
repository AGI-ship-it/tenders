export type Role = "analyst" | "approver";

export type Emirate =
  | "Dubai"
  | "Abu Dhabi"
  | "Sharjah"
  | "Ajman"
  | "Ras Al Khaimah"
  | "Fujairah"
  | "Umm Al Quwain";

export type Category =
  | "Integrated FM"
  | "Hard FM / MEP"
  | "Cleaning & Hygiene"
  | "Landscaping"
  | "Security Services"
  | "Pest Control"
  | "Waste Management";

export type Recommendation = "Bid" | "Bid with conditions" | "Review" | "No-bid";

export type TenderStatus =
  | "New"
  | "Under Review"
  | "Awaiting HoD"
  | "Changes Requested"
  | "Prequalified"
  | "Lead in D365"
  | "No-bid"
  | "Not qualified";

export type CheckStatus = "met" | "partial" | "unmet" | "unknown";

export interface EligibilityItem {
  requirement: string;
  status: CheckStatus;
  note: string;
}

export interface Risk {
  title: string;
  severity: "High" | "Medium" | "Low";
  mitigation: string;
}

export interface Evidence {
  label: string;
  location: string;
  excerpt: string;
}

export interface Comment {
  id: string;
  author: string;
  role: Role;
  at: string;
  text: string;
}

export interface ApprovalRecord {
  proposed: "Bid" | "No-bid";
  submittedBy: string;
  submittedAt: string;
  reviewer: string;
  note: string;
  decision?: "Approved" | "Rejected" | "Changes Requested";
  decidedBy?: string;
  decidedAt?: string;
  decisionComment?: string;
}

/** Simulated record of a prospect pushed to Dynamics 365 lead management. */
export interface D365Lead {
  leadId: string;
  pushedBy: string;
  pushedAt: string;
  owner: string;
}

export interface Tender {
  id: string;
  title: string;
  buyer: string;
  buyerType: "Government" | "Semi-government" | "Private client";
  sourceId: string;
  sourceRef: string;
  category: Category;
  emirate: Emirate;
  location: string;
  valueAED: number;
  /** false when the buyer did not publish a value; valueAED is then an AI estimate from scope. */
  valueDisclosed?: boolean;
  durationMonths: number;
  publishedAt: string;
  deadline: string;
  summary: string;
  scope: string[];
  eligibility: EligibilityItem[];
  /** ISO certifications the tender requires bidders to hold. */
  isoRequired: string[];
  risks: Risk[];
  assumptions: string[];
  evidence: Evidence[];
  aiNarrative: string;
  status: TenderStatus;
  discoveredAt: string;
  fromLatestScan?: boolean;
  approval?: ApprovalRecord;
  lead?: D365Lead;
  comments: Comment[];
}

export type AccessType = "Public" | "Password" | "UAE PASS" | "CAPTCHA";

export interface Source {
  id: string;
  access: AccessType;
  /** "Action needed" means a person must sign in or approve before the agent can scan. */
  accessState: "Ready" | "Action needed";
  name: string;
  kind: "Government" | "Semi-government" | "Client portal" | "Email" | "Upload";
  url: string;
  method: string;
  schedule: string;
  lastScanAt: string | null;
  status: "Connected" | "Needs attention" | "Paused";
  statusNote?: string;
  tendersFound: number;
  /** Service lines the agent filters for on this source. */
  watch?: Category[];
  /** "ai" when the agent found and connected the portal itself; otherwise added by a person. */
  addedBy?: "ai" | "user";
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  role: Role | "agent";
  action: string;
  tenderId?: string;
  detail?: string;
}

/** Outcome of the most recent scan, kept so Scan Portal can show it again later. */
export interface LastScan {
  at: string;
  scanned: number;
  duplicates: number;
  newIds: string[];
  /** Prospects the scan matched that were already in the pipeline (shown when nothing new was found). */
  foundIds?: string[];
  runs: { sourceId: string; outcome: "scanned" | "sign-in" | "paused" }[];
}

export interface DemoState {
  version: number;
  role: Role;
  tenders: Tender[];
  sources: Source[];
  audit: AuditEvent[];
  scanCount: number;
  lastScanAt: string | null;
  lastScan?: LastScan;
  onboarded: boolean;
}
