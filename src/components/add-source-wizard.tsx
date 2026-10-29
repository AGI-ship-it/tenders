"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  FileText,
  FileUp,
  Fingerprint,
  Globe,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  Smartphone,
  Store,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { addSource, addUploadedFiles } from "@/lib/store";
import { PEOPLE } from "@/lib/mock-data";
import type { AccessType, Category, Emirate, Source, Tender } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ACCESS_INFO } from "@/components/access";

const STEPS = ["Portal", "Sign-in", "What to scan", "Test & connect"];

const KINDS: { value: Source["kind"]; icon: typeof Globe }[] = [
  { value: "Government", icon: Building2 },
  { value: "Semi-government", icon: Globe },
  { value: "Client portal", icon: Store },
  { value: "Email", icon: Mail },
];

const CATEGORIES: Category[] = [
  "Integrated FM",
  "Hard FM / MEP",
  "Cleaning & Hygiene",
  "Landscaping",
  "Security Services",
  "Pest Control",
  "Waste Management",
];
const EMIRATES: Emirate[] = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"];
const SCHEDULES = ["Daily, 06:00 GST", "Every 4 hours", "Weekly, Monday"];

const METHOD: Record<AccessType, string> = {
  Public: "Simulated web monitor",
  Password: "Simulated supplier-portal connector",
  "UAE PASS": "Simulated web monitor",
  CAPTCHA: "Simulated email parser",
};

const TESTS = ["Reaching portal", "Signing in", "Finding tender listings", "Reading a sample notice"];

type SignIn = "none" | "waiting" | "done";

