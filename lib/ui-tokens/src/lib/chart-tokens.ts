/** A color scheme the tokens have values for. */
export type ColorScheme = 'light' | 'dark';

/** Colors a chart is drawn with (ADR-0009). The DSL never names a color; renderers read these. */
export interface ChartColors {
  /** One color per series, in series order; at most 4 series per chart. */
  series: readonly [string, string, string, string];
  /** One color per pie slice, at most 8 slices; the first four are the series colors. */
  slices: readonly string[];
  /** Axis lines and tick labels. */
  axis: string;
  /** Grid lines (decorative). */
  grid: string;
  /** Title, legend and caption text. */
  text: string;
}

/**
 * CSS custom properties a host page may set to theme charts. Renderers read them from the chart
 * element and fall back to {@link CHART_COLORS} for the current color scheme.
 */
export const CHART_COLOR_PROPERTIES = {
  series: ['--esi-chart-series-1', '--esi-chart-series-2', '--esi-chart-series-3', '--esi-chart-series-4'],
  axis: '--esi-chart-axis',
  grid: '--esi-chart-grid',
  text: '--esi-chart-text',
} as const;

/** Background each scheme's colors are checked against. */
export const CHART_BACKGROUNDS: Record<ColorScheme, string> = {
  light: '#FFFFFF',
  dark: '#1E1E1E',
};

/**
 * Default chart colors. Series colors are based on the Okabe-Ito palette (distinguishable with
 * common color-vision deficiencies) and have at least 3:1 contrast against the scheme background,
 * as do the pie slice, axis and text colors; grid lines are decorative.
 */
export const CHART_COLORS: Record<ColorScheme, ChartColors> = {
  light: {
    series: ['#0072B2', '#C24F00', '#00785A', '#A8457E'],
    slices: ['#0072B2', '#C24F00', '#00785A', '#A8457E', '#6A51A3', '#8A6A00', '#00838F', '#B3261E'],
    axis: '#5F6B7A',
    grid: '#D9DDE3',
    text: '#1F2328',
  },
  dark: {
    series: ['#56B4E9', '#E69F00', '#3DD6A3', '#E89BC6'],
    slices: ['#56B4E9', '#E69F00', '#3DD6A3', '#E89BC6', '#B4A7E5', '#F0E442', '#7FD4E0', '#FF8A80'],
    axis: '#A3ABB6',
    grid: '#3A4049',
    text: '#E6E8EB',
  },
};

/** WCAG 2 contrast ratio of two `#RRGGBB` colors (1 to 21). */
export function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Not a #RRGGBB color: ${hex}`);
  const [r, g, b] = match.slice(1).map((part) => {
    const channel = parseInt(part, 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
