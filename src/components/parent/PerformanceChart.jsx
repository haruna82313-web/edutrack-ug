import { useMemo } from 'react';

const PerformanceChart = ({ data }) => {
  // Data expects: [{ label: 'Term 1', value: 85 }, { label: 'Term 2', value: 90 }]
  
  const chartData = useMemo(() => {
    if (!data || data.length < 2) return null;
    
    const height = 120;
    const width = 300;
    const padding = 20;
    
    const maxVal = Math.max(...data.map(d => d.value), 100);
    const minVal = 0;
    
    const points = data.map((d, i) => ({
      x: padding + (i * (width - 2 * padding) / (data.length - 1)),
      y: height - padding - ((d.value - minVal) * (height - 2 * padding) / (maxVal - minVal))
    }));
    
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaData = `${pathData} L ${points[points.length-1].x} ${height-padding} L ${points[0].x} ${height-padding} Z`;
    
    return { points, pathData, areaData, width, height };
  }, [data]);

  if (!chartData) {
    return (
      <div className="h-[120px] flex items-center justify-center text-slate-600 text-[8px] font-black uppercase tracking-widest border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
        Insufficient data for visualization
      </div>
    );
  }

  return (
    <div className="relative w-full h-[120px] animate-in fade-in duration-1000">
      <svg 
        viewBox={`0 0 ${chartData.width} ${chartData.height}`} 
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        {/* Gradient Definition */}
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid Lines */}
        <line x1="20" y1="20" x2="280" y2="20" stroke="white" strokeOpacity="0.05" strokeWidth="1" />
        <line x1="20" y1="60" x2="280" y2="60" stroke="white" strokeOpacity="0.05" strokeWidth="1" />
        <line x1="20" y1="100" x2="280" y2="100" stroke="white" strokeOpacity="0.05" strokeWidth="1" />

        {/* Area */}
        <path d={chartData.areaData} fill="url(#chartGradient)" />

        {/* Line */}
        <path 
          d={chartData.pathData} 
          fill="none" 
          stroke="#a78bfa" 
          strokeWidth="3" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="drop-shadow-glow"
        />

        {/* Points */}
        {chartData.points.map((p, i) => (
          <g key={i} className="group cursor-pointer">
            <circle 
              cx={p.x} 
              cy={p.y} 
              r="4" 
              fill="#8b5cf6" 
              className="transition-all duration-300 group-hover:r-6" 
            />
            <circle cx={p.x} cy={p.y} r="8" fill="#8b5cf6" fillOpacity="0.1" />
          </g>
        ))}
      </svg>
      
      {/* Labels */}
      <div className="absolute bottom-[-10px] left-0 right-0 flex justify-between px-4">
        {data.map((d, i) => (
          <span key={i} className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{d.label}</span>
        ))}
      </div>
    </div>
  );
};

export default PerformanceChart;
