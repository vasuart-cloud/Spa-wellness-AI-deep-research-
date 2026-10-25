import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppState } from "../../context/AppStateContext";
import { PERSONAS } from "../../services/syntheticDataService";
import { TanStackDataTable } from "../common/TanStackDataTable";

const DONUT_COLORS = ["#0d9488", "#0284c7", "#7c3aed", "#64748b"];

export const ControlTowerView: React.FC = () => {
  const {
    activePersona,
    controlTowerEvents,
    policy,
    updatePolicy,
    presenterHintsEnabled,
  } = useAppState();

  const isAdmin = PERSONAS[activePersona].canConfigureGovernance;

  // Filters (Section 12)
  const [productFilter, setProductFilter] = useState<string>("All");
  const [regionFilter, setRegionFilter] = useState<string>("All");
  const [userFilter, setUserFilter] = useState<string>("All");
  const [requestTypeFilter, setRequestTypeFilter] = useState<string>("All");
  const [dateWindow, setDateWindow] = useState<"7d" | "3d" | "today">("7d");
  const [telemetryView, setTelemetryView] = useState<"all" | "policy">("all");

  // Local budget & rate-limit form inputs synced with active policy
  const [dailyTokensInput, setDailyTokensInput] = useState<number>(
    policy.dailyTenantTokenBudget
  );
  const [monthlySpendInput, setMonthlySpendInput] = useState<number>(
    policy.monthlyAiSpendBudgetUsd
  );
  const [hourlyLimitInput, setHourlyLimitInput] = useState<number>(
    policy.userHourlyQueryLimit
  );

  useEffect(() => {
    setDailyTokensInput(policy.dailyTenantTokenBudget);
    setMonthlySpendInput(policy.monthlyAiSpendBudgetUsd);
    setHourlyLimitInput(policy.userHourlyQueryLimit);
  }, [
    policy.dailyTenantTokenBudget,
    policy.monthlyAiSpendBudgetUsd,
    policy.userHourlyQueryLimit,
  ]);

  const uniqueUsers = useMemo(
    () => Array.from(new Set(controlTowerEvents.map((e) => e.user))),
    [controlTowerEvents]
  );

  const filteredEvents = useMemo(() => {
    return controlTowerEvents.filter((e) => {
      if (productFilter !== "All" && e.product !== productFilter) return false;
      if (regionFilter !== "All" && e.region !== regionFilter) return false;
      if (userFilter !== "All" && e.user !== userFilter) return false;
      if (requestTypeFilter !== "All" && e.requestType !== requestTypeFilter)
        return false;
      if (dateWindow === "today" && e.date !== "2026-10-24") return false;
      if (
        dateWindow === "3d" &&
        !["2026-10-22", "2026-10-23", "2026-10-24"].includes(e.date)
      )
        return false;
      return true;
    });
  }, [
    controlTowerEvents,
    productFilter,
    regionFilter,
    userFilter,
    requestTypeFilter,
    dateWindow,
  ]);

  // 12 Control Tower Telemetry Cards
  const totalQueries = filteredEvents.length;
  const advisorQueries = filteredEvents.filter(
    (e) => e.product === "AI Business Advisor"
  ).length;
  const retentionQueries = filteredEvents.filter(
    (e) => e.product === "AI Retention Manager"
  ).length;
  const disputeQueries = filteredEvents.filter(
    (e) => e.product === "AI Dispute Manager"
  ).length;
  const deepCount = filteredEvents.filter(
    (e) => e.requestType === "Deep Analysis"
  ).length;
  const fastCount = filteredEvents.filter(
    (e) => e.requestType === "Fast Analysis"
  ).length;
  const tokensConsumed = filteredEvents.reduce(
    (s, e) => s + e.tokensConsumed,
    0
  );
  const estimatedSpend = filteredEvents.reduce((s, e) => s + e.costUsd, 0);
  const budgetRemaining = Math.max(
    0,
    policy.monthlyAiSpendBudgetUsd - estimatedSpend
  );
  const cacheHits = filteredEvents.filter((e) => e.cacheHit).length;
  const cacheHitRate = ((cacheHits / Math.max(1, totalQueries)) * 100).toFixed(
    1
  );
  const avgLatency = Math.round(
    filteredEvents.reduce((s, e) => s + e.latencyMs, 0) /
      Math.max(1, totalQueries)
  );
  const blockedCount = filteredEvents.filter(
    (e) => e.status === "Blocked"
  ).length;
  const violationCount = filteredEvents.filter(
    (e) => e.status === "Policy Violation"
  ).length;
  const errorCount = filteredEvents.filter((e) => e.status === "Error").length;
  const scheduledJobs = filteredEvents.filter(
    (e) => e.requestType === "Scheduled Refresh"
  ).length;

  // Daily Token Usage Line Chart + Cost by Agent Stacked Bar
  const dailySeries = useMemo(() => {
    const days = Array.from(
      new Set(filteredEvents.map((e) => e.date))
    ).sort();
    return days.map((d) => {
      const slice = filteredEvents.filter((e) => e.date === d);
      const cachePct = Number(
        (
          (slice.filter((x) => x.cacheHit).length / Math.max(1, slice.length)) *
          100
        ).toFixed(1)
      );
      return {
        date: d.slice(5),
        Tokens: slice.reduce((s, x) => s + x.tokensConsumed, 0),
        "Advisor ($)": Number(
          slice
            .filter((x) => x.product === "AI Business Advisor")
            .reduce((s, x) => s + x.costUsd, 0)
            .toFixed(2)
        ),
        "Retention ($)": Number(
          slice
            .filter((x) => x.product === "AI Retention Manager")
            .reduce((s, x) => s + x.costUsd, 0)
            .toFixed(2)
        ),
        "Dispute ($)": Number(
          slice
            .filter((x) => x.product === "AI Dispute Manager")
            .reduce((s, x) => s + x.costUsd, 0)
            .toFixed(2)
        ),
        "Cache Hit %": cachePct,
      };
    });
  }, [filteredEvents]);

  const requestDistribution = [
    { name: "AI Business Advisor", value: advisorQueries },
    { name: "AI Retention Manager", value: retentionQueries },
    { name: "AI Dispute Manager", value: disputeQueries },
  ].filter((x) => x.value > 0);

  const budgetUtilPct = Math.min(
    100,
    Math.round((estimatedSpend / Math.max(1, policy.monthlyAiSpendBudgetUsd)) * 100)
  );

  const policyEvents = useMemo(
    () =>
      filteredEvents.filter(
        (e) => e.status !== "Success" || e.isLiveGeminiMetadata
      ),
    [filteredEvents]
  );

  const displayedEvents =
    telemetryView === "policy" ? policyEvents : filteredEvents;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 space-y-1">
        <div className="text-xs font-medium text-slate-600">
          Multi-Agent Usage, Token Observability &amp; Tenant Budget Governance
          {presenterHintsEnabled && (
            <span> · Simulated Multi-Product Streams + Live Gemini Metadata When Configured</span>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          AI Control Tower
        </h1>
        <p className="text-sm text-slate-700 max-w-3xl">
          Unified cost, latency, cache efficiency, and policy enforcement across AI Business Advisor, AI Retention Manager, and AI Dispute Manager.
        </p>
      </div>

      {/* 5-Dimension Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            AI Product
          </label>
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-800"
          >
            <option value="All">All 3 AI Products</option>
            <option value="AI Business Advisor">AI Business Advisor</option>
            <option value="AI Retention Manager">AI Retention Manager</option>
            <option value="AI Dispute Manager">AI Dispute Manager</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Date Window
          </label>
          <select
            value={dateWindow}
            onChange={(e) =>
              setDateWindow(e.target.value as "7d" | "3d" | "today")
            }
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-800"
          >
            <option value="7d">Last 7 Days</option>
            <option value="3d">Last 3 Days</option>
            <option value="today">Today (2026-10-24)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            User / Actor
          </label>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-800"
          >
            <option value="All">All Users &amp; Jobs</option>
            {uniqueUsers.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Region Scope
          </label>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-800"
          >
            <option value="All">All Regions</option>
            <option value="Pacific Northwest">Pacific Northwest</option>
            <option value="Southwest">Southwest</option>
            <option value="Midwest">Midwest</option>
            <option value="Northeast">Northeast</option>
            <option value="All Regions">Org-Wide</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Request Type
          </label>
          <select
            value={requestTypeFilter}
            onChange={(e) => setRequestTypeFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-800"
          >
            <option value="All">All Request Types</option>
            <option value="Fast Analysis">Fast Analysis</option>
            <option value="Deep Analysis">Deep Analysis</option>
            <option value="Scheduled Refresh">Scheduled Refresh</option>
            <option value="Proactive Alert">Proactive Alert</option>
            <option value="Retention Campaign">Retention Campaign</option>
            <option value="Dispute Triage">Dispute Triage</option>
          </select>
        </div>
      </div>

      {/* 12 Control Tower Telemetry Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Queries", val: String(totalQueries) },
          {
            label: "By Agent (Adv/Ret/Disp)",
            val: `${advisorQueries} / ${retentionQueries} / ${disputeQueries}`,
          },
          { label: "Fast vs Deep", val: `${fastCount} Fast · ${deepCount} Deep` },
          {
            label: "Tokens Consumed (Est/Live)",
            val: tokensConsumed.toLocaleString(),
          },
          { label: "Est. AI Spending", val: `$${estimatedSpend.toFixed(2)}` },
          { label: "Budget Remaining", val: `$${budgetRemaining.toFixed(2)}` },
          { label: "Cache Hit Rate", val: `${cacheHitRate}%` },
          { label: "Average Latency", val: `${avgLatency} ms` },
          {
            label: "Error Rate",
            val: `${((errorCount / Math.max(1, totalQueries)) * 100).toFixed(1)}%`,
          },
          { label: "Blocked Requests", val: String(blockedCount) },
          { label: "Policy Violations", val: String(violationCount) },
          { label: "Scheduled Jobs Run", val: String(scheduledJobs) },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-1"
          >
            <div className="text-xs font-medium text-slate-600">{card.label}</div>
            <div className="text-sm sm:text-base font-bold font-mono tabular-nums text-slate-900">
              {card.val}
            </div>
          </div>
        ))}
      </div>

      {/* Tenant Budget Utilization Bar + Interactive Budget Configurator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Daily Token Usage &amp; Cache Effectiveness Trend
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Token counts reflect live Gemini metadata on Advisor calls when configured and deterministic estimates on simulated multi-product streams.
            </p>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#334155" }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "#334155" }} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12, fill: "#334155" }}
                />
                <Tooltip contentStyle={{ fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="Tokens"
                  stroke="#0d9488"
                  strokeWidth={2.2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="Cache Hit %"
                  stroke="#7c3aed"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tenant Governance Budget & Rate-Limit Configurator */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Tenant AI Budget &amp; Tier Controls
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-700 font-medium">
              {budgetUtilPct}% of Monthly Cap
            </span>
          </div>

          {/* Budget Utilization Meter */}
          <div className="space-y-1">
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  budgetUtilPct >= 90
                    ? "bg-red-600"
                    : budgetUtilPct >= 75
                      ? "bg-amber-500"
                      : "bg-teal-600"
                }`}
                style={{ width: `${budgetUtilPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-mono tabular-nums text-slate-600">
              <span>Spent: ${estimatedSpend.toFixed(2)}</span>
              <span>Cap: ${policy.monthlyAiSpendBudgetUsd.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Daily Tokens
              </label>
              <input
                type="number"
                min={0}
                disabled={!isAdmin}
                value={dailyTokensInput}
                onChange={(e) => setDailyTokensInput(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 font-mono tabular-nums border border-slate-300 rounded-md text-slate-900 disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Monthly Cap ($)
              </label>
              <input
                type="number"
                min={0}
                disabled={!isAdmin}
                value={monthlySpendInput}
                onChange={(e) => setMonthlySpendInput(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 font-mono tabular-nums border border-slate-300 rounded-md text-slate-900 disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Queries / User / Hr
              </label>
              <input
                type="number"
                min={1}
                disabled={!isAdmin}
                value={hourlyLimitInput}
                onChange={(e) =>
                  setHourlyLimitInput(Math.max(1, Number(e.target.value)))
                }
                className="w-full px-2.5 py-1.5 font-mono tabular-nums border border-slate-300 rounded-md text-slate-900 disabled:bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() =>
                updatePolicy(
                  { allowDeepAnalysis: !policy.allowDeepAnalysis },
                  policy.allowDeepAnalysis
                    ? "Restricted Deep Analysis tier"
                    : "Allowed Deep Analysis tier"
                )
              }
              className={`px-3 py-1.5 rounded-md border font-medium whitespace-nowrap disabled:opacity-50 ${
                policy.allowDeepAnalysis
                  ? "bg-teal-50 border-teal-200 text-teal-900"
                  : "bg-amber-50 border-amber-300 text-amber-950"
              }`}
            >
              Deep Analysis: {policy.allowDeepAnalysis ? "Allowed" : "Restricted"}
            </button>

            <button
              type="button"
              disabled={!isAdmin}
              onClick={() =>
                updatePolicy(
                  {
                    requireApprovalForHighCost:
                      !policy.requireApprovalForHighCost,
                  },
                  "Toggled High-Cost Query Approval Gate"
                )
              }
              className="px-3 py-1.5 rounded-md border border-slate-300 bg-slate-50 font-medium text-slate-800 whitespace-nowrap disabled:opacity-50"
            >
              High-Cost Gate: {policy.requireApprovalForHighCost ? "On" : "Off"}
            </button>

            <button
              type="button"
              disabled={!isAdmin}
              onClick={() =>
                updatePolicy(
                  {
                    budgetExhaustionMode:
                      policy.budgetExhaustionMode === "Hard Stop"
                        ? "Warning Only"
                        : "Hard Stop",
                  },
                  "Updated Budget Exhaustion Enforcement Mode"
                )
              }
              className="px-3 py-1.5 rounded-md border border-slate-300 bg-slate-50 font-medium text-slate-800 whitespace-nowrap disabled:opacity-50"
            >
              Exhaustion: {policy.budgetExhaustionMode}
            </button>

            <button
              type="button"
              disabled={!isAdmin}
              onClick={() =>
                updatePolicy(
                  {
                    cachePolicy:
                      policy.cachePolicy === "Strict Scoped Reuse"
                        ? "Bypass Cache"
                        : "Strict Scoped Reuse",
                  },
                  "Updated Scoped Query Cache Policy"
                )
              }
              className="px-3 py-1.5 rounded-md border border-slate-300 bg-slate-50 font-medium text-slate-800 whitespace-nowrap disabled:opacity-50"
            >
              Cache: {policy.cachePolicy === "Strict Scoped Reuse" ? "Scoped Reuse" : "Bypass"}
            </button>

            <button
              type="button"
              disabled={!isAdmin}
              onClick={() =>
                updatePolicy(
                  {
                    maxQueryWindowMonths:
                      policy.maxQueryWindowMonths === 12 ? 6 : 12,
                  },
                  `Updated maximum historical query window to ${policy.maxQueryWindowMonths === 12 ? 6 : 12} months`
                )
              }
              className="col-span-2 px-3 py-1.5 rounded-md border border-slate-300 bg-slate-50 font-medium text-slate-800 whitespace-nowrap disabled:opacity-50"
            >
              Max Historical Query Window: {policy.maxQueryWindowMonths} Months
            </button>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  updatePolicy(
                    {
                      dailyTenantTokenBudget: dailyTokensInput,
                      monthlyAiSpendBudgetUsd: monthlySpendInput,
                      userHourlyQueryLimit: hourlyLimitInput,
                    },
                    `Updated budgets: ${dailyTokensInput.toLocaleString()} daily tokens, $${monthlySpendInput}/mo, ${hourlyLimitInput} queries/hr`
                  )
                }
                className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap"
              >
                Apply Budget &amp; Limits
              </button>
              <button
                type="button"
                onClick={() => {
                  setDailyTokensInput(5000);
                  setMonthlySpendInput(5);
                  updatePolicy(
                    {
                      dailyTenantTokenBudget: 5000,
                      monthlyAiSpendBudgetUsd: 5,
                      budgetExhaustionMode: "Hard Stop",
                    },
                    "Demo Test: Lowered tenant budget below current spend to demonstrate Hard Stop"
                  );
                }}
                className="py-2 px-3 text-xs font-medium text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg whitespace-nowrap"
              >
                Test Low Budget Cap
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cost by Agent Stacked Bar + Request Distribution Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Daily Estimated AI Spend by Product ($)
          </h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#334155" }} />
                <YAxis tick={{ fontSize: 12, fill: "#334155" }} />
                <Tooltip contentStyle={{ fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="Advisor ($)" stackId="cost" fill="#0d9488" />
                <Bar dataKey="Retention ($)" stackId="cost" fill="#0284c7" />
                <Bar dataKey="Dispute ($)" stackId="cost" fill="#7c3aed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Query Volume Distribution Across 3 AI Products
          </h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={requestDistribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={3}
                >
                  {requestDistribution.map((entry, idx) => (
                    <Cell
                      key={entry.name}
                      fill={DONUT_COLORS[idx % DONUT_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Blocked Requests, Policy Violations & Live Telemetry Table */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">
            Agent Usage, Blocked Requests &amp; Live Query Telemetry
          </h2>
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTelemetryView("all")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                telemetryView === "all"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Telemetry Events ({filteredEvents.length})
            </button>
            <button
              type="button"
              onClick={() => setTelemetryView("policy")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                telemetryView === "policy"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Blocked &amp; Policy Events ({policyEvents.length})
            </button>
          </div>
        </div>
        <TanStackDataTable
          pageSize={10}
          columns={[
            { key: "timestamp", header: "Timestamp" },
            { key: "product", header: "AI Product" },
            { key: "user", header: "User / Job" },
            { key: "region", header: "Scope" },
            { key: "type", header: "Request Type" },
            { key: "status", header: "Status" },
            { key: "tokens", header: "Tokens", align: "right" },
            { key: "detail", header: "Event Detail" },
          ]}
          rows={displayedEvents.map((e) => ({
            timestamp: e.timestamp,
            product: e.product,
            user: e.user,
            region: e.region,
            type: e.requestType,
            status: e.status,
            tokens: `${e.tokensConsumed.toLocaleString()} ${e.isLiveGeminiMetadata ? "(live)" : "(sim)"}`,
            detail: e.detail,
          }))}
        />
      </div>
    </div>
  );
};
