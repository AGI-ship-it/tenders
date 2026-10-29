"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Check, CheckCircle2, CloudUpload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { pushToD365 } from "@/lib/store";
import { serviceLineFor } from "@/lib/mock-data";
import { formatAED, formatDate } from "@/lib/format";
import type { Tender } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STEPS = ["Connecting to Dynamics 365", "Creating lead record", "Attaching RFP summary and evidence"];

/** How opportunity fields land in the D365 Lead entity. */
function mapping(t: Tender) {
  const line = serviceLineFor(t.category);
  return [
    ["Topic", t.title],
    ["Company name", t.buyer],
    ["Est. value", `${formatAED(t.valueAED, false)}${t.valueDisclosed === false ? " (AI estimate)" : ""}`],
    ["Est. close date", formatDate(t.deadline)],
    ["Lead source", `Tender portal · ${t.sourceRef}`],
    ["Service line", line.name],
    ["Owner", line.hod],
  ];
}

export function PushToD365Button({ tender, className }: { tender: Tender; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="lg" className={cn("w-full", className)} onClick={() => setOpen(true)}>
        <CloudUpload /> Push to D365 as lead
      </Button>
      <PushDialog tender={tender} open={open} onOpenChange={setOpen} />
    </>
  );
}

function PushDialog({ tender, open, onOpenChange }: { tender: Tender; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [phase, setPhase] = useState<"review" | "pushing" | "done">("review");
  const [step, setStep] = useState(0);
  const [leadId, setLeadId] = useState("");
  const timers = useRef<number[]>([]);

  function close(o: boolean) {
    if (!o) {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      window.setTimeout(() => {
        setPhase("review");
        setStep(0);
      }, 200);
    }
    onOpenChange(o);
  }

  function push() {
    setPhase("pushing");
    STEPS.forEach((_, i) => timers.current.push(window.setTimeout(() => setStep(i), i * 900)));
    timers.current.push(
      window.setTimeout(() => {
        const id = pushToD365(tender.id);
        setLeadId(id);
        setPhase("done");
        toast.success(`Lead ${id} created in D365`, { description: "Simulated. No data left this browser." });
      }, STEPS.length * 900),
    );
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Push to Dynamics 365</DialogTitle>
          <DialogDescription>
            Creates a lead in D365 Lead Management so Sales can take it forward. Simulated in this prototype.
          </DialogDescription>
        </DialogHeader>

        {phase === "review" && (
          <div className="overflow-hidden rounded-lg border text-sm">
            <div className="grid grid-cols-[130px_1fr] bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>D365 lead field</span>
              <span>Value from opportunity</span>
            </div>
            <dl className="divide-y">
              {mapping(tender).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[130px_1fr] px-3 py-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="truncate font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {phase === "pushing" && (
          <ol className="space-y-3 py-2">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-2.5 text-sm">
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full",
                    i < step ? "bg-primary text-primary-foreground" : i === step ? "text-primary" : "text-muted-foreground/40",
                  )}
                >
                  {i < step ? <Check className="size-3" /> : i === step ? <Loader2 className="size-4 animate-spin" /> : "·"}
                </span>
                <span className={cn(i > step && "text-muted-foreground")}>{s}</span>
              </li>
            ))}
          </ol>
        )}

        {phase === "done" && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-4 text-center">
            <CheckCircle2 className="size-10 text-emerald-600" />
            <p className="mt-3 font-medium">Lead created</p>
            <p className="mt-1 font-mono text-sm">{leadId}</p>
            <p className="mt-1 text-xs text-muted-foreground">Owner: {serviceLineFor(tender.category).hod} · status set to Lead in D365</p>
          </motion.div>
        )}

        <DialogFooter>
          {phase === "review" && (
            <>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button onClick={push}>
                Push lead <ArrowRight />
              </Button>
            </>
          )}
          {phase === "done" && <Button onClick={() => close(false)}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
