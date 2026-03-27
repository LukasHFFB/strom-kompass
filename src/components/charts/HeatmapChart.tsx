'use client';

import { useMemo, useCallback } from 'react';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { ParentSize } from '@visx/responsive';

// ─── Types ──────────────────────────────────────────────────────────────

export interface HeatmapDataPoint {
  timestamp: string;
  value: number;
  unit: string;
}

interface Cell {
  dayKey: string;   // "YYYY-MM-DD" — used as scale domain key
  dayLabel: string; // "01.03." — displayed label
  hour: number;     // 0-23
  value: number;    // averaged if sub-hourly
  unit: string;
}

interface TooltipDatum {
  dayLabel: string;
  hour: number;
  value: number;
  unit: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const margin = { top: 10, right: 20, bottom: 48, left: 66 };

// ─── Data transformation ─────────────────────────────────────────────────

function buildGrid(data: HeatmapDataPoint[]): {
  cellMap: Map<string, Cell>;
  orderedDays: { key: string; label: string }[];
  minVal: number;
  maxVal: number;
} {
  const empty = { cellMap: new Map<string, Cell>(), orderedDays: [], minVal: 0, maxVal: 1 };
  if (data.length === 0) return empty;

  // Accumulate sums for averaging sub-hourly data
  const acc = new Map<string, { sum: number; count: number; unit: string; dayKey: string; dayLabel: string; hour: number }>();

  for (const pt of data) {
    if (!pt.timestamp) continue;
    const d = new Date(pt.timestamp);
    if (isNaN(d.getTime())) continue;
    if (!isFinite(pt.value)) continue;

    const dayKey = pt.timestamp.slice(0, 10); // "YYYY-MM-DD"
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dayLabel = `${dd}.${mm}.`;
    const hour = d.getUTCHours();
    const key = `${dayKey}_${hour}`;

    const ex = acc.get(key);
    if (ex) {
      ex.sum += pt.value;
      ex.count += 1;
    } else {
      acc.set(key, { sum: pt.value, count: 1, unit: pt.unit ?? '', dayKey, dayLabel, hour });
    }
  }

  const cellMap = new Map<string, Cell>();
  let minVal = Infinity;
  let maxVal = -Infinity;

  for (const [key, { sum, count, unit, dayKey, dayLabel, hour }] of acc) {
    const value = sum / count;
    cellMap.set(key, { dayKey, dayLabel, hour, value, unit });
    if (value < minVal) minVal = value;
    if (value > maxVal) maxVal = value;
  }

  // Unique days in chronological order
  const dayMap = new Map<string, string>();
  for (const cell of cellMap.values()) {
    if (!dayMap.has(cell.dayKey)) dayMap.set(cell.dayKey, cell.dayLabel);
  }
  const orderedDays = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, label]) => ({ key, label }));

  return {
    cellMap,
    orderedDays,
    minVal: isFinite(minVal) ? minVal : 0,
    maxVal: isFinite(maxVal) ? maxVal : 1,
  };
}

// ─── Color scale ─────────────────────────────────────────────────────────
// Diverging (blue → white → red) when data has negatives (e.g. prices).
// Sequential (light → dark blue) for non-negative data (e.g. load).

function buildColorFn(minVal: number, maxVal: number): (v: number) => string {
  const range = maxVal - minVal || 1;

  const lerp = (t: number, stops: [number, number, number][]): string => {
    const s = stops.length - 1;
    const clamped = Math.max(0, Math.min(1, t));
    const scaled = clamped * s;
    const i = Math.min(Math.floor(scaled), s - 1);
    const f = scaled - i;
    const [r1, g1, b1] = stops[i];
    const [r2, g2, b2] = stops[i + 1];
    return `rgb(${Math.round(r1 + (r2 - r1) * f)},${Math.round(g1 + (g2 - g1) * f)},${Math.round(b1 + (b2 - b1) * f)})`;
  };

  if (minVal < -5) {
    // Diverging: dark blue → light blue → white → light red → dark red
    const stops: [number, number, number][] = [
      [30, 64, 175],
      [96, 165, 250],
      [255, 255, 255],
      [252, 165, 165],
      [185, 28, 28],
    ];
    return (v: number) => lerp((v - minVal) / range, stops);
  } else {
    // Sequential: very light blue → dark blue
    const stops: [number, number, number][] = [
      [219, 234, 254],
      [147, 197, 253],
      [59, 130, 246],
      [29, 78, 216],
      [17, 24, 99],
    ];
    return (v: number) => lerp((v - minVal) / range, stops);
  }
}

// ─── Color Legend ─────────────────────────────────────────────────────────

function ColorLegend({
  minVal,
  maxVal,
  colorFn,
  unit,
}: {
  minVal: number;
  maxVal: number;
  colorFn: (v: number) => string;
  unit: string;
}) {
  const stops = Array.from({ length: 24 }, (_, i) =>
    colorFn(minVal + (maxVal - minVal) * (i / 23))
  ).join(',');

  const fmt = (v: number) =>
    v.toLocaleString('de-DE', { maximumFractionDigits: 1 });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 6,
        paddingLeft: margin.left,
        fontSize: 11,
        color: '#888',
      }}
    >
      <span>{fmt(minVal)} {unit}</span>
      <div
        style={{
          width: 120,
          height: 10,
          borderRadius: 3,
          background: `linear-gradient(to right, ${stops})`,
          border: '1px solid #e5e5e5',
        }}
      />
      <span>{fmt(maxVal)} {unit}</span>
    </div>
  );
}

