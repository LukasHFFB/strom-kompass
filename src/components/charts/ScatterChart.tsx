'use client';

import { useMemo, useCallback } from 'react';
import { Group } from '@visx/group';
import { scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows, GridColumns } from '@visx/grid';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
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
};

interface ScatterPoint {
  x: number;
  y: number;
  timestamp: string;
}

interface TooltipData {
  point: ScatterPoint;
  xLabel: string;
  yLabel: string;
  xUnit: string;
  yUnit: string;
}

interface Props {
  datasetX: ChartDataset;
  datasetY: ChartDataset;
  height?: number;
}

function ScatterInner({
  datasetX,
  datasetY,
  width,
  height,
}: Props & { width: number; height: number }) {
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft = 0, tooltipTop = 0 } =
    useTooltip<TooltipData>();

  const margin = { top: 20, right: 20, bottom: 50, left: 70 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Match timestamps between two datasets
  const points: ScatterPoint[] = useMemo(() => {
    const mapY = new Map<string, number>();
    for (const d of datasetY.data) {
      mapY.set(d.timestamp, d.value);
    }
    const matched: ScatterPoint[] = [];
    for (const d of datasetX.data) {
      const yVal = mapY.get(d.timestamp);
      if (yVal !== undefined) {
        matched.push({ x: d.value, y: yVal, timestamp: d.timestamp });
      }
    }
    return matched;
  }, [datasetX, datasetY]);

  const xScale = useMemo(() => {
    if (points.length === 0) return scaleLinear({ range: [0, innerWidth], domain: [0, 1] });
    const vals = points.map(p => p.x);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.05 || 1;
    return scaleLinear({ range: [0, innerWidth], domain: [min - pad, max + pad], nice: true });
  }, [points, innerWidth]);

  const yScale = useMemo(() => {
    if (points.length === 0) return scaleLinear({ range: [innerHeight, 0], domain: [0, 1] });
    const vals = points.map(p => p.y);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.05 || 1;
    return scaleLinear({ range: [innerHeight, 0], domain: [min - pad, max + pad], nice: true });
  }, [points, innerHeight]);

  if (points.length === 0 || innerWidth <= 0 || innerHeight <= 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
        Keine übereinstimmenden Zeitstempel zwischen den Datensätzen
      </div>
    );
  }

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
          <GridColumns
            scale={xScale}
            height={innerHeight}
            strokeDasharray="3,3"
            stroke="#f0f0f0"
            strokeOpacity={0.8}
          />

          {points.map((p, i) => (
            <circle
              key={i}
              cx={xScale(p.x)}
              cy={yScale(p.y)}
              r={3.5}
              fill={datasetX.color}
              fillOpacity={0.6}
              stroke={datasetX.color}
              strokeWidth={1}
              onMouseMove={e => {
                const pt = localPoint(e);
                if (pt) {
                  showTooltip({
                    tooltipData: {
                      point: p,
                      xLabel: datasetX.label,
                      yLabel: datasetY.label,
                      xUnit: datasetX.unit,
                      yUnit: datasetY.unit,
                    },
                    tooltipLeft: pt.x,
                    tooltipTop: pt.y,
                  });
                }
              }}
              onMouseLeave={hideTooltip}
              style={{ cursor: 'pointer' }}
            />
          ))}

          <AxisBottom
            top={innerHeight}
            scale={xScale}
            numTicks={8}
            label={`${datasetX.label} (${datasetX.unit})`}
            labelProps={{ fill: '#888', fontSize: 12, textAnchor: 'middle' }}
            tickLabelProps={{ fill: '#888', fontSize: 11, textAnchor: 'middle' }}
            stroke="#f0f0f0"
            tickStroke="#f0f0f0"
          />
          <AxisLeft
            scale={yScale}
            numTicks={6}
            label={`${datasetY.label} (${datasetY.unit})`}
            labelProps={{ fill: '#888', fontSize: 12, textAnchor: 'middle' }}
            tickLabelProps={{ fill: '#888', fontSize: 11, textAnchor: 'end', dx: '-0.25em', dy: '0.33em' }}
            stroke="#f0f0f0"
            tickStroke="#f0f0f0"
          />
        </Group>
      </svg>

      {tooltipData && (
        <TooltipWithBounds top={tooltipTop} left={tooltipLeft} style={tooltipStyles}>
          <div style={{ fontWeight: 600, marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '4px' }}>
            {new Date(tooltipData.point.timestamp).toLocaleString('de-DE', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
          <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <span>{tooltipData.xLabel}</span>
              <strong>{tooltipData.point.x.toLocaleString('de-DE', { maximumFractionDigits: 2 })} {tooltipData.xUnit}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <span>{tooltipData.yLabel}</span>
              <strong>{tooltipData.point.y.toLocaleString('de-DE', { maximumFractionDigits: 2 })} {tooltipData.yUnit}</strong>
            </div>
          </div>
        </TooltipWithBounds>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', paddingLeft: margin.left, fontSize: '11px', color: '#888' }}>
        {points.length} Datenpunkte
      </div>
    </div>
  );
}

export default function ScatterChart({ datasetX, datasetY, height = 400 }: Props) {
  return (
    <ParentSize>
      {({ width }) =>
        width > 0 ? (
          <ScatterInner datasetX={datasetX} datasetY={datasetY} width={width} height={height} />
        ) : null
      }
    </ParentSize>
  );
}
