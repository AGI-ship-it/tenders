import { TenderDetail } from "./tender-detail";

// Detail content is read from client-side demo state, so there is nothing to prerender.
export const instant = false;

export default function TenderDetailPage() {
  return <TenderDetail />;
}
