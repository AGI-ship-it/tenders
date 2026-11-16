# AGFS Tender Intelligence

A clickable prototype of the to-be **lead-to-opportunity** process in four screens: tenders arrive in the shared sales mailbox, the AI spots them, pulls out the details and prepares a **lead draft** for every tender; the Bid Analyst checks each draft and **pushes it to Dynamics 365** (manual push), AI prequalifies the lead, and VP Commercial approves it, which creates the D365 opportunity and hands it to the bidding agent.

**Live demo:** https://agi-ship-it.github.io/tenders/

> **Prototype with simulated data.** All portals, tenders, buyers, people, scores and integrations are fictional. Nothing connects to external portals, signs in to real services, downloads real tenders or submits bids. Demo state is saved in your browser.

## The flow

**Tender discovery → D365 lead → Lead pipeline → Approvals → D365 opportunity**

1. **Tender discovery** (`/inbox`). The Bid Analyst signs in as **First time** or **Returning**. *First time* starts the demo fresh: connect one or more **Outlook (Microsoft 365) mailboxes** (enter the mailbox's email address, e.g. the shared sales@, then choose the folders to read; read-only, simulated), then **Add another email address** or **Start reading**. During this setup only the connection shows (no step counters or menu links). On large screens the four steps are a vertical rail on the left, each tagged *AI · automated* or *Person decides*; during the run, the AI's sub-steps (scan, spot, read attachments, analyze, match, create leads, prequalify) nest under Tender discovery with Done / Running / Queued states. *Returning* users already have their mailboxes connected (sales@ and tenders@ on a fresh demo) and manage them in **Settings** (profile menu, or **Mailboxes** on the first screen): add more email addresses, change folders, or disconnect. Then, on each sign-in the AI runs over the connected mailboxes, shown live: emails fly from an *Incoming* stack into lanes (**Tenders → D365 leads**, **Already a lead**; everyday mail is quietly set aside), while a band of brighter dots sweeps across the background, it reads attachments, pulls out each tender's details (client, tender no., scope, dates, fees, NDA, site visit), stamps the new D365 lead number and the AI pre-qualification. **Every tender gets a lead draft**; emails it is unsure about still get one, flagged "please check"; a tender that is already a lead is linked, not duplicated. The results list each new lead (open it to see the email and where each detail came from). Every email is tagged with the mailbox it arrived in (`sales@`, `tenders@`, …), and with several mailboxes the results can be filtered by mailbox. **Run again** replays it.
2. **D365 lead** (`/lead`). The lead draft the AI prepared, shown as a D365 form (nothing is in D365 yet): topic, client, tender no., service, emirate, date bid received, opening and closing dates, scope, and the actions it found (anything it was unsure of is flagged). The Bid Analyst corrects anything and clicks **Create lead in D365**: the lead number is given then, the AI prequalifies it and it goes to VP Commercial. Or **Not a tender** with a reason (newsletter, supplier offer, existing-contract mail, already a lead, other): no lead is created and the reason teaches the AI. Every draft ends one of these two ways.
3. **Lead pipeline** (`/pipeline`). Every case in every status, with status tabs and counts: Draft, BD Head review, Awaiting HoD, Opportunity created, Rejected and Not a tender. Drafts show "No lead yet" and open the review screen. Columns: with lead ID, tender, scope, service, the AI pre-qualification (Yes / No) and status. Open a lead to see the pre-qualification rationale.
4. **Approvals** (`/approvals`). When the Bid Analyst creates the lead it goes to the **BD Head** (Romulo Panes, VP Commercial), who can **approve directly** (this converts the lead into a **D365 opportunity** and hands it to the bidding agent), **reject**, or first **ask the service line's HoD** whether they are interested. The **HoD** signs in, replies **Interested / Not interested** (within 24 hours, with reminders), and the lead goes back to the BD Head to decide. Every response is logged on the D365 lead. The approval chain shows each step; an **HoD tracker** tab lists every HoD request with its SLA, response and reminders. "Not interested" is advisory: the BD Head can still approve.

Statuses: **Draft → BD Head review → (Awaiting HoD, if the BD Head asks) → Opportunity created / Rejected**; a dismissed draft is **Not a tender** (never in D365).

Portal scanning is out of phase one. The Scan Portal and Portal Registry screens are still in the code (`/sources`, `/portals`) but are not linked.

## Pre-qualification

The AI pre-qualification score (0 to 100) is a weighted sum of three criteria, each traceable on the lead page:

| Criterion | Weight |
| --- | --- |
| Service coverage | 50% |
| Geography | 25% |
| ISO certifications | 25% |

A missing ISO certificate or unmet mandatory requirement means "Bid with conditions" at best. AI priority (High / Medium / Low) weighs the score against how soon the tender closes. Weights and AGFS's ISO list are in `src/lib/scoring.ts` and are to be refined with Commercial.

## Demo tips

- Suggested path: sign in as **Bid Analyst** (**First time** to show connecting mailboxes, **Returning** to go straight to the run) → watch the AI sort the mailboxes → on the Dubai health clinics lead, **Review & create lead** → check the form → **Create lead in D365** → log out and sign in as **BD Head** → open the lead → **Ask Omar Rahman (HoD) first** → log out and sign in as **Head of Department** (pick Omar) → **Interested** → sign in as **BD Head** again → **Approve** (opportunity created).
- Signed in as Bid Analyst, **Preview email** in Approvals shows the email the BD Head receives.
- **Reset demo** (profile menu) restores fresh data.

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
| `src/lib/mock-data.ts` | Fictional portals, tenders, people (Bid Analyst, BD Head / VP Commercial, service-line HoDs), extracted actions, history |
| `src/lib/scoring.ts` | Pre-qualification criteria, weights, AGFS ISO list and recommendation rules |
| `src/lib/store.ts` | Demo state and actions (create lead from draft, dismiss draft, ask HoD, HoD reply, approve / reject) |
| `src/app/inbox/` | Screen 1: tender alert inbox |
| `src/app/lead/` | Screen 2: D365 lead form |
| `src/app/pipeline/` | Screen 3: Lead Pipeline |
| `src/app/approvals/` | Screen 4: Approvals (BD Head decides, asking an HoD if needed), approval register and HoD tracker |
| `src/app/settings/`, `src/components/mailbox-connect.tsx` | Settings: connect Outlook mailboxes by email address, folders, add more |
| `src/components/decision-panel.tsx` | Approval chain, asking the HoD, the HoD's reply (24 h), the BD Head's decision, D365 lead and opportunity |
