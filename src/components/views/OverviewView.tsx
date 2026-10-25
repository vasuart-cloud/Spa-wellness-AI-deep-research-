import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookmarkCheck,
  Download,
  FileText,
  Gauge,
  MessageSquareText,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppState } from "../../context/AppStateContext";
import {
  formatCurrency,
  formatPct,
  formatSignedPct,
  formatSignedPts,
  getRegionalSummaries,
  getSalonComparisons,
  getScopeAggregateKPIs,
} from "../../services/analyticsService";
import { exportExecutiveBriefPdf } from "../../services/exportShareService";
import { getSourceSystems, PERSONAS } from "../../services/syntheticDataService";
import { TanStackDataTable } from "../common/TanStackDataTable";

export const OverviewView: React.FC = () => {
  const {
    activePersona,
    setActiveNav,
    setOpportunitiesSubTab,
    askAdvisor,
    dataVersion,
    demoTimeOffsetHours,
    posSyncRefreshed,
    opportunities,
    triggeredAlerts,
    interventions,
    savedInsights,
    policy,
    safetyResults,
    controlTowerEvents,
    presenterHintsEnabled,
    verifyExportChannelAllowed,
    appendAuditEvent,
    notify,
  } = useAppState();

  const persona = PERSONAS[activePersona];
  const agg = getScopeAggregateKPIs(persona.allowedSalonIds, dataVersion);
  const regional = getRegionalSummaries(persona.allowedSalonIds, dataVersion);
  const salonComps = getSalonComparisons(persona.allowedSalonIds, dataVersion);
  const sources = getSourceSystems(demoTimeOffsetHours, posSyncRefreshed);

  const scopedOpportunities = opportunities.filter(
    (o) =>
      persona.canViewAllRegions ||
      o.region === persona.assignedRegion ||
      o.region === "Multiple Regions"
  );

  // ========================================================
  // B. MEERA — DISTINCT COO EXECUTIVE EXPERIENCE (Section 7)
  // ========================================================
  if (activePersona === "meera") {
    const totalRisk = regional.reduce((s, r) => s + r.revenueAtRiskDollars, 0);
    const completedValueMonthly = interventions
      .filter((i) => i.status === "Completed & Validated")
      .reduce((s, i) => s + i.estimatedNetContributionMonthly, 0);

    const topRegion = [...regional].sort(
      (a, b) => b.avgContributionMarginPct - a.avgContributionMarginPct
    )[0];
    const bottomRegion = [...regional].sort(
      (a, b) => a.avgRepeatVisitRate - b.avgRepeatVisitRate
    )[0];

    const handleExecBrief = () => {
      if (!verifyExportChannelAllowed("PDF", "COO Executive Brief PDF")) {
        return;
      }
      exportExecutiveBriefPdf({
        dataVersion,
        demoTimeOffsetHours,
        posSyncRefreshed,
        opportunities,
        interventions,
        personaId: activePersona,
      });
      appendAuditEvent(
        "REPORT_EXPORTED",
        "Generated COO Executive Brief PDF across 20 salons",
        "Allowed",
        "PDF Download"
      );
      notify("Downloaded COO Executive Brief PDF.", "teal");
    };

    return (
      <div className="space-y-8">
        {/* Executive Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-600">
              COO Executive Command · All 20 Salons Across 4 Regions
              {presenterHintsEnabled && (
                <span> · Zenoti-Inspired Executive KPIs + Proposed ROI &amp; Brief Enhancements</span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Executive Performance &amp; Value Summary
            </h1>
            <p className="text-sm text-slate-700 max-w-3xl">
              Concise organization-wide view of revenue growth, contribution margin, retention risks, and validated financial impact from manager interventions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={async () => {
                setActiveNav("advisor");
                await askAdvisor("How is our business performing this month?");
              }}
              className="px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <MessageSquareText className="w-3.5 h-3.5 text-violet-700" />
              Ask Executive Advisor
            </button>
            <button
              type="button"
              onClick={handleExecBrief}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Generate Executive Brief (PDF)
            </button>
          </div>
        </div>

        {/* 6 Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[
            {
              label: "Total Net Revenue (30d)",
              value: formatCurrency(agg.totalRevenue),
              sub: `${formatSignedPct(agg.revGrowthMoMPct)} vs Sep`,
              tone: agg.revGrowthMoMPct >= 0 ? "text-emerald-700" : "text-red-700",
            },
            {
              label: "Estimated Contribution",
              value: formatCurrency(agg.contributionDollars),
              sub: `${formatPct(agg.contributionMarginPct)} org margin`,
              tone: "text-slate-700",
            },
            {
              label: "Repeat-Visit Rate",
              value: formatPct(agg.avgRepeatRate),
              sub: `${formatSignedPts(agg.repeatDeltaPts)} vs 3-mo base`,
              tone: agg.repeatDeltaPts >= 0 ? "text-emerald-700" : "text-amber-800",
            },
            {
              label: "Staff Utilization",
              value: formatPct(agg.utilizationPct),
              sub: `${agg.unusedHours.toLocaleString()} unused hrs`,
              tone: "text-slate-700",
            },
            {
              label: "Monthly Revenue at Risk",
              value: formatCurrency(totalRisk),
              sub: `${opportunities.filter((o) => o.status !== "Completed").length} open opportunities`,
              tone: "text-red-700",
            },
            {
              label: "Validated Pilot Net Lift",
              value: `+${formatCurrency(completedValueMonthly)}/mo`,
              sub: "Holdout-verified pilot",
              tone: "text-teal-700",
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5"
            >
              <div className="text-xs font-medium text-slate-600">{kpi.label}</div>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
                {kpi.value}
              </div>
              <div className={`text-xs font-mono tabular-nums ${kpi.tone}`}>
                {kpi.sub}
              </div>
            </div>
          ))}
        </div>

        {/* Regional Comparison Chart + Attention / Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Regional Revenue &amp; Contribution Comparison ($k)
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Top margin: {topRegion?.region} ({formatPct(topRegion?.avgContributionMarginPct ?? 0)}) · Retention watchlist: {bottomRegion?.region} ({formatPct(bottomRegion?.avgRepeatVisitRate ?? 0)} repeat)
                </p>
              </div>
              <span className="text-xs text-slate-600 font-mono whitespace-nowrap">
                Daily Batch 04:00 AM
              </span>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regional.map((r) => ({
                  name: r.region,
                  "Net Revenue ($k)": Math.round(r.totalRevenue / 1000),
                  "Contribution ($k)": Math.round(r.estimatedContributionDollars / 1000),
                  "Rev at Risk ($k)": Math.round(r.revenueAtRiskDollars / 1000),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#334155" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#334155" }} />
                  <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="Net Revenue ($k)" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Contribution ($k)" fill="#0284c7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Rev at Risk ($k)" fill="#d97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">
                  Executive Risks Requiring Attention
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setOpportunitiesSubTab("pipeline");
                    setActiveNav("opportunities");
                  }}
                  className="text-xs font-medium text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  All Opportunities <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {opportunities.slice(0, 3).map((opp) => (
                  <div key={opp.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900">
                        {opp.title}
                      </span>
                      <span className="font-mono font-semibold text-red-700 tabular-nums whitespace-nowrap">
                        {formatCurrency(opp.monthlyImpactDollars)}/mo
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 line-clamp-2">
                      {opp.supportingEvidence}
                    </p>
                    <div className="text-xs text-slate-600">
                      {opp.region} · Owner: {opp.assignedOwner} · Status: {opp.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveNav("saved-insights")}
                className="text-xs font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <BookmarkCheck className="w-3.5 h-3.5 text-teal-700" />
                Compare Regional Saved Insights ({savedInsights.filter((i) => i.ownerPersona === "arjun").length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpportunitiesSubTab("business-value");
                  setActiveNav("opportunities");
                }}
                className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 whitespace-nowrap"
              >
                Verify Holdout ROI <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Regional Comparison Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              All 4 Regions — Certified Financial &amp; Operational Scorecard
            </h2>
            <span className="text-xs text-slate-500">
              Warehouse Close: {sources["SRC-WAREHOUSE-DAILY"].dataThroughTimestamp}
            </span>
          </div>
          <TanStackDataTable
            columns={[
              { key: "region", header: "Region" },
              { key: "salons", header: "Salons", align: "right" },
              { key: "revenue", header: "Net Revenue", align: "right" },
              { key: "growth", header: "MoM Growth", align: "right" },
              { key: "margin", header: "Contrib. Margin", align: "right" },
              { key: "repeat", header: "Repeat Rate", align: "right" },
              { key: "util", header: "Stylist Util.", align: "right" },
              { key: "risk", header: "Monthly Rev at Risk", align: "right" },
            ]}
            rows={regional.map((r) => ({
              region: r.region,
              salons: r.salonCount,
              revenue: formatCurrency(r.totalRevenue),
              growth: formatSignedPct(r.revenueGrowthPct),
              margin: `${formatPct(r.avgContributionMarginPct)} (${formatCurrency(r.estimatedContributionDollars)})`,
              repeat: formatPct(r.avgRepeatVisitRate),
              util: `${formatPct(r.avgStaffUtilizationPct)} (${r.unusedStylistHours}h idle)`,
              risk: formatCurrency(r.revenueAtRiskDollars),
            }))}
          />
        </div>
      </div>
    );
  }

  // ========================================================
  // C. NEHA — CUSTOMER ADMIN GOVERNANCE OVERVIEW
  // ========================================================
  if (activePersona === "neha") {
    const totalTokens = controlTowerEvents.reduce(
      (s, e) => s + e.tokensConsumed,
      0
    );
    const totalSpend = controlTowerEvents.reduce((s, e) => s + e.costUsd, 0);
    const blockedCount = controlTowerEvents.filter(
      (e) => e.status === "Blocked" || e.status === "Policy Violation"
    ).length;
    const passCount = safetyResults.filter((s) => s.status === "Pass").length;

    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">
              Tenant AI Platform Administration · Elevate Salon &amp; Wellness Group
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Governance, Cost &amp; Safety Posture
            </h1>
            <p className="text-sm text-slate-600 max-w-3xl">
              Centralized oversight across AI Business Advisor, AI Retention Manager, and AI Dispute Manager.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveNav("governance")}
              className="px-3.5 py-2 text-xs font-medium border border-slate-300 bg-white hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
              Open 6-Pillar Governance
            </button>
            <button
              type="button"
              onClick={() => setActiveNav("control-tower")}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Gauge className="w-3.5 h-3.5" />
              Open AI Control Tower
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
            <div className="text-xs text-slate-500">Monthly AI Spend vs Budget</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
              ${totalSpend.toFixed(2)} / ${policy.monthlyAiSpendBudgetUsd}
            </div>
            <div className="text-xs text-slate-600">
              Mode: {policy.budgetExhaustionMode}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
            <div className="text-xs text-slate-500">7-Day Tokens Consumed</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
              {totalTokens.toLocaleString()}
            </div>
            <div className="text-xs text-slate-600">
              Daily cap: {policy.dailyTenantTokenBudget.toLocaleString()} tokens
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
            <div className="text-xs text-slate-500">Safety Evaluation Checks</div>
            <div className="text-xl font-bold font-mono tabular-nums text-teal-700">
              {passCount} / {safetyResults.length} Passing
            </div>
            <div className="text-xs text-slate-600">
              {sources["SRC-POS-RETAIL"].status === "Stale"
                ? "1 Amber (POS Retail Stale Guardrail)"
                : "All data feeds within SLA"}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
            <div className="text-xs text-slate-500">Blocked / Policy Events</div>
            <div className="text-xl font-bold font-mono tabular-nums text-amber-700">
              {blockedCount}
            </div>
            <div className="text-xs text-slate-600">
              Zero unauthorized data leaks
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Source Data Freshness &amp; Pipeline Health
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.values(sources).map((src) => (
              <div
                key={src.id}
                className="p-4 rounded-lg border border-slate-200 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-900">
                    {src.name}
                  </span>
                  <span
                    className={`text-xs font-mono font-semibold ${
                      src.status === "Fresh" ? "text-teal-700" : "text-amber-700"
                    }`}
                  >
                    {src.status} ({src.ageHours}h)
                  </span>
                </div>
                <div className="text-xs text-slate-600">
                  {src.updateScheduleLabel} · Through {src.dataThroughTimestamp}
                </div>
                <div className="text-xs text-slate-700">{src.notes}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ========================================================
  // A. ARJUN — REGIONAL MANAGER OVERVIEW (5 PNW Salons)
  // ========================================================
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="text-xs text-slate-500">
            Regional Operations Workspace · Pacific Northwest (5 Authorized Salons)
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Pacific Northwest Regional Pulse
          </h1>
          <p className="text-sm text-slate-600 max-w-3xl">
            Monitor repeat guest retention, stylist roster utilization, and revenue targets across your 5 assigned salons.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveNav("dashboards")}
            className="px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5 text-teal-700" />
            Custom Dashboards
          </button>
          <button
            type="button"
            onClick={async () => {
              setActiveNav("advisor");
              await askAdvisor(
                "Which salons had the biggest decline in repeat visits in the last 30 days?"
              );
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            Investigate Repeat Visits in Advisor
          </button>
        </div>
      </div>

      {/* 4 Regional KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-500">PNW Net Revenue (30d)</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
            {formatCurrency(agg.totalRevenue)}
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-600">
            {formatSignedPct(agg.revGrowthMoMPct)} vs prior month ·{" "}
            {agg.completedVisits.toLocaleString()} visits
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Repeat-Visit Rate</div>
          <div className="text-xl font-bold font-mono tabular-nums text-red-700">
            {formatPct(agg.avgRepeatRate)}
          </div>
          <div className="text-xs font-mono tabular-nums text-red-700">
            {formatSignedPts(agg.repeatDeltaPts)} vs {formatPct(agg.baselineRepeatRate)} baseline
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Stylist Utilization</div>
          <div className="text-xl font-bold font-mono tabular-nums text-amber-700">
            {formatPct(agg.utilizationPct)}
          </div>
          <div className="text-xs font-mono tabular-nums text-amber-700">
            {agg.unusedHours.toLocaleString()} unused roster hrs (30d)
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Active Regional Alerts</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
            {triggeredAlerts.filter((a) => a.status === "Active").length}
          </div>
          <div className="text-xs text-slate-600">
            {scopedOpportunities.length} open revenue opportunities
          </div>
        </div>
      </div>

      {/* Stale Retail Sync Notice + Priority Alerts */}
      {sources["SRC-POS-RETAIL"].status === "Stale" && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">
                Source Freshness Notice (POS Retail Sync · {sources["SRC-POS-RETAIL"].ageHours}h old):
              </span>{" "}
              {sources["SRC-POS-RETAIL"].notes} Daily service &amp; appointment streams remain current.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveNav("alerts")}
            className="text-xs font-semibold text-amber-900 underline whitespace-nowrap shrink-0"
          >
            View Alert Guardrails
          </button>
        </div>
      )}

      {/* 5 PNW Salons Performance Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Assigned Salons Scorecard (5 Pacific Northwest Locations)
          </h2>
          <button
            type="button"
            onClick={() => {
              setOpportunitiesSubTab("pipeline");
              setActiveNav("opportunities");
            }}
            className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Open Actionable Opportunities
          </button>
        </div>
        <TanStackDataTable
          columns={[
            { key: "salon", header: "Salon" },
            { key: "manager", header: "Salon Manager" },
            { key: "rev", header: "Oct Net Revenue", align: "right" },
            { key: "vsTarget", header: "vs Target", align: "right" },
            { key: "repeat", header: "Repeat % (Delta)", align: "right" },
            { key: "rebook", header: "Rebooking %", align: "right" },
            { key: "util", header: "Utilization %", align: "right" },
            { key: "cancel", header: "Cancel %", align: "right" },
          ]}
          rows={salonComps.map((c) => ({
            salon: c.salon.name,
            manager: c.salon.managerName,
            rev: formatCurrency(c.current.totalRevenue),
            vsTarget: formatCurrency(c.targetVarianceDollars),
            repeat: `${formatPct(c.current.repeatVisitRate)} (${formatSignedPts(c.repeatRateDeltaPts)})`,
            rebook: formatPct(c.current.rebookingRate),
            util: `${formatPct(c.current.staffUtilizationPct)} (${c.unusedHoursCurrent}h idle)`,
            cancel: formatPct(c.current.cancellationRatePct),
          }))}
        />
      </div>
    </div>
  );
};
