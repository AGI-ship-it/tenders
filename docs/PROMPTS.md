# Prompts used to build the prototype

The prototype was built iteratively with Claude Code. These are the prompts given, grouped by phase and in the order they were used. Wording is lightly tidied for readability; screenshots that accompanied some prompts are described in brackets.

## 1. Stack and initial build

1. Set up the stack: Next.js + TypeScript + Tailwind, shadcn/ui, Motion, Lucide icons.
2. Build the prototype:

   > Act as a senior enterprise product designer and full-stack developer. Build a polished, clickable desktop web prototype called "AGFS Tender Intelligence" for Al Ghurair Facilities Solutions.
   >
   > **Goal:** demonstrate how an AI agent scans connected government and client tender portals, extracts new RFPs, evaluates opportunities against AGFS business criteria, prioritises the pipeline and routes bid/no-bid recommendations to Commercial and Bidding leadership.
   >
   > **Tech:** React, TypeScript, Tailwind CSS, shadcn/ui, Lucide icons. Use mock data and local state; no backend or live integrations required.
   >
   > **Design:** premium enterprise SaaS. White/light neutral surfaces, deep teal accents, sophisticated typography, compact tables, spacious layouts, polished hover states and subtle microinteractions. Left sidebar navigation.
   >
   > **Build five screens:** Dashboard (KPIs, Run AI Scan); Connected Sources (fictional, clearly simulated portals, Add Source); Opportunity Pipeline (sortable, filterable table); Tender Detail (RFP summary, eligibility, risks, evidence, explainable AI recommendation); Approval Center (send for approval, approve, reject, request changes, comments, audit trail).
   >
   > **Interactive demo:** Run AI Scan shows sequential progress (connecting, discovering, extracting, deduplicating, scoring) and adds three realistic but fictional UAE FM RFPs; open a high-fit opportunity, review the AI reasoning and submit for approval; switch to an approver role and decide; persist demo state in localStorage with Reset Demo; clear "Demo data / Simulated" indicators.
   >
   > **Important:** do not claim to access live government portals, authenticate into external services, download real tenders, calculate verified profit margins or submit real bids. Build working navigation and interactions, not static mockups.

3. Use case context [slide]: an AI bot scans government and client tender portals daily and pulls new RFPs into one pipeline; each is screened for relevance to AGFS services, geography and contract size with a decision-to-bid; outputs are an ordered pipeline and documented bid decisions; needed because bid teams are scarce and scanning and logging RFPs is manual.
4. Keep it simple; don't overwhelm with content. Clarity should come from the interaction.

## 2. Portal access and onboarding

5. What if some portals use a password, a CAPTCHA or UAE PASS? How do we handle that?
6. Instead of landing on the dashboard, offer first-time and returning-user options. *(Later simplified to a single Sign in, with first-time setup replayable via Reset demo.)*
7. Add Add source to the connect step of setup; show the same status as inside the app ("Ready" was confusing).
8. Mark portals the AI found and connected with an AI indicator.

## 3. Branding and visual design

9. Add Al Ghurair branding colours; use the design tokens file (Purple, Magenta, Teal, Grey, Orange, Gold, Green; SST Arabic; 4px spacing).
10. Use the Inter font.
11. Purple is a bit monotonous; break it up, use a white main area, remove hard lines on cards, add a very soft shadow.
12. Remove gradients; try background patterns; settle on a faint dotted background.
13. Move the user profile to the top right and remove the left sidebar.
14. Make KPI headings darker; make KPIs compact; fix overlapping tags.

## 4. Workflow and structure

15. Show the outputs and why they matter (ordered pipeline, documented bid decisions, scarce bid teams).
16. Remove the bid-capacity line for the first demo; keep it step by step.
17. Show the three steps (Scan Portal → Opportunities → Approval Center) on the landing page as large circles that switch the screen below, with the related numbers and a modern flow indicator.
18. Run the scan on screen; show results by source and new opportunities; Next moves to Opportunities; Sources opens in a side panel with Add source.
19. Show previous scan results; sign-in runs a scan automatically; re-runs find new opportunities.
20. Sources and Run AI Scan sit inside the scan card; the scan card and the opportunity page fit the window, with scrolling inside long sections.
21. Back from an opportunity returns to where it was opened.
22. Show bidding opens, due date, estimated value and the tender ID, with a way to open the original portal listing.

## 5. Meeting feedback (round 1)

23. Flow of screens: Prospect Scanning → Prospects Pipeline → Prospects for Prequalification.
24. In scanning, add a journey for adding and configuring a source portal with the login prompt (as in UAE PASS setup).
25. Revise the Approval Center around service-line HoDs, showing the prospects routed to each and their status.
26. Add a way to push a qualified prospect (a "lead") to Dynamics 365's lead management module.
27. Sources can be uploaded as a single file or multiple files.
28. Rename "prospects" to "opportunities".

## 6. Meeting feedback (round 2)

29. **Scope:** focus exclusively on tender-related opportunities; Dynamics 365 is the source of truth for leads and opportunities; broader prospect management is a separate future use case.
30. **Workflow:** the agent scans portals into a consolidated opportunity pipeline; AI performs the initial pre-qualification and scoring; HoDs validate before leads are uploaded to Dynamics 365.
31. **Prototype:** reflect the real workflow from scanning through approval; include dashboard, pipeline, approval and portal-configuration views; demonstrate the portal login and second-factor authentication prompts.
32. **Pre-qualification:** focus on service coverage, geography, contract size and ISO certifications; remove win probability, profit, delivery capacity and strategic value; approval views show HoD ownership, status and pre-qualification scores.

## 7. Publishing

33. Commit and push to GitHub; share the GitHub page; add a deploy workflow (GitHub Pages).
