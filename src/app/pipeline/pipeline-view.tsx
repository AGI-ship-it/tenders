"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDemo } from "@/lib/store";
import { PROSPECT_STATUSES, aiPrequalified, fitScore, isActive, priorityScore, prospectStatus } from "@/lib/scoring";
import { ChevronRight, Download } from "lucide-react";
import Link from "next/link";
import { downloadCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { daysUntil, formatDate, formatValue, timeAgo } from "@/lib/format";
import { serviceLineFor } from "@/lib/mock-data";
import type { Tender } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FilterChips, FilterMenu, TableHeader, useTableFilters, type Facet } from "@/components/table-filters";
import { SortTh, nextSort, type SortState } from "@/components/sort-header";
import { TablePagination, usePagination } from "@/components/table-pagination";
import { PageHeader, PrequalBadge, StatusBadge, boldD365 } from "@/components/shared";

type SortKey = "priority" | "id" | "value" | "deadline" | "fit" | "status";


export function PipelineView({ embedded = false }: { embedded?: boolean }) {
  const demo = useDemo()!;
  const router = useRouter();
  const [q, setQ] = useState("");
  const filters = useTableFilters();
  const { matches } = filters;
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "priority", dir: "desc" });

  const facets = useMemo<Facet[]>(() => {
    const uniq = (f: (t: Tender) => string) => Array.from(new Set(demo.tenders.map(f))).sort();
    return [
      { key: "category", label: "Service", options: uniq((t) => t.category) },
      { key: "emirate", label: "Emirate", options: uniq((t) => t.emirate) },
      { key: "status", label: "Status", options: [...PROSPECT_STATUSES] },
    ];
  }, [demo.tenders]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const value = (t: Tender): number | string => {
      switch (sort.key) {
        case "priority":
          return priorityScore(t);
        case "fit":
          // Yes before No, then by the score behind it.
          return (aiPrequalified(t) ? 1000 : 0) + fitScore(t);
        case "value":
          return t.valueAED;
        case "deadline":
          return t.deadline;
        case "id":
          return t.id;
        case "status":
          return PROSPECT_STATUSES.indexOf(prospectStatus(t.status));
      }
    };
    return demo.tenders
      .filter(
        (t) =>
          matches("category", t.category) &&
          matches("emirate", t.emirate) &&
          matches("status", prospectStatus(t.status)) &&
          (!needle || `${t.id} ${t.title} ${t.buyer}`.toLowerCase().includes(needle)),
      )
      .sort((a, b) => {
        // In priority order, open prospects always rank above decided ones.
        if (sort.key === "priority" && isActive(a) !== isActive(b)) return isActive(a) ? -1 : 1;
        const av = value(a);
        const bv = value(b);
        const c = av < bv ? -1 : av > bv ? 1 : 0;
        return sort.dir === "asc" ? c : -c;
      });
  }, [demo.tenders, q, matches, sort]);
  const pager = usePagination(rows, `${q}|${filters.key}|${sort.key}|${sort.dir}`);

  function toggleSort(key: SortKey) {
    setSort((s) => nextSort(s, key, ["deadline", "id", "status"]));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {!embedded && (
        <PageHeader
          title="Prospects Pipeline"
          description="Every prospect the agent found, ranked by AI pre-qualification. Click a row to see why."
        />
      )}

      {/* The table fills the rest of the window and scrolls inside, with its headings pinned. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card shadow-soft in-data-step-section:rounded-none in-data-step-section:shadow-none">
        <TableHeader title="All prospects" count={rows.length} search={q} onSearch={setQ}>
          <FilterMenu facets={facets} filters={filters} />
          <Button size="lg" onClick={() => exportCsv(rows)} disabled={!rows.length}>
            Export CSV <Download />
          </Button>
        </TableHeader>
        <FilterChips facets={facets} filters={filters} />
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="sticky top-0 z-10 border-b bg-zinc-50 text-left text-xs text-muted-foreground">
              <tr>
                <SortTh sortKey="id" sort={sort} onSort={toggleSort} className="pl-5">
                  Tender no.
                </SortTh>
                <SortTh sortKey="priority" sort={sort} onSort={toggleSort}>
                  Prospect
                </SortTh>
                <SortTh sortKey="value" sort={sort} onSort={toggleSort} className="text-right">
                  Value
                </SortTh>
                <SortTh sortKey="deadline" sort={sort} onSort={toggleSort}>
                  Due date
                </SortTh>
                <SortTh sortKey="fit" sort={sort} onSort={toggleSort}>
                  AI pre-qual
                </SortTh>
                <SortTh sortKey="status" sort={sort} onSort={toggleSort}>
                  Status
                </SortTh>
                <th className="px-3 py-3 font-bold">Decision</th>
                <th className="w-12 py-3 pr-4"><span className="sr-only">Details</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pager.pageItems.map((t) => {
                const days = daysUntil(t.deadline);
                return (
                  <tr
                    key={t.id}
                    onClick={() => router.push(`/opportunity?id=${encodeURIComponent(t.id)}&from=pipeline`)}
                    className={cn(
                      "group cursor-pointer transition-colors hover:bg-secondary/50",
                      t.fromLatestScan && "bg-sky-50/40",
                    )}
                  >
<td className="py-3 pr-3 pl-5 whitespace-nowrap">
                      <span className="font-mono text-xs text-muted-foreground">{t.id}</span>
                    </td>
                    <td className="max-w-[420px] px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium group-hover:text-primary">{t.title}</span>
                        {t.fromLatestScan && (
                          <span className="shrink-0 rounded bg-sky-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                            New
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{t.buyer}</div>
                    </td>
                    <td className="tabular px-3 py-3 text-right whitespace-nowrap font-medium">{formatValue(t)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div>{formatDate(t.deadline)}</div>
                      <div className={cn("text-xs", days <= 14 ? "text-orange-700" : "text-muted-foreground")}>
                        {days > 0 ? `${days} days left` : "Closed"}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <PrequalBadge yes={aiPrequalified(t)} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <Decision tender={t} />
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <Link
                        href={`/opportunity?id=${encodeURIComponent(t.id)}&from=pipeline`}
                        aria-label={`Show details for ${t.title}`}
                        title="Show details"
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
                    No prospects match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination {...pager} overall={demo.tenders.length} />
      </div>
    </div>
  );
}

/** Who holds the decision on a prospect, or who made it and when. */
function decisionOf(t: Tender): { main: string; sub?: string; tone: string } {
  const hod = serviceLineFor(t.category).hod;
  const a = t.approval;
  const decidedOn = a?.decidedAt ? formatDate(a.decidedAt) : undefined;
  let main: string;
  let sub: string | undefined;
  let tone = "text-foreground";
  switch (t.status) {
    case "New":
    case "Under Review":
      main = "Not yet submitted";
      tone = "text-muted-foreground";
      break;
    case "Awaiting HoD":
      main = `Awaiting ${hod}`;
      sub = a ? `Sent ${timeAgo(a.submittedAt).toLowerCase()}` : undefined;
      tone = "text-orange-700";
      break;
    case "Changes Requested":
      main = `Changes requested by ${a?.decidedBy ?? hod}`;
      sub = decidedOn;
      tone = "text-orange-700";
      break;
    case "Prequalified":
    case "Lead in D365":
      main = `Approved by ${a?.decidedBy ?? hod}`;
      sub = [decidedOn, t.lead ? `Lead ${t.lead.leadId} in D365` : undefined].filter(Boolean).join(" · ");
      break;
    default:
      main = a?.decidedBy ? `Rejected by ${a.decidedBy}` : "Rejected";
      sub = decidedOn;
  }
  return { main, sub, tone };
}

function Decision({ tender }: { tender: Tender }) {
  const { main, sub, tone } = decisionOf(tender);
  return (
    <>
      <div className={cn("text-sm", tone)}>{main}</div>
      {sub && <div className="text-xs text-muted-foreground">{boldD365(sub)}</div>}
    </>
  );
}

function exportCsv(tenders: Tender[]) {
  const header = ["Tender ID", "Title", "Buyer", "Service", "Emirate", "Value (AED)", "Value disclosed", "Due date", "AI pre-qualification", "Status", "Decision", "Decision detail"];
  const rows = tenders.map((t) => {
    const d = decisionOf(t);
    return [
      t.id, t.title, t.buyer, t.category, t.emirate, t.valueAED, t.valueDisclosed === false ? "No (AI estimate)" : "Yes",
      t.deadline.slice(0, 10), aiPrequalified(t) ? "Yes" : "No", prospectStatus(t.status), d.main, d.sub ?? "",
    ];
  });
  downloadCsv("agfs-prospects-pipeline.csv", header, rows, "Pipeline exported");
}
