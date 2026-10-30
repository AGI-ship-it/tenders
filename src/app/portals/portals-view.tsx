"use client";

import { useState } from "react";
import { CheckCircle2, Fingerprint, MoreHorizontal, Pause, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { toggleSource, useDemo } from "@/lib/store";
import { timeAgo } from "@/lib/format";
import type { AccessType, Source } from "@/lib/types";
import { ACCESS_INFO, AiSourceTag, SignInDialog, SourceAccess, SourceStatusBadge } from "@/components/access";
import { AddSourceWizard } from "@/components/add-source-wizard";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared";

/** Full portal configuration: how each portal is reached, what it is scanned for, and its connection state. */
export function PortalsView() {
  const demo = useDemo()!;
  const [addOpen, setAddOpen] = useState(false);
  const [signIn, setSignIn] = useState<Source | null>(null);
  const connected = demo.sources.filter((s) => s.status === "Connected").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portal configuration"
        description={`${connected} of ${demo.sources.length} sources connected. Portals that need a login or UAE PASS are signed in by a named person; the agent never bypasses a login or CAPTCHA.`}
        actions={
          <Button className="h-10 rounded-xl px-4" onClick={() => setAddOpen(true)}>
            <Plus /> Add source
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Portal</th>
                <th className="px-3 py-3 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    Access
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
                  </span>
                </th>
                <th className="px-3 py-3 font-medium">Method · schedule</th>
                <th className="px-3 py-3 font-medium">Scanning for</th>
                <th className="px-3 py-3 font-medium">Last scan</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {demo.sources.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{s.name}</span>
                      <AiSourceTag source={s} />
                    </div>
                    <div className="max-w-64 truncate font-mono text-[11px] text-muted-foreground">{s.url}</div>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-2">
                      <SourceAccess source={s} />
                      {s.accessState === "Action needed" && s.status !== "Paused" && (
                        <Button size="xs" onClick={() => setSignIn(s)}>
                          <Fingerprint /> Sign in
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-muted-foreground">
                    {s.method.replace("Simulated ", "")}
                    <div className="text-[11px]">{s.schedule}</div>
                  </td>
                  <td className="max-w-56 px-3 py-3.5 text-xs text-muted-foreground">
                    {s.kind === "Upload" ? "Uploaded RFP files" : s.watch?.join(", ") ?? "All AGFS service lines"}
                  </td>
                  <td className="px-3 py-3.5 text-muted-foreground">{timeAgo(s.lastScanAt)}</td>
                  <td className="px-3 py-3.5">
                    <SourceStatusBadge source={s} />
                  </td>
                  <td className="px-3 py-3.5">
                    {s.kind !== "Upload" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Portal actions" />}>
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
                            {s.status === "Paused" ? "Resume scanning" : "Pause scanning"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => toast.success("Connection test passed", { description: `${s.name} · simulated check` })}
                          >
                            <CheckCircle2 /> Test connection
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddSourceWizard open={addOpen} onOpenChange={setAddOpen} />
      <SignInDialog source={signIn} open={!!signIn} onOpenChange={(o) => !o && setSignIn(null)} />
    </div>
  );
}
