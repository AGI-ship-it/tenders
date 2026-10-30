"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  CircleHelp,
  FileText,
  Sparkles,
  XCircle,
} from "lucide-react";
import { markUnderReview, useDemo } from "@/lib/store";
import { fitBreakdown, fitScore, recommendation, type CriterionResult } from "@/lib/scoring";
import { daysUntil, formatAED, formatDate, timeAgo } from "@/lib/format";
import type { CheckStatus, Tender } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DecisionPanel } from "@/components/decision-panel";
import { PortalLinkButton } from "@/components/portal-link";
import { RecommendationBadge, scoreTone } from "@/components/shared";

/** Where "back" returns to, keyed by the ?from= the opening link passed. */
const BACK: Record<string, { href: string; label: string }> = {
  pipeline: { href: "/pipeline", label: "Opportunities" },
  approvals: { href: "/approvals", label: "Approval Center" },
  sources: { href: "/sources", label: "Scan Portal" },
};

export function TenderDetail() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? "";
  const from = params.get("from");
  const back = BACK[from ?? ""] ?? BACK.pipeline;

  // Return to the exact place we came from (same tab, same open panel); fall back to that screen if this page was
  // opened directly.
  function goBack() {
    if (from && window.history.length > 1) router.back();
    else router.push(back.href);
  }
  const demo = useDemo()!;
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

  const fit = fitScore(tender);
  const rec = recommendation(tender);
  const days = daysUntil(tender.deadline);
  const history = demo.audit.filter((e) => e.tenderId === tender.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <button onClick={goBack} className="inline-flex shrink-0 items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {back.label}
      </button>

      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            {tender.category} · {tender.buyer} · {tender.emirate}
          </div>
          <h1 className="max-w-3xl text-2xl font-semibold tracking-tight">{tender.title}</h1>
        </div>
        <PortalLinkButton tender={tender} source={source} />
      </div>

      {/* Key facts, as listed on the portal */}
      <dl className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-xl shadow-soft bg-zinc-100 md:grid-cols-5">
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

      <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[1fr_340px]">
        <div className="flex min-h-0 min-w-0 flex-col gap-5 overflow-y-auto pr-1">
          {/* AI pre-qualification: overall score and the four criteria behind it */}
          <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <ScoreCard score={fit} />
            {fitBreakdown(tender).map((c) => (
              <CriterionCard key={c.key} criterion={c} />
            ))}
          </div>

          {/* Recommendation */}
          <RecommendationCard tender={tender} />

          {/* Details, progressively disclosed */}
          <Tabs defaultValue="summary" className="flex min-h-[260px] flex-1 flex-col rounded-xl bg-card p-1 shadow-soft">
            <TabsList variant="line" className="w-full shrink-0 justify-start border-b px-3 pt-1">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="eligibility">
                Eligibility
                <CountDot items={tender.eligibility.filter((e) => e.status !== "met").length} />
              </TabsTrigger>
              <TabsTrigger value="risks">Risks & assumptions</TabsTrigger>
              <TabsTrigger value="evidence">Evidence</TabsTrigger>
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
        <aside className="min-h-0">
          <div className="h-full overflow-y-auto rounded-xl bg-card p-5 shadow-soft">
            <h2 className="mb-4 text-sm font-semibold">Prequalification</h2>
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

      <span className="sr-only">AI recommendation: {rec}</span>
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

function ScoreCard({ score }: { score: number }) {
  return (
    <div className="rounded-xl bg-primary p-4 text-primary-foreground shadow-soft">
      <div className="flex items-center gap-1 text-xs font-medium text-primary-foreground/80">
        AI pre-qualification
        <Tooltip>
          <TooltipTrigger render={<button aria-label="About the pre-qualification score" className="text-primary-foreground/70 hover:text-primary-foreground" />}>
            <CircleHelp className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent className="max-w-60">
            Weighted score across four AGFS criteria: service coverage, geography, contract size and ISO certifications.
            The HoD validates it before anything goes to D365.
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="tabular mt-2 text-3xl font-semibold tracking-tight">
        {score}
        <span className="text-sm font-normal text-primary-foreground/70">/100</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-primary-foreground/20">
        <motion.div
          className="h-full rounded-full bg-primary-foreground"
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function CriterionCard({ criterion: c }: { criterion: CriterionResult }) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-soft">
      <div className="text-xs font-medium text-muted-foreground">{c.label}</div>
      <div className="tabular mt-2 text-xl font-semibold tracking-tight">
        {c.score}
        <span className="text-xs font-normal text-muted-foreground">/100</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn("h-full rounded-full", scoreTone(c.score))}
          initial={{ width: 0 }}
          animate={{ width: `${c.score}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function RecommendationCard({ tender }: { tender: Tender }) {
  return (
    <div className="flex shrink-0 gap-4 rounded-xl bg-card p-5 shadow-soft">
      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Sparkles className="size-5" />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">AI recommendation</span>
          <RecommendationBadge rec={recommendation(tender)} />
          <span className="text-xs text-muted-foreground">· HoD validates before upload to D365</span>
        </div>
        <p className="text-sm leading-relaxed text-foreground/80">{tender.aiNarrative}</p>
      </div>
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
