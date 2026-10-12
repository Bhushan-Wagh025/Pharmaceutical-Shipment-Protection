'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface TempReading {
  temperature: number;
  timestamp: string;
  battery?: number;
}

interface TemperatureHistoryChartProps {
  data: TempReading[];
  tempLimit: number;
  tempSafeMin?: number;
}

export function TemperatureHistoryChart({
  data,
  tempLimit,
  tempSafeMin = 2.0,
}: TemperatureHistoryChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
        Awaiting sensor telemetry readings...
      </div>
    );
  }

  // Format data for Recharts
  const chartData = data.map((d, index) => {
    const timeStr = d.timestamp
      ? new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : `T-${data.length - index}`;
    return {
      time: timeStr,
      temperature: Number(d.temperature.toFixed(2)),
      battery: d.battery,
    };
  });

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 25, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis
            domain={[1.0, 10.0]}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            unit="°C"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              borderColor: '#e2e8f0',
              borderRadius: '6px',
              fontSize: '12px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            }}
            formatter={(value: any) => [`${value} °C`, 'Temperature']}
          />
          {/* Upper Thermal Limit Threshold */}
          <ReferenceLine
            y={tempLimit}
            stroke="#ef4444"
            strokeDasharray="4 4"
            label={{
              value: `Limit (${tempLimit.toFixed(1)}°C)`,
              fill: '#ef4444',
              fontSize: 10,
              position: 'insideTopRight',
            }}
          />
          {/* Lower Safe Cold Bound */}
          <ReferenceLine
            y={tempSafeMin}
            stroke="#3b82f6"
            strokeDasharray="4 4"
            label={{
              value: `Min (${tempSafeMin.toFixed(1)}°C)`,
              fill: '#3b82f6',
              fontSize: 10,
              position: 'insideBottomRight',
            }}
          />
          <Line
            type="monotone"
            dataKey="temperature"
            stroke="#1d4ed8"
            strokeWidth={2.5}
            dot={{ r: 2.5, fill: '#1d4ed8' }}
            activeDot={{ r: 5, fill: '#ef4444' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
