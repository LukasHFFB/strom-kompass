'use client';

import { useMemo, useCallback } from 'react';
import { Group } from '@visx/group';
import { AreaStack, LinePath } from '@visx/shape';
import { scaleTime, scaleLinear, scaleOrdinal } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows } from '@visx/grid';
import { curveMonotoneX } from '@visx/curve';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { bisector } from 'd3-array';
import { ParentSize } from '@visx/responsive';
import { ENERGY_TYPE_LABELS } from '@/lib/utils/translations';
import { EnergyType } from '@/types/energy';
import { TYPE_COLORS } from './CapacityBarChart';

const TYPE_LABELS = ENERGY_TYPE_LABELS;

// ─── Types ──────────────────────────────────────────────────────────────

export interface GenerationPoint {
  timestamp: string;
  type: string;
  value: number;
  unit: string;
  source: string;
}

interface StackedRow {
  date: Date;
  [key: string]: number | Date;
}

// ─── Tooltip Style ──────────────────────────────────────────────────────

const tooltipStyles = {
  ...defaultStyles,
  background: 'rgba(0,0,0,0.85)',
  border: 'none',
  color: '#fff',
  padding: '10px 14px',
  borderRadius: '6px',
  fontSize: '13px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  maxWidth: '280px',
};

// ─── Margins ────────────────────────────────────────────────────────────

const margin = { top: 20, right: 20, bottom: 40, left: 65 };

// ─── Data Transformation ────────────────────────────────────────────────

function transformData(raw: GenerationPoint[]): { rows: StackedRow[]; keys: string[] } {
  // Group by timestamp, then pivot so each energy type is a column
  const byTimestamp = new Map<string, Record<string, number>>();
  const allTypes = new Set<string>();

  for (const point of raw) {
    allTypes.add(point.type);
    if (!byTimestamp.has(point.timestamp)) {
      byTimestamp.set(point.timestamp, {});
    }
    const row = byTimestamp.get(point.timestamp)!;
    row[point.type] = (row[point.type] ?? 0) + point.value;
  }

  const keys = Array.from(allTypes).sort();
  const rows: StackedRow[] = [];

  for (const [ts, values] of byTimestamp) {
    const row: StackedRow = { date: new Date(ts) };
    for (const key of keys) {
      row[key] = values[key] ?? 0;
    }
    rows.push(row);
  }

  rows.sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime());
  return { rows, keys };
}

// ─── Inner Chart ────────────────────────────────────────────────────────

interface InnerProps {
  data: GenerationPoint[];
  width: number;
  height: number;
}

