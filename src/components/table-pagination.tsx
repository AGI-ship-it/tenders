"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const PAGE_SIZE = 10;

/**
 * Slice a list into pages. `resetKey` should change whenever filters or sort
 * change, so the table jumps back to page 1.
 */
export function usePagination<T>(items: T[], resetKey: string, pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [seenKey, setSeenKey] = useState(resetKey);
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setPage(1);
  }
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  return {
    page: current,
    pageCount,
    setPage,
    pageItems: items.slice(start, start + pageSize),
    from: items.length ? start + 1 : 0,
    to: Math.min(start + pageSize, items.length),
    total: items.length,
  };
}

/** Footer for a table card: the range on the left, page controls on the right. */
export function TablePagination({
  page,
  pageCount,
  setPage,
  from,
  to,
  total,
  overall,
}: {
  page: number;
  pageCount: number;
  setPage: (p: number) => void;
  from: number;
  to: number;
  total: number;
  /** Total before filters; shown when filters hide some rows. */
  overall: number;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-t px-4 py-2.5 sm:px-5 text-xs text-muted-foreground">
      <span className="tabular">
        {total ? `${from}–${to} of ${total} prospects` : "0 prospects"}
        {total !== overall && ` · filtered from ${overall}`}
      </span>
      {pageCount > 1 && (
        <nav className="ml-auto flex items-center gap-1" aria-label="Pagination">
          <PageButton label="Previous page" disabled={page === 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="size-4" />
          </PageButton>
          {pages(page, pageCount).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1">
                …
              </span>
            ) : (
              <PageButton key={p} label={`Page ${p}`} active={p === page} onClick={() => setPage(p)}>
                {p}
              </PageButton>
            ),
          )}
          <PageButton label="Next page" disabled={page === pageCount} onClick={() => setPage(page + 1)}>
            <ChevronRight className="size-4" />
          </PageButton>
        </nav>
      )}
    </div>
  );
}

function PageButton({
  children,
  label,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "tabular grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-xs transition-colors",
        active ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-muted hover:text-foreground",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {children}
    </button>
  );
}

/** Page numbers with gaps, e.g. 1 … 4 5 6 … 12. */
function pages(page: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const set = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}
