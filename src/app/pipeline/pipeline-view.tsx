"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDemo } from "@/lib/store";
import { PROSPECT_STATUSES, aiPrequalified, fitScore, inD365, isActive, priorityScore, prospectStatus } from "@/lib/scoring";
import { ChevronRight, Download, Inbox } from "lucide-react";
import Link from "next/link";
import { downloadCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { daysUntil, formatDate, hoursLeft, timeAgo } from "@/lib/format";
import { PEOPLE } from "@/lib/mock-data";
import type { ProspectStatus, Tender } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FilterChips, FilterMenu, TableHeader, useTableFilters, type Facet } from "@/components/table-filters";
import { SortTh, nextSort, type SortState } from "@/components/sort-header";
import { TablePagination, usePagination } from "@/components/table-pagination";
import { PageHeader, PrequalBadge, StatusBadge, boldD365 } from "@/components/shared";

type SortKey = "priority" | "lead" | "deadline" | "fit" | "status";

/**
 * Screen 3 · the Lead Pipeline: every D365 lead the Bid Analyst created from an AI draft, with the AI pre-qualification and where it
 * stands with VP Commercial.
 */
export function PipelineView({ embedded = false }: { embedded?: boolean }) {
  const demo = useDemo()!;
  const router = useRouter();
  const params = useSearchParams();
  const highlight = params.get("highlight");
  const [q, setQ] = useState("");
  const filters = useTableFilters();
  const { matches } = filters;
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "priority", dir: "desc" });
  // Every case, whatever its status: drafts, D365 leads, VP Commercial's decisions, and dismissed drafts.
  const leads = demo.tenders;
  const toConfirm = demo.tenders.filter((t) => t.status === "Draft").length;
  const [tab, setTab] = useState<ProspectStatus | "All">("All");

  const facets = useMemo<Facet[]>(() => {
    const uniq = (f: (t: Tender) => string) => Array.from(new Set(leads.map(f))).sort();
    return [
      { key: "category", label: "Service", options: uniq((t) => t.category) },
      { key: "ai", label: "AI pre-qual", options: ["Yes", "No"] },
      { key: "emirate", label: "Emirate", options: uniq((t) => t.emirate) },
    ];
  }, [leads]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const value = (t: Tender): number | string => {
      switch (sort.key) {
        case "priority":
          return priorityScore(t);
        case "fit":
          // Yes before No, then by the score behind it.
          return (aiPrequalified(t) ? 1000 : 0) + fitScore(t);
        case "deadline":
          return t.deadline;
        case "lead":
          return t.lead.leadId;
        case "status":
          return PROSPECT_STATUSES.indexOf(prospectStatus(t.status));
      }
    };
    return leads
      .filter(
        (t) =>
          matches("category", t.category) &&
          matches("emirate", t.emirate) &&
          matches("status", prospectStatus(t.status)) &&
          (tab === "All" || t.status === tab) &&
          matches("ai", aiPrequalified(t) ? "Yes" : "No") &&
          (!needle || `${t.id} ${t.lead.leadId} ${t.opportunity?.oppId ?? ""} ${t.title} ${t.buyer}`.toLowerCase().includes(needle)),
      )
      .sort((a, b) => {
        // The lead just created comes first, then open leads above decided ones.
        if (highlight && (a.id === highlight) !== (b.id === highlight)) return a.id === highlight ? -1 : 1;
        if (sort.key === "priority" && isActive(a) !== isActive(b)) return isActive(a) ? -1 : 1;
        const av = value(a);
        const bv = value(b);
        const c = av < bv ? -1 : av > bv ? 1 : 0;
        return sort.dir === "asc" ? c : -c;
      });
  }, [leads, q, matches, sort, highlight, tab]);
  const pager = usePagination(rows, `${q}|${filters.key}|${sort.key}|${sort.dir}|${tab}`);

  function toggleSort(key: SortKey) {
    setSort((s) => nextSort(s, key, ["deadline", "lead", "status"]));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {!embedded && (
        <PageHeader
          title="Lead Pipeline"
          description="Every tender the AI found, from draft to VP Commercial's decision: drafts to review, D365 leads, opportunities, rejections and dismissed drafts."
        />
      )}

      {/* The table fills the rest of the window and scrolls inside, with its headings pinned. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card shadow-soft in-data-step-section:rounded-none in-data-step-section:shadow-none">
        <TableHeader title="All cases" count={rows.length} search={q} onSearch={setQ}>
          {toConfirm > 0 && (
            <Link href="/lead" className="flex items-center gap-1 px-1 text-xs text-muted-foreground hover:text-primary">
              <Inbox className="size-3.5" /> {toConfirm} draft{toConfirm === 1 ? "" : "s"} to review →
            </Link>
          )}
          <FilterMenu facets={facets} filters={filters} />
          <Button size="lg" onClick={() => exportCsv(rows)} disabled={!rows.length}>
            Export CSV <Download />
          </Button>
        </TableHeader>
        {/* Every status in journey order, with how many cases are in each. */}
        <div role="tablist" aria-label="Status" className="flex flex-wrap gap-1.5 border-b px-5 py-2.5">
          {(["All", ...PROSPECT_STATUSES] as const).map((st) => {
            const n = st === "All" ? leads.length : leads.filter((t) => t.status === st).length;
            const on = tab === st;
            return (
              <button
                key={st}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(st)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors",
                  on
                    ? "bg-primary text-primary-foreground ring-primary"
                    : "bg-card text-muted-foreground ring-border hover:text-foreground",
                )}
              >
                {st === "All" ? "All" : st}
                <span className={cn("tabular rounded-full px-1.5 text-[10px]", on ? "bg-white/20" : "bg-muted")}>{n}</span>
              </button>
            );
          })}
        </div>
        <FilterChips facets={facets} filters={filters} />
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="sticky top-0 z-10 border-b bg-zinc-50 text-left text-xs text-muted-foreground">
              <tr>
                <SortTh sortKey="lead" sort={sort} onSort={toggleSort} className="pl-5">
                  Lead ID
                </SortTh>
                <SortTh sortKey="priority" sort={sort} onSort={toggleSort}>
                  Tender
                </SortTh>
                <th className="px-3 py-3 font-bold">Scope</th>
                <th className="px-3 py-3 font-bold">Service</th>
                <SortTh sortKey="deadline" sort={sort} onSort={toggleSort}>
                  Closing date
                </SortTh>
                <SortTh sortKey="fit" sort={sort} onSort={toggleSort}>
                  AI pre-qual
                </SortTh>
                <SortTh sortKey="status" sort={sort} onSort={toggleSort}>
                  Status
                </SortTh>
                <th className="w-12 py-3 pr-4">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pager.pageItems.map((t) => {
                const days = daysUntil(t.deadline);
                const next = nextStep(t);
                return (
                  <tr
                    key={t.id}
                    onClick={() =>
                      router.push(
                        t.status === "Draft"
                          ? `/lead?id=${encodeURIComponent(t.id)}`
                          : `/opportunity?id=${encodeURIComponent(t.id)}&from=pipeline`,
                      )
                    }
                    className={cn(
                      "group cursor-pointer align-top transition-colors hover:bg-secondary/50",
                      highlight === t.id && "bg-sky-50/60",
                    )}
                  >
                    <td className="py-3 pr-3 pl-5 whitespace-nowrap">
                      {inD365(t) ? (
                        <span className="font-mono text-xs font-medium text-teal-700">{t.lead.leadId}</span>
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground">No lead yet</span>
                      )}
                      {highlight === t.id && (
                        <span className="ml-2 rounded bg-sky-100 px-1.5 py-px text-[10px] font-semibold tracking-wide text-sky-700 uppercase">
                          New
                        </span>
                      )}
                      <div className="text-xs text-muted-foreground">{timeAgo(inD365(t) ? t.lead.createdAt : t.discoveredAt)}</div>
                    </td>
                    <td className="max-w-[300px] px-3 py-3">
                      <div className="truncate font-medium group-hover:text-primary">{t.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {t.buyer} · <span className="font-mono">{t.sourceRef}</span>
                      </div>
                    </td>
                    <td className="max-w-[280px] px-3 py-3">
                      <p className="line-clamp-2 text-xs text-muted-foreground">{t.summary}</p>
                    </td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap">
                      {t.category}
                      <div className="text-muted-foreground">{t.emirate}</div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div>{formatDate(t.deadline)}</div>
                      <div className={cn("text-xs", days <= 14 && days > 0 ? "text-orange-700" : "text-muted-foreground")}>
                        {days > 0 ? `${days} days left` : "Closed"}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {t.status === "Not a tender" ? (
                        <span className="text-xs text-muted-foreground">n/a</span>
                      ) : (
                        <PrequalBadge yes={aiPrequalified(t)} />
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <StatusBadge status={t.status} />
                      <div className={cn("mt-1 text-xs", next.tone)}>{boldD365(next.text)}</div>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <Link
                        href={`/opportunity?id=${encodeURIComponent(t.id)}&from=pipeline`}
                        aria-label={`Show details for ${t.title}`}
                        title="Show prequalification details"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors group-hover:bg-secondary group-hover:text-primary hover:bg-primary/10"
                      >
                        <ChevronRight className="size-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-14 text-center text-sm text-muted-foreground">
                    No leads match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination {...pager} overall={leads.length} />
      </div>
    </div>
  );
}

/** One line under the status: who holds the lead now, or what it became. */
function nextStep(t: Tender): { text: string; tone: string } {
  const vp = PEOPLE.vp.name;
  switch (t.status) {
    case "Draft":
      return { text: "To review · Bid Analyst", tone: "text-sky-700" };
    case "Not a tender":
      return { text: "Dismissed by Bid Analyst · no lead", tone: "text-muted-foreground" };
    case "BD Head review":
      return { text: t.opsInput?.reply ? `HoD ${t.opsInput.reply.toLowerCase()} · with ${vp}` : `With ${vp}`, tone: "text-amber-700" };
    case "Awaiting HoD":
      return {
        text:
          t.opsInput && hoursLeft(t.opsInput.dueAt) <= 0
            ? `${t.opsInput.person} overdue · reminded`
            : `${vp.split(" ")[0]} asked ${t.opsInput?.person ?? "HoD"} · 24 h`,
        tone: "text-orange-700",
      };
    case "Opportunity created":
      return { text: `${t.opportunity?.oppId ?? "Opportunity"} · with bidding agent`, tone: "text-emerald-700" };
    case "Rejected":
      return {
        text: t.approval?.decidedAt ? `By ${t.approval.decidedBy} · ${formatDate(t.approval.decidedAt)}` : "Rejected",
        tone: "text-muted-foreground",
      };
    default:
      return { text: "", tone: "" };
  }
}

function exportCsv(tenders: Tender[]) {
  const header = [
    "Lead ID",
    "Tender no.",
    "Title",
    "Client",
    "Service",
    "Emirate",
    "Closing date",
    "AI pre-qualification",
    "Status",
    "Next step",
    "Opportunity",
  ];
  const rows = tenders.map((t) => [
    t.lead.leadId,
    t.sourceRef,
    t.title,
    t.buyer,
    t.category,
    t.emirate,
    t.deadline.slice(0, 10),
    aiPrequalified(t) ? "Yes" : "No",
    prospectStatus(t.status),
    nextStep(t).text,
    t.opportunity?.oppId ?? "",
  ]);
  downloadCsv("agfs-lead-pipeline.csv", header, rows, "Lead pipeline exported");
}
