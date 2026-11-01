"use client";

import { useCallback, useState } from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Check, ChevronLeft, ChevronRight, ListFilter, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** One filterable field of a table, e.g. Status with its options. */
export interface Facet {
  key: string;
  label: string;
  options: string[];
}

/** Selected options per facet; an empty or missing list means no filter. */
export type FilterValues = Record<string, string[]>;
/** Per facet: keep rows matching the selection ("is") or exclude them ("not"). */
export type FilterOp = "is" | "not";

export function useTableFilters() {
  const [values, setValues] = useState<FilterValues>({});
  const [ops, setOps] = useState<Record<string, FilterOp>>({});
  const toggle = (key: string, option: string) =>
    setValues((v) => {
      const cur = v[key] ?? [];
      return { ...v, [key]: cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option] };
    });
  const remove = (key: string, option: string) => setValues((v) => ({ ...v, [key]: (v[key] ?? []).filter((o) => o !== option) }));
  /** Drop a whole condition, e.g. every Service value. */
  const removeFacet = (key: string) => {
    setValues((v) => ({ ...v, [key]: [] }));
    setOps((o) => ({ ...o, [key]: "is" }));
  };
  const setOp = (key: string, op: FilterOp) => setOps((o) => ({ ...o, [key]: op }));
  const clear = () => {
    setValues({});
    setOps({});
  };
  /** Whether a row's value passes the condition for this facet. */
  const matches = useCallback(
    (key: string, value: string) => {
      const sel = values[key];
      if (!sel?.length) return true;
      return (ops[key] ?? "is") === "is" ? sel.includes(value) : !sel.includes(value);
    },
    [values, ops],
  );
  const count = Object.values(values).reduce((n, l) => n + l.length, 0);
  return { values, ops, toggle, remove, removeFacet, setOp, clear, matches, count, key: JSON.stringify([values, ops]) };
}