// ─── Inner chart ──────────────────────────────────────────────────────────

interface InnerProps {
  data: HeatmapDataPoint[];
  width: number;
  height: number;
  unit: string;
}

function HeatmapChartInner({ data, width, height, unit }: InnerProps) {
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft = 0, tooltipTop = 0 } =
    useTooltip<TooltipDatum>();

  const { cellMap, orderedDays, minVal, maxVal } = useMemo(() => buildGrid(data), [data]);
  const colorFn = useMemo(() => buildColorFn(minVal, maxVal), [minVal, maxVal]);

  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const xScale = useMemo(
    () => scaleBand<number>({ domain: HOURS, range: [0, innerW], padding: 0.04 }),
    [innerW]
  );

  const yScale = useMemo(
    () =>
      scaleBand<string>({
        domain: orderedDays.map((d) => d.key),
        range: [0, innerH],
        padding: 0.04,
      }),
    [orderedDays, innerH]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGRectElement>, cell: Cell) => {
      const pt = localPoint(e) ?? { x: 0, y: 0 };
      showTooltip({
        tooltipData: {
          dayLabel: cell.dayLabel,
          hour: cell.hour,
          value: cell.value,
          unit: cell.unit || unit,
        },
        tooltipLeft: pt.x + margin.left,
        tooltipTop: pt.y + margin.top,
      });
    },
    [showTooltip, unit]
  );

  if (innerW <= 0 || innerH <= 0 || orderedDays.length === 0) return null;

  // Limit Y-axis label density to ~1 per 18px
  const maxLabels = Math.max(1, Math.floor(innerH / 18));
  const labelStep = Math.max(1, Math.ceil(orderedDays.length / maxLabels));
  const visibleDayKeys = new Set(
    orderedDays.filter((_, i) => i % labelStep === 0).map((d) => d.key)
  );

  const dayLabelMap = new Map(orderedDays.map((d) => [d.key, d.label]));

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height}>
        <Group left={margin.left} top={margin.top}>
          {[...cellMap.values()].map((cell) => {
            const x = xScale(cell.hour);
            const y = yScale(cell.dayKey);
            if (x === undefined || y === undefined) return null;
            return (
              <rect
                key={`${cell.dayKey}_${cell.hour}`}
                x={x}
                y={y}
                width={Math.max(xScale.bandwidth(), 0)}
                height={Math.max(yScale.bandwidth(), 0)}
                fill={colorFn(cell.value)}
                rx={1}
                onMouseMove={(e) => handleMouseMove(e, cell)}
                onMouseLeave={hideTooltip}
                style={{ cursor: 'crosshair' }}
              />
            );
          })}

          {/* X axis — hours */}
          <AxisBottom
            top={innerH}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            scale={xScale as any}
            tickValues={[0, 4, 8, 12, 16, 20]}
            tickFormat={(h) => `${h}:00`}
            tickLabelProps={{ fill: '#888', fontSize: 10, textAnchor: 'middle' }}
            stroke="#e5e5e5"
            tickStroke="#e5e5e5"
          />

          {/* Y axis — days */}
          <AxisLeft
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            scale={yScale as any}
            tickValues={orderedDays.filter((d) => visibleDayKeys.has(d.key)).map((d) => d.key)}
            tickFormat={(key) => dayLabelMap.get(key as string) ?? String(key).slice(5)}
            tickLabelProps={{ fill: '#888', fontSize: 10, textAnchor: 'end', dx: '-0.3em', dy: '0.33em' }}
            stroke="#e5e5e5"
            tickStroke="#e5e5e5"
          />
        </Group>
      </svg>

      {tooltipData && (
        <TooltipWithBounds
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            ...defaultStyles,
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            fontSize: 12,
            borderRadius: 6,
            padding: '6px 10px',
            border: 'none',
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {tooltipData.value.toLocaleString('de-DE', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 2,
            })}{' '}
            {tooltipData.unit}
          </div>
          <div style={{ opacity: 0.75, fontSize: 11, marginTop: 2 }}>
            {tooltipData.dayLabel} {String(tooltipData.hour).padStart(2, '0')}:00 Uhr
          </div>
        </TooltipWithBounds>
      )}

      <ColorLegend minVal={minVal} maxVal={maxVal} colorFn={colorFn} unit={unit} />
    </div>
  );
}

// ─── Responsive wrapper ───────────────────────────────────────────────────

interface HeatmapChartProps {
  data: HeatmapDataPoint[];
  height?: number;
  unit?: string;
}

export default function HeatmapChart({ data, height = 500, unit = '' }: HeatmapChartProps) {
  if (data.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#888',
          fontSize: 14,
        }}
      >
        Keine Daten verfügbar
      </div>
    );
  }

  return (
    <ParentSize>
      {({ width }) =>
        width > 0 ? (
          <HeatmapChartInner data={data} width={width} height={height} unit={unit} />
        ) : null
      }
    </ParentSize>
  );
}
