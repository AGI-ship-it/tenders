"use client";

import { useState } from "react";
import { Layers, ScanSearch, Sparkles } from "lucide-react";
import { useDemo } from "@/lib/store";
import { aiPrequalified } from "@/lib/scoring";
import { Button } from "@/components/ui/button";
import { ScanPanel } from "@/components/scan-panel";
import { SourcesSheet } from "@/components/sources-panel";

/** Step 1: run the scan on screen; connected sources (and Add source) live in a side panel. */
export function SourcesView() {
  const demo = useDemo()!;
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const connected = demo.sources.filter((s) => s.status === "Connected").length;
  const needsSignIn = demo.sources.some((s) => s.accessState === "Action needed" && s.status !== "Paused");
  const scanned = demo.tenders.length;
  const recommended = demo.tenders.filter(aiPrequalified).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScanPanel
        onOpenSources={() => setSourcesOpen(true)}
        stats={
          // Overall pipeline numbers, across every scan so far.
          <div className="flex items-center divide-x divide-border rounded-xl bg-muted/40 ring-1 ring-border ring-inset">
            <PipelineStat icon={ScanSearch} label="Scanned" value={scanned} />
            <PipelineStat icon={Sparkles} label="AI recommended as prequalified" value={recommended} />
          </div>
        }
        sourcesAction={
          <Button variant="outline" className="h-10 rounded-xl px-4" onClick={() => setSourcesOpen(true)}>
            <Layers /> Sources · {connected} connected
            {needsSignIn && <span className="size-2 rounded-full bg-amber-500" aria-label="Sign-in needed" />}
          </Button>
        }
      />

      <SourcesSheet open={sourcesOpen} onOpenChange={setSourcesOpen} />
    </div>
  );
}

function PipelineStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-1.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-3.5" />
      </span>
      <span className="tabular text-lg font-semibold tracking-tight">{value}</span>
      <span className="text-xs leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}