export function AddSourceWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [mode, setMode] = useState<"choose" | "portal" | "upload">("choose");
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("https://");
  const [kind, setKind] = useState<Source["kind"]>("Government");
  const [access, setAccess] = useState<AccessType>("UAE PASS");
  const [signIn, setSignIn] = useState<SignIn>("none");
  const [username, setUsername] = useState("");
  const [alertsOk, setAlertsOk] = useState(false);
  const [schedule, setSchedule] = useState(SCHEDULES[0]);
  const [cats, setCats] = useState<Category[]>(["Integrated FM", "Hard FM / MEP", "Cleaning & Hygiene"]);
  const [emirates, setEmirates] = useState<Emirate[]>(["Dubai", "Abu Dhabi", "Sharjah"]);
  const [test, setTest] = useState(-1);
  const timers = useRef<number[]>([]);

  const signedIn =
    access === "Public" || (access === "CAPTCHA" ? alertsOk : signIn === "done");
  const canNext = [
    name.trim().length > 2 && url.trim().length > 8,
    signedIn,
    cats.length > 0 && emirates.length > 0,
    test >= TESTS.length,
  ][step];

  function reset() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setMode("choose");
    setStep(0);
    setName("");
    setUrl("https://");
    setKind("Government");
    setAccess("UAE PASS");
    setSignIn("none");
    setUsername("");
    setAlertsOk(false);
    setSchedule(SCHEDULES[0]);
    setTest(-1);
  }

  function close(o: boolean) {
    onOpenChange(o);
    if (!o) window.setTimeout(reset, 200);
  }

  function chooseAccess(a: AccessType) {
    setAccess(a);
    setSignIn("none");
    setAlertsOk(false);
  }

  function requestUaePass() {
    setSignIn("waiting");
    timers.current.push(window.setTimeout(() => setSignIn("done"), 2400));
  }

  function runTest() {
    setTest(0);
    TESTS.forEach((_, i) => timers.current.push(window.setTimeout(() => setTest(i + 1), (i + 1) * 700)));
  }

  function finish() {
    addSource({
      name: name.trim(),
      url: url.trim(),
      kind,
      access,
      method: METHOD[access],
      schedule,
      watch: cats,
      authorised: true,
    });
    toast.success(`${name.trim()} connected`, { description: "Included from the next scan. Simulated connection." });
    close(false);
  }

  function toggle<T>(list: T[], v: T, set: (l: T[]) => void) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  if (mode !== "portal") {
    return (
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
          {mode === "choose" ? (
            <>
              <DialogHeader className="border-b px-6 pt-5 pb-4">
                <DialogTitle>Add a source</DialogTitle>
                <DialogDescription>Connect a portal the agent scans every day, or upload RFP files you already have.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 p-6 sm:grid-cols-2">
                <ModeCard icon={Globe} title="Connect a portal" body="Government or client tender portal, scanned on schedule." onClick={() => setMode("portal")} />
                <ModeCard icon={FileUp} title="Upload RFP files" body="One or several files. Each becomes an opportunity." onClick={() => setMode("upload")} />
              </div>
            </>
          ) : (
            <UploadFlow onBack={() => setMode("choose")} onDone={() => close(false)} />
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b px-6 pt-5 pb-4">
          <DialogTitle>Connect a source portal</DialogTitle>
          <DialogDescription>Connect a portal once; the agent scans it on schedule. Simulated, nothing is contacted.</DialogDescription>
          <ol className="mt-3 flex items-center gap-2">
            {STEPS.map((label, i) => (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition-colors",
                    i < step && "bg-primary text-primary-foreground",
                    i === step && "bg-primary/10 text-primary ring-2 ring-primary/30",
                    i > step && "bg-muted text-muted-foreground",
                  )}
                >
                  {i < step ? <Check className="size-3" /> : i + 1}
                </span>
                <span className={cn("hidden text-xs sm:inline", i === step ? "font-medium" : "text-muted-foreground")}>{label}</span>
                {i < STEPS.length - 1 && <span className={cn("h-px flex-1", i < step ? "bg-primary" : "bg-border")} />}
              </li>
            ))}
          </ol>
        </DialogHeader>

        <div className="min-h-[300px] px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {step === 0 && (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor="w-name">Portal name</Label>
                    <Input id="w-name" placeholder="e.g. Ajman Government Procurement" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="w-url">Portal URL</Label>
                    <Input id="w-url" className="font-mono text-xs" value={url} onChange={(e) => setUrl(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Type</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {KINDS.map((k) => (
                        <Choice key={k.value} active={kind === k.value} onClick={() => setKind(k.value)} icon={k.icon} label={k.value} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div className="grid gap-1.5">
                    <Label>How does this portal sign in?</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {(Object.keys(ACCESS_INFO) as AccessType[]).map((k) => (
                        <Choice key={k} active={access === k} onClick={() => chooseAccess(k)} icon={ACCESS_INFO[k].icon} label={ACCESS_INFO[k].label} />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-muted/40 p-4">
                    {access === "Public" && (
                      <Done text="No sign-in needed. The agent reads public notices." />
                    )}

                    {access === "Password" &&
                      (signIn === "done" ? (
                        <Done text={`Credentials for ${username} saved to the vault. The agent never sees the password.`} />
                      ) : (
                        <div className="grid gap-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                              <Label htmlFor="w-user">Username</Label>
                              <Input id="w-user" className="bg-card" placeholder="agfs.bidding" value={username} onChange={(e) => setUsername(e.target.value)} />
                            </div>
                            <div className="grid gap-1.5">
                              <Label htmlFor="w-pass">Password</Label>
                              <Input id="w-pass" className="bg-card" type="password" placeholder="••••••••" autoComplete="off" />
                            </div>
                          </div>
                          <Button disabled={!username.trim()} onClick={() => setSignIn("done")}>
                            <KeyRound /> Save to vault
                          </Button>
                        </div>
                      ))}

                    {access === "UAE PASS" &&
                      (signIn === "done" ? (
                        <Done text={`Approved on ${PEOPLE.analyst.name}'s UAE PASS app. Session renews every 30 days.`} />
                      ) : signIn === "waiting" ? (
                        <div className="flex flex-col items-center py-3 text-center">
                          <motion.div
                            animate={{ scale: [1, 1.08, 1] }}
                            transition={{ repeat: Infinity, duration: 1.4 }}
                            className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"
                          >
                            <Fingerprint className="size-6" />
                          </motion.div>
                          <p className="mt-3 text-sm font-medium">Waiting for approval on phone…</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">Simulated. Approves in a moment.</p>
                        </div>
                      ) : (
                        <div className="space-y-3 text-sm">
                          <div className="flex gap-3">
                            <Smartphone className="mt-0.5 size-5 shrink-0 text-primary" />
                            <p className="text-muted-foreground">
                              UAE PASS is personal. A sign-in request goes to{" "}
                              <span className="font-medium text-foreground">{PEOPLE.analyst.name}</span>’s phone; the agent
                              never signs in alone.
                            </p>
                          </div>
                          <Button className="w-full" onClick={requestUaePass}>
                            <Fingerprint /> Send UAE PASS request
                          </Button>
                        </div>
                      ))}

                    {access === "CAPTCHA" && (
                      <div className="space-y-3 text-sm">
                        <p className="text-muted-foreground">
                          The agent does not solve CAPTCHAs. Subscribe this portal’s tender alerts to the mailbox below and
                          the agent reads them instead.
                        </p>
                        <div className="rounded-lg bg-card px-3 py-2 font-mono text-xs">tenders@agfs.demo.example</div>
                        <label className="flex items-center gap-2.5">
                          <Checkbox checked={alertsOk} onCheckedChange={(c) => setAlertsOk(Boolean(c))} />
                          <span>Email alerts are set up for this portal</span>
                        </label>
                      </div>
                    )}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <ChipGroup label="Service lines to watch" options={CATEGORIES} selected={cats} onToggle={(v) => toggle(cats, v, setCats)} />
                  <ChipGroup label="Emirates" options={EMIRATES} selected={emirates} onToggle={(v) => toggle(emirates, v, setEmirates)} />
                  <div className="grid gap-1.5">
                    <Label>Scan schedule</Label>
                    <div className="flex flex-wrap gap-2">
                      {SCHEDULES.map((s) => (
                        <Chip key={s} active={schedule === s} onClick={() => setSchedule(s)}>
                          {s}
                        </Chip>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-muted/40 p-4 text-sm">
                    <div className="font-medium">{name}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{url}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {kind} · {ACCESS_INFO[access].label} · {schedule} · {cats.length} service lines · {emirates.length} emirates
                    </div>
                  </div>
                  {test < 0 ? (
                    <Button variant="outline" className="w-full" onClick={runTest}>
                      <ShieldCheck /> Run connection test
                    </Button>
                  ) : (
                    <ol className="space-y-2.5">
                      {TESTS.map((t, i) => (
                        <li key={t} className="flex items-center gap-2.5 text-sm">
                          <span className="grid size-5 place-items-center">
                            {i < test ? (
                              <CheckCircle2 className="size-4 text-emerald-600" />
                            ) : i === test ? (
                              <Loader2 className="size-4 animate-spin text-primary" />
                            ) : (
                              <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                            )}
                          </span>
                          <span className={cn(i > test && "text-muted-foreground")}>{t}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {test >= TESTS.length && (
                    <p className="text-sm font-medium text-emerald-700">All checks passed (simulated). Ready to connect.</p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between border-t bg-muted/30 px-6 py-3">
          <Button variant="ghost" onClick={() => (step === 0 ? setMode("choose") : setStep((s) => s - 1))}>
            <ArrowLeft /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button disabled={!canNext} onClick={finish}>
              <Check /> Connect source
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Choice({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Globe; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-all",
        active ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20" : "text-muted-foreground hover:border-foreground/20 hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
        active ? "border-primary/40 bg-primary/5 font-medium text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && <Check className="size-3" />}
      {children}
    </button>
  );
}

function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: T[];
  selected: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o} active={selected.includes(o)} onClick={() => onToggle(o)}>
            {o}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Done({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 text-sm text-emerald-700">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      {text}
    </div>
  );
}

function ModeCard({ icon: Icon, title, body, onClick }: { icon: typeof Globe; title: string; body: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-3 rounded-xl bg-muted/40 p-5 text-left transition-all hover:bg-card hover:shadow-soft-lg"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Icon className="size-5" />
      </span>
      <div>
        <div className="font-medium">{title}</div>
        <div className="mt-0.5 text-sm text-muted-foreground">{body}</div>
      </div>
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
        Choose <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.zip";

function formatSize(bytes: number) {
  return bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/** Upload one or many RFP files. Only names are used; files are never read or sent anywhere. */
function UploadFlow({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const router = useRouter();
  const [files, setFiles] = useState<{ name: string; size: number }[]>([]);
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState<"pick" | "extracting" | "done">("pick");
  const [progress, setProgress] = useState(0);
  const [added, setAdded] = useState<Tender[]>([]);
  const input = useRef<HTMLInputElement>(null);

  function take(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list).map((f) => ({ name: f.name, size: f.size }));
    setFiles((cur) => [...cur, ...next.filter((n) => !cur.some((c) => c.name === n.name))]);
  }

  function extract() {
    setPhase("extracting");
    files.forEach((_, i) => window.setTimeout(() => setProgress(i + 1), (i + 1) * 800));
    window.setTimeout(() => {
      const created = addUploadedFiles(files.map((f) => f.name));
      setAdded(created);
      setPhase("done");
      toast.success(`${created.length} ${created.length === 1 ? "opportunity" : "opportunities"} added from uploads`, {
        description: "Simulated extraction from file names.",
      });
    }, files.length * 800 + 300);
  }

  return (
    <>
      <DialogHeader className="border-b px-6 pt-5 pb-4">
        <DialogTitle>Upload RFP files</DialogTitle>
        <DialogDescription>Add one file or several. The agent extracts each into an opportunity and scores it.</DialogDescription>
      </DialogHeader>

      <div className="min-h-[300px] space-y-4 px-6 py-5">
        {phase === "pick" && (
          <>
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                take(e.dataTransfer.files);
              }}
              className={cn(
                "flex w-full flex-col items-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
                drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40",
              )}
            >
              <FileUp className="size-7 text-primary" />
              <span className="mt-2 text-sm font-medium">Drop files here or click to browse</span>
              <span className="mt-0.5 text-xs text-muted-foreground">PDF, Word, Excel or ZIP · one or many</span>
            </button>
            <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => take(e.target.files)} />

            {files.length > 0 && (
              <ul className="divide-y rounded-xl bg-muted/40">
                {files.map((f) => (
                  <li key={f.name} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{formatSize(f.size)}</span>
                    <button
                      aria-label={`Remove ${f.name}`}
                      onClick={() => setFiles((cur) => cur.filter((c) => c.name !== f.name))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">Demo: only file names are used. Files are not read or uploaded anywhere.</p>
          </>
        )}

        {phase === "extracting" && (
          <ol className="space-y-2.5">
            {files.map((f, i) => (
              <li key={f.name} className="flex items-center gap-2.5 text-sm">
                {i < progress ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : i === progress ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <span className="grid size-4 place-items-center">
                    <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                  </span>
                )}
                <span className={cn("truncate", i > progress && "text-muted-foreground")}>
                  {i < progress ? "Extracted" : i === progress ? "Extracting" : "Waiting"} · {f.name}
                </span>
              </li>
            ))}
          </ol>
        )}

        {phase === "done" && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Added to the Opportunities Pipeline</div>
            {added.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onDone();
                  router.push(`/pipeline/${t.id}`);
                }}
                className="flex w-full items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5 text-left transition-colors hover:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.id} · {t.category} · {t.emirate}
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t bg-muted/30 px-6 py-3">
        {phase === "pick" ? (
          <>
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft /> Back
            </Button>
            <Button disabled={!files.length} onClick={extract}>
              Extract {files.length || ""} file{files.length === 1 ? "" : "s"} <ArrowRight />
            </Button>
          </>
        ) : phase === "done" ? (
          <Button className="ml-auto" onClick={onDone}>
            Done
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            Extracting {progress} of {files.length}…
          </span>
        )}
      </div>
    </>
  );
}
