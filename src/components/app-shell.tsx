"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, FlaskConical, LogOut, Radar, RotateCcw, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDemo, resetDemo, setRole } from "@/lib/store";
import { PEOPLE } from "@/lib/mock-data";
import { STEP_ROUTES, StepTabs } from "@/components/step-tabs";
import type { Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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

const NAV = [
  { href: "/dashboard", label: "Dashboard", match: ["/dashboard"] },
  { href: "/sources", label: "Scan", match: ["/sources", "/onboarding"] },
  { href: "/pipeline", label: "Pipeline", match: ["/pipeline", "/opportunity"] },
  { href: "/approvals", label: "Approvals", match: ["/approvals"] },
  { href: "/portals", label: "Portals", match: ["/portals"] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  // Static hosting (GitHub Pages) serves pages with a trailing slash, e.g. "/sources/".
  const pathname = usePathname().replace(/(.)\/$/, "$1");
  const demo = useDemo();

  // The welcome screen is full-screen, without app chrome. First-time setup uses the normal layout.
  if (pathname === "/") {
    return <div className="min-h-screen">{demo ? children : null}</div>;
  }

  // Scan Portal and the opportunity page fit the window; long sections scroll inside their own cards.
  const fill = pathname === "/sources" || pathname === "/opportunity";

  return (
    <div className={cn("flex flex-col", fill ? "h-dvh" : "min-h-screen")}>
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="mx-auto flex h-16 w-full max-w-[1320px] items-center gap-4 px-6 lg:px-10">
          <Link href="/sources" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Radar className="size-5" />
            </div>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold tracking-tight">AGFS Tender</div>
              <div className="text-[13px] font-semibold tracking-tight text-primary">Intelligence</div>
            </div>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {NAV.map((n) => {
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
            {demo && <ProfileMenu role={demo.role} />}
          </div>
        </div>
      </header>

      <main className={cn("app-canvas flex-1 px-6 py-8 lg:px-10", fill && "flex min-h-0 flex-col overflow-y-auto pb-6")}>
        <div className={cn("mx-auto w-full max-w-[1320px]", fill && "flex min-h-[520px] flex-1 flex-col")}>
          {demo ? (
            <>
              {(STEP_ROUTES.includes(pathname) || pathname === "/onboarding") && <StepTabs />}
              {children}
            </>
          ) : (
            <LoadingState />
          )}
        </div>
      </main>
    </div>
  );
}

function ProfileMenu({ role }: { role: Role }) {
  const person = PEOPLE[role];
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
            <DropdownMenuLabel>Switch demo role</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={role}
              onValueChange={(v) => {
                setRole(v as Role);
                toast.success(`Now acting as ${PEOPLE[v as Role].name}`, {
                  description:
                    v === "approver"
                      ? "You can prequalify opportunities routed to HoDs."
                      : "You can review opportunities and submit for prequalification.",
                });
              }}
            >
              <DropdownMenuRadioItem value="analyst">
                <UserRound className="size-4 text-purple-800" />
                <div>
                  <div className="text-sm">Bid Analyst</div>
                  <div className="text-xs text-muted-foreground">Reviews AI output, submits for prequalification</div>
                </div>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="approver">
                <ShieldCheck className="size-4 text-pink-700" />
                <div>
                  <div className="text-sm">Service-line HoD</div>
                  <div className="text-xs text-muted-foreground">Prequalifies opportunities routed to their line</div>
                </div>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setResetOpen(true)}>
            <RotateCcw /> Reset demo
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              router.push("/");
              toast("Logged out", { description: "Your demo progress is saved in this browser." });
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
