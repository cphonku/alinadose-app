# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project overview

This repository holds the patient-facing **mobile app, Alinadose**, part of the
U Copenhagen iGEM 2026 project. It goes with the **Alinadose biosensor kit**.

Naming: **Alinadose** = the app and the biosensor test kit; use it in all UI text
and app config. **Lutealine** = the pill, a separate product of the overall
project; don't use it for the app or the kit. Internal code names (e.g.
`LutealineRepository`, storage keys, `lutealine.db`) are unchanged on purpose.

### Scientific background
Women with ADHD often have symptoms that vary across the menstrual cycle.
**Progesterone** is the marker we use. When progesterone is high, dopamine
tends to be lower and ADHD symptoms tend to be worse.

The biosensor is a **split-TEV protease** system. The N- and C-terminal halves
of split TEV are each fused to a progesterone-sensitive receptor. When
progesterone binds, the receptor dimerizes and TEV reassembles. TEV then cleaves
a specific amino-acid sequence and releases a reporter signal. The reporter
signal gives a quantitative measure of progesterone. The patient tests
**saliva or urine** and reads the reporter signal with the **smartphone camera**.

### What the app does
The app helps a patient with ADHD and their physician see how progesterone
levels relate to ADHD symptom severity and medication. It is used in two phases:

1. **Monitoring phase (1–2 cycles).** Each day the patient measures progesterone
   with the biosensor (the app reads the reporter signal from a camera image),
   fills in the ADHD symptom questionnaire, and logs the medication taken.
   There is no dosing plan yet.
2. **Treatment phase.** The physician reviews the combined data and agrees a
   personalized dosing plan with the patient. The plan is entered into the
   app, which then shows the dose for the current cycle day. The patient keeps
   logging data during this phase.

Showing the dose is a **separate feature** from logging data. The daily
logging flow must work fully without a dosing plan.

**Primary user:** the patient, who uses the app daily.
**Near-term goal:** a working demo at the iGEM Jamboree.

## Features

### In scope now (MVP)
- **Patient profile:** basic patient information (name or pseudonym, date of birth,
  typical cycle length, medication name). Collect only the minimum.
- **Accounts:** login flow. For the demo, a local or mock account is enough; build
  auth behind an interface so a real backend can replace it later.
- **Biosensor reading (dummy):** a `BiosensorService` interface with a mock
  implementation. The mock returns plausible synthetic reporter-signal values
  that follow the cycle (low progesterone in the follicular phase, a peak in
  the mid-luteal phase) and converts them to a progesterone concentration
  using a calibration curve. Each reading records the sample type
  (saliva/urine). The real camera-based readout comes later. Keep the
  interface stable so it can be swapped in, and keep the calibration
  parameters in one config file.
- **ADHD symptom questionnaire:** the short DIVA-inspired questionnaire
  (`docs/diva_questionnaire_short.md`, 14 questions). The markdown file is the
  source of truth; re-read it whenever you work on the questionnaire. The older
  long version is kept in `docs/diva_questionnaire_long.md` for reference.
  Current structure (scale 1–5):
  - Part 1 – Attention and organisation: 5 questions (`a1`–`a5`, merged DIVA O1–O9)
  - Part 2 – Inner restlessness and impulsivity: 4 questions (`h1`–`h4`, merged H/I 1–9)
  - Part 3 – Emotional regulation and daily functioning: 2 questions (`e1`–`e2`)
  - Medication questions (not symptoms): `medEffect` "My medication felt
    effective" (scale, reverse direction); `sideEffects` (yes/no);
    `sideEffectList` (multiple choice, only after "yes": trouble sleeping,
    heart racing, headaches, loss of appetite, nausea, anxiety, other + free text)
  Scoring (`scoreQuestionnaire` in `domain/scoring.ts`, questionnaire version 3):
  - Store every raw answer.
  - Each part gets an **average** (1–5). The **overall symptom score is the
    average of the three part averages**, so each part weighs the same.
    Higher = worse. `overallPercent` rescales it to 0–100 for charts.
  - The medication questions are never part of the symptom score; they are
    stored as separate fields.
  - Scores saved by version 2 (sums over 23 questions) are converted to averages
    by `symptomSummary`.
  Keep the questions in a data file (`src/content/`), not hard-coded in the UI.
  Ask before changing the wording.
