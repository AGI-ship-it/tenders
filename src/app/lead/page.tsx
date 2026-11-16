"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Draft review now sits beside the draft list in the inbox; old links land there. */
export default function LeadPage() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  useEffect(() => {
    router.replace(id ? `/inbox?id=${encodeURIComponent(id)}` : "/inbox");
  }, [id, router]);
  return null;
}
