# AGFS Tender Intelligence

A clickable prototype showing how an AI agent can scan government and client tender portals, rank the opportunities that fit Al Ghurair Facilities Solutions, route them to service-line Heads of Department for prequalification, and hand qualified ones to Dynamics 365 as leads.

**Live demo:** https://agi-ship-it.github.io/tenders/

> **Prototype with simulated data.** All portals, tenders, buyers, people, scores and integrations are fictional. Nothing connects to external portals, signs in to real services, downloads real tenders or submits bids. Demo state is saved in your browser.

## The flow

**Sign in → Scan Portal → Opportunities → Approval Center → D365**

1. **Scan Portal.** Signing in runs a scan across connected portals. You see each step (connect, discover, extract, deduplicate, score) and a live log, then the results by source. **Run again** finds new opportunities.
2. **Opportunities.** One ranked list across every portal. Open an opportunity to see the AI reasoning, then submit it for prequalification.
3. **Approval Center.** Opportunities are routed automatically to the HoD of their service line. The HoD prequalifies, requests changes or marks them not qualified.
4. **D365.** Prequalified opportunities are pushed to D365 Lead Management as leads (simulated).

## Highlights

- **Portal sign-in handled properly.** Public portals, password vault, UAE PASS approval on a named person's phone, and CAPTCHA portals read through email alerts. The agent never bypasses a login or CAPTCHA.
- **Add sources two ways.** Connect a portal through a short guided journey, or upload one or more RFP files.
- **Explainable AI.** The fit score is a weighted sum of six AGFS criteria (service, geography, contract size, eligibility, strategic value, capacity), with every point traceable. Win probability and margin band are shown separately and labelled as indicative.
- **Documented decisions.** A decision register (with CSV export) and a full audit trail of agent and human actions.
- **Roles.** Bid Analyst and Service-line HoD, switchable from the profile menu.

## Demo tips

- **Sign in** on a fresh demo discovers 3 new opportunities. Later sign-ins re-check portals and show what is already tracked.
- **Reset demo** (profile menu, top right) restores fresh data and replays first-time setup.
- A good path: open the Dubai health clinics opportunity, click **Why 92?**, **Submit for prequalification**, switch to **HoD**, **Prequalify**, then **Push to D365 as lead**.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Deploy

Every push to `main` runs `.github/workflows/deploy-pages.yml`, which builds a static export (`GITHUB_PAGES=true npm run build`) and publishes it to GitHub Pages.

## Tech

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Motion · Lucide icons. Colours follow the Al Ghurair design tokens. No backend: state lives in `localStorage`.

## Where things are

| Path | What |
| --- | --- |
| `src/lib/mock-data.ts` | Fictional portals, tenders, people and service-line HoDs |
| `src/lib/scoring.ts` | AGFS fit criteria, weights and recommendation rules |
| `src/lib/store.ts` | Demo state and actions (scan, submit, decide, push to D365) |
| `src/components/` | Scan panel, step circles, add-source journey, decision panel, D365 push |
| `src/app/` | Screens: welcome, setup, Scan Portal, Opportunities, Approval Center |
