/**
 * Bid Analyst (creates leads), BD Head (VP Commercial: reviews after the HoD, can bypass the HoD), Bid Head (final
 * approval, creates the opportunity), HoD of a service line (interested or not, 24 h).
 */
export type Role = "analyst" | "vp" | "bid" | "ops";

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

/**
 * Lead-to-opportunity journey (workshop: manual push, then HoD → BD Head → Bid Head):
 * Draft (the AI prepared a lead draft; nothing in D365 yet) → Awaiting HoD (the Bid Analyst created the D365 lead; it
 * goes to the service line's HoD automatically, interested or not within 24 h) → BD Head review (after the HoD's reply,
 * or the BD Head bypassed the HoD) → Bid Head approval (BD Head approved) → Opportunity created (Bid Head approved;
 * handed to the bidding agent) or Rejected (by the BD Head or the Bid Head). A dismissed draft is "Not a tender".
 * Every response is logged on the D365 lead.
 */
export type TenderStatus =
  | "Draft"
  | "Not a tender"
  | "BD Head review"
  | "Awaiting HoD"
  | "Bid Head approval"
  | "Opportunity created"
  | "Rejected";

/** The statuses shown to users are the workflow statuses themselves. */
export type ProspectStatus = TenderStatus;

/** How the tender reached the agent: an emailed alert with a link (the main path), the daily portal scan, or an upload. */
export type Intake = "Email alert" | "Portal scan" | "Upload";

export type Priority = "High" | "Medium" | "Low";

/** A date, fee or obligation the AI read from the tender and logged as an action on the D365 lead. */
export interface TenderAction {
  id: string;
  kind: "Submission deadline" | "Clarification deadline" | "Site visit" | "Tender fee" | "NDA";
  label: string;
  due?: string;
  amountAED?: number;
  /** "Low" when the AI could not read it clearly; the Bid Analyst should check it. */
  confidence: "High" | "Low";
  /** Where in the tender the AI found it. */
  foundIn: string;
  /** Checked by the Bid Analyst. */
  confirmed: boolean;
}

/** The service-line HoD's prequalification, asked automatically when the lead is created: interested or not, 24 h. */
export interface OpsInput {
  person: string;
  line: string;
  askedAt: string;
  dueAt: string;
  reply?: "Interested" | "Not interested";
  repliedAt?: string;
  remindersSent: number;
  /** The BD Head moved the lead on without the HoD's reply. */
  bypassed?: boolean;
  bypassReason?: string;
}

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
  /** Routing: HoD → BD Head (reviewer) → Bid Head (final decision in decision / decidedBy). */
  submittedBy: string;
  submittedAt: string;
  reviewer: string;
  note: string;
  /** The BD Head's step. */
  bdDecision?: "Approved" | "Rejected";
  bdBy?: string;
  bdAt?: string;
  bdComment?: string;
  /** The final outcome: the Bid Head's decision, or the BD Head's rejection. */
  decision?: "Approved" | "Rejected";
  decidedBy?: string;
  decidedAt?: string;
  decisionComment?: string;
}

/**
 * Simulated Dynamics 365 lead. The AI prepares a draft for every tender it spots; the lead exists in D365 only once the
 * Bid Analyst pushes it (createdBy/createdAt are then the analyst's). For a draft, leadId is the number it will get.
 */
export interface D365Lead {
  leadId: string;
  createdBy: string;
  createdAt: string;
  owner: string;
  /** Set when the Bid Analyst confirms the details the AI filled in. */
  confirmedBy?: string;
  confirmedAt?: string;
  /** Open while being worked; Qualified once converted to an opportunity; Disqualified when rejected. */
  state: "Open" | "Qualified" | "Disqualified";
}

/** Simulated D365 opportunity, created when the Bid Head gives the final approval. */
export interface D365Opportunity {
  oppId: string;
  createdBy: string;
  createdAt: string;
  /** Who takes it on for the bid/no-bid work. */
  handedTo: string;
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
  intake: Intake;
  /** Dates, fees and NDAs logged as actions on the lead. */
  actions: TenderAction[];
  discoveredAt: string;
  fromLatestScan?: boolean;
  approval?: ApprovalRecord;
  opsInput?: OpsInput;
  lead: D365Lead;
  opportunity?: D365Opportunity;
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
  /** Tenders the portal scan found that had already arrived by email alert: no second lead was created. */
  alreadyLeadIds?: string[];
  runs: { sourceId: string; outcome: "scanned" | "sign-in" | "paused" }[];
}

/** An Outlook (Microsoft 365) mailbox the agent reads for tenders. Simulated. */
export interface MailboxConnection {
  address: string;
  /** "Shared" for a team mailbox such as sales@; "Personal" for one person's mailbox. */
  kind: "Shared" | "Personal";
  /** Folders the agent reads. */
  folders: string[];
  connectedBy: string;
  connectedAt: string;
}

export interface DemoState {
  version: number;
  role: Role;
  /** Service line of the HoD being acted as when role is "ops". */
  opsLine?: string;
  tenders: Tender[];
  sources: Source[];
  audit: AuditEvent[];
  scanCount: number;
  lastScanAt: string | null;
  lastScan?: LastScan;
  onboarded: boolean;
  /** Outlook mailboxes connected for the agent to read. Empty until someone connects one. */
  mailboxes: MailboxConnection[];
}
