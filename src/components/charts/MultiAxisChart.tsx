'use client';

import { useCallback, useMemo } from 'react';
import { Group } from '@visx/group';
import { LinePath, AreaClosed } from '@visx/shape';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft, AxisRight } from '@visx/axis';
import { GridRows } from '@visx/grid';
import { curveMonotoneX } from '@visx/curve';
import { LinearGradient } from '@visx/gradient';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { bisector } from 'd3-array';
import { ParentSize } from '@visx/responsive';
import type { ChartDataset } from '@/lib/chart-builder/types';

const tooltipStyles = {
  ...defaultStyles,
  background: 'rgba(0,0,0,0.85)',
  border: 'none',
  color: '#fff',
  padding: '10px 14px',
  borderRadius: '6px',
  fontSize: '13px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  maxWidth: '320px',
};

interface TooltipData {
  timestamp: Date;
  values: { dataset: ChartDataset; value: number }[];
}

interface Props {
  datasets: ChartDataset[];
  height?: number;
}

const DISPLAY_LABELS: Record<string, string> = {
  line: 'Linie',
  area: 'Fläche',
  bar: 'Balken',
};

function MultiAxisChartInner({ datasets, width, height }: Props & { width: number; height: number }) {
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft = 0, tooltipTop = 0 } =
    useTooltip<TooltipData>();

  const hasRightAxis = datasets.some(d => d.yAxis === 'right');
  const marginLeft = 70;
  const marginRight = hasRightAxis ? 70 : 20;
  const marginTop = 20;
  const marginBottom = 40;

  const innerWidth = width - marginLeft - marginRight;
  const innerHeight = height - marginTop - marginBottom;

  const allTimestamps = useMemo(() => {
    const set = new Set<number>();
    for (const ds of datasets) {
      for (const d of ds.data) set.add(new Date(d.timestamp).getTime());
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [datasets]);

  const xScale = useMemo(() => {
    if (allTimestamps.length === 0)
      return scaleTime({ range: [0, innerWidth], domain: [new Date(), new Date()] });
    return scaleTime({
      range: [0, innerWidth],
      domain: [new Date(allTimestamps[0]), new Date(allTimestamps[allTimestamps.length - 1])],
    });
  }, [allTimestamps, innerWidth]);

  const leftDatasets = useMemo(() => datasets.filter(d => d.yAxis === 'left'), [datasets]);
  const rightDatasets = useMemo(() => datasets.filter(d => d.yAxis === 'right'), [datasets]);

  const yScaleLeft = useMemo(() => {
    const vals = leftDatasets.flatMap(ds => ds.data.map(d => d.value));
    if (vals.length === 0) return scaleLinear({ range: [innerHeight, 0], domain: [0, 1] });
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.1 || 5;
    return scaleLinear({ range: [innerHeight, 0], domain: [min - pad, max + pad], nice: true });
  }, [leftDatasets, innerHeight]);

  const yScaleRight = useMemo(() => {
    const vals = rightDatasets.flatMap(ds => ds.data.map(d => d.value));
    if (vals.length === 0) return scaleLinear({ range: [innerHeight, 0], domain: [0, 1] });
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.1 || 5;
    return scaleLinear({ range: [innerHeight, 0], domain: [min - pad, max + pad], nice: true });
  }, [rightDatasets, innerHeight]);

  const yScaleFor = (ds: ChartDataset) => (ds.yAxis === 'right' ? yScaleRight : yScaleLeft);

  const bisectDate = useMemo(
    () => bisector<{ timestamp: string; value: number }, Date>(d => new Date(d.timestamp)).left,
    [],
  );

  const handleTooltip = useCallback(
    (event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>) => {
      const point = localPoint(event);
      if (!point) return;
      const x0 = xScale.invert(point.x - marginLeft);

      const values: TooltipData['values'] = [];
      for (const ds of datasets) {
        if (ds.data.length === 0) continue;
        const idx = bisectDate(ds.data, x0, 1);
        const d0 = ds.data[idx - 1];
        const d1 = ds.data[idx];
        let d = d0;
        if (d1) {
          d =
            x0.getTime() - new Date(d0.timestamp).getTime() >
            new Date(d1.timestamp).getTime() - x0.getTime()
              ? d1
              : d0;
        }
        if (d) values.push({ dataset: ds, value: d.value });
      }

      if (values.length > 0) {
        showTooltip({ tooltipData: { timestamp: x0, values }, tooltipLeft: point.x, tooltipTop: point.y });
      }
    },
    [datasets, xScale, bisectDate, showTooltip],
  );

  if (innerWidth <= 0 || innerHeight <= 0 || allTimestamps.length === 0) return null;

  const leftUnit = leftDatasets[0]?.unit || '';
  const rightUnit = rightDatasets[0]?.unit || '';

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height}>
        {datasets.map(ds => (
          <LinearGradient
            key={`grad-${ds.id}`}
            id={`gradient-${ds.id}`}
            from={ds.color}
            to={ds.color}
            fromOpacity={0.25}
            toOpacity={0.02}
          />
        ))}

        <Group left={marginLeft} top={marginTop}>
          <GridRows
            scale={yScaleLeft}
            width={innerWidth}
            strokeDasharray="3,3"
            stroke="#f0f0f0"
            strokeOpacity={0.8}
          />

          {/* Render each dataset with its own display type */}
          {datasets.map((ds, dsIdx) => {
            const yScale = yScaleFor(ds);
            const dt = ds.displayType || 'line';

            if (dt === 'bar') {
              const barWidth = Math.max(1, (innerWidth / (ds.data.length || 1) / datasets.length) - 1);
              const barOffset = dsIdx * barWidth;
              return (
                <g key={ds.id}>
                  {ds.data.map((d, i) => {
                    const x = (xScale(new Date(d.timestamp)) ?? 0) + barOffset;
                    const yVal = yScale(d.value) ?? 0;
                    const yZero = yScale(0) ?? innerHeight;
                    const barHeight = Math.abs(yZero - yVal);
                    const barY = d.value >= 0 ? yVal : yZero;
                    return (
                      <rect key={i} x={x - barWidth / 2} y={barY} width={barWidth} height={barHeight}
                        fill={ds.color} fillOpacity={0.7} rx={1} />
                    );
                  })}
                </g>
              );
            }

            return (
              <g key={ds.id}>
                {dt === 'area' && (
                  <AreaClosed
                    data={ds.data}
                    x={d => xScale(new Date(d.timestamp)) ?? 0}
                    y={d => yScale(d.value) ?? 0}
                    yScale={yScale}
                    curve={curveMonotoneX}
                    fill={`url(#gradient-${ds.id})`}
                  />
                )}
                <LinePath
                  data={ds.data}
                  x={d => xScale(new Date(d.timestamp)) ?? 0}
                  y={d => yScale(d.value) ?? 0}
                  curve={curveMonotoneX}
                  stroke={ds.color}
                  strokeWidth={2}
                />
              </g>
            );
          })}

          <AxisBottom
            top={innerHeight}
            scale={xScale}
            numTicks={Math.min(allTimestamps.length, 8)}
            tickLabelProps={{ fill: '#888', fontSize: 11, textAnchor: 'middle' }}
            stroke="#f0f0f0"
            tickStroke="#f0f0f0"
          />
          <AxisLeft
            scale={yScaleLeft}
            numTicks={6}
            tickLabelProps={{ fill: '#888', fontSize: 11, textAnchor: 'end', dx: '-0.25em', dy: '0.33em' }}
            stroke="#f0f0f0"
            tickStroke="#f0f0f0"
            label={leftUnit}
            labelProps={{ fill: '#888', fontSize: 12, textAnchor: 'middle' }}
          />
          {hasRightAxis && (
            <AxisRight
              left={innerWidth}
              scale={yScaleRight}
              numTicks={6}
              tickLabelProps={{ fill: '#888', fontSize: 11, textAnchor: 'start', dx: '0.25em', dy: '0.33em' }}
              stroke="#f0f0f0"
              tickStroke="#f0f0f0"
              label={rightUnit}
              labelProps={{ fill: '#888', fontSize: 12, textAnchor: 'middle' }}
            />
          )}

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
              x1={xScale(tooltipData.timestamp)}
              x2={xScale(tooltipData.timestamp)}
              y1={0}
              y2={innerHeight}
              stroke="#333"
              strokeWidth={1}
              strokeDasharray="4,3"
              pointerEvents="none"
            />
          )}
          {tooltipData &&
            tooltipData.values.map(({ dataset: ds, value }) => {
              const yScale = yScaleFor(ds);
              return (
                <circle
                  key={ds.id}
                  cx={xScale(tooltipData.timestamp)}
                  cy={yScale(value)}
                  r={4}
                  fill={ds.color}
                  stroke="#fff"
                  strokeWidth={2}
                  pointerEvents="none"
                />
              );
            })}
        </Group>
      </svg>

      {tooltipData && (
        <TooltipWithBounds top={tooltipTop} left={tooltipLeft} style={tooltipStyles}>
          <div style={{ fontWeight: 600, marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '4px' }}>
            {tooltipData.timestamp.toLocaleString('de-DE', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </div>
          {tooltipData.values.map(({ dataset: ds, value }) => (
            <div key={ds.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '12px', lineHeight: '1.6' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: ds.color, display: 'inline-block' }} />
                {ds.label}
              </span>
              <span style={{ fontWeight: 600 }}>
                {value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} {ds.unit}
              </span>
            </div>
          ))}
        </TooltipWithBounds>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: '12px', paddingLeft: marginLeft }}>
        {datasets.map(ds => (
          <div key={ds.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#666' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: ds.color, display: 'inline-block' }} />
            {ds.label}
            <span style={{ fontSize: '9px', color: '#999' }}>
              ({DISPLAY_LABELS[ds.displayType] || ds.displayType}{ds.yAxis === 'right' ? ', rechts' : ''})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MultiAxisChart({ datasets, height = 400 }: Props) {
  if (datasets.length === 0 || datasets.every(ds => ds.data.length === 0)) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
        Keine Daten verfügbar
      </div>
    );
  }

  return (
    <ParentSize>
      {({ width }) =>
        width > 0 ? <MultiAxisChartInner datasets={datasets} width={width} height={height} /> : null
      }
    </ParentSize>
  );
}
