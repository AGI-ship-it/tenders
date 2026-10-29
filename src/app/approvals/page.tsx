import { ApprovalsView } from "./approvals-view";

// Content is rendered from client-side demo state, so there is nothing to prerender.
export const instant = false;

export default function ApprovalsPage() {
  return <ApprovalsView embedded />;
}
