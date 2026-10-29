import { WelcomeView } from "./welcome-view";

// Content is rendered from client-side demo state, so there is nothing to prerender.
export const instant = false;

export default function WelcomePage() {
  return <WelcomeView />;
}
