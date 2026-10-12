import { interpolateColor, linePath, ringSegment } from '../charts/svgHelpers';

describe('chart helpers', () => {
  it('interpolates between colour stops', () => {
    expect(interpolateColor(['#000000', '#FFFFFF'], 0)).toBe('rgb(0, 0, 0)');
    expect(interpolateColor(['#000000', '#FFFFFF'], 1)).toBe('rgb(255, 255, 255)');
    expect(interpolateColor(['#000000', '#FFFFFF'], 0.5)).toBe('rgb(128, 128, 128)');
    expect(interpolateColor(['#000000', '#FF0000', '#FFFFFF'], 0.5)).toBe('rgb(255, 0, 0)');
    expect(interpolateColor(['#000000', '#FFFFFF'], 7)).toBe('rgb(255, 255, 255)');
  });

  it('breaks lines at missing values', () => {
    expect(linePath([{ x: 0, y: 0 }, { x: 1, y: 1 }, null, { x: 3, y: 3 }])).toBe('M 0.0 0.0 L 1.0 1.0 M 3.0 3.0');
  });

  it('builds a closed ring segment path', () => {
    const d = ringSegment(50, 50, 10, 20, 0, Math.PI / 2);
    expect(d.startsWith('M 70 50')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });
});
