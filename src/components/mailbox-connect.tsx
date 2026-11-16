"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Check, Lock, Mail, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { connectMailbox, disconnectMailbox, setMailboxFolders, useDemo } from "@/lib/store";
import { MAILBOX_ADDRESS, TENDERS_ADDRESS } from "@/lib/mailbox";
import { PEOPLE } from "@/lib/mock-data";
import { timeAgo } from "@/lib/format";
import type { MailboxConnection } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/** Outlook folders the agent can read. */
export const OUTLOOK_FOLDERS = [
  { name: "Inbox", hint: "Where portal alerts and client emails arrive" },
  { name: "Inbox / Tenders", hint: "Tender alerts filed by an Outlook rule" },
  { name: "Junk Email", hint: "Portal alerts sometimes land here" },
  { name: "Archive", hint: "Older, filed mail" },
  { name: "Sent Items", hint: "Replies AGFS has sent" },
];
const DEFAULT_FOLDERS = ["Inbox", "Inbox / Tenders"];

const ANALYST_EMAIL = `${PEOPLE.analyst.name.toLowerCase().replace(/\s+/g, ".")}@agfs.demo.example`;

/** What the agent reads, said once wherever folders are chosen. */
const READ_NOTE = "The agent reads emails from the last 30 days, then new ones every 15 minutes, with PDF, DOCX and XLSX attachments.";

/** An Outlook-blue tile standing in for the mailbox, so it reads as Outlook without using its logo. */
function MailTile({ kind }: { kind: MailboxConnection["kind"] }) {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#0f6cbd] text-white shadow-sm">
      {kind === "Shared" ? <Users className="size-5" /> : <Mail className="size-5" />}
    </span>
  );
}

function FolderPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-2">
      {OUTLOOK_FOLDERS.map((f) => {
        const on = value.includes(f.name);
        return (
          <label
            key={f.name}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 ring-1 transition-colors",
              on ? "bg-secondary/60 ring-primary/30" : "bg-card ring-border hover:bg-muted/40",
            )}
          >
            <Checkbox checked={on} onCheckedChange={(c) => onChange(c ? [...value, f.name] : value.filter((x) => x !== f.name))} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{f.name}</span>
              <span className="block text-xs text-muted-foreground">{f.hint}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

type ConnectStep = "start" | "mailbox" | "folders";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Connecting an Outlook mailbox, step by step: enter the mailbox's email address, then choose the folders to read. */
export function MailboxConnect({
  onConnected,
  onCancel,
  startAt = "start",
}: {
  /** Called with the mailbox just connected. */
  onConnected: (m: Pick<MailboxConnection, "address" | "kind" | "folders">) => void;
  onCancel?: () => void;
  startAt?: ConnectStep;
}) {
  const demo = useDemo()!;
  const taken = new Set(demo.mailboxes.map((m) => m.address));
  const total = 2;
  const [step, setStep] = useState<ConnectStep>(startAt);
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [folders, setFolders] = useState(DEFAULT_FOLDERS);
  const address = email.trim().toLowerCase();
  const valid = EMAIL_RE.test(address);
  const already = taken.has(address);
  const kind: MailboxConnection["kind"] = address === ANALYST_EMAIL ? "Personal" : "Shared";
  const error = !touched ? "" : !address ? "Enter the email address." : !valid ? "That doesn't look like an email address." : already ? "This email is already connected." : "";
  const suggestions = [MAILBOX_ADDRESS, TENDERS_ADDRESS, ANALYST_EMAIL].filter((a) => !taken.has(a));

  function next() {
    setTouched(true);
    if (!valid || already) return;
    setStep("folders");
  }

  function finish() {
    const conn = { address, kind, folders };
    connectMailbox(conn);
    toast.success(`Connected ${address}`, { description: `Reading ${folders.join(", ")} · simulated` });
    onConnected(conn);
  }

  const back = (to: ConnectStep | "cancel") => (
    <button
      onClick={() => (to === "cancel" ? onCancel?.() : setStep(to))}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary"
    >
      <ArrowLeft className="size-3.5" /> Back
    </button>
  );
  const stepLabel = (n: number) => <div className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Step {n} of {total}</div>;

  return (
    <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="w-full">
      {step === "start" && (
        <div className="flex flex-col items-center text-center">
          <MailTile kind="Shared" />
          <h2 className="mt-5 text-xl font-bold tracking-tight text-primary">Connect the sales email</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Connect the Outlook (Microsoft 365) address tenders arrive in. The AI reads it and prepares a lead draft for
            each tender.
          </p>
          <Button size="xl" className="mt-6" onClick={() => setStep("mailbox")}>
            <Mail /> Connect Outlook email
          </Button>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" /> Read-only. The agent never sends, deletes or moves email.
          </p>
        </div>
      )}

      {step === "mailbox" && (
        <form
          className="mx-auto max-w-md space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
        >
          {onCancel && startAt === "mailbox" ? back("cancel") : back("start")}
          <div>
            {stepLabel(1)}
            <h2 className="mt-1 text-lg font-bold text-primary">Which email do tenders arrive in?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Usually a shared address such as sales@; your own works too.
            </p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Email address</span>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                aria-invalid={!!error}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => email && setTouched(true)}
                placeholder="e.g. sales@yourcompany.com"
                className="h-11 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
              />
            </div>
            {error ? (
              <span className="block text-xs text-rose-600">{error}</span>
            ) : valid && !already ? (
              <span className="flex items-center gap-1 text-xs text-emerald-700">
                <Check className="size-3.5" /> {kind === "Personal" ? "Your email" : "Shared email"} · you&apos;ll choose its folders next
              </span>
            ) : null}
          </label>
          {suggestions.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">Suggestions</div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      setEmail(a);
                      setTouched(false);
                    }}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs ring-1 transition-colors",
                      address === a ? "bg-secondary font-semibold text-primary ring-primary/40" : "bg-card ring-border hover:bg-muted",
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Button type="submit" size="lg" className="w-full">
            Next: choose folders
          </Button>
        </form>
      )}

      {step === "folders" && (
        <div className="mx-auto max-w-lg space-y-4">
          {back("mailbox")}
          {stepLabel(total)}
          <div className="flex items-center gap-3">
            <MailTile kind={kind} />
            <div className="min-w-0">
              <div className="truncate font-semibold">{address}</div>
              <div className="text-sm text-muted-foreground">Choose the folders to read.</div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{READ_NOTE}</p>
          <FolderPicker value={folders} onChange={setFolders} />
          <Button size="xl" onClick={finish} disabled={!folders.length}>
            Read these folders
          </Button>
        </div>
      )}
    </motion.div>
  );
}

