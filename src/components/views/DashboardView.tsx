import React, { useMemo, useState } from "react";
import {
  CalendarClock,
  Clock,
  Database,
  MessageSquarePlus,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAppState } from "../../context/AppStateContext";
import { extractFreshnessMetadata } from "../../services/agentService";
import {
  formatCurrency,
  formatPct,
  formatSignedPct,
  formatSignedPts,
  getScopeAggregateKPIs,
} from "../../services/analyticsService";
import { buildSavedInsightVisualSpec } from "../../services/dashboardScheduleService";
import {
  getSourceSystems,
  PERSONAS,
  SALONS,
} from "../../services/syntheticDataService";
import { SavedDashboardWidget, SavedInsight } from "../../types/domain";
import { VisualizationRenderer } from "../common/VisualizationRenderer";

const WidgetScheduleCard: React.FC<{
  widget: SavedDashboardWidget;
  dataVersion: number;
  schedulingGloballyEnabled: boolean;
}> = ({ widget, dataVersion, schedulingGloballyEnabled }) => {
  const {
    updateDashboardWidgetSchedule,
    refreshDashboardWidgetNow,
    removeDashboardWidget,
    openZenneWithPrompt,
  } = useAppState();

  const [editingSchedule, setEditingSchedule] = useState(false);
  const [timeInput, setTimeInput] = useState(widget.scheduledTime);
  const [cadenceInput, setCadenceInput] = useState<"Daily" | "Weekly">(
    widget.cadence
  );
  const [enabledInput, setEnabledInput] = useState(widget.scheduleEnabled);

  const visualSpec = useMemo(() => {
    const adapterInsight = {
      topicKey: widget.topicKey,
      chartType: widget.chartType,
      authorizedSalonIds: widget.scopedSalonIds,
    } as SavedInsight;
    return buildSavedInsightVisualSpec(adapterInsight, dataVersion, "all");
  }, [widget.topicKey, widget.chartType, widget.scopedSalonIds, dataVersion]);

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    updateDashboardWidgetSchedule(
      widget.id,
      timeInput || "08:00",
      cadenceInput,
      enabledInput
    );
    setEditingSchedule(false);
  };

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
      <div className="space-y-4">
        {/* Widget Top Header & Actions */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span className="font-medium text-purple-800">
                Saved from Zenne
              </span>
              <span aria-hidden="true">·</span>
              <span>{widget.roleLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{widget.scopeLabel}</span>
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              {widget.widgetName}
            </h3>
            <div className="text-xs text-slate-600">
              Question: &ldquo;{widget.originalQuestion}&rdquo;
              {widget.clarificationFocus ? (
                <span className="text-purple-800 font-medium">
                  {" "}
                  · Focus: {widget.clarificationFocus}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => refreshDashboardWidgetNow(widget.id)}
              title="Refresh widget data now"
              className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md inline-flex items-center gap-1 whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5 text-purple-700" />
              Refresh Now
            </button>
            <button
              type="button"
              onClick={() => setEditingSchedule(!editingSchedule)}
              className="px-2.5 py-1.5 text-xs font-medium border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 rounded-md inline-flex items-center gap-1 whitespace-nowrap"
            >
              <CalendarClock className="w-3.5 h-3.5 text-purple-700" />
              Schedule Time
            </button>
            <button
              type="button"
              onClick={() => removeDashboardWidget(widget.id)}
              title="Remove widget from Dashboard"
              className="p-1.5 text-slate-400 hover:text-red-700 rounded-md"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Explicit Data Freshness & Scheduled Time Metadata Line */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 bg-slate-50/80 border border-slate-200/80 rounded-lg px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <span className="font-semibold text-slate-800">
              Data Freshness:
            </span>
            <span className="font-mono tabular-nums text-slate-900">
              {widget.dataFreshness.dataDate}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-900">
              {widget.dataFreshness.dataTime}
            </span>
            <span aria-hidden="true">·</span>
            <span>Source: {widget.dataFreshness.sourceName}</span>
            <span aria-hidden="true">·</span>
            <span
              className={`font-semibold ${
                widget.dataFreshness.status === "Fresh"
                  ? "text-emerald-700"
                  : "text-amber-700"
              }`}
            >
              {widget.dataFreshness.status}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 font-mono tabular-nums text-[11px] text-slate-600">
            <Clock className="w-3.5 h-3.5 text-purple-700 shrink-0" />
            <span>
              {!schedulingGloballyEnabled
                ? "Schedule Paused by Admin"
                : widget.scheduleEnabled
                  ? `Scheduled: ${widget.cadence} at ${widget.scheduledTime}`
                  : "Manual Refresh Only"}
            </span>
            <span aria-hidden="true">·</span>
            <span>Last Refreshed: {widget.lastRefreshedAt}</span>
          </div>
        </div>

        {/* Inline Schedule Time Editor */}
        {editingSchedule && (
          <form
            onSubmit={handleSaveSchedule}
            className="p-3.5 rounded-lg bg-purple-50/70 border border-purple-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
          >
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-slate-700">
                Cadence
              </label>
              <select
                value={cadenceInput}
                onChange={(e) =>
                  setCadenceInput(e.target.value as "Daily" | "Weekly")
                }
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-purple-300 rounded-md text-slate-900"
              >
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly (Mondays)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-slate-700">
                Refresh Time (Local)
              </label>
              <input
                type="time"
                required
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-purple-300 rounded-md text-slate-900"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-800 pb-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={enabledInput}
                onChange={(e) => setEnabledInput(e.target.checked)}
                className="rounded border-purple-300 text-purple-700 focus:ring-purple-600"
              />
              <span>Auto-Refresh Active</span>
            </label>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingSchedule(false)}
                className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-md whitespace-nowrap"
              >
                Save Time
              </button>
            </div>
          </form>
        )}

        {/* KPI Row */}
        {widget.kpis.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {widget.kpis.slice(0, 3).map((kpi) => (
              <div
                key={kpi.id}
                className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/40 space-y-0.5"
              >
                <div className="text-[11px] text-slate-500">{kpi.label}</div>
                <div className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                  {kpi.currentValue}
                </div>
                <div
                  className={`text-[11px] font-mono tabular-nums ${
                    kpi.varianceDirection === "positive"
                      ? "text-emerald-700"
                      : kpi.varianceDirection === "negative"
                        ? "text-red-700"
                        : "text-slate-600"
                  }`}
                >
                  {kpi.varianceLabel}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Live Chart */}
        <div className="pt-1">
          <VisualizationRenderer
            chartType={visualSpec.chartType}
            chartData={visualSpec.chartData}
            heatmapData={visualSpec.heatmapData}
            funnelData={visualSpec.funnelData}
            height={220}
          />
        </div>

        {/* Insights & Recommendations */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <div className="font-semibold text-slate-900">Key Insights</div>
            <p className="text-slate-700 leading-relaxed">{widget.summary}</p>
            {widget.interpretation && (
              <p className="text-slate-600 leading-relaxed">
                {widget.interpretation}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="font-semibold text-slate-900">
              Recommended Actions
            </div>
            {widget.recommendations.length === 0 ? (
              <p className="text-slate-500">
                Continue monitoring scheduled refreshes for threshold changes.
              </p>
            ) : (
              <ul className="space-y-1.5 text-slate-700">
                {widget.recommendations.slice(0, 2).map((rec) => (
                  <li key={rec.id} className="leading-relaxed">
                    <span className="font-semibold text-purple-900">
                      {rec.priority}:
                    </span>{" "}
                    {rec.title}{" "}
                    <span className="text-emerald-800 font-medium">
                      ({rec.expectedImpactDirection})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Footer Link to Re-open in Zenne */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-500 font-mono tabular-nums">
          Next Run: {widget.nextScheduledLabel}
        </span>
        <button
          type="button"
          onClick={() => openZenneWithPrompt(widget.originalQuestion)}
          className="text-purple-800 hover:text-purple-950 font-semibold inline-flex items-center gap-1 whitespace-nowrap"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Explore Deeper in Zenne
        </button>
      </div>
    </article>
  );
};

export const DashboardView: React.FC = () => {
  const {
    activePersona,
    authSession,
    dataVersion,
    demoTimeOffsetHours,
    posSyncRefreshed,
    dashboardWidgets,
    runScheduledWidgetRefreshes,
    advanceDemoTime,
    openZenneWithPrompt,
    policy,
    setActiveNav,
  } = useAppState();

  const persona = PERSONAS[activePersona];
  const [widgetScopeFilter, setWidgetScopeFilter] = useState<"role" | "all">(
    "role"
  );

  const scopedSalonIds = useMemo(
    () =>
      persona.canViewAllRegions
        ? SALONS.map((s) => s.id)
        : persona.allowedSalonIds,
    [persona]
  );

  const aggKpis = useMemo(
    () => getScopeAggregateKPIs(scopedSalonIds, dataVersion),
    [scopedSalonIds, dataVersion]
  );

  const sources = useMemo(
    () => getSourceSystems(demoTimeOffsetHours, posSyncRefreshed),
    [demoTimeOffsetHours, posSyncRefreshed]
  );

  const warehouseFreshness = useMemo(
    () => extractFreshnessMetadata(sources["SRC-WAREHOUSE-DAILY"]),
    [sources]
  );
  const bookingFreshness = useMemo(
    () => extractFreshnessMetadata(sources["SRC-BOOKING-STREAM"]),
    [sources]
  );
  const posFreshness = useMemo(
    () => extractFreshnessMetadata(sources["SRC-POS-RETAIL"]),
    [sources]
  );

  const visibleWidgets = useMemo(() => {
    if (!persona.canViewAllRegions) {
      return dashboardWidgets.filter((w) => w.ownerPersona === activePersona);
    }
    if (widgetScopeFilter === "role") {
      const roleMatches = dashboardWidgets.filter(
        (w) => w.ownerPersona === activePersona
      );
      return roleMatches.length > 0 ? roleMatches : dashboardWidgets;
    }
    return dashboardWidgets;
  }, [dashboardWidgets, persona.canViewAllRegions, activePersona, widgetScopeFilter]);

  return (
    <div className="space-y-8">
      {/* Page Header & Explicit Data Freshness Strip */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">
              {authSession.roleLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {persona.assignedRegion} ({scopedSalonIds.length} Authorized
              Salons)
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Dataset v{dataVersion}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {activePersona === "meera"
              ? "Executive Wellness & Multi-Region Dashboard"
              : activePersona === "neha"
                ? "Tenant Wellness Intelligence Dashboard"
                : "Regional Wellness & Studio Performance Dashboard"}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 pt-0.5">
            <span className="font-semibold text-slate-800">
              Live Data Freshness:
            </span>
            <span>
              Financial Batch:{" "}
              <strong className="font-mono tabular-nums font-medium text-slate-900">
                {warehouseFreshness.dataDate} {warehouseFreshness.dataTime}
              </strong>{" "}
              ({warehouseFreshness.status})
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Booking Stream:{" "}
              <strong className="font-mono tabular-nums font-medium text-slate-900">
                {bookingFreshness.dataDate} {bookingFreshness.dataTime}
              </strong>{" "}
              ({bookingFreshness.status})
            </span>
            <span aria-hidden="true">·</span>
            <span>
              POS Retail SKU Sync:{" "}
              <strong
                className={`font-mono tabular-nums font-medium ${
                  posFreshness.status === "Fresh"
                    ? "text-emerald-700"
                    : "text-amber-700"
                }`}
              >
                {posFreshness.dataDate} {posFreshness.dataTime} (
                {posFreshness.status})
              </strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => advanceDemoTime(24)}
            className="px-3 py-2 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Simulate +24h Clock
          </button>

          <button
            type="button"
            onClick={runScheduledWidgetRefreshes}
            className="px-3.5 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 text-teal-700" />
            Run Scheduled Refreshes
          </button>

          {persona.canConfigureGovernance ? (
            <button
              type="button"
              onClick={() => setActiveNav("settings")}
              className="px-4 py-2 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Govern AI Agents in Settings
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openZenneWithPrompt()}
              className="px-4 py-2 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              Ask Zenne Deep Research
            </button>
          )}
        </div>
      </div>

      {/* 4-Card Certified Wellness KPI Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">
            30-Day Net Revenue ({scopedSalonIds.length} Salons)
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatCurrency(aggKpis.totalRevenue)}
          </div>
          <div className="text-xs font-mono tabular-nums flex items-center gap-1.5">
            <span
              className={
                aggKpis.revGrowthMoMPct >= 0
                  ? "text-emerald-700 font-semibold"
                  : "text-red-700 font-semibold"
              }
            >
              {formatSignedPct(aggKpis.revGrowthMoMPct)} MoM
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span className="text-slate-500">
              {aggKpis.completedVisits.toLocaleString()} visits
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">
            Repeat-Visit Rate
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatPct(aggKpis.avgRepeatRate)}
          </div>
          <div className="text-xs font-mono tabular-nums flex items-center gap-1.5">
            <span
              className={
                aggKpis.repeatDeltaPts >= 0
                  ? "text-emerald-700 font-semibold"
                  : "text-red-700 font-semibold"
              }
            >
              {formatSignedPts(aggKpis.repeatDeltaPts)} vs 3-mo baseline
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span className="text-slate-500">
              Baseline {formatPct(aggKpis.baselineRepeatRate)}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">
            Stylist Roster Utilization
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatPct(aggKpis.utilizationPct)}
          </div>
          <div className="text-xs font-mono tabular-nums flex items-center gap-1.5">
            <span
              className={
                aggKpis.utilizationDeltaPts >= 0
                  ? "text-emerald-700 font-semibold"
                  : "text-amber-700 font-semibold"
              }
            >
              {aggKpis.unusedHours.toLocaleString()} unused hrs
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span className="text-slate-500">
              {formatSignedPts(aggKpis.utilizationDeltaPts)} vs baseline
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">
            Contribution Margin
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatPct(aggKpis.contributionMarginPct)}
          </div>
          <div className="text-xs font-mono tabular-nums flex items-center gap-1.5">
            <span className="text-teal-700 font-semibold">
              {formatCurrency(aggKpis.contributionDollars)} est.
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span className="text-slate-500">
              Avg Ticket {formatCurrency(aggKpis.avgTicket)}
            </span>
          </div>
        </div>
      </section>

      {/* Saved Zenne Research Widgets & Scheduled Refreshes */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Saved Zenne Conversations &amp; Scheduled Widgets
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Ask deep research questions in Zenne (bottom-right purple icon),
              answer clarifying follow-ups, and save any conversation here with
              an automated daily or weekly refresh time.
            </p>
          </div>

          {persona.canViewAllRegions && (
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setWidgetScopeFilter("role")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  widgetScopeFilter === "role"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {persona.shortLabel} Widgets
              </button>
              <button
                type="button"
                onClick={() => setWidgetScopeFilter("all")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  widgetScopeFilter === "all"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Organization Widgets ({dashboardWidgets.length})
              </button>
            </div>
          )}
        </div>

        {visibleWidgets.length === 0 ? (
          <div className="bg-white border border-dashed border-purple-300 rounded-xl p-8 text-center space-y-3">
            <div className="text-sm font-semibold text-slate-900">
              No Zenne conversation widgets saved for this view yet
            </div>
            <p className="text-xs text-slate-600 max-w-lg mx-auto">
              Open the purple Zenne chatbot in the bottom-right corner, ask a
              deep research question, respond to Zenne&apos;s clarifying
              questions, and click &ldquo;Save to Dashboard &amp; Schedule
              Refresh&rdquo;.
            </p>
            <button
              type="button"
              onClick={() =>
                openZenneWithPrompt(
                  activePersona === "meera"
                    ? "Where should I focus to improve profitability this quarter?"
                    : "Which salons had the biggest decline in repeat visits in the last 30 days?"
                )
              }
              className="px-4 py-2 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Start Deep Research in Zenne
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {visibleWidgets.map((widget) => (
              <WidgetScheduleCard
                key={widget.id}
                widget={widget}
                dataVersion={dataVersion}
                schedulingGloballyEnabled={policy.schedulingEnabled}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
