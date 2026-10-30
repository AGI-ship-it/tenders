"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileUp,
  Fingerprint,
  Globe,
  Mail,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { toggleSource, useDemo } from "@/lib/store";
import { timeAgo } from "@/lib/format";
import type { AccessType, Source } from "@/lib/types";
import { ACCESS_INFO, AiSourceTag, SignInDialog, SourceAccess, SourceStatusBadge } from "@/components/access";
import { AddSourceWizard } from "@/components/add-source-wizard";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const KIND_ICON: Record<Source["kind"], typeof Globe> = {
  Government: Building2,
  "Semi-government": Globe,
  "Client portal": Store,
  Email: Mail,
  Upload: FileUp,
};

/** Side panel listing connected sources, with sign-in, pause/resume and Add source. */
export function SourcesSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const demo = useDemo()!;
  const [addOpen, setAddOpen] = useState(false);
  const [signIn, setSignIn] = useState<Source | null>(null);
  const connected = demo.sources.filter((s) => s.status === "Connected").length;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full gap-0 p-0 sm:max-w-lg data-[side=right]:sm:max-w-lg">
          <SheetHeader className="border-b px-5 pt-5 pb-4">
            <SheetTitle className="text-base">Sources</SheetTitle>
            <SheetDescription className="flex items-center gap-1.5">
              {connected} of {demo.sources.length} connected
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      aria-label="What access types mean"
                      className="grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
                    />
                  }
                >
                  i
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-80 space-y-2 p-3 text-left">
                  {(Object.keys(ACCESS_INFO) as AccessType[]).map((k) => {
                    const info = ACCESS_INFO[k];
                    return (
                      <div key={k} className="flex gap-2">
                        <info.icon className="mt-0.5 size-3.5 shrink-0" />
                        <div>
                          <span className="font-semibold">{info.label}:</span> {info.how}
                        </div>
                      </div>
                    );
                  })}
                </TooltipContent>
              </Tooltip>
            </SheetDescription>
            <div className="mt-3 flex gap-2">
              <Button className="flex-1" onClick={() => setAddOpen(true)}>
                <Plus /> Add source
              </Button>
              <Button variant="outline" nativeButton={false} render={<Link href="/portals" />} onClick={() => onOpenChange(false)}>
                Portal configuration <ArrowRight />
              </Button>
            </div>
          </SheetHeader>

          <ul className="flex-1 divide-y overflow-y-auto">
            {demo.sources.map((s) => {
              const Icon = KIND_ICON[s.kind];
              return (
                <li key={s.id} className="flex items-start gap-3 px-5 py-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{s.name}</span>
                        <AiSourceTag source={s} />
                      </span>
                      <SourceStatusBadge source={s} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <SourceAccess source={s} />
                      <span>Last scan {timeAgo(s.lastScanAt).toLowerCase()}</span>
                      {s.accessState === "Action needed" && (
                        <Button size="xs" className="ml-auto" onClick={() => setSignIn(s)}>
                          <Fingerprint /> Sign in
                        </Button>
                      )}
                    </div>
                  </div>
                  {s.kind !== "Upload" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Source actions" />}>
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => {
                            toggleSource(s.id);
                            toast(s.status === "Paused" ? `${s.name} resumed` : `${s.name} paused`, {
                              description: "Simulated change. Applies to the next scan.",
                            });
                          }}
                        >
                          {s.status === "Paused" ? <Play /> : <Pause />}
                          {s.status === "Paused" ? "Resume monitoring" : "Pause monitoring"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toast.success("Connection test passed", { description: `${s.name} · simulated check` })}
                        >
                          <CheckCircle2 /> Test connection
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>

      <AddSourceWizard open={addOpen} onOpenChange={setAddOpen} />
      <SignInDialog source={signIn} open={!!signIn} onOpenChange={(o) => !o && setSignIn(null)} />
    </>
  );
}