/** Connected mailboxes: add more email addresses, change folders, or disconnect. Used on the Settings page. */
export function MailboxSettings() {
  const demo = useDemo()!;
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary">Connected emails</h2>
          <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
            The AI reads these for tenders and prepares a lead draft for each one. It only reads, never sends. Add every address tenders arrive in.
          </p>
        </div>
        {!adding && (
          <Button size="lg" onClick={() => setAdding(true)}>
            <Plus /> Add email address
          </Button>
        )}
      </div>

      {adding && (
        <div className="rounded-2xl bg-card p-6 ring-1 ring-primary/20">
          <MailboxConnect
            startAt="mailbox"
            onConnected={() => setAdding(false)}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {demo.mailboxes.map((m) => (
        <ConnectedMailbox key={m.address} m={m} />
      ))}
      {demo.mailboxes.length === 0 && !adding && (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No email connected yet. Add the address tenders arrive in.
        </p>
      )}
    </div>
  );
}

function ConnectedMailbox({ m }: { m: MailboxConnection }) {
  const [folders, setFolders] = useState(m.folders);
  const [editing, setEditing] = useState(false);
  const changed = folders.slice().sort().join("|") !== m.folders.slice().sort().join("|");
  return (
    <div className="space-y-4 rounded-2xl bg-card p-5 ring-1 ring-border">
      <div className="flex items-center gap-3">
        <MailTile kind={m.kind} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{m.address}</div>
          <div className="text-xs text-muted-foreground">
            {m.kind} email · connected by {m.connectedBy} {timeAgo(m.connectedAt).toLowerCase()}
          </div>
        </div>
        <button
          onClick={() => {
            disconnectMailbox(m.address);
            toast(`Disconnected ${m.address}`);
          }}
          className="shrink-0 text-sm font-medium text-muted-foreground hover:text-rose-700"
        >
          Disconnect
        </button>
      </div>
      {editing ? (
        <>
          <p className="text-sm text-muted-foreground">Choose the folders to read. {READ_NOTE}</p>
          <FolderPicker value={folders} onChange={setFolders} />
          <div className="flex items-center gap-2">
            <Button
              size="lg"
              disabled={!changed || !folders.length}
              onClick={() => {
                setMailboxFolders(m.address, folders);
                setEditing(false);
                toast.success("Folders updated", { description: `Reading ${folders.join(", ")}` });
              }}
            >
              Read these folders
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                setFolders(m.folders);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-4 py-3 text-sm">
          <span className="min-w-0">
            <span className="text-muted-foreground">Reading </span>
            <span className="font-medium">{m.folders.join(", ")}</span>
          </span>
          <button onClick={() => setEditing(true)} className="shrink-0 text-sm font-semibold text-primary hover:underline">
            Change folders
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * First-time setup on the first screen: connect one mailbox or several, then start the AI's first run. After each
 * mailbox it shows what is connected, with the option to add another email address.
 */
export function MailboxOnboarding({ onStart }: { onStart: () => void }) {
  const demo = useDemo()!;
  const [adding, setAdding] = useState(false);
  const boxes = demo.mailboxes;

  if (boxes.length === 0) return <MailboxConnect onConnected={() => setAdding(false)} />;
  if (adding) return <MailboxConnect startAt="mailbox" onConnected={() => setAdding(false)} onCancel={() => setAdding(false)} />;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-lg space-y-4">
      <div>
        <div className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Emails to read</div>
        <h2 className="mt-1 text-lg font-bold text-primary">
          {boxes.length === 1 ? "1 email connected" : `${boxes.length} emails connected`}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Do tenders also arrive somewhere else, such as tenders@ or your own email? Add it now, or later in Settings.
        </p>
      </div>
      <ul className="space-y-2">
        {boxes.map((m) => (
          <li key={m.address} className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-border">
            <MailTile kind={m.kind} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{m.address}</div>
              <div className="truncate text-xs text-muted-foreground">
                {m.kind} · reading {m.folders.join(", ")}
              </div>
            </div>
            <button
              onClick={() => disconnectMailbox(m.address)}
              className="shrink-0 text-xs font-medium text-muted-foreground hover:text-rose-700"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={() => setAdding(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-secondary/50"
      >
        <Plus className="size-4" /> Add another email address
      </button>
      <Button size="xl" className="w-full" onClick={onStart}>
        Start reading {boxes.length === 1 ? "1 email" : `${boxes.length} emails`}
      </Button>
    </motion.div>
  );
}
