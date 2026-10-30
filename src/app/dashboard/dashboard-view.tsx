"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, CloudUpload, ListOrdered, Radar, Target } from "lucide-react";
import { useDemo } from "@/lib/store";
import { SERVICE_LINES } from "@/lib/mock-data";
import { fitScore, isActive } from "@/lib/scoring";
import { formatDateTime } from "@/lib/format";
import type { TenderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared";

const STAGES: TenderStatus[] = ["New", "Under Review", "Awaiting HoD", "Changes Requested", "Prequalified", "Lead in D365"];

/** Overview of the tender workflow: pipeline, HoD ownership and what has gone to D365. */
export function DashboardView() {
  const demo = useDemo()!;
  const { tenders } = demo;
  const open = tenders.filter(isActive);
  const avgScore = open.length ? Math.round(open.reduce((s, t) => s + fitScore(t), 0) / open.length) : 0;
  const awaiting = tenders.filter((t) => t.status === "Awaiting HoD").length;
  const leads = tenders.filter((t) => t.status === "Lead in D365").length;
  const maxStage = Math.max(1, ...STAGES.map((st) => tenders.filter((t) => t.status === st).length));
  const scan = demo.lastScan;

  const kpis = [
    { label: "Open opportunities", value: open.length, icon: ListOrdered, href: "/pipeline" },
    { label: "Avg. pre-qualification score", value: avgScore, icon: Target, href: "/pipeline" },
    { label: "Awaiting HoD", value: awaiting, icon: CheckCircle2, href: "/approvals", alert: awaiting > 0 },
    { label: "Leads in D365", value: leads, icon: CloudUpload, href: "/approvals?view=decided" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Where tender opportunities stand, from scanning to HoD-validated leads in D365." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className="group rounded-xl bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground/85">{k.label}</span>
              <span className={cn("grid size-8 place-items-center rounded-lg", k.alert ? "bg-amber-50 text-amber-700" : "bg-secondary text-primary")}>
                <k.icon className="size-4" />
              </span>
            </div>
            <div className="tabular mt-3 text-3xl font-semibold tracking-tight">{k.value}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl bg-card p-5 shadow-soft">
          <h2 className="mb-4 text-sm font-semibold">Opportunities by status</h2>
          <div className="space-y-3">
            {STAGES.map((st) => {
              const n = tenders.filter((t) => t.status === st).length;
              return (
                <div key={st} className="grid grid-cols-[140px_1fr_28px] items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{st}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/80" style={{ width: `${(n / maxStage) * 100}%` }} />
                  </div>
                  <span className="tabular text-right font-medium">{n}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl bg-card p-5 shadow-soft">
          <h2 className="mb-4 text-sm font-semibold">HoD ownership by service line</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Service line</th>
                <th className="pb-2 text-right font-medium">Awaiting</th>
                <th className="pb-2 text-right font-medium">Prequalified</th>
                <th className="pb-2 text-right font-medium">In D365</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {SERVICE_LINES.map((line) => {
                const items = tenders.filter((t) => line.categories.includes(t.category));
                const count = (st: TenderStatus) => items.filter((t) => t.status === st).length;
                return (
                  <tr key={line.id}>
                    <td className="py-2.5">
                      <div className="font-medium">{line.name}</div>
                      <div className="text-xs text-muted-foreground">{line.hod}</div>
                    </td>
                    <td className={cn("tabular py-2.5 text-right", count("Awaiting HoD") > 0 && "font-semibold text-amber-700")}>
                      {count("Awaiting HoD")}
                    </td>
                    <td className="tabular py-2.5 text-right">{count("Prequalified")}</td>
                    <td className="tabular py-2.5 text-right">{count("Lead in D365")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-card p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Radar className="size-5" />
          </span>
          <div>
            <div className="text-sm font-semibold">Latest scan</div>
            <div className="text-sm text-muted-foreground">
              {scan
                ? `${formatDateTime(scan.at)} · ${scan.scanned} portals scanned · ${scan.newIds.length} new`
                : "No scan yet"}
            </div>
          </div>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/sources" />}>
          Go to Scan <ArrowRight />
        </Button>
      </section>
    </div>
  );
}
