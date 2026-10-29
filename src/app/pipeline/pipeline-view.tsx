"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from "lucide-react";
import { useDemo } from "@/lib/store";
import { fitScore, isActive, priorityScore, recommendation } from "@/lib/scoring";
import { daysUntil, formatDate, formatValue } from "@/lib/format";
import type { Tender } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, RecommendationBadge, ScoreBar, StatusBadge } from "@/components/shared";

type SortKey = "priority" | "id" | "value" | "deadline" | "fit";

const ALL = "All";

export function PipelineView({ embedded = false }: { embedded?: boolean }) {
  const demo = useDemo()!;
  const router = useRouter();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState(ALL);
  const [emirate, setEmirate] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "priority", dir: "desc" });

  const options = useMemo(() => {
    const uniq = (f: (t: Tender) => string) => [ALL, ...Array.from(new Set(demo.tenders.map(f))).sort()];
    return { category: uniq((t) => t.category), emirate: uniq((t) => t.emirate), status: uniq((t) => t.status) };
  }, [demo.tenders]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const value = (t: Tender): number | string => {
      switch (sort.key) {
        case "priority":
          return priorityScore(t);
        case "fit":
          return fitScore(t);
        case "value":
          return t.valueAED;
        case "deadline":
          return t.deadline;
        case "id":
          return t.id;
      }
    };
    return demo.tenders
      .filter(
        (t) =>
          (category === ALL || t.category === category) &&
          (emirate === ALL || t.emirate === emirate) &&
          (status === ALL || t.status === status) &&
          (!needle || `${t.id} ${t.title} ${t.buyer}`.toLowerCase().includes(needle)),
      )
      .sort((a, b) => {
        // In priority order, open opportunities always rank above decided ones.
        if (sort.key === "priority" && isActive(a) !== isActive(b)) return isActive(a) ? -1 : 1;
        const av = value(a);
        const bv = value(b);
        const c = av < bv ? -1 : av > bv ? 1 : 0;
        return sort.dir === "asc" ? c : -c;
      });
  }, [demo.tenders, q, category, emirate, status, sort]);

  const filtered = q || category !== ALL || emirate !== ALL || status !== ALL;

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "deadline" || key === "id" ? "asc" : "desc" }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={embedded ? undefined : "Opportunities Pipeline"}
        description={embedded ? undefined : "Every opportunity the agent found, ranked by fit, win likelihood and size. Click a row to see the AI reasoning."}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="bg-card pl-8" placeholder="Search opportunity ID, title or buyer" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Filter label="Service" value={category} onChange={setCategory} options={options.category} />
        <Filter label="Emirate" value={emirate} onChange={setEmirate} options={options.emirate} />
        <Filter label="Status" value={status} onChange={setStatus} options={options.status} />
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setCategory(ALL);
              setEmirate(ALL);
              setStatus(ALL);
            }}
          >
            <X /> Clear
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} of {demo.tenders.length} opportunities
        </span>
      </div>

      <div className="overflow-hidden rounded-xl shadow-soft bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <Th sortKey="priority" sort={sort} onSort={toggleSort} className="pl-5">
                  Opportunity
                </Th>
                <Th sortKey="value" sort={sort} onSort={toggleSort} className="text-right">
                  Value
                </Th>
                <Th sortKey="deadline" sort={sort} onSort={toggleSort}>
                  Due date
                </Th>
                <Th sortKey="fit" sort={sort} onSort={toggleSort}>
                  AI fit
                </Th>
                <th className="px-3 py-3 font-medium">Recommendation</th>
                <th className="px-3 py-3 pr-5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((t) => {
                const days = daysUntil(t.deadline);
                return (
                  <tr
                    key={t.id}
                    onClick={() => router.push(`/opportunity?id=${encodeURIComponent(t.id)}`)}
                    className={cn(
                      "group cursor-pointer transition-colors hover:bg-secondary/50",
                      t.fromLatestScan && "bg-sky-50/40",
                    )}
                  >
                    <td className="max-w-[420px] py-3 pr-3 pl-5">
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
                      <ScoreBar score={fitScore(t)} />
                    </td>
                    <td className="px-3 py-3">
                      <RecommendationBadge rec={recommendation(t)} />
                    </td>
                    <td className="px-3 py-3 pr-5">
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-sm text-muted-foreground">
                    No opportunities match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({
  children,
  sortKey,
  sort,
  onSort,
  className,
}: {
  children: React.ReactNode;
  sortKey: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={cn("px-3 py-3 font-medium", className)}>
      <button
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 rounded transition-colors hover:text-foreground",
          active && "text-foreground",
          className?.includes("text-right") && "flex-row-reverse",
        )}
      >
        {children}
        <Icon className={cn("size-3", !active && "opacity-40")} />
      </button>
    </th>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as string)}>
      <SelectTrigger className={cn("min-w-36 bg-card", value !== ALL && "border-primary/40 text-primary")}>
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
