function getCSSVariable(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  if (!value) return '#6b7280';
  const parts = value.split(' ').map(Number);
  if (parts.length === 3) {
    return `#${parts.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }
  return '#6b7280';
}

export function getChartColors() {
  return {
    primary: getCSSVariable('chart-1'),
    secondary: getCSSVariable('chart-2'),
    tertiary: getCSSVariable('chart-3'),
    quaternary: getCSSVariable('chart-4'),
    success: getCSSVariable('chart-success'),
    warning: getCSSVariable('chart-warning'),
    danger: getCSSVariable('chart-danger'),
    purple: getCSSVariable('chart-purple'),
    muted: getCSSVariable('chart-muted'),
  };
}

export function getChartPalette(count = 4) {
  const colors = getChartColors();
  const palette = [colors.primary, colors.secondary, colors.tertiary, colors.quaternary];
  return palette.slice(0, count);
}

export function getAxisStyle() {
  const colors = getChartColors();
  return {
    tick: { fill: colors.muted },
    axisLine: { stroke: colors.muted },
    gridStroke: colors.muted + '33',
  };
}

export function getPieColors() {
  const colors = getChartColors();
  return [colors.success, colors.warning, colors.danger, colors.muted];
}

export function getProgramColors() {
  const colors = getChartColors();
  return {
    roadmap: colors.primary,
    afk: colors.success,
    acj: colors.purple,
  };
}
