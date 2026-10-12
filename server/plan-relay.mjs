// Lutealine demo plan relay.
//
// A tiny stand-in for the future backend so the physician portal can send a
// dosing plan to the patient app during the demo. DEMO ONLY:
//   - keeps everything in memory (gone on restart), no database
//   - no authentication: anyone with a patient code can read/write its plan
//   - meant for synthetic demo data on a local network
// The real backend (hosting, accounts, encryption, consent) is decided with
// the team's GDPR measures.
//
// Run: npm run relay   (PORT env var, default 8787)
//
//   GET  /api/health
//   GET  /api/patients/:code/plan   → 200 plan | 404
//   PUT  /api/patients/:code/plan   → 200 plan (body: plan draft) | 400 { error }

import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8787);
const MAX_BODY = 64 * 1024;
const plans = new Map();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

/** Mirrors validateDosingPlan in src/domain/dosing.ts (the app validates again on receipt). */
function validate(d) {
  if (!d || typeof d !== 'object') return 'Body must be a JSON object';
  if (typeof d.medicationName !== 'string' || !d.medicationName.trim()) return 'Medication name is required';
  if (typeof d.unit !== 'string' || !d.unit) return 'Unit is required';
  if (!Array.isArray(d.days) || d.days.length === 0) return 'Plan has no days';
  for (let i = 0; i < d.days.length; i++) {
    const day = d.days[i];
    if (!day || day.cycleDay !== i + 1) return `Plan must cover consecutive days from 1; problem at index ${i}`;
    if (typeof day.amount !== 'number' || !(day.amount >= 0)) return `Invalid dose on day ${i + 1}`;
  }
  if (!['phaseAnchored', 'fixedDays'].includes(d.adaptation)) return 'Invalid adaptation';
  if (d.adaptation === 'phaseAnchored' && d.days.length < 16) return 'A phase-anchored plan needs at least 16 days';
  if (!Number.isInteger(d.periodLength) || d.periodLength < 1 || d.periodLength > 14) return 'Period length must be between 1 and 14 days';
  if (d.doseBeyondPlan !== null && !(typeof d.doseBeyondPlan === 'number' && d.doseBeyondPlan >= 0)) return 'Invalid dose beyond plan';
  const hasReason = typeof d.overLimitReason === 'string' && d.overLimitReason.trim() !== '';
  if (d.notLicensedForAgeGroup === true && !hasReason && d.days.some((day) => day.amount > 0)) {
    return "This medication is not licensed for the patient's age group; give a reason to save.";
  }
  if (d.labelMaxDailyDose !== undefined) {
    if (!(typeof d.labelMaxDailyDose === 'number' && d.labelMaxDailyDose > 0)) return 'Invalid label maximum';
    const over = d.days.some((day) => day.amount > d.labelMaxDailyDose) || (d.doseBeyondPlan ?? 0) > d.labelMaxDailyDose;
    const reason = typeof d.overLimitReason === 'string' ? d.overLimitReason.trim() : '';
    if (over && !reason) return `Doses exceed the label maximum of ${d.labelMaxDailyDose} mg; give a reason to save.`;
  }
  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Body too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/api/health') return send(res, 200, { ok: true, plans: plans.size });

  const match = url.pathname.match(/^\/api\/patients\/([A-Za-z0-9-]{3,32})\/plan$/);
  if (!match) return send(res, 404, { error: 'Not found' });
  const code = decodeURIComponent(match[1]).toUpperCase();

  if (req.method === 'GET') {
    const plan = plans.get(code);
    return plan ? send(res, 200, plan) : send(res, 404, { error: 'No plan published' });
  }

  if (req.method === 'PUT') {
    let draft;
    try {
      draft = JSON.parse(await readBody(req));
    } catch {
      return send(res, 400, { error: 'Invalid JSON' });
    }
    const error = validate(draft);
    if (error) return send(res, 400, { error });
    const { medicationName, unit, days, periodLength, adaptation, doseBeyondPlan, prescribedBy } = draft;
    const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    const plan = {
      medicationName: medicationName.trim(),
      unit,
      days,
      periodLength,
      adaptation,
      doseBeyondPlan,
      prescribedBy: text(prescribedBy),
      medicationId: text(draft.medicationId),
      ageGroup: draft.ageGroup === 'adult' || draft.ageGroup === 'youth' ? draft.ageGroup : undefined,
      labelMaxDailyDose: typeof draft.labelMaxDailyDose === 'number' ? draft.labelMaxDailyDose : undefined,
      notLicensedForAgeGroup: draft.notLicensedForAgeGroup === true ? true : undefined,
      overLimitReason: text(draft.overLimitReason),
      patientCode: code,
      version: (plans.get(code)?.version ?? 0) + 1,
      publishedAt: new Date().toISOString(),
    };
    plans.set(code, plan);
    console.log(`[relay] ${code}: published plan v${plan.version} (${days.length} days)`);
    return send(res, 200, plan);
  }

  return send(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, () => {
  console.log(`Lutealine demo plan relay on http://localhost:${PORT} (in-memory, demo data only)`);
});
