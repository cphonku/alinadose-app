# Alinadose — Team U Copenhagen 2026 Software

**Hormone-aware ADHD care.** Alinadose is the patient app of the U Copenhagen
iGEM 2026 project. Together with the Alinadose biosensor kit it helps women with
ADHD and their physicians see how the menstrual cycle affects ADHD symptoms and
medication, and follow a personalised, cycle-aware dosing plan.

> Research and demonstration project, **not a medical device**. The app shows the
> dose a physician prescribed; it never calculates, suggests or changes doses.
> All data in this repository and in the demo is synthetic.

## Description

### Background
ADHD symptoms in women often change across the menstrual cycle. When
progesterone is high (luteal phase), dopamine tends to be lower and symptoms
worse, so one fixed medication dose may not fit every day of the cycle.

The Alinadose biosensor kit measures progesterone in saliva or urine with a
split-TEV protease system: progesterone-binding receptors reassemble TEV, which
releases a reporter signal that the phone camera reads. Team wiki:
https://2026.igem.wiki/u-copenhagen/

### Features
- **Daily log:** progesterone test (camera; simulated until the kit is ready),
  a short 14-question ADHD questionnaire inspired by DIVA, and today's medication.
- **Symptom scoring:** an average per section (attention, restlessness and
  impulsivity, emotional regulation), and an overall score that is the average of
  the three sections. Medication effect and side effects are recorded separately.
- **Cycle tracking:** cycle day and phase from logged periods; the patient can
  adjust this cycle's length and bleeding days.
- **Dosing plan dial:** the physician's dose for every cycle day on a circular
  dial. The plan adapts to longer or shorter cycles while keeping the luteal
  doses aligned with the next period.
- **Remote plans:** the physician publishes a plan from a web portal; the patient
  reviews the changed days and confirms before it is used.
- **Physician editor:** set doses or change them by mg or by %; product label
  limits per age group (from `EU_ADHD_stimulant_dosing.xlsx`, not yet verified)
  with warnings and a required reason for off-label doses.
- **History:** progesterone vs. symptom timeline, "cycle rings", phase averages
  and a plain-language summary of the hormone–symptom link; CSV export.
- **Research news:** recent ADHD and hormone studies from PubMed.
- **Demo mode:** one tap loads two months of synthetic data.

### Status and limits
- The biosensor reading is **simulated**; calibration values are placeholders.
- Medication label data is **not yet verified** against Danish product labels.
- No real backend yet: data stays on the phone. Storage, accounts and consent
  wait for the team's GDPR measures. The plan relay in `server/` is a demo only.

## Installation

Requirements: [Node.js LTS](https://nodejs.org) (v20 or newer) and git. To run it
on a phone, install the **Expo Go** app.

```bash
git clone https://gitlab.igem.org/2026/software/u-copenhagen/alinadose-app.git
cd alinadose-app
npm install
```

`npm install` downloads all libraries into `node_modules/`, using the exact
versions pinned in `package-lock.json`. That folder is not in the repository
(it is large and specific to each computer); run `npm install` again whenever
`package.json` changes, e.g. after a `git pull`. Build output (`dist-preview/`,
from `npm run build:preview`) is not in the repository either.

## Usage

```bash
npx expo start
```

Scan the QR code with Expo Go (phone and computer on the same Wi-Fi), or press
`w` to open the app in the browser. On the welcome screen, choose
**Explore the demo**: it loads two monitoring cycles and an active dosing plan,
with today on cycle day 20 (mid-luteal).

**Physician portal demo:** run `npm run relay` (demo plan server, port 8787) and
the web app. Open "Physician portal (demo)" in one browser tab and the patient
demo in another. The demo patient's code is `DEMO-01`: publish a plan in the
portal, then tap "Check for plan updates" in the app. For a phone, copy
`.env.example` to `.env.local` and set your computer's IP address.

| Command | What it does |
|---|---|
| `npx expo start` | Start the app (phone via Expo Go, or `w` for web) |
| `npm run relay` | Demo plan server for the physician portal |
| `npm run build:preview` | Build the shareable web preview into `dist-preview/` (on the `preview` branch) |

## Data and large files

This repository holds source code only. The medication label overview
(`EU_ADHD_stimulant_dosing.xlsx`) and the questionnaires (`docs/`) are small
text/table sources used by the app. The app ships no datasets or models; all demo
data is generated synthetically in `src/data/demoSeed.ts`.

## Contributing

The project is open to contributions from the team and future iGEM teams.

```
src/app/        screens (Expo Router)
src/domain/     cycle, scoring, dosing and record logic (pure, unit tested)
src/data/       storage (SQLite on phone, in-memory on web) and demo data
src/services/   biosensor (mock), demo login, PubMed, plan sync
src/content/    questionnaire, medication label data, test instructions
src/ui/         theme, components, charts, dosing dial
server/         demo plan relay (demo only, in memory)
docs/           questionnaire sources
```

Before committing, run:

```bash
npm test            # unit tests (Jest)
npm run typecheck   # TypeScript check
```

Branches: `main` is the app (judged by iGEM); `preview` adds the settings for the
public web preview. `CLAUDE.md` documents design decisions and conventions in
detail. If you use an AI assistant, read
[.claude/RESPONSIBLE_AI_USE.md](.claude/RESPONSIBLE_AI_USE.md) first.

## Authors and acknowledgment

U Copenhagen iGEM 2026 team.

Development was assisted by Claude Code (Anthropic), an AI coding assistant; the
team reviewed the code and is responsible for it. Medication label data comes from
the public product labels (SmPCs) listed in `EU_ADHD_stimulant_dosing.xlsx` and
`src/content/medications.ts`; research news comes from PubMed (U.S. National
Library of Medicine).

Tech: Expo SDK 57 · React Native · TypeScript · Expo Router · SQLite ·
react-native-svg · Jest.

## License

This repository is licensed under the [Apache License 2.0](LICENSE).
