"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Mail } from "lucide-react";
import { toast } from "sonner";
import type { Source, Tender } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ACCESS_INFO } from "@/components/access";

export function portalDeepLink(source: Source | undefined, tender: Tender): string | null {
  if (!source || !source.url.startsWith("http")) return null;
  return `${source.url.replace(/\/$/, "")}/tender/${encodeURIComponent(tender.sourceRef)}`;
}

/** Hands the user over to the original portal listing, with the reference ready to paste. */
export function PortalLinkButton({ tender, source }: { tender: Tender; source: Source | undefined }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = portalDeepLink(source, tender);
  const needsSignIn = source && source.access !== "Public";

  async function copyRef() {
    try {
      await navigator.clipboard.writeText(tender.sourceRef);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("Copy not available in this browser");
    }
  }

  return (
    <>
      <Button variant="outline" size="lg" onClick={() => setOpen(true)}>
        <ExternalLink /> Open on portal
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open original tender</DialogTitle>
            <DialogDescription>
              Go to {source?.name ?? "the source"} to read the full RFP pack or submit the bid.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
              <div>
                <div className="text-[11px] text-muted-foreground">Portal tender ID</div>
                <div className="font-mono text-sm font-medium">{tender.sourceRef}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={copyRef}>
                {copied ? <Check className="text-emerald-600" /> : <Copy />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            {link ? (
              <div className="rounded-lg border px-3 py-2.5">
                <div className="text-[11px] text-muted-foreground">Link</div>
                <div className="truncate font-mono text-xs">{link}</div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-muted-foreground">
                <Mail className="size-4" /> Received as an email invitation. Open it from the tenders mailbox.
              </div>
            )}

            {needsSignIn && source && (
              <p className="text-xs text-muted-foreground">
                This portal uses {ACCESS_INFO[source.access].label}. You may be asked to sign in.
              </p>
            )}
            <p className="text-xs text-muted-foreground">Demo portals are fictional, so the link won’t load a real page.</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {link && (
              <Button
                nativeButton={false}
                render={<a href={link} target="_blank" rel="noopener noreferrer" />}
                onClick={() => setOpen(false)}
              >
                <ExternalLink /> Open portal
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
