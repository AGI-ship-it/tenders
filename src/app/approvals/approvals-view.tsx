"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { ArrowUpRight, Download, Inbox, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { addComment, useDemo } from "@/lib/store";
import { fitScore, recommendation } from "@/lib/scoring";
import { formatValue, formatDateTime, timeAgo } from "@/lib/format";
import type { Tender } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DecisionPanel } from "@/components/decision-panel";
import { PageHeader, RecommendationBadge, StatusBadge } from "@/components/shared";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SERVICE_LINES, serviceLineFor } from "@/lib/mock-data";

type View = "hod" | "decided";

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
  const linkedView: View | null = linked === "decided" ? "decided" : linked ? "hod" : null;
  const [view, setView] = useState<View>(linkedView ?? "hod");
  const router = useRouter();
  const pathname = usePathname();
  // Mirror tab and open panel in the URL so returning from an opportunity restores them.
  function syncUrl(v: View, id: string | null) {
    const q = new URLSearchParams();
    if (v !== "hod") q.set("view", v);
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

  const routed = demo.tenders.filter((t) => t.approval);
  const decided = demo.tenders.filter((t) => ["Prequalified", "Lead in D365", "No-bid", "Not qualified"].includes(t.status));
  const notSubmitted = demo.tenders.filter((t) => ["New", "Under Review"].includes(t.status)).length;
  const awaiting = routed.filter((t) => t.status === "Awaiting HoD").length;
  const selected = demo.tenders.find((t) => t.id === selectedId);

  const tabs: { key: View; label: string; count?: number; alert?: boolean }[] = [
    { key: "hod", label: "By HoD", count: awaiting, alert: awaiting > 0 },
    { key: "decided", label: "Decision register", count: decided.length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={embedded ? undefined : "Opportunities for Prequalification"}
        description={embedded ? undefined : "Each opportunity is routed to the HoD of its service line. Prequalified opportunities are pushed to D365 as leads."}
      />

      <div className="flex items-center gap-1 border-b">
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
            {notSubmitted} opportunities not yet submitted →
          </Link>
        )}
      </div>

      {view === "decided" ? (
        decided.length ? <DecisionRegister tenders={decided} /> : <EmptyState />
      ) : (
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
                    <div className="truncate text-xs text-muted-foreground">HoD · {line.name}</div>
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
                        onClick={() => {
                          setSelectedId(t.id);
                          syncUrl("hod", t.id);
                        }}
                        className={cn(
                          "w-full rounded-xl bg-muted/40 p-3 text-left transition-all hover:bg-card hover:shadow-soft-lg",
                          t.status === "Awaiting HoD" && "bg-amber-50/70 ring-1 ring-amber-200 ring-inset",
                          selectedId === t.id && "ring-2 ring-primary/30",
                        )}
                      >
                        <div className="line-clamp-2 text-sm font-medium">{t.title}</div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="tabular text-xs text-muted-foreground">{formatValue(t)}</span>
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
          <SheetTitle className="sr-only">{selected?.title ?? "Opportunity"}</SheetTitle>
          {selected && <ReviewPanel tender={selected} />}
        </SheetContent>
      </Sheet>
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

      <div className="grid grid-cols-3 gap-3">
        <Mini label="AI fit" value={`${fitScore(tender)}/100`} />
        <Mini label="Win probability" value={`${tender.winProbability}%`} hint="Indicative" />
        <Mini label="Margin band" value={tender.marginBand} hint="Not verified" />
      </div>

      <div className="flex items-start gap-3 rounded-lg bg-secondary/60 p-3.5">
        <RecommendationBadge rec={recommendation(tender)} className="mt-0.5" />
        <p className="text-sm text-foreground/80">{tender.aiNarrative}</p>
      </div>

      <Button variant="link" className="h-auto px-0" nativeButton={false} render={<Link href={`/opportunity?id=${encodeURIComponent(tender.id)}&from=approvals`} />}>
        Open full opportunity and AI reasoning <ArrowUpRight />
      </Button>

      <div className="rounded-xl bg-muted/30 p-4">
        <h3 className="mb-3 text-sm font-semibold">HoD decision</h3>
        <DecisionPanel tender={tender} />
      </div>

      <Comments tender={tender} />
    </div>
  );
}

function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground">
        {label}
        {hint && <span className="ml-1 text-amber-700">· {hint}</span>}
      </div>
      <div className="tabular mt-0.5 text-sm font-semibold">{value}</div>
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

/** Collapses the AI's four-way recommendation and the final outcome to bid / no-bid for comparison. */
function finalOutcome(t: Tender): "Bid" | "No-bid" {
  return t.status === "Prequalified" || t.status === "Lead in D365" ? "Bid" : "No-bid";
}

function aiOutcome(t: Tender): "Bid" | "No-bid" {
  const r = recommendation(t);
  return r === "Bid" || r === "Bid with conditions" ? "Bid" : "No-bid";
}

function exportCsv(tenders: Tender[]) {
  const header = [
    "Tender ID", "Title", "Buyer", "Value (AED)", "AI fit", "AI recommendation", "Proposed",
    "Final decision", "Decided by", "Decided at", "Rationale", "Submitted by", "Submission note",
  ];
  const rows = tenders.map((t) => [
    t.id, t.title, t.buyer, t.valueAED, fitScore(t), recommendation(t), t.approval?.proposed ?? "",
    t.status, t.approval?.decidedBy ?? "", t.approval?.decidedAt ?? "", t.approval?.decisionComment ?? "",
    t.approval?.submittedBy ?? "", t.approval?.note ?? "",
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "agfs-bid-decision-register.csv";
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Decision register exported", { description: `${tenders.length} decisions · CSV` });
}

function DecisionRegister({ tenders }: { tenders: Tender[] }) {
  const sorted = [...tenders].sort((a, b) => (b.approval?.decidedAt ?? "").localeCompare(a.approval?.decidedAt ?? ""));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Every HoD prequalification decision, with who decided and why. Outcomes also feed the win model.
        </p>
        <Button variant="outline" onClick={() => exportCsv(sorted)}>
          <Download /> Export CSV
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl shadow-soft bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Tender</th>
              <th className="px-3 py-3 font-medium">AI said</th>
              <th className="px-3 py-3 font-medium">Decision</th>
              <th className="px-3 py-3 font-medium">HoD</th>
              <th className="px-3 py-3 pr-5 font-medium">Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((t) => {
              const agrees = aiOutcome(t) === finalOutcome(t);
              return (
                <tr key={t.id} className="align-top hover:bg-muted/30">
                  <td className="max-w-[300px] px-5 py-3">
                    <Link href={`/opportunity?id=${encodeURIComponent(t.id)}&from=approvals`} className="group">
                      <div className="font-mono text-xs text-muted-foreground">{t.id}</div>
                      <div className="truncate font-medium group-hover:text-primary">{t.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatValue(t)} · fit {fitScore(t)}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <RecommendationBadge rec={recommendation(t)} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={t.status} />
                    <div className={cn("mt-1.5 text-[11px] font-medium", agrees ? "text-muted-foreground" : "text-magenta")}>
                      {agrees ? "Matches AI" : "Overrides AI"}
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {t.approval?.decidedBy}
                    <div className="text-xs text-muted-foreground">
                      {t.approval?.decidedAt && formatDateTime(t.approval.decidedAt)}
                    </div>
                  </td>
                  <td className="max-w-sm px-3 py-3 pr-5 text-xs text-muted-foreground">
                    {t.approval?.decisionComment || "No comment"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card py-16 text-center">
      <Inbox className="size-8 text-muted-foreground/60" />
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">No HoD decisions yet.</p>
    </div>
  );
}
