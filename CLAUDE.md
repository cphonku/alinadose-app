# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project overview

**Lutealine** is an iGEM project. This repository holds the patient-facing
**mobile app** that goes with the Lutealine biosensor.

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
- **ADHD symptom questionnaire:** the "Daily Functioning Questionnaire"
  (`docs/diva_questionnaire.md`), based on DIVA. The markdown file is the source
  of truth; re-read it whenever you work on the questionnaire. Current structure:
  - Part 1 – Attention and organisation (O1–O9), 9 items, scale 1–5
  - Part 2 – Inner restlessness and impulsivity (H/I 1–9), 9 items, scale 1–5
  - Part 3 – Emotional regulation and daily functioning:
    - items 1–5: symptom items, scale 1–5
    - item 6: "My medication felt effective", scale 1–5, reverse direction
    - item 7: adverse side effects, yes/no
    - item 8: shown only if item 7 = yes. Multiple choice: trouble sleeping,
      heart racing, headaches, loss of appetite, nausea, anxiety, other
      (with a free-text field for "other")
  Scoring:
  - Store every raw answer.
  - Calculate subscores for Part 1, Part 2 and Part 3 items 1–5, plus a total
    symptom score (higher = worse).
  - Store medication effectiveness (item 6) and side effects (items 7–8) as
    separate fields, not part of the symptom score.
  Keep the questions in a data file (`src/content/`), not hard-coded in the UI.
  Ask before changing the wording.
- **Medication log:** the dose taken today, as part of the daily questionnaire.
- **Cycle tracking:** the patient logs period start dates; the app calculates the
  current cycle day and phase (follicular / ovulatory / luteal).
- **Dosing plan:** the physician's personalized plan, with a dose for **each
  specific day of the cycle**, made after the monitoring phase. For now the plan
  is entered in the app (e.g. a settings screen, or demo seed data); later it
  will come from the physician. When a plan exists, the home screen shows
  today's prescribed dose. Before that, it shows monitoring progress
  (e.g. "Cycle 1, day 12 of monitoring"). Decide and document how the plan
  handles cycles longer or shorter than the plan.
- **Integrated daily record + overview:** one record per day (hormones,
  symptom score, medication, cycle day), with a simple timeline or chart view.

### Out of scope for now (but design for it)
- Sending data to the physician.
- Sharing data with researchers.
- The real biosensor hardware integration.

To make these possible later, store data in a structured, versioned schema with
timestamps and stable IDs, behind a repository layer. Make export easy to add
(e.g. JSON/CSV).

## Tech stack

- **Expo SDK 57** (React Native 0.86, React 19), **TypeScript 6** (strict)
- Navigation: Expo Router, with routes in `src/app/` (not built yet)
- Storage: `expo-sqlite` behind `DocumentStore` / `LutealineRepository`;
  `expo-secure-store` for the demo account
- Charts: not chosen yet (decide together with the UI design)
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
```

## Project structure

```
src/
  app/                 Expo Router screens (to do, waiting on UI design)
  components/          reusable UI (to do)
  content/
    questionnaire.ts   questionnaire items, mirrors docs/diva_questionnaire.md
  domain/              pure logic, no React/Expo imports, all unit tested
    dates.ts           ISO-date helpers ("YYYY-MM-DD", local calendar dates)
    cycle.ts           cycle day, phase and length estimation, next-period prediction
    scoring.ts         questionnaire visibility, validation and scoring
    dosing.ts          dose lookup from the physician's plan, plan validation
    dailyRecords.ts    combined daily records, monitoring/treatment status, phase summary, correlation
    export.ts          CSV export of daily records
    models.ts          persisted record types
  data/
    DocumentStore.ts   storage interface + in-memory store (tests)
    SqliteDocumentStore.ts  SQLite implementation + migrations (PRAGMA user_version)
    LutealineRepository.ts  the only API screens use for reading/writing data
    demoSeed.ts        synthetic demo data (2 monitoring cycles + active plan)
  services/
    appServices.ts     creates the real services; swap implementations here
    biosensor/         BiosensorService, MockBiosensorService, calibration.ts (4PL curve)
    auth/              AuthService, DemoAuthService (single local account)
docs/                  questionnaire source, design notes
```

### Behaviour decisions already made
- **Cycle:** the luteal phase is taken as 14 days, so ovulation = cycle
  length − 14. The ovulatory window is ovulation day ±1. The current cycle's
  length is the average of past logged cycles (15–60 days), falling back to the
  profile's typical length.
- **Dosing plan:** cycle day N maps to plan day N. In cycles longer than the
  plan, the app shows the physician's `doseBeyondPlan`, or "contact your
  physician" if none was given. Saving a new plan deactivates the old one
  (kept for history).
- **One entry per day:** saving the questionnaire or the medication log again
  for the same date replaces the earlier entry. Several biosensor readings per
  day are allowed; daily records show the latest one.
- **Calibration:** the values in `services/biosensor/calibration.ts` are
  PLACEHOLDERS until the wet lab has real calibration data. Saliva uses
  pg/mL; urine uses ng/mL (PdG).
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
- Data stays on the device for now. Don't use analytics, crash reporters or
  network calls with patient data.
- Use only synthetic data in the repo, tests, seed data and demo builds.
- The app is a research and demonstration project, **not a medical device**.
  It shows the dose the physician prescribed. It must never calculate,
  suggest or change doses on its own. Include a disclaimer.

## iGEM context

- **Positioning:** the code is open source and the project is not going to be
  sold. At the Jamboree, though, it is presented *as a sellable product*.
  The app should look and feel like a polished consumer health product:
  consistent branding ("Lutealine"), onboarding, clean visuals and a smooth
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
