"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import {
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  CircleDashed,
  CircleHelp,
  FileText,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { markUnderReview, useDemo } from "@/lib/store";
import { aiPrequalified, criterionStatus, fitBreakdown } from "@/lib/scoring";
import { daysUntil, formatAED, formatDate, timeAgo } from "@/lib/format";
import type { CheckStatus, Tender } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DecisionPanel } from "@/components/decision-panel";
import { PortalLinkButton } from "@/components/portal-link";
import { PrequalBadge } from "@/components/shared";

/** Where "back" returns to, keyed by the ?from= the opening link passed. */
const BACK: Record<string, { href: string; label: string }> = {
  pipeline: { href: "/pipeline", label: "Prospects" },
  approvals: { href: "/approvals", label: "Approval Center" },
  sources: { href: "/sources", label: "Scan Portal" },
};

export function TenderDetail() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? "";
  const from = params.get("from");

  // Return to the exact place we came from (same tab, same open panel); fall back to that screen if this page was
  // opened directly.
  function goBack() {
    if (from && window.history.length > 1) router.back();
    else router.push(back.href);
  }
  const demo = useDemo()!;
  // An HoD has no Prospects screen, so their default way back is Approvals.
  const back = BACK[from ?? ""] ?? (demo.role === "approver" ? BACK.approvals : BACK.pipeline);
  const tender = demo.tenders.find((t) => t.id === id);
  const source = demo.sources.find((s) => s.id === tender?.sourceId);

  useEffect(() => {
    if (tender?.status === "New" && demo.role === "analyst") markUnderReview(tender.id);
  }, [tender?.id, tender?.status, demo.role]);

  if (!tender) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">This tender isn’t in the pipeline. It may need an AI scan first.</p>
        <Button variant="outline" className="mt-4" nativeButton={false} render={<Link href="/pipeline" />}>
          Back to pipeline
        </Button>
      </div>
    );
  }

  const days = daysUntil(tender.deadline);
  const history = demo.audit.filter((e) => e.tenderId === tender.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex shrink-0 items-center justify-end gap-3">
        <button
          onClick={goBack}
          aria-label={`Close and return to ${back.label}`}
          title="Close"
          className="grid size-11 place-items-center text-foreground/70 transition-colors hover:text-primary"
        >
          <X className="size-6" />
        </button>
      </div>

      {/* One section: header, key facts, then the assessment beside the prequalification rail. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card shadow-soft sm:rounded-3xl">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4 px-4 pt-5 pb-4 sm:px-6 sm:pt-6 sm:pb-5">
        <div className="min-w-0 space-y-1">
          <nav aria-label="Breadcrumb" className="mb-2 min-w-0">
            <ol className="flex min-w-0 items-center gap-1.5 text-sm">
              <li className="shrink-0">
                <button onClick={goBack} className="font-medium text-muted-foreground transition-colors hover:text-primary hover:underline">
                  {back.label}
                </button>
              </li>
              <li aria-hidden className="shrink-0 text-muted-foreground/60">
                <ChevronRight className="size-4" />
              </li>
              <li aria-current="page" className="min-w-0 truncate font-semibold text-foreground">
                {tender.id}
              </li>
            </ol>
          </nav>
          <h1 className="max-w-3xl text-2xl font-semibold tracking-tight">{tender.title}</h1>
          <div className="text-sm text-muted-foreground">
            {tender.category} · {tender.buyer} · {tender.emirate}
          </div>
        </div>
        <PortalLinkButton tender={tender} source={source} />
      </div>

      {/* Key facts, as listed on the portal */}
      <dl className="grid shrink-0 grid-cols-2 gap-px border-y bg-border md:grid-cols-5">
        <Fact label="Tender ID" value={<span className="font-mono">{tender.sourceRef}</span>} sub={`AGFS ref ${tender.id}`} />
        <Fact label="Bidding opens" value={formatDate(tender.publishedAt)} sub={source?.name} />
        <Fact
          label="Due date"
          value={formatDate(tender.deadline)}
          sub={days > 0 ? `${days} days left` : "Closed"}
          tone={days <= 14 ? "text-orange-700" : undefined}
        />
        <Fact
          label="Estimated value"
          value={tender.valueDisclosed === false ? "Not disclosed" : formatAED(tender.valueAED, false)}
          sub={tender.valueDisclosed === false ? `AI estimate ~${formatAED(tender.valueAED)} from scope` : "Published by buyer"}
          tone={tender.valueDisclosed === false ? "text-magenta" : undefined}
        />
        <Fact label="Contract term" value={`${tender.durationMonths} months`} sub={tender.location.split(" (")[0]} />
      </dl>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_340px]">
        <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto">
          {/* AI pre-qualification: Yes / No and why */}
          <PrequalCard tender={tender} />

          {/* Details, progressively disclosed */}
          <Tabs defaultValue="summary" className="flex min-h-[260px] flex-1 flex-col">
            <TabsList variant="line" className="w-full shrink-0 justify-start gap-2 overflow-x-auto border-b px-3 group-data-horizontal/tabs:h-12 sm:gap-4 sm:px-5">
              <TabsTrigger className={LINE_TAB} value="summary">Summary</TabsTrigger>
              <TabsTrigger className={LINE_TAB} value="eligibility">
                Eligibility
                <CountDot items={tender.eligibility.filter((e) => e.status !== "met").length} />
              </TabsTrigger>
              <TabsTrigger className={LINE_TAB} value="risks">Risks & assumptions</TabsTrigger>
              <TabsTrigger className={LINE_TAB} value="evidence">Evidence</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <p className="text-sm leading-relaxed">{tender.summary}</p>
              <ul className="space-y-2">
                {tender.scope.map((s) => (
                  <li key={s} className="flex gap-2.5 text-sm text-muted-foreground">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
                    {s}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
                <FileText className="size-3.5" /> Sample RFP summary generated from fictional documents · {tender.location}
              </div>
            </TabsContent>

            <TabsContent value="eligibility" className="min-h-0 flex-1 overflow-y-auto p-2">
              <ul className="divide-y">
                {tender.eligibility.map((e) => (
                  <li key={e.requirement} className="flex gap-3 px-3 py-3">
                    <CheckIcon status={e.status} />
                    <div className="text-sm">
                      <div className="font-medium">{e.requirement}</div>
                      <div className="text-xs text-muted-foreground">{e.note}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </TabsContent>

            <TabsContent value="risks" className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-5 md:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Risks</h3>
                {tender.risks.map((r) => (
                  <div key={r.title} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{r.title}</span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-px text-[11px] font-medium",
                          r.severity === "High" && "bg-rose-50 text-rose-700",
                          r.severity === "Medium" && "bg-amber-50 text-amber-800",
                          r.severity === "Low" && "bg-zinc-100 text-zinc-600",
                        )}
                      >
                        {r.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{r.mitigation}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Commercial assumptions</h3>
                <ul className="space-y-2">
                  {tender.assumptions.map((a) => (
                    <li key={a} className="flex gap-2.5 text-sm">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
                      {a}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">To be validated by Estimation before pricing.</p>
              </div>
            </TabsContent>

            <TabsContent value="evidence" className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
              {tender.evidence.map((e) => (
                <figure key={e.label} className="rounded-lg border-l-2 border-primary/50 bg-muted/30 py-2.5 pr-3 pl-4">
                  <blockquote className="text-sm">“{e.excerpt}”</blockquote>
                  <figcaption className="mt-1 text-xs text-muted-foreground">
                    {e.label} · {e.location}
                  </figcaption>
                </figure>
              ))}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right rail */}
        <aside className="min-h-0 border-t bg-zinc-50/50 lg:border-t-0 lg:border-l">
          <div className="h-full overflow-y-auto p-4 sm:p-5">
            <h2 className="mb-4 text-sm font-bold text-primary">Prequalification</h2>
            <DecisionPanel tender={tender} />
            {history.length > 0 && (
              <div className="mt-6 border-t pt-4">
                <h3 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">History</h3>
                <ol className="space-y-3">
                  {history.slice(0, 5).map((e) => (
                    <li key={e.id} className="flex gap-2.5 text-xs">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary/60" />
                      <div>
                        <span className="font-medium">{e.actor}</span>{" "}
                        <span className="text-muted-foreground">{e.action.toLowerCase()}</span>
                        <div className="text-muted-foreground/80">{timeAgo(e.at)}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </aside>
      </div>
      </div>

    </div>
  );
}

function Fact({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="bg-card px-4 py-3.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-[15px] font-semibold">{value}</dd>
      {sub && <dd className={cn("mt-0.5 truncate text-xs text-muted-foreground", tone)}>{sub}</dd>}
    </div>
  );
}

/** Tabs sized to their labels, aligned left, with the magenta underline used on the step circles. */
const LINE_TAB =
  "flex-none px-1 data-active:font-semibold data-active:text-primary dark:data-active:text-primary after:rounded-full after:bg-magenta group-data-horizontal/tabs:after:h-[3px]";

function PrequalCard({ tender }: { tender: Tender }) {
  const yes = aiPrequalified(tender);
  return (
    <div className="shrink-0 border-b p-4 sm:p-6">
      <div className="flex gap-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">AI pre-qualification</span>
            <PrequalBadge yes={yes} />
            <Tooltip>
              <TooltipTrigger render={<button aria-label="About the AI pre-qualification" className="text-muted-foreground hover:text-foreground" />}>
                <CircleHelp className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                The AI checks the prospect against four AGFS criteria and recommends Yes or No. It does not decide
                whether to bid. The HoD validates it before anything goes to D365.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-sm leading-relaxed text-foreground/80">{tender.aiNarrative}</p>
        </div>
      </div>

      <h3 className="mt-4 mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Why {yes ? "Yes" : "No"}
      </h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {fitBreakdown(tender).map((c) => (
          <li key={c.key} className="flex gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5">
            <CheckIcon status={criterionStatus(c)} />
            <div className="min-w-0 text-sm">
              <div className="font-medium">{c.label}</div>
              <div className="text-xs text-muted-foreground">{c.rationale}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CheckIcon({ status }: { status: CheckStatus }) {
  const map = {
    met: <CheckCircle2 className="size-4.5 text-emerald-600" />,
    partial: <AlertTriangle className="size-4.5 text-amber-500" />,
    unmet: <XCircle className="size-4.5 text-rose-600" />,
    unknown: <CircleDashed className="size-4.5 text-muted-foreground" />,
  };
  return <span className="mt-0.5 shrink-0">{map[status]}</span>;
}

function CountDot({ items }: { items: number }) {
  if (!items) return null;
  return (
    <span className="ml-1 grid size-4 place-items-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-800">
      {items}
    </span>
  );
}
