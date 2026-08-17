'use client';

import dynamic from 'next/dynamic';
import { forwardRef } from 'react';
import type { Chart as ChartJS } from 'chart.js';
import type { ChartProps } from 'react-chartjs-2';

/**
 * Wrappers `next/dynamic` autour de `react-chartjs-2`.
 *
 * Charge `chart.js` + `react-chartjs-2` (~150 KB gzip) UNIQUEMENT à l'usage —
 * pas dans le bundle initial dashboard. Disable le SSR (charts client-only).
 *
 * Usage drop-in : remplacer
 *   import { Bar } from 'react-chartjs-2';
 * par
 *   import { Bar } from '@/components/charts';
 *
 * F-6 : `ChartJS.register(...)` est desormais fait IcI dans le loader dynamique
 * → les pages consommatrices n'ont plus besoin d'importer `chart.js` au top-level
 * (qui le bundlait dans leur chunk initial pour ~70 KB inutiles).
 *
 * Tous les elements + plugins courants sont enregistres une seule fois
 * (idempotent grace au cache module ESM). Si un plugin custom est requis,
 * appeler `Chart.register(...)` apres le 1er rendu.
 *
 * Ref forwarding : `next/dynamic` ne propage pas `forwardRef` — on enveloppe
 * via `React.forwardRef` pour conserver l'accès à `chartRef.current.toBase64Image`.
 */

const loading = () => (
  <div className="flex items-center justify-center h-48">
    <span className="w-6 h-6 border-2 border-[#006633]/30 border-t-[#006633] rounded-full animate-spin" />
  </div>
);

// Charge chart.js + plugins une seule fois. Le module ESM est cache.
async function _registerChartJS(): Promise<void> {
  const [chartJs, datalabels] = await Promise.all([
    import('chart.js'),
    import('chartjs-plugin-datalabels'),
  ]);
  const {
    Chart,
    CategoryScale, LinearScale,
    BarElement, PointElement, LineElement, ArcElement,
    Title, Tooltip, Legend, Filler,
  } = chartJs;
  Chart.register(
    CategoryScale, LinearScale,
    BarElement, PointElement, LineElement, ArcElement,
    Title, Tooltip, Legend, Filler,
    datalabels.default,
  );
}

const BarDynamic = dynamic(
  async () => {
    await _registerChartJS();
    const m = await import('react-chartjs-2');
    return { default: m.Bar };
  },
  { ssr: false, loading },
);
const DoughnutDynamic = dynamic(
  async () => {
    await _registerChartJS();
    const m = await import('react-chartjs-2');
    return { default: m.Doughnut };
  },
  { ssr: false, loading },
);
const PieDynamic = dynamic(
  async () => {
    await _registerChartJS();
    const m = await import('react-chartjs-2');
    return { default: m.Pie };
  },
  { ssr: false, loading },
);
const LineDynamic = dynamic(
  async () => {
    await _registerChartJS();
    const m = await import('react-chartjs-2');
    return { default: m.Line };
  },
  { ssr: false, loading },
);

type AnyComp = (props: Record<string, unknown>) => React.ReactNode;

export const Bar = forwardRef<ChartJS<'bar'>, Omit<ChartProps<'bar'>, 'type'>>(
  (props, ref) => {
    const Comp = BarDynamic as unknown as AnyComp;
    return <Comp {...(props as unknown as Record<string, unknown>)} ref={ref} />;
  },
);
Bar.displayName = 'LazyBar';

export const Doughnut = forwardRef<ChartJS<'doughnut'>, Omit<ChartProps<'doughnut'>, 'type'>>(
  (props, ref) => {
    const Comp = DoughnutDynamic as unknown as AnyComp;
    return <Comp {...(props as unknown as Record<string, unknown>)} ref={ref} />;
  },
);
Doughnut.displayName = 'LazyDoughnut';

export const Pie = forwardRef<ChartJS<'pie'>, Omit<ChartProps<'pie'>, 'type'>>(
  (props, ref) => {
    const Comp = PieDynamic as unknown as AnyComp;
    return <Comp {...(props as unknown as Record<string, unknown>)} ref={ref} />;
  },
);
Pie.displayName = 'LazyPie';

export const Line = forwardRef<ChartJS<'line'>, Omit<ChartProps<'line'>, 'type'>>(
  (props, ref) => {
    const Comp = LineDynamic as unknown as AnyComp;
    return <Comp {...(props as unknown as Record<string, unknown>)} ref={ref} />;
  },
);
Line.displayName = 'LazyLine';
