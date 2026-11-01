import { toast } from "sonner";

/** Download rows as a CSV file and confirm with a toast. */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][], toastTitle: string) {
  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(toastTitle, { description: `${rows.length} prospects · CSV` });
}