- **Medication log:** the dose taken today, as part of the daily questionnaire.
- **Cycle tracking:** the patient logs period start dates; the app calculates the
  current cycle day and phase (follicular / ovulatory / luteal).
- **Dosing plan:** the physician's personalized plan, with a dose for **each
  specific day of the cycle**, made after the monitoring phase. The physician
  edits it **remotely** (physician portal → plan server → patient app; the
  patient confirms each new plan). The plan **adapts to the patient's actual
  cycle and period length** (see Behaviour decisions). Before a plan exists the
  app shows monitoring progress (e.g. "Cycle 1 of 2").
- **Cycle adjustments:** on the dosing screen the patient can set this cycle's
  expected length and the number of bleeding days; the plan follows.
- **Integrated daily record + overview:** one record per day (hormones,
  symptom score, medication, cycle day), with a simple timeline or chart view.

### Out of scope for now (but design for it)
- Sending patient data to the physician (the portal only edits plans).
- The real backend: hosting, physician accounts, encryption, consent. **Waiting for
  the team's GDPR measures** — don't pick a provider or add cloud storage before then.
- Sharing data with researchers.
- The real biosensor hardware integration.

To make these possible later, store data in a structured, versioned schema with
timestamps and stable IDs, behind a repository layer. Make export easy to add
(e.g. JSON/CSV).

## Tech stack

- **Expo SDK 57** (React Native 0.86, React 19), **TypeScript 6** (strict)
- Navigation: Expo Router, with routes in `src/app/`
- Storage: `expo-sqlite` behind `DocumentStore` / `LutealineRepository`;
  `expo-secure-store` for the demo account
- Charts: hand-drawn with `react-native-svg` (no chart library) in `src/ui/charts/`
- Fonts: Playfair Display (headings) + DM Sans (body) via `@expo-google-fonts`; icons: Ionicons
- Testing: Jest with the `jest-expo` preset
- Demo: run with Expo Go or a development build on a phone at the Jamboree

