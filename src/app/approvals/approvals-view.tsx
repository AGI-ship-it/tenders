"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowUpRight, CheckCircle2, Download, Inbox, Mail, MessageSquare, Send, X } from "lucide-react";
import { toast } from "sonner";
import { addComment, useDemo } from "@/lib/store";
import { PROSPECT_STATUSES, aiPrequalified, prospectStatus } from "@/lib/scoring";
import { downloadCsv } from "@/lib/csv";
import { daysUntil, formatDate, formatValue, timeAgo } from "@/lib/format";
import type { Tender } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FilterChips, FilterMenu, TableHeader, useTableFilters, type Facet } from "@/components/table-filters";
import { SortTh, compareBy, nextSort, type SortState } from "@/components/sort-header";
import { TablePagination, usePagination } from "@/components/table-pagination";
import { DecisionPanel } from "@/components/decision-panel";
import { openHodEmail } from "@/components/hod-email";
import { motion } from "motion/react";
import { D365, PageHeader, PrequalBadge, StatusBadge, boldD365 } from "@/components/shared";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SERVICE_LINES, serviceLineFor } from "@/lib/mock-data";

const PENDING: Tender["status"][] = ["Awaiting HoD"];

/** "order" is the default: pending first by due date, then the latest decisions. */
type RegisterSort = "order" | "id" | "value" | "deadline" | "ai" | "hod" | "status" | "lead";

const STATUS_RANK: Tender["status"][] = [
  "Awaiting HoD",
  "Prequalified",
  "Lead in D365",
  "Not qualified",
  "No-bid",
];

function registerValue(t: Tender, key: Exclude<RegisterSort, "order">): number | string {
  switch (key) {
    case "id":
      return t.id;
    case "value":
      return t.valueAED;
    case "deadline":
      return t.deadline;
    case "ai":
      return aiPrequalified(t) ? 1 : 0;
    case "hod":
      return serviceLineFor(t.category).hod;
    case "status":
      return STATUS_RANK.indexOf(t.status);
    case "lead":
      return t.lead?.leadId ?? "";
  }
}