/** The heading row of a table card: title and count on the left, search, filters and actions on the right. */
export function TableHeader({
  title,
  count,
  search,
  onSearch,
  searchPlaceholder = "Search ID, title or buyer",
  children,
}: {
  title: string;
  count: number;
  search: string;
  onSearch: (q: string) => void;
  searchPlaceholder?: string;
  /** Filter menu and actions, shown at the right. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-5">
      <h2 className="text-sm font-bold text-primary">{title}</h2>
      <span className="tabular rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{count}</span>
      <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-10 bg-card pr-8 pl-8" placeholder={searchPlaceholder} value={search} onChange={(e) => onSearch(e.target.value)} />
          {search && (
            <button
              aria-label="Clear search"
              onClick={() => onSearch("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * "Filter" button. The menu lists the fields; choosing one replaces the list
 * with that field's options as checkboxes, with Back to return.
 */
export function FilterMenu({
  facets,
  filters,
}: {
  facets: Facet[];
  filters: ReturnType<typeof useTableFilters>;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const facet = facets.find((f) => f.key === openKey);
  const selected = facet ? (filters.values[facet.key] ?? []) : [];
  return (
    <DropdownMenu onOpenChange={(open) => !open && setOpenKey(null)}>
      <DropdownMenuTrigger render={<Button variant="secondary" size="lg" />}>
        Filter
        {filters.count > 0 && (
          <span className="tabular grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {filters.count}
          </span>
        )}
        <ListFilter />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-xl p-1.5">
        {facet ? (
          <>
            <DropdownMenuItem closeOnClick={false} onClick={() => setOpenKey(null)} className={cn(ITEM, "text-muted-foreground")}>
              <ChevronLeft /> Back
            </DropdownMenuItem>
            <DropdownMenuSeparator className="-mx-1.5 my-1.5" />
            <div className="flex items-center justify-between px-2.5 pt-1 pb-1.5">
              <span className={MENU_LABEL}>{facet.label}</span>
              {selected.length > 0 && (
                <button
                  onClick={() => selected.forEach((o) => filters.remove(facet.key, o))}
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-0.5">
              {facet.options.map((o) => (
                <CheckboxOption key={o} checked={selected.includes(o)} onToggle={() => filters.toggle(facet.key, o)}>
                  {o}
                </CheckboxOption>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className={cn(MENU_LABEL, "px-2.5 pt-1 pb-1.5")}>Filter by</div>
            <div className="space-y-0.5">
              {facets.map((f) => {
                const n = filters.values[f.key]?.length ?? 0;
                return (
                  <DropdownMenuItem key={f.key} closeOnClick={false} onClick={() => setOpenKey(f.key)} className={ITEM}>
                    {f.label}
                    <span className="ml-auto flex items-center gap-1.5">
                      {n > 0 && (
                        <span className="tabular grid h-5 min-w-5 place-items-center rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold text-primary">
                          {n}
                        </span>
                      )}
                      <ChevronRight className="text-muted-foreground" />
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </div>
            {filters.count > 0 && (
              <>
                <DropdownMenuSeparator className="-mx-1.5 my-1.5" />
                <DropdownMenuItem onClick={filters.clear} className={cn(ITEM, "text-muted-foreground")}>
                  <X /> Clear all filters
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Shared spacing for rows in the filter menu. */
const ITEM = "gap-2.5 rounded-lg px-2.5 py-2 text-sm";
const MENU_LABEL = "text-[11px] font-semibold tracking-wide text-muted-foreground uppercase";

/** A menu option with a visible checkbox on the left; the menu stays open when toggled. */
function CheckboxOption({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <MenuPrimitive.CheckboxItem
      checked={checked}
      onCheckedChange={onToggle}
      closeOnClick={false}
      className={cn(ITEM, "flex cursor-default items-center outline-hidden select-none focus:bg-accent focus:text-accent-foreground")}
    >
      <span
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card",
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

/**
 * Applied filters as conditions, like Linear: one chip per field reading
 * "Service | is any of | Cleaning & Hygiene +1 | ×". The operator and the values are each editable in place.
 */
export function FilterChips({ facets, filters }: { facets: Facet[]; filters: ReturnType<typeof useTableFilters> }) {
  if (!filters.count) return null;
  const active = facets.filter((f) => filters.values[f.key]?.length);
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2.5 sm:px-5">
      {active.map((f) => (
        <FilterCondition key={f.key} facet={f} filters={filters} />
      ))}
      <button onClick={filters.clear} className="ml-1 text-xs font-medium text-muted-foreground hover:text-primary">
        Clear all
      </button>
    </div>
  );
}

const SEGMENT = "flex h-full items-center px-2.5 transition-colors hover:bg-primary/10 aria-expanded:bg-primary/10";

function FilterCondition({ facet: f, filters }: { facet: Facet; filters: ReturnType<typeof useTableFilters> }) {
  const selected = filters.values[f.key] ?? [];
  const op = filters.ops[f.key] ?? "is";
  const many = selected.length > 1;
  const opLabel = (o: FilterOp) => (o === "is" ? (many ? "is any of" : "is") : many ? "is none of" : "is not");
  return (
    <div className="inline-flex h-8 items-stretch divide-x divide-primary/15 overflow-hidden rounded-full bg-secondary text-xs">
      <span className="flex items-center pr-2.5 pl-3.5 font-semibold text-foreground">{f.label}</span>

      <DropdownMenu>
        <DropdownMenuTrigger render={<button className={cn(SEGMENT, "text-muted-foreground")} aria-label={`${f.label} condition`} />}>
          {opLabel(op)}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40 rounded-xl p-1.5">
          {(["is", "not"] as const).map((o) => (
            <DropdownMenuItem key={o} className={cn(ITEM, o === op && "font-semibold text-primary")} onClick={() => filters.setOp(f.key, o)}>
              {opLabel(o)}
              {o === op && <Check className="ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger render={<button className={cn(SEGMENT, "gap-1 font-semibold text-primary")} aria-label={`${f.label} values`} />}>
          <span className="max-w-48 truncate">{selected[0]}</span>
          {many && <span className="tabular font-medium text-muted-foreground">+{selected.length - 1}</span>}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60 rounded-xl p-1.5">
          <div className={cn(MENU_LABEL, "px-2.5 pt-1 pb-1.5")}>{f.label}</div>
          <div className="space-y-0.5">
            {f.options.map((o) => (
              <CheckboxOption key={o} checked={selected.includes(o)} onToggle={() => filters.toggle(f.key, o)}>
                {o}
              </CheckboxOption>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        aria-label={`Remove ${f.label} filter`}
        title="Remove filter"
        onClick={() => filters.removeFacet(f.key)}
        className="grid w-9 place-items-center pr-0.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
