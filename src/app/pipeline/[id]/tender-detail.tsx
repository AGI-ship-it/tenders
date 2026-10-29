"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  CircleHelp,
  FileText,
  MinusCircle,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { markUnderReview, useDemo } from "@/lib/store";
import { fitBreakdown, fitScore, recommendation } from "@/lib/scoring";
import { daysUntil, formatAED, formatDate, timeAgo } from "@/lib/format";
import type { CheckStatus, Tender } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DecisionPanel } from "@/components/decision-panel";
import { PortalLinkButton } from "@/components/portal-link";
import { RecommendationBadge, scoreTone } from "@/components/shared";

export function TenderDetail() {
  const { id } = useParams<{ id: string }>();
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
    <div className="space-y-6">
      <Link href="/pipeline" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Pipeline
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            {tender.category} · {tender.buyer} · {tender.emirate}
          </div>
          <h1 className="max-w-3xl text-2xl font-semibold tracking-tight">{tender.title}</h1>
        </div>
        <PortalLinkButton tender={tender} source={source} />
      </div>

      {/* Key facts, as listed on the portal */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl shadow-soft bg-zinc-100 md:grid-cols-5">
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

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {/* Three distinct scores */}
          <div className="grid gap-4 md:grid-cols-3">
            <ScoreCard
              label="AI fit score"
              value={`${fit}`}
              suffix="/100"
              bar={fit}
              question="Does it match what AGFS does?"
              help="Rules-based score across six weighted AGFS criteria. Fully explainable below."
            />
            <ScoreCard
              label="Win probability"
              value={`${tender.winProbability}%`}
              bar={tender.winProbability}
              question="How likely are we to win?"
              help="Indicative estimate from a separate win/loss model on historical bids (pilot, simulated). Not part of the fit score."
              tag="Indicative"
            />
            <ScoreCard
              label="Profitability"
              value={tender.marginBand}
              question="Is it worth winning?"
              help={tender.marginNote}
              tag="Not verified"
            />
          </div>

          {/* Recommendation */}
          <RecommendationCard tender={tender} fit={fit} />

          {/* Details, progressively disclosed */}
          <Tabs defaultValue="summary" className="rounded-xl shadow-soft bg-card p-1">
            <TabsList variant="line" className="w-full justify-start border-b px-3 pt-1">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="eligibility">
                Eligibility
                <CountDot items={tender.eligibility.filter((e) => e.status !== "met").length} />
              </TabsTrigger>
              <TabsTrigger value="risks">Risks & assumptions</TabsTrigger>
              <TabsTrigger value="evidence">Evidence</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4 p-5">
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

            <TabsContent value="eligibility" className="p-2">
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

            <TabsContent value="risks" className="grid gap-6 p-5 md:grid-cols-2">
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

            <TabsContent value="evidence" className="space-y-3 p-5">
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
        <aside className="space-y-6">
          <div className="rounded-xl shadow-soft bg-card p-5 xl:sticky xl:top-20">
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

function ScoreCard({
  label,
  value,
  suffix,
  bar,
  question,
  help,
  tag,
}: {
  label: string;
  value: string;
  suffix?: string;
  bar?: number;
  question: string;
  help: string;
  tag?: string;
}) {
  return (
    <div className="rounded-xl shadow-soft bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          {label}
          <Tooltip>
            <TooltipTrigger render={<button aria-label={`About ${label}`} className="text-muted-foreground/70 hover:text-foreground" />}>
              <CircleHelp className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent className="max-w-60">{help}</TooltipContent>
          </Tooltip>
        </span>
        {tag && <span className="rounded bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-800">{tag}</span>}
      </div>
      <div className="tabular mt-2 text-2xl font-semibold tracking-tight">
        {value}
        {suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}
      </div>
      {bar !== undefined ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <motion.div
            className={cn("h-full rounded-full", scoreTone(bar))}
            initial={{ width: 0 }}
            animate={{ width: `${bar}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </div>
      ) : (
        <div className="mt-2 h-1" />
      )}
      <div className="mt-2.5 text-xs text-muted-foreground">{question}</div>
    </div>
  );
}

function RecommendationCard({ tender, fit }: { tender: Tender; fit: number }) {
  const [open, setOpen] = useState(false);
  const rec = recommendation(tender);
  const rows = fitBreakdown(tender);

  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-soft">
      <div className="flex gap-4 p-5">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">AI recommendation</span>
            <RecommendationBadge rec={rec} />
          </div>
          <p className="text-sm leading-relaxed text-foreground/80">{tender.aiNarrative}</p>
          <button
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Why {fit}? See how the score was built
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="grid gap-6 border-t bg-card/60 p-5 lg:grid-cols-[1fr_240px]">
              <div className="space-y-3">
                {rows.map((r) => (
                  <div key={r.key} className="grid grid-cols-[130px_1fr_64px] items-center gap-3">
                    <div className="text-sm">
                      {r.label}
                      <div className="text-[11px] text-muted-foreground">weight {r.weight}%</div>
                    </div>
                    <div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          className={cn("h-full rounded-full", scoreTone(r.score))}
                          initial={{ width: 0 }}
                          animate={{ width: `${r.score}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{r.rationale}</div>
                    </div>
                    <div className="tabular text-right text-sm font-medium">
                      +{r.points}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-3 text-sm font-semibold">
                  <span>Fit score</span>
                  <span className="tabular">{fit} / 100</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Bot className="size-3.5" /> Win-probability drivers
                </div>
                {tender.winDrivers.map((d) => (
                  <div key={d.label} className="flex items-start gap-2 text-xs">
                    {d.effect === "positive" ? (
                      <TrendingUp className="mt-px size-3.5 shrink-0 text-emerald-600" />
                    ) : d.effect === "negative" ? (
                      <TrendingDown className="mt-px size-3.5 shrink-0 text-rose-600" />
                    ) : (
                      <MinusCircle className="mt-px size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    {d.label}
                  </div>
                ))}
                <p className="pt-2 text-[11px] text-muted-foreground">
                  Separate from the fit score. A human makes the final decision.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