export function ApprovalsView({ embedded = false }: { embedded?: boolean }) {
  const demo = useDemo()!;
  // Deep link from "Submit for prequalification": /approvals?id=TND-...
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Mirror the open panel in the URL so returning from a prospect restores it.
  function syncUrl(id: string | null) {
    router.replace(id ? `${pathname}?id=${encodeURIComponent(id)}` : pathname, { scroll: false });
  }
  const [selectedId, setSelectedId] = useState<string | null>(params.get("id"));
  // Arrived by clicking "Review & decide" in the HoD's email.
  const [fromEmail, setFromEmail] = useState(params.get("via") === "email");
  // The prospect the email was about, highlighted in the HoD's list.
  const [focusId, setFocusId] = useState<string | null>(params.get("focus"));
  // Follow new deep links even when this page is already open.
  const linkKey = params.toString();
  const [seenLink, setSeenLink] = useState(linkKey);
  if (seenLink !== linkKey) {
    setSeenLink(linkKey);
    setSelectedId(params.get("id"));
    if (params.get("via") === "email") setFromEmail(true);
    if (params.get("focus")) setFocusId(params.get("focus"));
  }

  const isHod = demo.role === "approver";
  const myLine = SERVICE_LINES.find((l) => l.id === demo.hodLine) ?? SERVICE_LINES[0];
  const routed = demo.tenders.filter((t) => t.approval);
  const mine = routed.filter((t) => myLine.categories.includes(t.category));
  const notSubmitted = demo.tenders.filter((t) => ["New", "Under Review"].includes(t.status)).length;
  const myAwaiting = mine.filter((t) => t.status === "Awaiting HoD").length;
  const selected = demo.tenders.find((t) => t.id === selectedId);
  const focused = demo.tenders.find((t) => t.id === focusId);
  // The HoD's queue, soonest due first, for "Review next".
  const myQueue = mine.filter((t) => t.status === "Awaiting HoD").sort((a, b) => a.deadline.localeCompare(b.deadline));

  function open(id: string) {
    setSelectedId(id);
    syncUrl(id);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {!embedded && (
        <PageHeader
          title="Prospects for Prequalification"
          description={<>Each prospect is routed to the HoD of its service line. Prequalifying pushes the prospect to <D365 /> as a lead automatically.</>}
        />
      )}

      {isHod ? (
        // HoD view: only the prospects routed to this HoD's service line.
        <>
          <div className="flex shrink-0 items-center gap-3 border-b pb-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-pink-100 text-xs font-semibold text-pink-800">
              {myLine.initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Routed to you · {myLine.hod}</div>
              <div className="text-xs text-muted-foreground">HoD, {myLine.name}</div>
            </div>
            {myAwaiting > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                {myAwaiting} pending your review
              </span>
            )}
          </div>
          {fromEmail && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex shrink-0 flex-wrap items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground"
            >
              <Mail className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="font-semibold">Welcome, {myLine.hod.split(" ")[0]}.</span>{" "}
                {focused ? (
                  <>
                    You opened <span className="font-semibold text-foreground">{focused.title}</span> from your email.
                  </>
                ) : (
                  "Signed in from your email."
                )}
              </span>
              {focused && focused.status === "Awaiting HoD" && (
                <Button size="lg" onClick={() => open(focused.id)}>
                  Review now <ArrowRight />
                </Button>
              )}
              <button onClick={() => setFromEmail(false)} aria-label="Dismiss" className="rounded-md p-1 hover:bg-primary/10">
                <X className="size-4" />
              </button>
            </motion.div>
          )}
          {mine.length ? (
            <Register tenders={mine} onOpen={open} selectedId={selectedId} highlightId={fromEmail ? focusId : null} showHod={false} />
          ) : (
            <EmptyState text="Nothing has been routed to you yet." />
          )}
        </>
      ) : (
        <>
          {routed.length ? (
            <Register tenders={routed} onOpen={open} selectedId={selectedId} showHod notSubmitted={notSubmitted} />
          ) : (
            <EmptyState text="No prospects have been routed to an HoD yet." />
          )}
        </>
      )}

      <Sheet
        open={!!selected}
        onOpenChange={(o) => {
          if (o) return;
          setSelectedId(null);
          syncUrl(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl data-[side=right]:sm:max-w-xl">
          <SheetTitle className="sr-only">{selected?.title ?? "Prospect"}</SheetTitle>
          {selected && (
            <ReviewPanel
              tender={selected}
              isHod={isHod}
              next={myQueue.find((t) => t.id !== selected.id)}
              remaining={myQueue.filter((t) => t.id !== selected.id).length}
              onOpen={open}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

const DONE_LABEL: Partial<Record<Tender["status"], string>> = {
  Prequalified: "Prequalified",
  "Lead in D365": "Prequalified & pushed to D365",
  "Not qualified": "Marked not qualified",
  "No-bid": "Rejection confirmed",
};

function ReviewPanel({
  tender,
  isHod,
  next,
  remaining,
  onOpen,
}: {
  tender: Tender;
  isHod: boolean;
  next?: Tender;
  remaining: number;
  onOpen: (id: string) => void;
}) {
  const line = serviceLineFor(tender.category);
  const done = isHod ? DONE_LABEL[tender.status] : undefined;
  return (
    <div className="space-y-5 p-6">
      {/* After the HoD decides: keep going through the queue without returning to the inbox. */}
      {done && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200 ring-inset"
        >
          <CheckCircle2 className="size-5 shrink-0 text-emerald-700" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-bold text-emerald-900">{boldD365(done)}</div>
            {tender.lead && (
              <div className="text-emerald-900/80">
                Lead <span className="font-mono font-semibold">{tender.lead.leadId}</span> created in <D365 />, owner {tender.lead.owner}.
              </div>
            )}
            <div className="text-emerald-900/80">
              {remaining ? `${remaining} more waiting for you` : "You're all caught up."}
            </div>
          </div>
          {next && (
            <Button variant="success" size="lg" onClick={() => onOpen(next.id)}>
              Review next <ArrowRight />
            </Button>
          )}
        </motion.div>
      )}

      <div className="pr-8">
        <div className="text-xs text-muted-foreground">
          <span className="font-mono">{tender.id}</span> · routed to {line.hod}, HoD {line.name}
        </div>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">{tender.title}</h2>
        <div className="mt-1 text-sm text-muted-foreground">
          {tender.buyer} · {tender.emirate} · {formatValue(tender)}
        </div>
      </div>

      <div className="space-y-1.5 rounded-lg bg-secondary/60 p-3.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          AI pre-qualification <PrequalBadge yes={aiPrequalified(tender)} />
        </div>
        <p className="text-sm text-foreground/80">{tender.aiNarrative}</p>
      </div>

      <Button variant="link" nativeButton={false} render={<Link href={`/opportunity?id=${encodeURIComponent(tender.id)}&from=approvals`} />}>
        Open full prospect and AI reasoning <ArrowUpRight />
      </Button>

      <div className="rounded-xl bg-muted/30 p-4">
        <h3 className="mb-3 text-sm font-bold text-primary">HoD decision</h3>
        <DecisionPanel tender={tender} />
        {!isHod && tender.status === "Awaiting HoD" && (
          <Button variant="secondary" size="lg" className="mt-3 w-full" onClick={() => openHodEmail(tender.id)}>
            <Mail /> Preview email to {line.hod}
          </Button>
        )}
      </div>

      <Comments tender={tender} />
    </div>
  );
}

function Comments({ tender }: { tender: Tender }) {
  const [text, setText] = useState("");
  return (
    <div className="space-y-3 border-t pt-5">
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-primary">
        <MessageSquare className="size-4 text-muted-foreground" /> Reviewer comments
      </h3>
      {tender.comments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
      <ul className="space-y-3">
        {tender.comments.map((c) => (
          <li key={c.id} className="flex gap-2.5">
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
                c.role === "approver" ? "bg-pink-100 text-pink-800" : "bg-purple-100 text-purple-900",
              )}
            >
              {c.author.split(" ").map((p) => p[0]).join("")}
            </span>
            <div className="text-sm">
              <span className="font-medium">{c.author}</span>{" "}
              <span className="text-xs text-muted-foreground">{timeAgo(c.at)}</span>
              <p className="text-foreground/80">{c.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          addComment(tender.id, text.trim());
          setText("");
          toast("Comment added", { description: "Recorded in the audit trail." });
        }}
      >
        <Textarea rows={2} placeholder="Add a comment…" value={text} onChange={(e) => setText(e.target.value)} className="min-h-0" />
        <Button type="submit" size="icon" variant="outline" disabled={!text.trim()} aria-label="Post comment">
          <Send />
        </Button>
      </form>
    </div>
  );
}

/** Whether the HoD's final decision matches the AI's Yes / No. */
function agreesWithAi(t: Tender): boolean {
  return aiPrequalified(t) === (t.status === "Prequalified" || t.status === "Lead in D365");
}

function exportCsv(tenders: Tender[]) {
  const header = [
    "Tender ID", "Title", "Buyer", "Value (AED)", "Due date", "AI pre-qualification", "HoD", "Proposed",
    "Status", "Decided by", "Decided at", "Rationale", "D365 lead", "Submitted by", "Submission note",
  ];
  const rows = tenders.map((t) => [
    t.id, t.title, t.buyer, t.valueAED, t.deadline.slice(0, 10), aiPrequalified(t) ? "Yes" : "No",
    serviceLineFor(t.category).hod, t.approval?.proposed ?? "", prospectStatus(t.status), t.approval?.decidedBy ?? "",
    t.approval?.decidedAt ?? "", t.approval?.decisionComment ?? "", t.lead?.leadId ?? "",
    t.approval?.submittedBy ?? "", t.approval?.note ?? "",
  ]);
  downloadCsv("agfs-prequalification-register.csv", header, rows, "Register exported");
}

/** Pending first (soonest due date first), then decided (most recent first). */
function registerOrder(a: Tender, b: Tender) {
  const pa = PENDING.includes(a.status);
  const pb = PENDING.includes(b.status);
  if (pa !== pb) return pa ? -1 : 1;
  if (pa) return a.deadline.localeCompare(b.deadline);
  return (b.approval?.decidedAt ?? "").localeCompare(a.approval?.decidedAt ?? "");
}

/** Register of routed prospects: who they are assigned to, their status and, once prequalified, the D365 lead. */
function Register({
  tenders,
  onOpen,
  selectedId,
  highlightId,
  showHod,
  notSubmitted,
}: {
  tenders: Tender[];
  onOpen: (id: string) => void;
  selectedId: string | null;
  /** A row to draw attention to, e.g. the prospect an email linked to. */
  highlightId?: string | null;
  showHod: boolean;
  /** Prospects not yet sent to an HoD; linked to the Pipeline in the toolbar. */
  notSubmitted?: number;
}) {
  const [q, setQ] = useState("");
  const filters = useTableFilters();
  const facets: Facet[] = [
    { key: "status", label: "Status", options: [...PROSPECT_STATUSES] },
    ...(showHod ? [{ key: "hod", label: "HoD", options: SERVICE_LINES.map((l) => l.hod) }] : []),
    { key: "ai", label: "AI pre-qual", options: ["Yes", "No"] },
  ];
  const [sort, setSort] = useState<SortState<RegisterSort>>({ key: "order", dir: "asc" });
  const onSort = (key: RegisterSort) => setSort((s) => nextSort(s, key, ["order", "id", "deadline", "hod", "status"]));

  const needle = q.trim().toLowerCase();
  const sorted = tenders
    .filter(
      (t) =>
        filters.matches("status", prospectStatus(t.status)) &&
        filters.matches("hod", serviceLineFor(t.category).hod) &&
        filters.matches("ai", aiPrequalified(t) ? "Yes" : "No") &&
        (!needle || `${t.id} ${t.title} ${t.buyer}`.toLowerCase().includes(needle)),
    )
    .sort((a, b) => {
      if (sort.key === "order") return sort.dir === "asc" ? registerOrder(a, b) : registerOrder(b, a);
      const key = sort.key;
      // Ties fall back to the default order so the list stays stable.
      return compareBy<Tender>(sort.dir, (t) => registerValue(t, key))(a, b) || registerOrder(a, b);
    });
  const pager = usePagination(sorted, `${q}|${filters.key}|${sort.key}|${sort.dir}`);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {!showHod && (
        <p className="shrink-0 text-sm text-muted-foreground">
          Prospects routed to your service line. Open one to prequalify or reject it.
        </p>
      )}
      {/* The table fills the rest of the window and scrolls inside, with its headings pinned. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card shadow-soft in-data-step-section:rounded-none in-data-step-section:shadow-none">
        <TableHeader title={showHod ? "Prequalification register" : "Routed to you"} count={sorted.length} search={q} onSearch={setQ}>
          {notSubmitted ? (
            <Link href="/pipeline" className="px-1 text-xs text-muted-foreground hover:text-primary">
              {notSubmitted} not yet submitted →
            </Link>
          ) : null}
          <FilterMenu facets={facets} filters={filters} />
          <Button size="lg" onClick={() => exportCsv(sorted)} disabled={!sorted.length}>
            Export CSV <Download />
          </Button>
        </TableHeader>
        <FilterChips facets={facets} filters={filters} />
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="sticky top-0 z-10 border-b bg-zinc-50 text-left text-xs text-muted-foreground">
              <tr>
                <SortTh sortKey="id" sort={sort} onSort={onSort} className="pl-5">
                  Tender no.
                </SortTh>
                <SortTh sortKey="order" sort={sort} onSort={onSort}>
                  Prospect
                </SortTh>
                <SortTh sortKey="value" sort={sort} onSort={onSort} className="text-right">
                  Value
                </SortTh>
                <SortTh sortKey="deadline" sort={sort} onSort={onSort}>
                  Due date
                </SortTh>
                <SortTh sortKey="ai" sort={sort} onSort={onSort}>
                  AI pre-qual
                </SortTh>
                {showHod && (
                  <SortTh sortKey="hod" sort={sort} onSort={onSort}>
                    HoD
                  </SortTh>
                )}
                <SortTh sortKey="status" sort={sort} onSort={onSort}>
                  Status
                </SortTh>
                <SortTh sortKey="lead" sort={sort} onSort={onSort} className="pr-5">
                  D365 lead
                </SortTh>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pager.pageItems.map((t) => {
                const line = serviceLineFor(t.category);
                const pending = PENDING.includes(t.status);
                const days = daysUntil(t.deadline);
                const agrees = agreesWithAi(t);
                return (
                  <tr
                    key={t.id}
                    onClick={() => onOpen(t.id)}
                    className={cn(
                      "cursor-pointer align-top transition-colors hover:bg-muted/30",
                      t.status === "Awaiting HoD" && "bg-amber-50/40",
                      selectedId === t.id && "bg-primary/5",
                      highlightId === t.id && "bg-secondary shadow-[inset_3px_0_0_var(--primary)]",
                    )}
                  >
<td className="py-3 pr-3 pl-5 whitespace-nowrap">
                      <span className="font-mono text-xs text-muted-foreground">{t.id}</span>
                    </td>
                    <td className="max-w-[320px] px-3 py-3">
                      <div className="truncate font-medium">{t.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{t.buyer}</div>
                    </td>
                    <td className="tabular px-3 py-3 text-right whitespace-nowrap font-medium">{formatValue(t)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {formatDate(t.deadline)}
                      <div className={cn("text-xs", days <= 14 && days > 0 ? "text-orange-700" : "text-muted-foreground")}>
                        {days > 0 ? `${days} days left` : "Closed"}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <PrequalBadge yes={aiPrequalified(t)} />
                    </td>
                    {showHod && (
                      <td className="px-3 py-3 whitespace-nowrap">
                        {line.hod}
                        <div className="text-xs text-muted-foreground">{line.name}</div>
                      </td>
                    )}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <StatusBadge status={t.status} />
                      <div className="mt-1.5 text-[11px] text-muted-foreground">
                        {pending ? (
                          t.approval && `Submitted ${timeAgo(t.approval.submittedAt)}`
                        ) : (
                          <span className={cn("font-medium", !agrees && "text-magenta")}>
                            {agrees ? "Matches AI" : "Overrides AI"}
                            {t.approval?.decidedAt && <span className="font-normal text-muted-foreground"> · {formatDate(t.approval.decidedAt)}</span>}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 pr-5 whitespace-nowrap">
                      {t.lead ? (
                        <>
                          <span className="font-mono text-xs font-medium text-teal-700">{t.lead.leadId}</span>
                          <div className="text-xs text-muted-foreground">{formatDate(t.lead.pushedAt)}</div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={showHod ? 8 : 7} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No prospects match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination {...pager} overall={tenders.length} />
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card py-16 text-center">
      <Inbox className="size-8 text-muted-foreground/60" />
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
