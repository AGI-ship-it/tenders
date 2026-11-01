"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";
export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

/** Click the active column to flip it; a new column starts in its natural direction. */
export function nextSort<K extends string>(s: SortState<K>, key: K, ascByDefault: readonly K[]): SortState<K> {
  if (s.key === key) return { key, dir: s.dir === "asc" ? "desc" : "asc" };
  return { key, dir: ascByDefault.includes(key) ? "asc" : "desc" };
}

/** Apply a direction to a comparison of two values. */
export function compareBy<T>(dir: SortDir, value: (t: T) => number | string) {
  return (a: T, b: T) => {
    const av = value(a);
    const bv = value(b);
    const c = av < bv ? -1 : av > bv ? 1 : 0;
    return dir === "asc" ? c : -c;
  };
}

/** A sortable table heading, shared by the Pipeline and the Approval Center register. */
export function SortTh<K extends string>({
  children,
  sortKey,
  sort,
  onSort,
  className,
}: {
  children: React.ReactNode;
  sortKey: K;
  sort: SortState<K>;
  onSort: (k: K) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={cn("px-3 py-3 font-medium", className)} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
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
