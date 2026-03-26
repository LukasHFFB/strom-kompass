'use client';

import { useMemo } from 'react';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { scaleLinear, scaleBand } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridColumns } from '@visx/grid';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { ParentSize } from '@visx/responsive';
import { translateEnergyType } from '@/lib/utils/translations';
import { EnergyType } from '@/types/energy';

// ─── Types ──────────────────────────────────────────────────────────────

export interface CapacityItem {
  type: string;
  capacity: number;
  unit: string;
  year: number;
  source: string;
}

// ─── Colors ─────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  solar: '#f59e0b',
  wind_onshore: '#06b6d4',
  wind_offshore: '#0284c7',
  biomass: '#65a30d',
  hydro: '#3b82f6',
  hydro_pumped: '#6366f1',
  gas: '#ef4444',
  hard_coal: '#374151',
  lignite: '#78716c',
  nuclear: '#a855f7',
  oil: '#92400e',
  other: '#9ca3af',
};


// ─── Tooltip Style ──────────────────────────────────────────────────────

const tooltipStyles = {
  ...defaultStyles,
  background: 'rgba(0,0,0,0.85)',
  border: 'none',
  color: '#fff',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '13px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
};

// ─── Margins ────────────────────────────────────────────────────────────

const margin = { top: 10, right: 30, bottom: 30, left: 120 };

// ─── Inner Chart ────────────────────────────────────────────────────────

interface InnerProps {
  data: CapacityItem[];
  width: number;
  height: number;
}

function CapacityBarChartInner({ data, width, height }: InnerProps) {
  const {
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipLeft = 0,
    tooltipTop = 0,
  } = useTooltip<CapacityItem>();

  const sorted = useMemo(
    () => [...data].sort((a, b) => b.capacity - a.capacity),
    [data]
  );

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const yScale = useMemo(
    () =>
      scaleBand({
        range: [0, innerHeight],
        domain: sorted.map((d) => d.type),
        padding: 0.3,
      }),
    [sorted, innerHeight]
  );

  const xScale = useMemo(
    () =>
      scaleLinear({
        range: [0, innerWidth],
        domain: [0, Math.max(...sorted.map((d) => d.capacity)) * 1.1],
        nice: true,
      }),
    [sorted, innerWidth]
  );

  if (innerWidth <= 0 || innerHeight <= 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height}>
        <Group left={margin.left} top={margin.top}>
          <GridColumns
            scale={xScale}
            height={innerHeight}
            strokeDasharray="3,3"
            stroke="#f0f0f0"
            strokeOpacity={0.8}
          />
          {sorted.map((d) => {
            const barWidth = xScale(d.capacity);
            const barY = yScale(d.type) ?? 0;
            const barHeight = yScale.bandwidth();
            const color = TYPE_COLORS[d.type] ?? TYPE_COLORS.other;

            return (
              <Bar
                key={d.type}
                x={0}
                y={barY}
                width={barWidth}
                height={barHeight}
                fill={color}
                rx={3}
                onMouseMove={(event) => {
                  const point = { x: event.clientX, y: event.clientY };
                  showTooltip({
                    tooltipData: d,
                    tooltipLeft: point.x,
                    tooltipTop: point.y - 40,
                  });
                }}
                onMouseLeave={hideTooltip}
                style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                opacity={tooltipData?.type === d.type ? 1 : 0.85}
              />
            );
          })}
          <AxisLeft
            scale={yScale}
            tickFormat={(v) => translateEnergyType(v as string)}
            tickLabelProps={{
              fill: '#666',
              fontSize: 12,
              textAnchor: 'end',
              dy: '0.33em',
            }}
            hideAxisLine
            hideTicks
          />
          <AxisBottom
            top={innerHeight}
            scale={xScale}
            numTicks={5}
            tickFormat={(v) => `${(Number(v) / 1000).toFixed(0)} GW`}
            tickLabelProps={{
              fill: '#888',
              fontSize: 11,
              textAnchor: 'middle',
            }}
            stroke="#f0f0f0"
            tickStroke="#f0f0f0"
          />
        </Group>
      </svg>
      {tooltipData && (
        <TooltipWithBounds
          top={tooltipTop}
          left={tooltipLeft}
          style={tooltipStyles}
        >
          <div style={{ fontWeight: 600 }}>
            {translateEnergyType(tooltipData.type)}
          </div>
          <div>
            {(tooltipData.capacity / 1000).toFixed(1)} GW
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
}

// ─── Responsive Wrapper ─────────────────────────────────────────────────

interface CapacityBarChartProps {
  data: CapacityItem[];
  height?: number;
}

export default function CapacityBarChart({ data, height }: CapacityBarChartProps) {
  const chartHeight = height ?? Math.max(300, data.length * 45);

  if (data.length === 0) {
    return (
      <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
        Keine Daten verfügbar
      </div>
    );
  }

  return (
    <ParentSize>
      {({ width }) =>
        width > 0 ? (
          <CapacityBarChartInner data={data} width={width} height={chartHeight} />
        ) : null
      }
    </ParentSize>
  );
}

export { TYPE_COLORS };
