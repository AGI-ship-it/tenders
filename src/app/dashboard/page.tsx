import { redirect } from "next/navigation";

// The dashboard was replaced by the step tabs; Opportunity Scanning is the landing page.
export default function DashboardPage() {
  redirect("/sources");
}