Expo changes a lot between SDK versions. Before using an Expo or React Native
API, check the docs for the installed version
(https://docs.expo.dev/versions/v57.0.0/). Add packages with
`npx expo install <pkg>`, never with plain `npm install <pkg>`, so the
versions match the SDK.

Node.js is installed through winget in the user profile. If `node` isn't on the PATH
in a shell, open a new terminal.

## Commands

```bash
npm install
npx expo start      # dev server (scan the QR code with Expo Go)
npm test            # Jest
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint (ESLint not configured yet; first run sets it up)
npx expo start --web  # browser preview (also: .claude/launch.json "lutealine-web")
npm run relay       # demo plan server on :8787 (also: launch.json "plan-relay")
```

**Remote plan demo:** run `npm run relay` and the web preview. Open `/physician`
(or "Physician portal (demo)" on the welcome screen) in one tab, the patient demo
in another (each browser tab has its own in-memory data, like two devices). The
demo patient's code is `DEMO-01`. For a phone with Expo Go, set
`EXPO_PUBLIC_PLAN_SERVER_URL=http://<laptop-ip>:8787` in `.env.local` (see
`.env.example`); without it, native builds have remote plans switched off.

The **web build is for previews only**: it uses in-memory storage (data and account
are lost on reload; `*.web.ts` files swap the implementations) and shows the app in
a 430 px phone-width column. Use "Explore the demo" on the welcome screen to load
demo data. In the browser preview tool, mobile/touch emulation stops Pressables from
receiving clicks, so test at desktop size.

## Project structure

```
src/
  app/                 Expo Router screens (every file is a route; no other code here)
    _layout.tsx        fonts, providers, auth/onboarding guards (Stack.Protected)
    welcome, auth, onboarding
    index.tsx          home: logo, profile avatar, 4 cards (sketch 1)
    dosing.tsx         cycle dial with the physician's plan (sketch 2)
    plan-review.tsx    patient reviews and confirms a plan sent by the physician
    plan-editor.tsx    DEMO: enter a plan on the patient's device
    physician.tsx      DEMO physician portal (web): open patient by code, publish plan
    log/               instructions → capture → questionnaire → finish (sketch 3)
    history.tsx        insight cards, timeline, cycle rings, phase bars
    news.tsx           PubMed articles
    profile.tsx        profile, period starts, export, demo tools
  ui/                  theme.ts (palette/fonts), components.tsx, DosingDial, charts/,
                       PlanEditorForm (shared by portal + device editor), PlanSyncStatus
  state/               AppContext (services, user, data, records), LogDraft
  content/
    questionnaire.ts   questionnaire items, mirrors docs/diva_questionnaire_short.md
    medications.ts     ADHD products: label rules per age group, from EU_ADHD_stimulant_dosing.xlsx (UNVERIFIED)
    testInstructions.ts  PLACEHOLDER test steps until the biosensor is designed
  domain/              pure logic, no React/Expo imports, all unit tested
    dates.ts, cycle.ts, scoring.ts, dosing.ts, dailyRecords.ts, export.ts, models.ts
  data/
    DocumentStore.ts   storage interface + in-memory store
    SqliteDocumentStore.ts  SQLite implementation + migrations (PRAGMA user_version)
    LutealineRepository.ts  the only API screens use for reading/writing data
    demoSeed.ts        synthetic demo data (2 monitoring cycles + active plan)
  services/
    appServices.ts / .web.ts  create services (SQLite+SecureStore / in-memory)
    buildServices.ts   wiring; swap mock biosensor / demo auth here
    biosensor/         BiosensorService, MockBiosensorService, calibration.ts (4PL curve)
    auth/              AuthService, DemoAuthService (single local account)
    news/pubmed.ts     PubMed E-utilities search (only the search term is sent)
    plans/             RemotePlanService interface, HttpRemotePlanService (REST),
                       MemoryRemotePlanService (tests), syncPlan (fetch → pending)
    photos.ts / .web.ts  saves test photos to app storage
server/plan-relay.mjs  DEMO plan server: Node http, in-memory, no auth, no dependencies
docs/                  questionnaire source, design notes
assets/                logo.png (transparent), app icons generated from the team logo
```

## Design

Based on the team's sketches (Word doc: home with 4 cards, circular dosing dial,
numbered test instructions) and the U Copenhagen iGEM 2026 wiki
(https://2026.igem.wiki/u-copenhagen/). Use the tokens in `src/ui/theme.ts`, never
raw colours. Series colours stay fixed across all charts: progesterone = teal,
symptoms = coral, medication = petal pink. Phases: period = coral, follicular =
green, ovulation = sand, luteal = petal. UI text is English.

## Behaviour decisions already made
- **Cycle:** the luteal phase is taken as 14 days, so ovulation = cycle
  length − 14. The ovulatory window is ovulation day ±1. The current cycle's
  length is the average of past logged cycles (15–60 days), falling back to the
  profile's typical length.
- **Cycle length & period length:** the running cycle uses the patient's
  `CycleAdjustment.expectedLength` if set, else the average of past cycles, else
  the typical length. Logged cycles always use their real length. Bleeding days:
  adjustment → `profile.typicalPeriodLength` → 5.
- **Plan adaptation** (`mapToPlanDay` in `domain/dosing.ts`), chosen by the
  physician per plan:
  - `phaseAnchored` (default): three segments. Bleeding days 1..M map onto plan
    days 1..Mp; follicular days stretch/shrink onto the plan's follicular days;
    the **last 14 days (luteal) map onto the plan's last 14 days**, counted back
    from the expected next period. Days after the expected end (late period) use
    `doseBeyondPlan`, or "contact your physician" if it is null.
  - `fixedDays`: cycle day N = plan day N (v1 plans are normalized to this).
  The app only *maps* days; every dose value is the physician's.
- **Dose limits** (`src/content/medications.ts`): one entry per product, with
  strengths, dose step, start dose, titration step and label maximum **per age
  group** (adult / 6–17). Stimulants come from the team's
  `EU_ADHD_stimulant_dosing.xlsx` (keep the two in sync); atomoxetine and
  guanfacine were added separately. Maximum kinds: mg, per-kg with a cap
  (Medikinet: 1 mg/kg, never > 80 mg; weight is entered in the editor and NOT
  stored or sent), not licensed for the age group, not checked, not stated.
  All entries are **unverified** until the team checks them against the Danish
  labels (`verified: true` then). The editor only *warns*: doses above the
  maximum, or any dose of a product not licensed for the age group, need a
  written `overLimitReason`, which is shown to the patient. Plans store a
  snapshot (`ageGroup`, `labelMaxDailyDose`, `notLicensedForAgeGroup`).
- **Titration:** the product's usual titration step is the default "change by
  mg" amount; raising a day by more than it (vs the current plan) shows an
  information note, without blocking.
- **Dose adjustments** (`adjustDose` in `domain/dosing.ts`): the physician editor
  can set days to a dose, change them by mg, or by % (5 % steps), for a range of
  days or per day (the per-day + / − buttons step by one dose step or by a %).
  Results are rounded to the medication's dose step, never go below 0, and are
  not capped. "Set to" and mg changes round to the nearest step; **% changes
  round toward the change** (up for increases, down for decreases), so a small
  % always moves the dose at least one step (20 mg + 10 % = 22 → 30 mg on a
  10 mg step). The editor shows the exact value and the resulting change.
- **Plan lifecycle:** `pending` (received from the physician) → patient taps
  "I have read my new plan" → `active` from that day; the previous plan becomes
  `archived`. A newer remote plan replaces an unconfirmed one. Remote plans are
  de-duplicated by `publishedAt` (a restarted relay counts versions from 1 again).
  The app checks for plans on start, when it returns to the foreground, and via
  "Check for plan updates".
- **Patient code:** `profile.shareCode` ("LUT-XXXXX", demo: `DEMO-01`) is the only
  identifier sent to the plan server.
- **One entry per day:** saving the questionnaire or the medication log again
  for the same date replaces the earlier entry. Several biosensor readings per
  day are allowed; daily records show the latest one.
- **Calibration:** the values in `services/biosensor/calibration.ts` are
  PLACEHOLDERS until the wet lab has real calibration data. Saliva uses
  pg/mL; urine uses ng/mL (PdG).
- **Plan start:** a saved plan is valid from the day it is entered; earlier days
  stay "monitoring" in the records.
- **History insights** (correlation, phase averages) use monitoring days only, once
  there are at least 10, so the medication changes don't blur the hormone/symptom link.
- **Camera:** the photo is saved with the reading, but the value still comes from the
  mock biosensor. Replace the measure step in `log/capture.tsx` with image analysis
  once the biosensor exists. "Use a simulated test" is the fallback without a camera.
- **Demo data:** "today" is cycle day 20 of the first treatment cycle
  (mid-luteal, highest dose) and is left unlogged so it can be logged live.

## Conventions

- Keep domain logic (`src/domain/`) as pure, UI-free functions with unit tests.
  The cycle-day calculation, questionnaire scoring and dose lookup must have tests.
- Hardware, auth and storage go behind interfaces with mock implementations.
- Make the UI accessible and calm. Many users have ADHD, so keep the daily
  entry quick: few taps, clear progress, and reminders that are easy to act on.
- Don't add new dependencies without a clear reason.
- Run the type check, lint and tests before calling a task done.

## Health data & privacy

The app handles sensitive health data (ADHD symptoms, medication, menstrual cycle).
- Patient data stays on the device. Don't use analytics, crash reporters or
  network calls with patient data. The only network traffic is PubMed searches
  and plan sync (patient code + plan, no health data).
- **GDPR measures are being drafted by the team.** Storage location, security
  (encryption at rest/in transit, auth), and consent to data storage will be
  decided with them. Until then: keep the relay demo-only and synthetic, and
  don't add cloud services.
- Use only synthetic data in the repo, tests, seed data and demo builds.
- The app is a research and demonstration project, **not a medical device**.
  It shows the dose the physician prescribed. It must never calculate,
  suggest or change doses on its own. Include a disclaimer.

## iGEM context

- **Positioning:** the code is open source and the project is not going to be
  sold. At the Jamboree, though, it is presented *as a sellable product*.
  The app should look and feel like a polished consumer health product:
  consistent branding ("Alinadose"), onboarding, clean visuals and a smooth
  demo flow. Prioritize demo polish over unseen infrastructure.
- **Demo mode:** include a way to seed realistic synthetic data covering
  2 monitoring cycles plus an active dosing plan, so the history and charts look meaningful during the
  presentation.
- The software must be open source (OSI license, e.g. MIT) and documented
  well enough for future teams to reuse it.
- Keep the README current: purpose, setup, and the feature list for judging.
- **Deadline: about one week (target 2026-10-19).** Scope accordingly. A
  working, polished demo of the core flow (log reading → questionnaire →
  today's dose → history chart) comes before extra features.
