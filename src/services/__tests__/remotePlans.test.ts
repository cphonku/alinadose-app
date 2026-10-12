import { HttpRemotePlanService } from '../plans/HttpRemotePlanService';
import { RemotePlanError } from '../plans/RemotePlanService';

const draft = {
  medicationName: 'Test',
  unit: 'mg',
  days: [{ cycleDay: 1, amount: 10 }],
  periodLength: 5,
  adaptation: 'fixedDays' as const,
  doseBeyondPlan: null,
};

function fakeFetch(responses: { status: number; body?: unknown }[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = responses.shift()!;
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe('HttpRemotePlanService', () => {
  it('fetches the latest plan by normalized patient code', async () => {
    const { fn, calls } = fakeFetch([{ status: 200, body: { ...draft, version: 2 } }]);
    const service = new HttpRemotePlanService('http://relay:8787/', fn);
    expect(await service.fetchLatest(' lut-abcde ')).toMatchObject({ version: 2 });
    expect(calls[0]!.url).toBe('http://relay:8787/api/patients/LUT-ABCDE/plan');
  });

  it('returns null when no plan was published', async () => {
    const { fn } = fakeFetch([{ status: 404 }]);
    expect(await new HttpRemotePlanService('http://relay', fn).fetchLatest('X')).toBeNull();
  });

  it('publishes a draft with PUT and reports validation errors', async () => {
    const { fn, calls } = fakeFetch([
      { status: 200, body: { ...draft, version: 1 } },
      { status: 400, body: { error: 'Plan has no days' } },
    ]);
    const service = new HttpRemotePlanService('http://relay', fn);
    await service.publish('X', draft);
    expect(calls[0]!.init).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(calls[0]!.init!.body as string)).toEqual(draft);
    await expect(service.publish('X', draft)).rejects.toMatchObject({ code: 'invalid', message: 'Plan has no days' });
  });

  it('is disabled without a server URL and wraps network failures', async () => {
    const offline = new HttpRemotePlanService(null);
    expect(offline.configured).toBe(false);
    await expect(offline.fetchLatest('X')).rejects.toBeInstanceOf(RemotePlanError);

    const failing = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await expect(new HttpRemotePlanService('http://relay', failing).fetchLatest('X')).rejects.toMatchObject({ code: 'network' });
  });
});
