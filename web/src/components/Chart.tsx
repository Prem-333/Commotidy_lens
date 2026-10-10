import { useEffect, useRef, useState } from 'react';
import type { Data, Layout, PlotlyHTMLElement } from 'plotly.js';
import { useQueryClient } from '@tanstack/react-query';
import type { Health } from '../types';
import { Download } from 'lucide-react';
import { usePreferences, csv } from '../lib';
import { Button } from './ui/button';
import { toast } from 'sonner';
export function Chart({
  data,
  layout = {},
  title,
  subtitle,
  height = 300,
  exportRows = [],
}: {
  data: Data[];
  layout?: Partial<Layout>;
  title: string;
  subtitle?: string;
  height?: number;
  exportRows?: Record<string, unknown>[];
}) {
  const root = useRef<HTMLDivElement>(null);
  const { theme } = usePreferences();
  const queryClient = useQueryClient();
  const [error, setError] = useState(false);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let alive = true;
    let observer: ResizeObserver | undefined;
    import('plotly.js-cartesian-dist-min')
      .then(async ({ default: Plotly }) => {
        if (!alive) return;
        const muted = theme === 'dark' ? '#8d99ad' : '#576479';
        const lightColors: Record<string, string> = {
          '#e6c66d': '#896714',
          '#c9a24b': '#896714',
          '#ed8997': '#b23f58',
          '#ed9a9e': '#b23f58',
          '#83b9ed': '#326d9e',
          '#80b6ec': '#326d9e',
          '#bba4e8': '#7650a8',
          '#6dd4bd': '#237d62',
        };
        const themedData =
          theme === 'light'
            ? (JSON.parse(
                JSON.stringify(data, (_key, value) =>
                  typeof value === 'string' ? (lightColors[value] ?? value) : value,
                ),
              ) as Data[])
            : data;
        await Plotly.react(
          element,
          themedData,
          {
            autosize: true,
            height,
            paper_bgcolor: theme === 'dark' ? '#0d1117' : '#ffffff',
            plot_bgcolor: theme === 'dark' ? '#0d1117' : '#ffffff',
            font: { family: 'Inter, sans-serif', size: 11, color: muted },
            margin: { l: 64, r: 24, t: 24, b: 44 },
            xaxis: { gridcolor: theme === 'dark' ? '#ffffff08' : '#00000008', zeroline: false },
            yaxis: {
              gridcolor: theme === 'dark' ? '#ffffff0c' : '#0000000c',
              zerolinecolor: '#80808035',
              tickfont: { family: 'JetBrains Mono' },
            },
            showlegend: false,
            hovermode: 'x unified',
            hoverlabel: {
              bgcolor: theme === 'dark' ? '#17202c' : '#fff',
              font: { color: theme === 'dark' ? '#eef2f7' : '#17202c' },
            },
            ...layout,
          },
          { responsive: true, displayModeBar: false, scrollZoom: false },
        );
        if (!alive) {
          Plotly.purge(element);
          return;
        }
        observer = new ResizeObserver(() => {
          if (element.isConnected) Plotly.Plots.resize(element);
        });
        observer.observe(element);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
      observer?.disconnect();
      import('plotly.js-cartesian-dist-min').then((p) => p.default.purge(element));
    };
  }, [data, layout, height, theme]);
  async function png() {
    const exportElement = document.createElement('div');
    exportElement.style.cssText = 'position:fixed;left:-10000px;top:0;width:1400px;height:650px;';
    exportElement.setAttribute('aria-hidden', 'true');
    try {
      if (!root.current) return;
      const { default: Plotly } = await import('plotly.js-cartesian-dist-min');
      const chart = root.current as HTMLDivElement & Pick<PlotlyHTMLElement, 'data' | 'layout'>;
      const source = queryClient.getQueryData<Health>(['health'])?.source ?? 'unverified source';
      document.body.appendChild(exportElement);
      await Plotly.newPlot(
        exportElement,
        chart.data,
        {
          ...chart.layout,
          width: 1400,
          height: 650,
          title: {
            text: `CommodityLens · ${title}<br><sup>${subtitle ?? ''} · ${source.toUpperCase()} DATA · RESEARCH ONLY</sup>`,
            font: { size: 16 },
            x: 0.05,
          },
          margin: { ...chart.layout.margin, t: 105 },
        },
        { staticPlot: true, displayModeBar: false },
      );
      await Plotly.downloadImage(exportElement, {
        format: 'png',
        width: 1400,
        height: 650,
        filename: `commoditylens-${title.toLowerCase().replaceAll(' ', '-')}`,
      });
      Plotly.purge(exportElement);
      toast.success('PNG exported');
    } catch {
      toast.error('Chart export failed');
    } finally {
      exportElement.remove();
    }
  }
  return (
    <section className="panel chart-panel">
      <div className="panel-header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              csv(
                title,
                exportRows.map((row) => ({
                  source: queryClient.getQueryData<Health>(['health'])?.source ?? 'unverified',
                  ...row,
                })),
              )
            }
            aria-label={`Export ${title} CSV`}
            title="Export underlying data"
          >
            CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={png}
            aria-label={`Export ${title} PNG`}
            title="Export chart as PNG"
          >
            <Download size={15} />
          </Button>
        </div>
      </div>
      {error ? (
        <div className="empty">Chart could not load. Reload the page or export its data.</div>
      ) : (
        <div ref={root} className="plot" style={{ minHeight: height }} role="img" aria-label={title} />
      )}
    </section>
  );
}
