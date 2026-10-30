# AGFS Tender Intelligence

A clickable prototype showing how an AI agent can scan government and client tender portals, rank the opportunities that fit Al Ghurair Facilities Solutions, route them to service-line Heads of Department for prequalification, and hand qualified ones to Dynamics 365 as leads.

**Live demo:** https://agi-ship-it.github.io/tenders/

> **Prototype with simulated data.** All portals, tenders, buyers, people, scores and integrations are fictional. Nothing connects to external portals, signs in to real services, downloads real tenders or submits bids. Demo state is saved in your browser.

## The flow

**Scan → Pipeline → HoD validation → D365**

1. **Scan.** Signing in runs a scan across connected portals: connect, discover, extract, deduplicate, score, with a live log, then results by source. **Run AI Scan** finds new tender opportunities.
2. **Pipeline.** One consolidated, ranked list of tender opportunities. AI performs the initial pre-qualification and scoring; open any opportunity to see why.
3. **Approvals.** Each opportunity is routed to the HoD of its service line, who validates the AI recommendation: prequalify, request changes or mark not qualified.
4. **D365.** Only HoD-validated opportunities are uploaded to Dynamics 365 Lead Management as leads (simulated). D365 remains the source of truth for leads and opportunities.

Views: **Dashboard** (scan and workflow overview), **Pipeline**, **Approvals** and **Portal configuration**.

## Pre-qualification

The AI pre-qualification score (0 to 100) is a weighted sum of four criteria, each traceable on the opportunity page:

| Criterion | Weight |
| --- | --- |
| Service coverage | 40% |
| Geography | 20% |
| Contract size | 20% |
| ISO certifications | 20% |

Contracts below AED 5M are always a no-bid. A missing ISO certificate or unmet mandatory requirement means "Bid with conditions" at best. Weights and AGFS's ISO list are in `src/lib/scoring.ts` and are to be refined with Commercial.

## Portal access

- **Public** portals are read automatically.
- **Password** portals: a person signs in once, including the portal's **two-step verification code**; credentials go to a vault the agent never sees.
- **UAE PASS** portals: a named person approves sign-in on their phone.
- **CAPTCHA** portals: the agent never solves CAPTCHAs; it reads the portal's email alerts instead.
- Sources can also be **RFP files uploaded** one at a time or several at once.

## Demo tips

- **Sign in** on a fresh demo discovers 3 new opportunities; later sign-ins re-check portals.
- On **Portals**, sign in to *Ajman e-Procurement Portal* to see a portal login with two-step verification, and to *Federal e-Procurement Portal* for UAE PASS.
- Suggested path: open the Dubai health clinics opportunity → **Submit for prequalification** → switch to **HoD** (profile menu) → **Prequalify** → **Push to D365 as lead**.
- **Reset demo** (profile menu) restores fresh data and replays first-time setup.

The prompts used to build the prototype are in [`docs/PROMPTS.md`](docs/PROMPTS.md).

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
| `src/lib/scoring.ts` | Pre-qualification criteria, weights, AGFS ISO list and recommendation rules |
| `src/lib/store.ts` | Demo state and actions (scan, submit, decide, push to D365) |
| `src/components/` | Scan panel, step circles, add-source journey, decision panel, D365 push |
| `src/app/` | Screens: sign-in, setup, Dashboard, Scan, Pipeline, opportunity detail, Approvals, Portal configuration |
