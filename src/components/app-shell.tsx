"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, FlaskConical, LogOut, Radar, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDemo, resetDemo } from "@/lib/store";
import { actingPerson } from "@/lib/mock-data";
import { STEP_ROUTES, StepTabs } from "@/components/step-tabs";
import type { Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
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
    <div className={cn("app-canvas flex flex-col p-3 sm:p-5", fill ? "h-dvh" : "min-h-screen")}>
      <div
        data-step-section={stepped ? "" : undefined}
        className={cn(
          "mx-auto flex w-full max-w-[1360px] flex-1 flex-col overflow-clip rounded-3xl bg-card shadow-soft ring-1 ring-border/60",
          fill && "min-h-0",
        )}
      >
        <header className="sticky top-0 z-30 shrink-0 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex h-16 w-full items-center gap-4 px-6">
            <Link href={isHod ? "/approvals" : "/sources"} className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Radar className="size-5" />
              </div>
              <div className="leading-tight">
                <div className="text-[13px] font-semibold tracking-tight">AGFS Tender</div>
                <div className="text-[13px] font-semibold tracking-tight text-primary">Intelligence</div>
              </div>
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
                      on ? "font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {n.label}
                    {on && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-magenta" />}
                  </Link>
                );
              })}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden items-center gap-1.5 rounded-full border border-dashed border-amber-300 bg-amber-50/70 px-2.5 py-1 text-[11px] font-medium text-amber-800 sm:inline-flex">
                <FlaskConical className="size-3.5" /> Demo data
              </span>
              {demo && <ProfileMenu role={demo.role} hodLine={demo.hodLine} />}
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

function ProfileMenu({ role, hodLine }: { role: Role; hodLine?: string }) {
  const person = actingPerson(role, hodLine);
  const router = useRouter();
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="flex items-center gap-2.5 rounded-full py-1 pr-2.5 pl-1 text-left transition-colors hover:bg-muted" />
          }
        >
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold",
              role === "approver" ? "bg-pink-100 text-pink-800" : "bg-purple-100 text-purple-900",
            )}
          >
            {person.initials}
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-medium">{person.name}</span>
            <span className="block text-[11px] text-muted-foreground">{person.title}</span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <div className="text-sm font-medium text-foreground">{person.name}</div>
              <div className="text-xs font-normal text-muted-foreground">{person.title}</div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
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
