"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, FlaskConical, LogOut, MonitorSmartphone, Radar, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setFrame, useFrame } from "@/lib/frame";
import { useDemo, resetDemo } from "@/lib/store";
import { actingPerson } from "@/lib/mock-data";
import { STEP_ROUTES, StepTabs } from "@/components/step-tabs";
import type { Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Screens only the Bid Analyst uses; an HoD signed in is sent to Approvals instead. */
const ANALYST_ONLY = ["/sources", "/onboarding", "/pipeline", "/portals"];

const HOD_NAV = [{ href: "/approvals", label: "Approvals", match: ["/approvals", "/opportunity"] }];

const NAV = [
  { href: "/sources", label: "Dashboard", match: ["/sources", "/onboarding"] },
  { href: "/pipeline", label: "Pipeline", match: ["/pipeline", "/opportunity"] },
  { href: "/approvals", label: "Approvals", match: ["/approvals"] },
  { href: "/portals", label: "Portals", match: ["/portals"] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  // Static hosting (GitHub Pages) serves pages with a trailing slash, e.g. "/sources/".
  const pathname = usePathname().replace(/(.)\/$/, "$1");
  const demo = useDemo();
  const router = useRouter();
  const isHod = demo?.role === "approver";
  const blocked = isHod && ANALYST_ONLY.includes(pathname);
  useEffect(() => {
    if (blocked) router.replace("/approvals");
  }, [blocked, router]);
  const nav = isHod ? HOD_NAV : NAV;
  const frame = useFrame();
  const pa = frame === "powerapps";
  // ?frame=powerapps or ?frame=web switches the look and remembers it.
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("frame");
    if (f === "powerapps" || f === "web") setFrame(f);
  }, []);

  // The welcome screen is full-screen, without app chrome. First-time setup uses the normal layout.
  if (pathname === "/") {
    return <div className="min-h-screen">{demo ? children : null}</div>;
  }

  // Scan Portal and the prospect page fit the window; long sections scroll inside their own cards.
  const fill = ["/sources", "/opportunity", "/pipeline", "/approvals"].includes(pathname);

  // Steps and the screen below them form one section with the top bar.
  const stepped = !isHod && (STEP_ROUTES.includes(pathname) || pathname === "/onboarding");

  return (
    // The app reads as one framed window, like a Power Apps screen: top bar, then the screen.
    // In the Power Apps look it fills the screen edge to edge under a slim brand-coloured app bar.
    <div className={cn("flex flex-col", pa ? "bg-card" : "app-canvas p-3 sm:p-5", fill ? "h-dvh" : "min-h-screen")}>
      <div
        data-step-section={stepped ? "" : undefined}
        className={cn(
          "flex w-full flex-1 flex-col overflow-clip bg-card",
          !pa && "mx-auto max-w-[1360px] rounded-3xl shadow-soft ring-1 ring-border/60",
          fill && "min-h-0",
        )}
      >
        <header
          className={cn(
            "sticky top-0 z-30 shrink-0",
            pa ? "bg-primary text-primary-foreground" : "border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80",
          )}
        >
          <div className={cn("flex w-full items-center gap-4", pa ? "h-12 px-4" : "h-16 px-6")}>
            <Link href={isHod ? "/approvals" : "/sources"} className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              {pa ? (
                <>
                  <div className="grid size-7 place-items-center rounded-md bg-white/15">
                    <Radar className="size-4" />
                  </div>
                  <div className="text-sm font-semibold tracking-tight whitespace-nowrap">AGFS Tender Intelligence</div>
                </>
              ) : (
                <>
                  <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                    <Radar className="size-5" />
                  </div>
                  <div className="leading-tight">
                    <div className="text-[13px] font-semibold tracking-tight">AGFS Tender</div>
                    <div className="text-[13px] font-semibold tracking-tight text-primary">Intelligence</div>
                  </div>
                </>
              )}
            </Link>
            <nav className="ml-6 hidden items-center gap-1 md:flex">
              {nav.map((n) => {
                const on = n.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "relative rounded-lg px-3 py-1.5 text-sm transition-colors",
                      pa
                        ? on
                          ? "font-medium text-white"
                          : "text-white/75 hover:bg-white/10 hover:text-white"
                        : on
                          ? "font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {n.label}
                    {on && (
                      <span className={cn("absolute inset-x-3 h-0.5 rounded-full", pa ? "-bottom-[8px] bg-white" : "-bottom-[13px] bg-magenta")} />
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <span
                className={cn(
                  "hidden items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-[11px] font-medium sm:inline-flex",
                  pa ? "border-white/40 bg-white/10 text-white" : "border-amber-300 bg-amber-50/70 text-amber-800",
                )}
              >
                <FlaskConical className="size-3.5" /> Demo data
              </span>
              {demo && <ProfileMenu role={demo.role} hodLine={demo.hodLine} onBrand={pa} />}
            </div>
          </div>
        </header>

        {demo && !blocked ? (
          stepped ? (
            <div className={cn("flex flex-col", fill && "min-h-0 flex-1 overflow-y-auto")}>
              <StepTabs />
              {/* A floor height so the table stays usable on short windows; the section scrolls instead. */}
              <div className={cn("flex flex-col", fill && "min-h-[440px] flex-1")}>{children}</div>
            </div>
          ) : (
            <main className={cn("flex-1 bg-zinc-50/70 px-6 py-8 lg:px-10", fill && "flex min-h-0 flex-col overflow-y-auto pb-6")}>
              <div className={cn("mx-auto w-full max-w-[1320px]", fill && "flex min-h-[520px] flex-1 flex-col")}>{children}</div>
            </main>
          )
        ) : (
          <main className="flex-1 px-6 py-8">
            <LoadingState />
          </main>
        )}
      </div>
    </div>
  );
}

function ProfileMenu({ role, hodLine, onBrand }: { role: Role; hodLine?: string; onBrand: boolean }) {
  const frame = useFrame();
  const person = actingPerson(role, hodLine);
  const router = useRouter();
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              className={cn(
                "flex items-center gap-2.5 rounded-full py-1 pr-2.5 pl-1 text-left transition-colors",
                onBrand ? "hover:bg-white/10" : "hover:bg-muted",
              )}
            />
          }
        >
          <span
            className={cn(
              "grid shrink-0 place-items-center rounded-full text-xs font-semibold",
              onBrand ? "size-8" : "size-9",
              role === "approver" ? "bg-pink-100 text-pink-800" : "bg-purple-100 text-purple-900",
            )}
          >
            {person.initials}
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-medium">{person.name}</span>
            <span className={cn("block text-[11px]", onBrand ? "text-white/70" : "text-muted-foreground")}>{person.title}</span>
          </span>
          <ChevronDown className={cn("size-4", onBrand ? "text-white/70" : "text-muted-foreground")} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <div className="text-sm font-medium text-foreground">{person.name}</div>
              <div className="text-xs font-normal text-muted-foreground">{person.title}</div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={frame === "powerapps"}
            onCheckedChange={(on) => setFrame(on ? "powerapps" : "web")}
          >
            <MonitorSmartphone /> Power Apps full-screen view
          </DropdownMenuCheckboxItem>
          <DropdownMenuItem onClick={() => setResetOpen(true)}>
            <RotateCcw /> Reset demo
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              router.push("/");
              toast("Logged out", { description: "Sign in as the Bid Analyst or an HoD. Your demo progress is saved in this browser." });
            }}
          >
            <LogOut /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset demo data?</DialogTitle>
            <DialogDescription>
              Restores the original sample data, clears scans, decisions and comments saved in this browser, and
              starts first-time setup again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              onClick={() => {
                resetDemo();
                setResetOpen(false);
                router.push("/onboarding");
                toast("Demo reset", { description: "Fresh data restored. Starting first-time setup." });
              }}
            >
              Reset demo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
      <div className="mx-auto h-36 max-w-3xl animate-pulse rounded-2xl bg-muted" />
      <div className="h-80 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
