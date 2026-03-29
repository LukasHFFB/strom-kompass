'use client';

import { useRef, useMemo, useCallback } from 'react';
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

export interface ForecastPoint {
  timestamp: string;
  type: string;
  forecast: number;
  unit: string;
  source: string;
}

// ─── Accessors ──────────────────────────────────────────────────────────

const getDate = (d: ForecastPoint) => new Date(d.timestamp);
const getForecast = (d: ForecastPoint) => d.forecast;
const bisectDate = bisector<ForecastPoint, Date>((d) => new Date(d.timestamp)).left;

// ─── Colors ─────────────────────────────────────────────────────────────

const COLORS: Record<string, { line: string; gradFrom: string; gradTo: string }> = {
  solar: {
    line: '#f59e0b',
    gradFrom: 'rgba(245, 158, 11, 0.3)',
    gradTo: 'rgba(245, 158, 11, 0.02)',
  },
  wind: {
    line: '#06b6d4',
    gradFrom: 'rgba(6, 182, 212, 0.3)',
    gradTo: 'rgba(6, 182, 212, 0.02)',
  },
  default: {
    line: '#2563eb',
    gradFrom: 'rgba(37, 99, 235, 0.3)',
    gradTo: 'rgba(37, 99, 235, 0.02)',
  },
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

const margin = { top: 20, right: 20, bottom: 40, left: 65 };

// ─── Inner Chart ────────────────────────────────────────────────────────

interface InnerProps {
  data: ForecastPoint[];
  width: number;
  height: number;
  type: string;
}

function ForecastChartInner({ data, width, height, type }: InnerProps) {
  const {
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipLeft = 0,
    tooltipTop = 0,
  } = useTooltip<ForecastPoint>();

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const color = COLORS[type] || COLORS.default;

  const xScale = useMemo(() => {
    const times = data.map((d) => getDate(d).getTime());
    return scaleTime({
      range: [0, innerWidth],
      domain: times.length > 0
        ? [Math.min(...times), Math.max(...times)]
        : [new Date(), new Date()],
    });
  }, [data, innerWidth]);

  const yScale = useMemo(() => {
    const vals = data.map(getForecast);
    const maxVal = vals.length > 0 ? Math.max(...vals) : 0;
    return scaleLinear({
      range: [innerHeight, 0],
      domain: [0, Math.max(maxVal * 1.1, 1)],
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
        d = x0.getTime() - getDate(d0).getTime() > getDate(d1).getTime() - x0.getTime() ? d1 : d0;
      }
      showTooltip({
        tooltipData: d,
        tooltipLeft: xScale(getDate(d)) + margin.left,
        tooltipTop: yScale(getForecast(d)) + margin.top,
      });
    },
    [data, xScale, yScale, showTooltip]
  );

  if (innerWidth <= 0 || innerHeight <= 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height}>
        <LinearGradient id={`grad-${type}`} from={color.gradFrom} to={color.gradTo} />
        <Group left={margin.left} top={margin.top}>
          <GridRows scale={yScale} width={innerWidth} strokeDasharray="3,3" stroke="#f0f0f0" />
          <AreaClosed
            data={data}
            x={(d) => xScale(getDate(d)) ?? 0}
            y={(d) => yScale(getForecast(d)) ?? 0}
            yScale={yScale}
            curve={curveMonotoneX}
            fill={`url(#grad-${type})`}
          />
          <LinePath
            data={data}
            x={(d) => xScale(getDate(d)) ?? 0}
            y={(d) => yScale(getForecast(d)) ?? 0}
            curve={curveMonotoneX}
            stroke={color.line}
            strokeWidth={2}
          />
          <AxisBottom
            top={innerHeight}
            scale={xScale}
            numTicks={6}
            tickLabelProps={{ fill: '#888', fontSize: 11, textAnchor: 'middle' }}
          />
          <AxisLeft
            scale={yScale}
            numTicks={5}
            tickFormat={(v) => `${(Number(v) / 1000).toFixed(0)} GW`}
            tickLabelProps={{ fill: '#888', fontSize: 11, textAnchor: 'end', dx: '-0.25em', dy: '0.33em' }}
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
            <>
              <line
                x1={xScale(getDate(tooltipData))}
                x2={xScale(getDate(tooltipData))}
                y1={0}
                y2={innerHeight}
                stroke={color.line}
                strokeWidth={1}
                strokeDasharray="4,3"
                pointerEvents="none"
              />
              <circle
                cx={xScale(getDate(tooltipData))}
                cy={yScale(getForecast(tooltipData))}
                r={4}
                fill={color.line}
                stroke="#fff"
                strokeWidth={2}
                pointerEvents="none"
              />
            </>
          )}
        </Group>
      </svg>
      {tooltipData && (
        <TooltipWithBounds top={tooltipTop} left={tooltipLeft} style={tooltipStyles}>
          <div style={{ fontWeight: 600 }}>{(tooltipData.forecast / 1000).toFixed(2)} GW</div>
          <div style={{ opacity: 0.7, fontSize: '11px' }}>
            {new Date(tooltipData.timestamp).toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
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

interface ForecastChartProps {
  data: ForecastPoint[];
  type: 'solar' | 'wind'; 
  height?: number;
}

export default function ForecastChart({ data, type, height = 300 }: ForecastChartProps) {
  if (data.length === 0) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>Keine Prognose-Daten</div>;
  }

  return (
    <ParentSize>
      {({ width }) => (width > 0 ? <ForecastChartInner data={data} width={width} height={height} type={type} /> : null)}
    </ParentSize>
  );
}
