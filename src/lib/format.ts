export function formatAED(value: number, compact = true) {
  if (!compact) return `AED ${value.toLocaleString("en-US")}`;
  const m = value / 1_000_000;
  return `AED ${m >= 100 ? m.toFixed(0) : m.toFixed(1)}M`;
}

export function daysUntil(dateISO: string) {
  const end = new Date(`${dateISO}T23:59:59`);
  return Math.ceil((end.getTime() - Date.now()) / 86_400_000);
}

export function formatDate(dateISO: string) {
  return new Date(dateISO).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(iso: string | null) {
  if (!iso) return "Never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

/** Value as shown in lists: buyer-published, or marked as an AI estimate. */
export function formatValue(t: { valueAED: number; valueDisclosed?: boolean }) {
  return t.valueDisclosed === false ? `~${formatAED(t.valueAED)}` : formatAED(t.valueAED);
}
