"use client";

import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { prospectStatus } from "@/lib/scoring";
import type { ProspectStatus, Recommendation, TenderStatus } from "@/lib/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const STATUS_STYLE: Record<ProspectStatus, string> = {
  "Pending Review": "bg-amber-50 text-amber-800 ring-amber-200",
  Prequalified: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Rejected: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function StatusBadge({ status: workflow, className }: { status: TenderStatus; className?: string }) {
  const status = prospectStatus(workflow);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        STATUS_STYLE[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

const REC_STYLE: Record<Recommendation, string> = {
  Bid: "bg-purple-800 text-white",
  "Bid with conditions": "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-100",
  Review: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
  "No-bid": "bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-200",
};

export function RecommendationBadge({ rec, className }: { rec: Recommendation; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
        REC_STYLE[rec],
        className,
      )}
    >
      {rec}
    </span>
  );
}

/** AI pre-qualification recommendation shown as Yes / No. */
export function PrequalBadge({ yes, className }: { yes: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        // Muted sage and soft coral rather than the stock green and red.
        yes ? "bg-[#EAF4EE] text-[#2E6B4F] ring-[#C9E2D3]" : "bg-[#FBEDEA] text-[#A9473D] ring-[#F1D1CB]",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", yes ? "bg-[#4E9A74]" : "bg-[#D2685C]")} />
      {yes ? "Yes" : "No"}
    </span>
  );
}

export function scoreTone(score: number) {
  if (score >= 75) return "bg-teal-600";
  if (score >= 60) return "bg-teal-400";
  if (score >= 45) return "bg-amber-400";
  return "bg-zinc-300";
}

export function ScoreBar({ score, className }: { score: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="tabular w-6 text-right text-sm font-semibold">{score}</span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", scoreTone(score))} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export function SimulatedTag({ label = "Simulated", className }: { label?: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "inline-flex cursor-help items-center gap-1 rounded-full border border-dashed border-amber-300 bg-amber-50/70 px-2 py-0.5 text-[11px] font-medium text-amber-800",
              className,
            )}
          />
        }
      >
        <FlaskConical className="size-3" />
        {label}
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        Demo data only. No live portal access, authentication, document download or bid submission takes place.
      </TooltipContent>
    </Tooltip>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  /** Omitted when the screen is embedded under the landing-page step tabs. */
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1.5">
        {eyebrow}
        {title && <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>}
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold text-foreground">{children}</h2>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
