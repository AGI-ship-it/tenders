"use client";

import { useState } from "react";
import { Layers } from "lucide-react";
import { useDemo } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared";
import { ScanPanel } from "@/components/scan-panel";
import { SourcesSheet } from "@/components/sources-panel";

/** Step 1: run the scan on screen; connected sources (and Add source) live in a side panel. */
export function SourcesView({ embedded = false }: { embedded?: boolean }) {
  const demo = useDemo()!;
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const connected = demo.sources.filter((s) => s.status === "Connected").length;
  const needsSignIn = demo.sources.some((s) => s.accessState === "Action needed" && s.status !== "Paused");

  return (
    <div className="space-y-4">
      <PageHeader
        title={embedded ? undefined : "Scan Portal"}
        description={embedded ? undefined : "Run the scan across connected portals, then review what was found."}
        actions={
          <Button variant="outline" className="h-10 rounded-xl px-4" onClick={() => setSourcesOpen(true)}>
            <Layers /> Sources · {connected} connected
            {needsSignIn && <span className="size-2 rounded-full bg-amber-500" aria-label="Sign-in needed" />}
          </Button>
        }
      />

      <ScanPanel onOpenSources={() => setSourcesOpen(true)} />

      <SourcesSheet open={sourcesOpen} onOpenChange={setSourcesOpen} />
    </div>
  );
}
