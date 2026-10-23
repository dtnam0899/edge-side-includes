import { CHART_BACKGROUNDS, CHART_COLOR_PROPERTIES, CHART_COLORS, type ColorScheme, contrastRatio } from './chart-tokens';

describe('chart tokens', () => {
  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
    expect(() => contrastRatio('red', '#FFFFFF')).toThrow('Not a #RRGGBB color');
  });

  it.each(['light', 'dark'] as ColorScheme[])('gives series, slice, axis and text colors at least 3:1 contrast on the %s background', (scheme) => {
    const colors = CHART_COLORS[scheme];
    for (const color of [...colors.series, ...colors.slices, colors.axis, colors.text]) {
      expect(contrastRatio(color, CHART_BACKGROUNDS[scheme])).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(['light', 'dark'] as ColorScheme[])('has 4 distinct series colors and 8 distinct slice colors for %s, series first', (scheme) => {
    const { series, slices } = CHART_COLORS[scheme];
    expect(new Set(series.map((color) => color.toUpperCase())).size).toBe(4);
    expect(new Set(slices.map((color) => color.toUpperCase())).size).toBe(8);
    expect(slices.slice(0, 4)).toEqual(series);
  });

  it('names one custom property per series', () => {
    expect(CHART_COLOR_PROPERTIES.series).toHaveLength(CHART_COLORS.light.series.length);
  });
});
