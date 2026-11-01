"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { ArrowUpRight, Download, Inbox, MessageSquare, Search, Send, X } from "lucide-react";
import { toast } from "sonner";
import { addComment, useDemo } from "@/lib/store";
import { PROSPECT_STATUSES, aiPrequalified, prospectStatus } from "@/lib/scoring";
import { daysUntil, formatDate, formatValue, timeAgo } from "@/lib/format";
import type { Tender } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ALL, FilterSelect } from "@/components/filter-select";
import { DecisionPanel } from "@/components/decision-panel";
import { PageHeader, PrequalBadge, StatusBadge } from "@/components/shared";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SERVICE_LINES, serviceLineFor } from "@/lib/mock-data";

type View = "register" | "hod";

const PENDING: Tender["status"][] = ["Awaiting HoD", "Changes Requested"];

const STATUS_ORDER: Tender["status"][] = [
  "Awaiting HoD",
  "Changes Requested",
  "Prequalified",
  "Lead in D365",
  "No-bid",
  "Not qualified",
];

export function ApprovalsView({ embedded = false }: { embedded?: boolean }) {
  const demo = useDemo()!;
  // Deep link from "Submit for prequalification": /approvals?view=hod&id=TND-...
  const params = useSearchParams();
  const linked = params.get("view");
  const linkedView: View | null = linked === "hod" ? "hod" : linked === "register" ? "register" : null;
  const [view, setView] = useState<View>(linkedView ?? "register");
  const router = useRouter();
  const pathname = usePathname();
  // Mirror tab and open panel in the URL so returning from a prospect restores them.
  function syncUrl(v: View, id: string | null) {
    const q = new URLSearchParams();
    if (v !== "register") q.set("view", v);
    if (id) q.set("id", id);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  const [selectedId, setSelectedId] = useState<string | null>(params.get("id"));
  // Follow new deep links even when this page is already open.
  const linkKey = params.toString();
  const [seenLink, setSeenLink] = useState(linkKey);
  if (seenLink !== linkKey) {
    setSeenLink(linkKey);
    if (linkedView) setView(linkedView);
    setSelectedId(params.get("id"));
  }

  const isHod = demo.role === "approver";
  const myLine = SERVICE_LINES.find((l) => l.id === demo.hodLine) ?? SERVICE_LINES[0];
  const routed = demo.tenders.filter((t) => t.approval);
  const mine = routed.filter((t) => myLine.categories.includes(t.category));
  const notSubmitted = demo.tenders.filter((t) => ["New", "Under Review"].includes(t.status)).length;
  const awaiting = routed.filter((t) => t.status === "Awaiting HoD").length;
  const myAwaiting = mine.filter((t) => t.status === "Awaiting HoD").length;
  const selected = demo.tenders.find((t) => t.id === selectedId);

  function open(id: string) {
    setSelectedId(id);
    syncUrl(view, id);
  }

  const tabs: { key: View; label: string; count?: number; alert?: boolean }[] = [
    { key: "register", label: "Register", count: routed.length },
    { key: "hod", label: "By HoD", count: awaiting, alert: awaiting > 0 },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <PageHeader
        title={embedded ? undefined : "Prospects for Prequalification"}
        description={embedded ? undefined : "Each prospect is routed to the HoD of its service line. Prequalified prospects are pushed to D365 as leads."}
      />

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
          {mine.length ? (
            <Register tenders={mine} onOpen={open} selectedId={selectedId} showHod={false} />
          ) : (
            <EmptyState text="Nothing has been routed to you yet." />
          )}
        </>
      ) : (
        <>
          <div className="flex shrink-0 items-center gap-1 border-b">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setView(t.key);
                  setSelectedId(null);
                  syncUrl(t.key, null);
                }}
                className={cn(
                  "relative -mb-px flex items-center gap-2 px-3 pb-2.5 text-sm transition-colors",
                  view === t.key ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {t.count !== undefined && (
                  <span
                    className={cn(
                      "tabular rounded-full px-1.5 text-[11px] font-semibold",
                      t.alert ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {t.count}
                  </span>
                )}
                {view === t.key && (
                  <motion.span layoutId="approval-tab" className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
            {notSubmitted > 0 && (
              <Link href="/pipeline" className="ml-auto pb-2.5 text-xs text-muted-foreground hover:text-primary">
                {notSubmitted} prospects not yet submitted →
              </Link>
            )}
          </div>

          {view === "register" ? (
            routed.length ? (
              <Register tenders={routed} onOpen={open} selectedId={selectedId} showHod />
            ) : (
              <EmptyState text="No prospects have been routed to an HoD yet." />
            )
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto pb-1">
              <HodBoard routed={routed} onOpen={open} selectedId={selectedId} />
            </div>
          )}
        </>
      )}

      <Sheet
        open={!!selected}
        onOpenChange={(o) => {
          if (o) return;
          setSelectedId(null);
          syncUrl(view, null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl data-[side=right]:sm:max-w-xl">
          <SheetTitle className="sr-only">{selected?.title ?? "Prospect"}</SheetTitle>
          {selected && <ReviewPanel tender={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** One column per service line and its HoD, with the status of each routed prospect. */
function HodBoard({ routed, onOpen, selectedId }: { routed: Tender[]; onOpen: (id: string) => void; selectedId: string | null }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {SERVICE_LINES.map((line) => {
        const items = routed
          .filter((t) => line.categories.includes(t.category))
          .sort((x, y) => STATUS_ORDER.indexOf(x.status) - STATUS_ORDER.indexOf(y.status));
        const waiting = items.filter((t) => t.status === "Awaiting HoD").length;
        return (
          <section key={line.id} className="flex flex-col rounded-2xl bg-card p-3 shadow-soft">
            <header className="flex items-center gap-2.5 px-1 pb-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-pink-100 text-xs font-semibold text-pink-800">
                {line.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{line.hod}</div>
                <div className="truncate text-xs text-muted-foreground">Owner · HoD, {line.name}</div>
              </div>
              {waiting > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  {waiting} waiting
                </span>
              )}
            </header>
            <ul className="flex-1 space-y-2">
              {items.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => onOpen(t.id)}
                    className={cn(
                      "w-full rounded-xl bg-muted/40 p-3 text-left transition-all hover:bg-card hover:shadow-soft-lg",
                      t.status === "Awaiting HoD" && "bg-amber-50/70 ring-1 ring-amber-200 ring-inset",
                      selectedId === t.id && "ring-2 ring-primary/30",
                    )}
                  >
                    <div className="line-clamp-2 text-sm font-medium">{t.title}</div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="tabular flex items-center gap-1.5 text-xs text-muted-foreground">
                        {formatValue(t)} · AI <PrequalBadge yes={aiPrequalified(t)} className="px-2 py-0 text-[11px]" />
                      </span>
                      <StatusBadge status={t.status} />
                    </div>
                  </button>
                </li>
              ))}
              {items.length === 0 && (
                <li className="rounded-xl border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  Nothing routed yet
                </li>
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ReviewPanel({ tender }: { tender: Tender }) {
  const line = serviceLineFor(tender.category);
  return (
    <div className="space-y-5 p-6">
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

      <Button variant="link" className="h-auto px-0" nativeButton={false} render={<Link href={`/opportunity?id=${encodeURIComponent(tender.id)}&from=approvals`} />}>
        Open full prospect and AI reasoning <ArrowUpRight />
      </Button>

      <div className="rounded-xl bg-muted/30 p-4">
        <h3 className="mb-3 text-sm font-semibold">HoD decision</h3>
        <DecisionPanel tender={tender} />
      </div>

      <Comments tender={tender} />
    </div>
  );
}

function Comments({ tender }: { tender: Tender }) {
  const [text, setText] = useState("");
  return (
    <div className="space-y-3 border-t pt-5">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
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
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "agfs-prequalification-register.csv";
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Register exported", { description: `${tenders.length} prospects · CSV` });
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
  showHod,
}: {
  tenders: Tender[];
  onOpen: (id: string) => void;
  selectedId: string | null;
  showHod: boolean;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(ALL);
  const [hod, setHod] = useState(ALL);
  const [ai, setAi] = useState(ALL);

  const needle = q.trim().toLowerCase();
  const sorted = tenders
    .filter(
      (t) =>
        (status === ALL || prospectStatus(t.status) === status) &&
        (hod === ALL || serviceLineFor(t.category).hod === hod) &&
        (ai === ALL || (ai === "Yes") === aiPrequalified(t)) &&
        (!needle || `${t.id} ${t.title} ${t.buyer}`.toLowerCase().includes(needle)),
    )
    .sort(registerOrder);
  const filtered = Boolean(needle) || status !== ALL || hod !== ALL || ai !== ALL;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {!showHod && (
        <p className="shrink-0 text-sm text-muted-foreground">
          Prospects routed to your service line. Open one to prequalify or reject it.
        </p>
      )}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="bg-card pl-8" placeholder="Search ID, title or buyer" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <FilterSelect label="Status" value={status} onChange={setStatus} options={[ALL, ...PROSPECT_STATUSES]} />
        {showHod && (
          <FilterSelect label="HoD" value={hod} onChange={setHod} options={[ALL, ...SERVICE_LINES.map((l) => l.hod)]} />
        )}
        <FilterSelect label="AI pre-qual" value={ai} onChange={setAi} options={[ALL, "Yes", "No"]} />
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setStatus(ALL);
              setHod(ALL);
              setAi(ALL);
            }}
          >
            <X /> Clear
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {sorted.length} of {tenders.length} prospects
        </span>
        <Button variant="outline" onClick={() => exportCsv(sorted)} disabled={!sorted.length}>
          <Download /> Export CSV
        </Button>
      </div>

      {/* The table fills the rest of the window and scrolls inside, with its headings pinned. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card shadow-soft">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b bg-zinc-50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Prospect</th>
                <th className="px-3 py-3 font-medium">Due date</th>
                <th className="px-3 py-3 font-medium">AI pre-qual</th>
                {showHod && <th className="px-3 py-3 font-medium">HoD</th>}
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 pr-5 font-medium">D365 lead</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((t) => {
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
                    )}
                  >
                    <td className="max-w-[320px] px-5 py-3">
                      <div className="font-mono text-xs text-muted-foreground">{t.id}</div>
                      <div className="truncate font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.buyer} · {formatValue(t)}
                      </div>
                    </td>
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
                          t.status === "Changes Requested" ? (
                            "Changes requested"
                          ) : (
                            t.approval && `Submitted ${timeAgo(t.approval.submittedAt)}`
                          )
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
                      ) : t.status === "Prequalified" ? (
                        <span className="text-xs text-muted-foreground">Ready to push</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={showHod ? 6 : 5} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No prospects match these filters.
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card py-16 text-center">
      <Inbox className="size-8 text-muted-foreground/60" />
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
