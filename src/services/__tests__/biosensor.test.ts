import {
  CALIBRATIONS,
  concentrationFromSignal,
  signalFromConcentration,
} from '../biosensor/calibration';
import { MockBiosensorService, relativeProgesterone } from '../biosensor/MockBiosensorService';

describe('calibration curve', () => {
  const cal = CALIBRATIONS.saliva;

  it('round-trips concentration → signal → concentration', () => {
    for (const c of [10, 50, 150, 400]) {
      expect(concentrationFromSignal(signalFromConcentration(c, cal), cal)).toBeCloseTo(c, 6);
    }
  });

  it('signal increases with progesterone', () => {
    expect(signalFromConcentration(300, cal)).toBeGreaterThan(signalFromConcentration(30, cal));
  });

  it('clamps signals outside the curve', () => {
    expect(concentrationFromSignal(0, cal)).toBe(cal.minConcentration);
    expect(concentrationFromSignal(cal.top * 2, cal)).toBe(cal.maxConcentration);
  });
});

describe('mock biosensor', () => {
  it('peaks in the mid-luteal phase', () => {
    expect(relativeProgesterone(21, 28)).toBeCloseTo(1);
    expect(relativeProgesterone(5, 28)).toBeLessThan(0.05);
  });

  it('gives higher readings in the luteal phase than the follicular phase', async () => {
    const measureOn = async (cycleDay: number) => {
      const sensor = new MockBiosensorService({ seed: 1, cycleContext: () => ({ cycleDay, cycleLength: 28 }) });
      const results = await Promise.all(Array.from({ length: 20 }, () => sensor.measure({ sampleType: 'saliva' })));
      return results.reduce((a, r) => a + r.progesterone, 0) / results.length;
    };
    expect(await measureOn(21)).toBeGreaterThan(4 * (await measureOn(5)));
  });

  it('labels readings as mock data with the calibration used', async () => {
    const sensor = new MockBiosensorService({ seed: 2, cycleContext: () => null });
    const at = new Date('2026-10-12T08:00:00Z');
    const r = await sensor.measure({ sampleType: 'urine', at });
    expect(r).toMatchObject({
      source: 'mock',
      sampleType: 'urine',
      unit: 'ng/mL',
      calibrationId: CALIBRATIONS.urine.id,
      measuredAt: at.toISOString(),
    });
  });

  it('is reproducible with a seed', async () => {
    const make = () => new MockBiosensorService({ seed: 7, cycleContext: () => ({ cycleDay: 10, cycleLength: 28 }) });
    const at = new Date('2026-10-12T08:00:00Z');
    expect(await make().measure({ sampleType: 'saliva', at })).toEqual(
      await make().measure({ sampleType: 'saliva', at }),
    );
  });
});
