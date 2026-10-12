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
  Legend,
} from 'recharts';

interface ForecastChartProps {
  currentTemp: number;
  predictedTemp: number;
  tempLimit: number;
  horizonMinutes: number;
  historyData: { temperature: number; timestamp: string }[];
}

export function AIForecastChart({
  currentTemp,
  predictedTemp,
  tempLimit,
  horizonMinutes = 15,
  historyData = [],
}: ForecastChartProps) {
  // Build projection dataset merging recent history + projected points
  const recent = historyData.slice(-6);
  const chartPoints: any[] = [];

  // Add historical points
  recent.forEach((pt, idx) => {
    chartPoints.push({
      time: `-${(recent.length - idx) * 2}m`,
      actualTemp: Number(pt.temperature.toFixed(2)),
      forecastTemp: null,
    });
  });

  // Current anchor point
  chartPoints.push({
    time: 'NOW',
    actualTemp: Number(currentTemp.toFixed(2)),
    forecastTemp: Number(currentTemp.toFixed(2)),
  });

  // Intermediate projected points
  const steps = 4;
  const tempDiff = predictedTemp - currentTemp;
  for (let i = 1; i <= steps; i++) {
    const fraction = i / steps;
    const futureMin = Math.round(horizonMinutes * fraction);
    // Quadratic or linear interpolation to target predictedTemp
    const intermediateTemp = currentTemp + tempDiff * fraction;
    chartPoints.push({
      time: `+${futureMin}m`,
      actualTemp: null,
      forecastTemp: Number(intermediateTemp.toFixed(2)),
    });
  }

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartPoints} margin={{ top: 10, right: 25, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis
            domain={[1.0, 11.0]}
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
          />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: '11px', color: '#475569' }}
          />
          {/* Threshold Limit */}
          <ReferenceLine
            y={tempLimit}
            stroke="#ef4444"
            strokeDasharray="4 4"
            label={{
              value: `Threshold (${tempLimit.toFixed(1)}°C)`,
              fill: '#ef4444',
              fontSize: 10,
              position: 'insideTopRight',
            }}
          />
          {/* Actual Line */}
          <Line
            name="Actual Sensor Telemetry"
            type="monotone"
            dataKey="actualTemp"
            stroke="#1d4ed8"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#1d4ed8' }}
            isAnimationActive={false}
          />
          {/* AI Projected Horizon Line */}
          <Line
            name={`AI Horizon Forecast (+${horizonMinutes}m)`}
            type="monotone"
            dataKey="forecastTemp"
            stroke="#9333ea"
            strokeWidth={2.5}
            strokeDasharray="5 5"
            dot={{ r: 4, fill: '#9333ea' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
