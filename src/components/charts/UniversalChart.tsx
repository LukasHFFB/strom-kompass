'use client';

import PriceLineChart from './PriceLineChart';
import GenerationStackedArea from './GenerationStackedArea';
import CapacityBarChart from './CapacityBarChart';

interface UniversalChartProps {
  type: 'line' | 'bar' | 'pie' | 'area';
  data: any[];
  height?: number;
  sourceId: string;
}

export default function UniversalChart({ type, data, height = 400, sourceId }: UniversalChartProps) {
  // Logic to route to the best fitting specialized chart or a generic one
  
  if (sourceId === 'generation' && type === 'area') {
    return <GenerationStackedArea data={data} height={height} />;
  }
  
  if (sourceId === 'capacity' && type === 'bar') {
    return <CapacityBarChart data={data} height={height} />;
  }

  if (type === 'line' || type === 'area') {
    // We can reuse PriceLineChart for most line/area needs if we normalize data
    // For now, let's keep it simple
    return <PriceLineChart data={data} height={height} />;
  }

  if (type === 'bar') {
    // Fallback to Capacity-style bars
    return <CapacityBarChart data={data} height={height} />;
  }

  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #eee', borderRadius: '8px' }}>
      <p>Visualisierung für {type} / {sourceId} in Vorbereitung.</p>
    </div>
  );
}