function GenerationStackedAreaInner({ data, width, height }: InnerProps) {
  const {
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipLeft = 0,
    tooltipTop = 0,
  } = useTooltip<{ row: StackedRow; keys: string[] }>();

  const { rows, keys } = useMemo(() => transformData(data), [data]);

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xScale = useMemo(
    () =>
      scaleTime({
        range: [0, innerWidth],
        domain: [
          rows[0]?.date ?? new Date(),
          rows[rows.length - 1]?.date ?? new Date(),
        ],
      }),
    [rows, innerWidth]
  );

  const yScale = useMemo(() => {
    // Compute maximum total generation at any point
    let maxTotal = 0;
    for (const row of rows) {
      let total = 0;
      for (const key of keys) {
        total += (row[key] as number) ?? 0;
      }
      maxTotal = Math.max(maxTotal, total);
    }
    return scaleLinear({
      range: [innerHeight, 0],
      domain: [0, maxTotal * 1.05],
      nice: true,
    });
  }, [rows, keys, innerHeight]);

  const colorScale = useMemo(
    () =>
      scaleOrdinal({
        domain: keys,
        range: keys.map((k) => TYPE_COLORS[k] ?? '#9ca3af'),
      }),
    [keys]
  );

  const bisectDate = useMemo(
    () => bisector<StackedRow, Date>((d) => d.date as Date).left,
    []
  );

  const handleTooltip = useCallback(
    (event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>) => {
      const point = localPoint(event);
      if (!point) return;
      const x0 = xScale.invert(point.x - margin.left);
      const index = bisectDate(rows, x0, 1);
      const d0 = rows[index - 1];
      const d1 = rows[index];
      let d = d0;
      if (d1) {
        d =
          x0.getTime() - (d0.date as Date).getTime() >
          (d1.date as Date).getTime() - x0.getTime()
            ? d1
            : d0;
      }
      if (!d) return;
      showTooltip({
        tooltipData: { row: d, keys },
        tooltipLeft: xScale(d.date as Date) + margin.left,
        tooltipTop: point.y,
      });
    },
    [rows, keys, xScale, bisectDate, showTooltip]
  );

  if (innerWidth <= 0 || innerHeight <= 0 || rows.length === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height}>
        <Group left={margin.left} top={margin.top}>
          <GridRows
            scale={yScale}
            width={innerWidth}
            strokeDasharray="3,3"
            stroke="#f0f0f0"
            strokeOpacity={0.8}
          />
          <AreaStack
            data={rows}
            keys={keys}
            x={(d) => xScale(d.data.date as Date) ?? 0}
            y0={(d) => yScale(d[0]) ?? 0}
            y1={(d) => yScale(d[1]) ?? 0}
            curve={curveMonotoneX}
          >
            {({ stacks, path }) =>
              stacks.map((stack) => (
                <path
                  key={`stack-${stack.key}`}
                  d={path(stack) ?? ''}
                  fill={colorScale(stack.key)}
                  fillOpacity={0.75}
                  stroke={colorScale(stack.key)}
                  strokeWidth={0.5}
                />
              ))
            }
          </AreaStack>
          <AxisBottom
            top={innerHeight}
            scale={xScale}
            numTicks={Math.min(rows.length, 8)}
            tickLabelProps={{
              fill: '#888',
              fontSize: 11,
              textAnchor: 'middle',
            }}
            stroke="#f0f0f0"
            tickStroke="#f0f0f0"
          />
          <AxisLeft
            scale={yScale}
            numTicks={6}
            tickFormat={(v) => `${(Number(v) / 1000).toFixed(0)} GW`}
            tickLabelProps={{
              fill: '#888',
              fontSize: 11,
              textAnchor: 'end',
              dx: '-0.25em',
              dy: '0.33em',
            }}
            stroke="#f0f0f0"
            tickStroke="#f0f0f0"
          />
          <rect
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onMouseMove={handleTooltip}
            onMouseLeave={hideTooltip}
            onTouchMove={handleTooltip}
            onTouchEnd={hideTooltip}
          />
          {tooltipData && (
            <line
              x1={xScale(tooltipData.row.date as Date)}
              x2={xScale(tooltipData.row.date as Date)}
              y1={0}
              y2={innerHeight}
              stroke="#333"
              strokeWidth={1}
              strokeDasharray="4,3"
              pointerEvents="none"
            />
          )}
        </Group>
      </svg>
      {tooltipData && (
        <TooltipWithBounds
          top={tooltipTop}
          left={tooltipLeft}
          style={tooltipStyles}
        >
          <div style={{ fontWeight: 600, marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '4px' }}>
            {(tooltipData.row.date as Date).toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
          {tooltipData.keys
            .filter((k) => (tooltipData.row[k] as number) > 0)
            .sort((a, b) => (tooltipData.row[b] as number) - (tooltipData.row[a] as number))
            .map((key) => (
              <div
                key={key}
                style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '12px', lineHeight: '1.6' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: TYPE_COLORS[key] ?? '#9ca3af',
                      display: 'inline-block',
                    }}
                  />
                  {ENERGY_TYPE_LABELS[(key as any) as EnergyType] || key}
                </span>
                <span style={{ fontWeight: 600 }}>
                  {((tooltipData.row[key] as number) / 1000).toFixed(1)} GW
                </span>
              </div>
            ))}
        </TooltipWithBounds>
      )}
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: '12px', paddingLeft: margin.left }}>
        {keys.map((key) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#666' }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: TYPE_COLORS[key] ?? '#9ca3af',
                display: 'inline-block',
              }}
            />
            {ENERGY_TYPE_LABELS[(key as any) as EnergyType] || key}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Responsive Wrapper ─────────────────────────────────────────────────

interface Props {
  data: GenerationPoint[];
  height?: number;
}

export default function GenerationStackedArea({ data, height = 400 }: Props) {
  if (data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
        Keine Daten verfügbar
      </div>
    );
  }

  return (
    <ParentSize>
      {({ width }) =>
        width > 0 ? (
          <GenerationStackedAreaInner data={data} width={width} height={height} />
        ) : null
      }
    </ParentSize>
  );
}
