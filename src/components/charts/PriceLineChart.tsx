'use client';

import { useRef, useState, useCallback, useMemo } from 'react';
import { Group } from '@visx/group';
import { LinePath, AreaClosed } from '@visx/shape';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows } from '@visx/grid';
import { curveMonotoneX } from '@visx/curve';
import { LinearGradient } from '@visx/gradient';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { bisector } from 'd3-array';
import { ParentSize } from '@visx/responsive';

// ─── Types ──────────────────────────────────────────────────────────────

export interface PricePoint {
  timestamp: string;
  price: number;
  unit: string;
  source: string;
}

// ─── Accessors ──────────────────────────────────────────────────────────

const getDate = (d: PricePoint) => new Date(d.timestamp);
const getPrice = (d: any) => d.price ?? d.value ?? 0;
const getUnit = (d: any) => d.unit ?? '';
const bisectDate = bisector<any, Date>((d) => new Date(d.timestamp)).left;

// ─── Tooltip Style ──────────────────────────────────────────────────────

const tooltipStyles = {
  ...defaultStyles,
  background: 'rgba(0,0,0,0.85)',
  border: 'none',
  color: '#fff',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '13px',
  lineHeight: '1.4',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
};

// ─── Chart Colors ───────────────────────────────────────────────────────

const COLORS = {
  line: '#2563eb',
  gradientFrom: 'rgba(37, 99, 235, 0.3)',
  gradientTo: 'rgba(37, 99, 235, 0.02)',
  grid: '#f0f0f0',
  axis: '#888',
  crosshair: '#2563eb',
  dot: '#2563eb',
};

// ─── Margins ────────────────────────────────────────────────────────────

const margin = { top: 20, right: 20, bottom: 40, left: 60 };

// ─── Inner Chart ────────────────────────────────────────────────────────

interface InnerChartProps {
  data: PricePoint[];
  width: number;
  height: number;
}

function PriceLineChartInner({ data, width, height }: InnerChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const {
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipLeft = 0,
    tooltipTop = 0,
  } = useTooltip<PricePoint>();

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xScale = useMemo(
    () =>
      scaleTime({
        range: [0, innerWidth],
        domain: [
          Math.min(...data.map((d) => getDate(d).getTime())),
          Math.max(...data.map((d) => getDate(d).getTime())),
        ],
      }),
    [data, innerWidth]
  );

  const yScale = useMemo(() => {
    const prices = data.map(getPrice);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const padding = (maxP - minP) * 0.1 || 5;
    return scaleLinear({
      range: [innerHeight, 0],
      domain: [minP - padding, maxP + padding],
      nice: true,
    });
  }, [data, innerHeight]);

  const handleTooltip = useCallback(
    (event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>) => {
      const point = localPoint(event);
      if (!point) return;
      const x0 = xScale.invert(point.x - margin.left);
      const index = bisectDate(data, x0, 1);
      const d0 = data[index - 1];
      const d1 = data[index];
      let d = d0;
      if (d1 && getDate(d1)) {
        d =
          x0.getTime() - getDate(d0).getTime() > getDate(d1).getTime() - x0.getTime()
            ? d1
            : d0;
      }
      showTooltip({
        tooltipData: d,
        tooltipLeft: xScale(getDate(d)) + margin.left,
        tooltipTop: yScale(getPrice(d)) + margin.top,
      });
    },
    [data, xScale, yScale, showTooltip]
  );

  if (innerWidth <= 0 || innerHeight <= 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={svgRef} width={width} height={height}>
        <LinearGradient
          id="price-gradient"
          from={COLORS.gradientFrom}
          to={COLORS.gradientTo}
        />
        <Group left={margin.left} top={margin.top}>
          <GridRows
            scale={yScale}
            width={innerWidth}
            strokeDasharray="3,3"
            stroke={COLORS.grid}
            strokeOpacity={0.8}
          />
          <AreaClosed
            data={data}
            x={(d) => xScale(getDate(d)) ?? 0}
            y={(d) => yScale(getPrice(d)) ?? 0}
            yScale={yScale}
            curve={curveMonotoneX}
            fill="url(#price-gradient)"
          />
          <LinePath
            data={data}
            x={(d) => xScale(getDate(d)) ?? 0}
            y={(d) => yScale(getPrice(d)) ?? 0}
            curve={curveMonotoneX}
            stroke={COLORS.line}
            strokeWidth={2}
          />
          <AxisBottom
            top={innerHeight}
            scale={xScale}
            numTicks={Math.min(data.length, 8)}
            tickLabelProps={{
              fill: COLORS.axis,
              fontSize: 11,
              textAnchor: 'middle',
            }}
            stroke={COLORS.grid}
            tickStroke={COLORS.grid}
          />
          <AxisLeft
            scale={yScale}
            numTicks={6}
            tickFormat={(v) => `${v}`}
            tickLabelProps={{
              fill: COLORS.axis,
              fontSize: 11,
              textAnchor: 'end',
              dx: '-0.25em',
              dy: '0.33em',
            }}
            stroke={COLORS.grid}
            tickStroke={COLORS.grid}
            label={data[0]?.unit || 'Wert'}
            labelProps={{
              fill: COLORS.axis,
              fontSize: 12,
              textAnchor: 'middle',
            }}
          />
          {/* Invisible overlay for tooltip detection */}
          <rect
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onMouseMove={handleTooltip}
            onMouseLeave={hideTooltip}
            onTouchMove={handleTooltip}
            onTouchEnd={hideTooltip}
          />
          {/* Crosshair + dot */}
          {tooltipData && (
            <>
              <line
                x1={xScale(getDate(tooltipData))}
                x2={xScale(getDate(tooltipData))}
                y1={0}
                y2={innerHeight}
                stroke={COLORS.crosshair}
                strokeWidth={1}
                strokeDasharray="4,3"
                pointerEvents="none"
              />
              <circle
                cx={xScale(getDate(tooltipData))}
                cy={yScale(getPrice(tooltipData))}
                r={5}
                fill={COLORS.dot}
                stroke="#fff"
                strokeWidth={2}
                pointerEvents="none"
              />
            </>
          )}
        </Group>
      </svg>
      {tooltipData && (
        <TooltipWithBounds
          top={tooltipTop}
          left={tooltipLeft}
          style={tooltipStyles}
        >
          <div style={{ fontWeight: 600 }}>
            {getPrice(tooltipData).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} {getUnit(tooltipData)}
          </div>
          <div style={{ opacity: 0.7, fontSize: '11px' }}>
            {new Date(tooltipData.timestamp).toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
}

// ─── Responsive Wrapper ─────────────────────────────────────────────────

interface PriceLineChartProps {
  data: PricePoint[];
  height?: number;
}

export default function PriceLineChart({ data, height = 350 }: PriceLineChartProps) {
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
          <PriceLineChartInner data={data} width={width} height={height} />
        ) : null
      }
    </ParentSize>
  );
}
