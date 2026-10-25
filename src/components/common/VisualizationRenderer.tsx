import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FunnelStage,
  HeatmapCell,
  VisualizationType,
} from "../../types/domain";

interface VisualizationRendererProps {
  chartType: VisualizationType;
  chartData: Array<Record<string, string | number>>;
  secondaryChartData?: Array<Record<string, string | number>>;
  heatmapData?: HeatmapCell[];
  funnelData?: FunnelStage[];
  height?: number;
}

const PALETTE = ["#0d9488", "#0284c7", "#64748b", "#7c3aed"];

export const VisualizationRenderer: React.FC<VisualizationRendererProps> = ({
  chartType,
  chartData,
  secondaryChartData,
  heatmapData,
  funnelData,
  height = 260,
}) => {
  if (chartType === "heatmap" && heatmapData && heatmapData.length > 0) {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const slots = ["09:00–12:00", "12:00–15:00", "15:00–18:00", "18:00–20:00"];

    const getCellColor = (pct: number) => {
      if (pct < 52) return "bg-amber-100/90 text-amber-950 border-amber-300";
      if (pct < 65) return "bg-slate-100 text-slate-900 border-slate-200";
      if (pct < 78) return "bg-teal-100/90 text-teal-950 border-teal-300";
      return "bg-teal-700 text-white border-teal-800";
    };

    return (
      <div className="space-y-3">
        <div className="overflow-x-auto">
          <div className="min-w-[540px] grid grid-cols-8 gap-1.5 text-xs">
            <div className="py-1.5 px-2 font-semibold text-slate-600">
              Time Block
            </div>
            {days.map((d) => (
              <div
                key={d}
                className="py-1.5 px-2 text-center font-semibold text-slate-800"
              >
                {d}
              </div>
            ))}

            {slots.map((slot) => (
              <React.Fragment key={slot}>
                <div className="py-2.5 px-2 font-mono text-xs text-slate-700 flex items-center whitespace-nowrap">
                  {slot}
                </div>
                {days.map((day) => {
                  const cell = heatmapData.find(
                    (c) => c.day === day && c.slot === slot
                  );
                  const pct = cell?.utilizationPct ?? 60;
                  const unused = cell?.unusedHours ?? 0;
                  return (
                    <div
                      key={`${day}-${slot}`}
                      title={`${day} ${slot}: ${pct}% utilization (${unused} unused hrs/wk)`}
                      className={`rounded border px-2 py-2 text-center transition-transform hover:scale-[1.02] ${getCellColor(
                        pct
                      )}`}
                    >
                      <div className="font-mono font-semibold tabular-nums text-xs">
                        {pct}%
                      </div>
                      <div className="text-xs opacity-90 font-mono tabular-nums">
                        {unused}h idle
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
          <span className="font-medium text-slate-700">Legend:</span>
          <span>Amber (&lt;52% Underutilized Gap)</span>
          <span aria-hidden="true">·</span>
          <span>Neutral (52%–64%)</span>
          <span aria-hidden="true">·</span>
          <span>Soft Teal (65%–77% Healthy)</span>
          <span aria-hidden="true">·</span>
          <span>Deep Teal (78%+ Peak Demand)</span>
        </div>
      </div>
    );
  }

  if (chartType === "funnel" && funnelData && funnelData.length > 0) {
    return (
      <div className="space-y-3">
        {funnelData.map((step) => {
          const gap = Number(
            (step.conversionPct - step.benchmarkPct).toFixed(1)
          );
          return (
            <div key={step.stage} className="space-y-1">
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="font-medium text-slate-900">{step.stage}</span>
                <div className="flex items-center gap-2 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                  <span className="font-semibold text-slate-900">
                    {step.conversionPct.toFixed(1)}%
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{step.guests.toLocaleString()} guests</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={
                      gap < -2
                        ? "text-red-700 font-semibold"
                        : "text-slate-600"
                    }
                  >
                    Benchmark {step.benchmarkPct.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="h-5 w-full bg-slate-100 rounded overflow-hidden relative">
                <div
                  className={`h-full rounded transition-all ${
                    gap < -5 ? "bg-amber-600" : "bg-teal-600"
                  }`}
                  style={{ width: `${Math.min(100, step.conversionPct)}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-900/80"
                  style={{ left: `${Math.min(100, step.benchmarkPct)}%` }}
                  title={`Benchmark: ${step.benchmarkPct}%`}
                />
              </div>
            </div>
          );
        })}
        <p className="text-xs text-slate-600 pt-1">
          Dark vertical marker indicates 20-salon organization benchmark. Amber bar highlights primary funnel drop-off stage.
        </p>
      </div>
    );
  }

  if (!chartData || chartData.length === 0 || chartType === "table-only") {
    return null;
  }

  const numericKeys = Object.keys(chartData[0]).filter(
    (k) =>
      k !== "name" &&
      k !== "deltaPts" &&
      k !== "guests" &&
      k !== "Total" &&
      typeof chartData[0][k] === "number"
  );

  return (
    <div className="space-y-5">
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "line" ? (
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 16, left: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "#334155" }}
                axisLine={{ stroke: "#94a3b8" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#334155" }}
                axisLine={{ stroke: "#94a3b8" }}
              />
              <Tooltip
                contentStyle={{
                  fontSize: "12px",
                  borderRadius: "8px",
                  borderColor: "#cbd5e1",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              {numericKeys.map((key, idx) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={PALETTE[idx % PALETTE.length]}
                  strokeWidth={2.4}
                  dot={{ r: 3.5 }}
                  activeDot={{ r: 5.5 }}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 16, left: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "#334155" }}
                axisLine={{ stroke: "#94a3b8" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#334155" }}
                axisLine={{ stroke: "#94a3b8" }}
              />
              <Tooltip
                contentStyle={{
                  fontSize: "12px",
                  borderRadius: "8px",
                  borderColor: "#cbd5e1",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              {numericKeys.map((key, idx) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId={chartType === "stacked-bar" ? "rev" : undefined}
                  fill={PALETTE[idx % PALETTE.length]}
                  radius={
                    chartType === "stacked-bar" ? [0, 0, 0, 0] : [4, 4, 0, 0]
                  }
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {secondaryChartData && secondaryChartData.length > 0 && (
        <div className="pt-3 border-t border-slate-200">
          <div className="text-xs font-semibold text-slate-800 mb-2">
            6-Month Co-Movement Trend (Repeat-Visit % vs Checkout Rebooking %)
          </div>
          <div style={{ width: "100%", height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={secondaryChartData}
                margin={{ top: 6, right: 16, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#334155" }}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 12, fill: "#334155" }}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: "12px",
                    borderRadius: "8px",
                    borderColor: "#cbd5e1",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                {Object.keys(secondaryChartData[0])
                  .filter((k) => k !== "name")
                  .map((k, idx) => (
                    <Line
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stroke={PALETTE[idx % PALETTE.length]}
                      strokeWidth={2.2}
                      dot={{ r: 3.5 }}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
