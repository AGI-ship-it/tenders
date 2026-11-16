"use client";

import { Mail } from "lucide-react";
import { PageHeader } from "@/components/shared";
import { MailboxSettings } from "@/components/mailbox-connect";
import { useDemo } from "@/lib/store";

/** Settings for the Bid Analyst. For now: the Outlook emails the AI reads for tenders. */
export function SettingsView() {
  const demo = useDemo()!;
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Where the AI looks for tenders." />
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <nav className="space-y-1 text-sm">
          <span className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 font-semibold text-primary">
            <Mail className="size-4" /> Emails
            <span className="ml-auto text-xs font-medium text-muted-foreground">{demo.mailboxes.length}</span>
          </span>
        </nav>
        <div className="min-w-0 rounded-2xl bg-card p-5 shadow-soft sm:p-6">
          <MailboxSettings />
        </div>
      </div>
    </div>
  );
}
