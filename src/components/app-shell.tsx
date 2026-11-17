"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, FlaskConical, LogOut, Menu, Monitor, Moon, RotateCcw, Settings, Sun } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useDemo, resetDemo } from "@/lib/store";
import { actingPerson } from "@/lib/mock-data";
import { AiStar } from "@/components/fit-pill";
import { STEP_ROUTES, StepTabs } from "@/components/step-tabs";
import { HodEmailHost } from "@/components/hod-email";
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
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Screens only the Bid Analyst uses; VP Commercial signed in is sent to Approvals instead. */
const ANALYST_ONLY = ["/sources", "/onboarding", "/pipeline", "/portals", "/inbox", "/lead", "/settings"];

const HOD_NAV = [{ href: "/approvals", label: "Approvals", match: ["/approvals", "/opportunity"] }];

// Portal scanning (Scan Portal, Portal Registry) is out of scope for phase one; those screens stay in the code but
// are not linked.
const NAV = [
  { href: "/inbox", label: "Inbox", match: ["/inbox", "/lead"] },
  { href: "/pipeline", label: "Lead Pipeline", match: ["/pipeline", "/opportunity"] },
  { href: "/approvals", label: "Approvals", match: ["/approvals"] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  // Static hosting (GitHub Pages) serves pages with a trailing slash, e.g. "/sources/".
  const pathname = usePathname().replace(/(.)\/$/, "$1");
  const demo = useDemo();
  const router = useRouter();
  // VP Commercial (and HoDs) only see Approvals.
  const isHod = !!demo && demo.role !== "analyst";
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
  const fill = ["/sources", "/opportunity", "/pipeline", "/approvals", "/inbox", "/lead"].includes(pathname);

  return (
    // On large screens the work screens fit the window and scroll inside; on smaller screens the page scrolls normally.
    // While the first screen is connecting mailboxes for the first time, the menu links are hidden too.
    <div className={cn("flex min-h-screen flex-col [&:has([data-onboarding])_[data-main-nav]]:hidden!", fill && "lg:h-dvh lg:min-h-0")}>
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="mx-auto flex h-13 w-full max-w-[1320px] items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:px-10">
          <Link href={isHod ? "/approvals" : "/inbox"} className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <div className="grid size-9 place-items-center rounded-[10px] bg-primary text-primary-foreground">
              <AiStar className="size-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight">AGFS Tender</div>
              <div className="text-sm font-medium tracking-tight text-muted-foreground">Intelligence</div>
            </div>
          </Link>
          <nav data-main-nav className="ml-6 hidden items-center gap-1 md:flex">
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
          <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-dashed border-amber-300 bg-amber-50/70 px-2.5 py-1 text-[11px] font-medium text-amber-800 sm:inline-flex">
              <FlaskConical className="size-3.5" /> Demo data
            </span>
            {nav.length > 1 && (
              <span data-main-nav className="contents">
                <MobileNav nav={nav} pathname={pathname} />
              </span>
            )}
            {demo && <ProfileMenu role={demo.role} opsLine={demo.opsLine} />}
          </div>
        </div>
      </header>

      <main
        className={cn(
          "app-canvas flex-1 px-3 py-4 sm:px-6 sm:py-8 lg:px-10",
          fill && "lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:pb-6",
        )}
      >
        <div className={cn("mx-auto w-full max-w-[1320px]", fill && "flex flex-col lg:min-h-[520px] lg:flex-1")}>
          {demo && !blocked ? (
            <>
              {!isHod && (STEP_ROUTES.includes(pathname) || pathname === "/onboarding") ? (
                // Steps and the screen below them read as one section; inner cards drop their own frame.
                <div
                  data-step-section
                  className={cn(
                    "overflow-hidden rounded-2xl bg-card shadow-soft sm:rounded-3xl",
                    // While the first screen is connecting mailboxes, only the connection shows: no step KPIs.
                    "[&:has([data-onboarding])>:first-child]:hidden",
                    fill && "flex flex-col lg:min-h-0 lg:flex-1",
                  )}
                >
                  <StepTabs />
                  <div className={cn("flex min-w-0 flex-1 flex-col", fill && "lg:min-h-0")}>{children}</div>
                </div>
              ) : (
                children
              )}
            </>
          ) : (
            <LoadingState />
          )}
        </div>
      </main>
      <HodEmailHost />
    </div>
  );
}

const APPEARANCE = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/** Light / Dark / System as a segmented control, the way Claude offers it. The menu stays open while switching. */
function AppearanceSwitch() {
  const { theme = "light", setTheme } = useTheme();
  return (
    <div className="flex items-center justify-between gap-3 px-2.5 py-1.5">
      <span className="text-sm">Appearance</span>
      <div role="radiogroup" aria-label="Appearance" className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
        {APPEARANCE.map(({ value, label, icon: Icon }) => {
          const on = theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={label}
              title={label}
              onClick={() => setTheme(value)}
              className={cn(
                "grid h-7 w-8 place-items-center rounded-md transition-colors",
                on ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The main navigation as a menu on phones and small tablets, where the nav links are hidden. */
function MobileNav({ nav, pathname }: { nav: typeof NAV; pathname: string }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            aria-label="Open navigation"
            className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          />
        }
      >
        <Menu className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
        <div className="space-y-0.5">
          {nav.map((n) => {
            const on = n.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
            return (
              <DropdownMenuItem
                key={n.href}
                onClick={() => router.push(n.href)}
                className={cn(MENU_ITEM, on && "bg-secondary font-semibold text-secondary-foreground")}
              >
                {n.label}
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Row spacing shared with the table Filter menu. */
const MENU_ITEM = "gap-2.5 rounded-lg px-2.5 py-2 text-sm";

function ProfileMenu({ role, opsLine }: { role: Role; opsLine?: string }) {
  const person = actingPerson(role, opsLine);
  const router = useRouter();
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<button className="flex items-center gap-2.5 rounded-full py-1 pr-2.5 pl-1 text-left transition-colors hover:bg-muted" />}
        >
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold",
              role !== "analyst" ? "bg-pink-100 text-pink-800" : "bg-purple-100 text-purple-900",
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
        <DropdownMenuContent align="end" className="w-72 rounded-xl p-1.5">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2.5 py-2">
              <div className="text-sm font-semibold text-foreground">{person.name}</div>
              <div className="mt-0.5 text-xs font-normal text-muted-foreground">{person.title}</div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator className="-mx-1.5 my-1.5" />
          <div className="space-y-0.5">
            <AppearanceSwitch />
            {role === "analyst" && (
              <DropdownMenuItem className={MENU_ITEM} onClick={() => router.push("/settings")}>
                <Settings /> Settings · mailboxes
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className={MENU_ITEM} onClick={() => setResetOpen(true)}>
              <RotateCcw /> Reset demo
            </DropdownMenuItem>
          </div>
          <DropdownMenuSeparator className="-mx-1.5 my-1.5" />
          <DropdownMenuItem
            className={MENU_ITEM}
            onClick={() => {
              router.push("/");
              toast("Logged out", {
                description: "Sign in as the Bid Analyst or VP Commercial. Your demo progress is saved in this browser.",
              });
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
              Restores the original sample data and clears the leads, decisions and comments saved in this browser.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              onClick={() => {
                resetDemo();
                setResetOpen(false);
                router.push("/");
                toast("Demo reset", { description: "Fresh data restored. Sign in to start again." });
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
