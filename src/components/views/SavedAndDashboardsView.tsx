import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Clock,
  Edit3,
  ExternalLink,
  Maximize2,
  Pin,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useAppState } from "../../context/AppStateContext";
import {
  formatCurrency,
  formatPct,
  getRegionalSummaries,
} from "../../services/analyticsService";
import {
  buildSavedInsightVisualSpec,
  recalculateSavedInsightSnapshot,
} from "../../services/dashboardScheduleService";
import { PERSONAS, SALONS } from "../../services/syntheticDataService";
import { SavedInsight } from "../../types/domain";
import { ScheduleConfigModal } from "../common/ShareAndScheduleModals";
import { TanStackDataTable } from "../common/TanStackDataTable";
import { VisualizationRenderer } from "../common/VisualizationRenderer";

export const SavedInsightsView: React.FC = () => {
  const {
    activePersona,
    savedInsights,
    runSavedInsightNow,
    runAllDueScheduledJobs,
    advanceDemoTime,
    demoTimeOffsetHours,
    updateInsightSchedule,
    pinInsightToDashboard,
    setActiveNav,
    askAdvisor,
    dataVersion,
    presenterHintsEnabled,
  } = useAppState();

  const [scheduleInsight, setScheduleInsight] = useState<SavedInsight | null>(
    null
  );
  const [compareCrossRegionInsight, setCompareCrossRegionInsight] =
    useState<SavedInsight | null>(null);

  const persona = PERSONAS[activePersona];
  const visibleInsights = savedInsights.filter(
    (ins) =>
      persona.canViewAllRegions || ins.ownerPersona === activePersona
  );

  const crossRegionRows = compareCrossRegionInsight
    ? getRegionalSummaries(
        SALONS.map((s) => s.id),
        dataVersion
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-600">
            Certified Reusable Analytical Definitions · Clock Offset: +{demoTimeOffsetHours}h
            {presenterHintsEnabled && (
              <span> · Proposed Product Enhancement (REPEAT Pillar)</span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Saved Insights Library
          </h1>
          <p className="text-sm text-slate-700 max-w-3xl">
            Stores structured KPI versions, authorized salon scope, freshness SLAs, and recurring refresh schedules—never static screenshots.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => advanceDemoTime(24)}
            className="px-3 py-2 text-xs font-semibold text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Clock className="w-3.5 h-3.5" />
            Advance Clock (+24h)
          </button>
          <button
            type="button"
            onClick={runAllDueScheduledJobs}
            className="px-3 py-2 text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            Run Due Jobs
          </button>
          <button
            type="button"
            onClick={() => setActiveNav("dashboards")}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap"
          >
            Open Custom Dashboards
          </button>
        </div>
      </div>

      {/* Executive Cross-Regional Comparison Drawer when inspecting a Regional insight */}
      {compareCrossRegionInsight && persona.canViewAllRegions && (
        <div className="bg-white border border-teal-300 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-teal-800">
                COO Cross-Region Expansion · Comparing &ldquo;{compareCrossRegionInsight.title}&rdquo; Across All 4 Regions
              </div>
              <p className="text-xs text-slate-700 mt-0.5">
                Originally saved by {compareCrossRegionInsight.ownerName} ({compareCrossRegionInsight.scopeLabel}); expanded using your 20-salon COO authorization.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCompareCrossRegionInsight(null)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700"
            >
              Close Comparison
            </button>
          </div>

          <TanStackDataTable
            compact
            columns={[
              { key: "region", header: "Region" },
              { key: "repeat", header: "Repeat-Visit Rate", align: "right" },
              { key: "rebook", header: "Rebooking %", align: "right" },
              { key: "util", header: "Stylist Util %", align: "right" },
              { key: "attach", header: "Retail Attach %", align: "right" },
              { key: "margin", header: "Contrib. Margin", align: "right" },
              { key: "revenue", header: "30d Net Revenue", align: "right" },
            ]}
            rows={crossRegionRows.map((r) => ({
              region: r.region,
              repeat: formatPct(r.avgRepeatVisitRate),
              rebook: formatPct(r.avgRebookingRate),
              util: formatPct(r.avgStaffUtilizationPct),
              attach: formatPct(r.avgRetailAttachmentPct),
              margin: formatPct(r.avgContributionMarginPct),
              revenue: formatCurrency(r.totalRevenue),
            }))}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {visibleInsights.map((ins) => (
          <div
            key={ins.id}
            className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                <span>
                  Owner: <strong className="text-slate-800">{ins.ownerName}</strong> ·{" "}
                  {ins.scopeLabel}
                </span>
                <span className="font-mono text-xs text-slate-700">
                  {ins.relativeDateRange}
                </span>
              </div>

              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {ins.title}
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Prompt: &ldquo;{ins.question}&rdquo;
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-slate-600">
                    Latest Certified Value
                  </div>
                  <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
                    {ins.cachedSnapshot.headlineMetric}
                  </div>
                  <div
                    className={`text-xs font-mono tabular-nums font-medium ${
                      ins.cachedSnapshot.trendDirection === "negative"
                        ? "text-red-700"
                        : ins.cachedSnapshot.trendDirection === "positive"
                          ? "text-emerald-700"
                          : "text-slate-700"
                    }`}
                  >
                    {ins.cachedSnapshot.trendLabel}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-600 space-y-0.5 font-mono tabular-nums">
                  <div>Refreshed: {ins.lastRefreshedAt}</div>
                  <div>SLA: &le;{ins.freshnessRequirementHours}h</div>
                  {ins.cachedSnapshot.isStaleWarning && (
                    <div className="text-amber-700 font-semibold">
                      Stale Source Warning
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-1">
                <div>
                  Certified KPIs:{" "}
                  <span className="font-mono text-slate-800">
                    {ins.kpiIdsAndVersions.join(" · ")}
                  </span>
                </div>
                <div>
                  Schedule:{" "}
                  {ins.schedule?.enabled ? (
                    <span
                      className={`font-medium ${
                        ins.schedule.lastRunStatus === "Pending"
                          ? "text-amber-800"
                          : ins.schedule.lastRunStatus === "Paused by Governance"
                            ? "text-red-700"
                            : "text-teal-800"
                      }`}
                    >
                      {ins.schedule.cadence} @ {ins.schedule.timeLocal} ({ins.schedule.timezone}) · Next: {ins.schedule.nextRunAt} · Status: {ins.schedule.lastRunStatus}
                    </span>
                  ) : (
                    <span>Manual refresh only</span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => runSavedInsightNow(ins.id)}
                  className="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" /> Run Now
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleInsight(ins)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <CalendarClock className="w-3.5 h-3.5" /> Schedule
                </button>
                <button
                  type="button"
                  onClick={() => pinInsightToDashboard(ins.id)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Pin className="w-3.5 h-3.5" /> Add to Dashboard
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {persona.canViewAllRegions && ins.ownerPersona === "arjun" && (
                  <button
                    type="button"
                    onClick={() => setCompareCrossRegionInsight(ins)}
                    className="px-3 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 hover:bg-sky-100 rounded-md whitespace-nowrap"
                  >
                    Compare All Regions
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    setActiveNav("advisor");
                    await askAdvisor(ins.question);
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  Open <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ScheduleConfigModal
        open={Boolean(scheduleInsight)}
        onClose={() => setScheduleInsight(null)}
        title={scheduleInsight?.title ?? ""}
        initialSchedule={scheduleInsight?.schedule ?? null}
        onSave={(sched) => {
          if (scheduleInsight) {
            updateInsightSchedule(scheduleInsight.id, sched);
          }
        }}
      />
    </div>
  );
};

export const CustomDashboardsView: React.FC = () => {
  const {
    activePersona,
    dashboards,
    savedInsights,
    createDashboard,
    renameDashboard,
    pinInsightToDashboard,
    removeTileFromDashboard,
    resizeDashboardTile,
    reorderDashboardTile,
    updateDashboardTileSalonFilter,
    refreshSingleTile,
    refreshAllDashboardTiles,
    runAllDueScheduledJobs,
    advanceDemoTime,
    demoTimeOffsetHours,
    posSyncRefreshed,
    dataVersion,
    setActiveNav,
    askAdvisor,
    presenterHintsEnabled,
  } = useAppState();

  const persona = PERSONAS[activePersona];
  // Strict RBAC scope: Regional Managers view only their regional boards; COO/Admin can view org-wide and regional boards
  const visibleDashboards = dashboards.filter(
    (d) => persona.canViewAllRegions || d.ownerPersona === activePersona
  );

  const [selectedDashId, setSelectedDashId] = useState<string>(
    visibleDashboards[0]?.id ?? dashboards[0]?.id ?? ""
  );
  const [newDashModalOpen, setNewDashModalOpen] = useState(false);
  const [newDashName, setNewDashName] = useState("");
  const [newDashDesc, setNewDashDesc] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState("");
  const [addTileInsightId, setAddTileInsightId] = useState<string>("");

  // Sync selected dashboard when persona changes or dashboards update
  useEffect(() => {
    const preferred =
      visibleDashboards.find((d) => d.ownerPersona === activePersona) ??
      visibleDashboards[0];
    if (
      preferred &&
      !visibleDashboards.some((d) => d.id === selectedDashId)
    ) {
      setSelectedDashId(preferred.id);
    }
  }, [activePersona, visibleDashboards, selectedDashId]);

  const activeDashboard =
    visibleDashboards.find((d) => d.id === selectedDashId) ??
    visibleDashboards[0];

  const sortedTiles = activeDashboard
    ? [...activeDashboard.tiles].sort((a, b) => a.order - b.order)
    : [];

  const authorizedSalons = SALONS.filter((s) =>
    persona.allowedSalonIds.includes(s.id)
  );

  const handleCreateDash = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDashName.trim()) return;
    const created = createDashboard(
      newDashName.trim(),
      newDashDesc.trim() || "Custom operational board"
    );
    setSelectedDashId(created.id);
    setNewDashName("");
    setNewDashDesc("");
    setNewDashModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header + Demo Scheduler Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-600">
            Refreshable Certified Insight Boards · Demo Clock Offset: +{demoTimeOffsetHours}h
            {presenterHintsEnabled && (
              <span> · Proposed Enhancement (Refreshable Tiles &amp; Testable Scheduler)</span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Custom Dashboards
          </h1>
          <p className="text-sm text-slate-700">
            Every tile recalculates live from the shared analytics layer while enforcing role permissions and source staleness checks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => advanceDemoTime(24)}
            className="px-3 py-2 text-xs font-semibold text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Clock className="w-3.5 h-3.5" />
            Advance Demo Time (+24h)
          </button>
          <button
            type="button"
            onClick={runAllDueScheduledJobs}
            className="px-3 py-2 text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            Run Due Jobs
          </button>
          {activeDashboard && (
            <button
              type="button"
              onClick={() => refreshAllDashboardTiles(activeDashboard.id)}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh All Tiles
            </button>
          )}
        </div>
      </div>

      {/* Dashboard Selector & Edit Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Select custom dashboard"
            value={activeDashboard?.id ?? ""}
            onChange={(e) => setSelectedDashId(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
          >
            {visibleDashboards.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.tiles.length} tiles)
              </option>
            ))}
          </select>

          {activeDashboard && !renaming && (
            <button
              type="button"
              onClick={() => {
                setRenameText(activeDashboard.name);
                setRenaming(true);
              }}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5" /> Rename
            </button>
          )}

          {activeDashboard && renaming && (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={renameText}
                onChange={(e) => setRenameText(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded-md text-slate-900"
              />
              <button
                type="button"
                onClick={() => {
                  if (renameText.trim()) {
                    renameDashboard(activeDashboard.id, renameText.trim());
                  }
                  setRenaming(false);
                }}
                className="px-2.5 py-1 text-xs font-semibold bg-teal-700 text-white rounded-md"
              >
                Save
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setNewDashModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-teal-800 border border-teal-200 bg-teal-50/70 hover:bg-teal-100 rounded-lg inline-flex items-center gap-1 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" /> New Dashboard
          </button>
        </div>

        {/* Add Saved Insight Tile Picker */}
        {activeDashboard && (
          <div className="flex items-center gap-2">
            <select
              aria-label="Select saved insight to add as tile"
              value={addTileInsightId}
              onChange={(e) => setAddTileInsightId(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
            >
              <option value="">+ Select Saved Insight to Add...</option>
              {savedInsights
                .filter(
                  (i) =>
                    persona.canViewAllRegions ||
                    i.ownerPersona === activePersona
                )
                .map((ins) => (
                  <option key={ins.id} value={ins.id}>
                    {ins.title}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={!addTileInsightId}
              onClick={() => {
                if (addTileInsightId) {
                  pinInsightToDashboard(addTileInsightId, activeDashboard.id);
                  setAddTileInsightId("");
                }
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white disabled:opacity-40 rounded-lg whitespace-nowrap"
            >
              Add Tile
            </button>
          </div>
        )}
      </div>

      {/* Create Dashboard Inline Modal */}
      {newDashModalOpen && (
        <form
          onSubmit={handleCreateDash}
          className="bg-white border border-slate-300 rounded-xl p-5 space-y-3"
        >
          <div className="text-sm font-semibold text-slate-900">
            Create Custom Dashboard
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="Dashboard Name (e.g. Q4 Retention Watch)"
              value={newDashName}
              onChange={(e) => setNewDashName(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900"
            />
            <input
              type="text"
              placeholder="Short description..."
              value={newDashDesc}
              onChange={(e) => setNewDashDesc(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNewDashModalOpen(false)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-semibold bg-teal-700 text-white rounded-lg"
            >
              Create Board
            </button>
          </div>
        </form>
      )}

      {/* Tiles Grid */}
      {activeDashboard && sortedTiles.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <div className="text-sm font-semibold text-slate-800">
            This dashboard has no tiles yet
          </div>
          <p className="text-xs text-slate-600">
            Select a Saved Insight from the dropdown above or click &ldquo;Pin to Dashboard&rdquo; inside AI Business Advisor.
          </p>
        </div>
      )}

      {activeDashboard && sortedTiles.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {sortedTiles.map((tile, idx) => {
            const ins = savedInsights.find(
              (s) => s.id === tile.savedInsightId
            );
            if (!ins) return null;

            const scopedSalonIds = ins.authorizedSalonIds.filter((id) =>
              persona.allowedSalonIds.includes(id)
            );
            const effectiveIds =
              tile.salonFilter === "all"
                ? scopedSalonIds
                : scopedSalonIds.filter((id) => id === tile.salonFilter);
            const safeSalonIds =
              effectiveIds.length > 0 ? effectiveIds : scopedSalonIds;

            const scopedInsight: SavedInsight = {
              ...ins,
              authorizedSalonIds: safeSalonIds,
            };

            const liveSnap = recalculateSavedInsightSnapshot(
              scopedInsight,
              dataVersion,
              demoTimeOffsetHours,
              posSyncRefreshed,
              tile.salonFilter
            );

            const visualSpec = buildSavedInsightVisualSpec(
              scopedInsight,
              dataVersion,
              tile.salonFilter
            );

            // In compact 4-col tiles, render wide heatmaps/funnels as clean bar summaries to avoid horizontal scroll
            const effectiveChartType =
              tile.size === "compact" &&
              (visualSpec.chartType === "heatmap" ||
                visualSpec.chartType === "funnel")
                ? "bar"
                : visualSpec.chartType;

            const colSpan =
              tile.size === "full"
                ? "lg:col-span-12"
                : tile.size === "wide"
                  ? "lg:col-span-8"
                  : "lg:col-span-4";

            return (
              <div
                key={tile.id}
                className={`${colSpan} bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4`}
              >
                <div className="space-y-3">
                  {/* Tile Top Controls */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {ins.title}
                      </h3>
                      <div className="text-xs text-slate-600 font-mono tabular-nums mt-0.5">
                        Refreshed: {ins.lastRefreshedAt} ·{" "}
                        {ins.schedule?.enabled
                          ? `${ins.schedule.cadence} (${ins.schedule.lastRunStatus})`
                          : "Manual"}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      <select
                        value={tile.salonFilter}
                        onChange={(e) =>
                          updateDashboardTileSalonFilter(
                            activeDashboard.id,
                            tile.id,
                            e.target.value
                          )
                        }
                        className="px-2 py-1 text-xs border border-slate-200 rounded bg-slate-50 text-slate-800"
                        title="Filter Tile by Salon"
                      >
                        <option value="all">All Scope Salons</option>
                        {authorizedSalons
                          .filter((s) => ins.authorizedSalonIds.includes(s.id))
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </select>

                      <button
                        type="button"
                        onClick={() =>
                          resizeDashboardTile(
                            activeDashboard.id,
                            tile.id,
                            tile.size === "compact"
                              ? "wide"
                              : tile.size === "wide"
                                ? "full"
                                : "compact"
                          )
                        }
                        className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded"
                        title={`Resize Tile (Current: ${tile.size})`}
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() =>
                          reorderDashboardTile(activeDashboard.id, tile.id, "up")
                        }
                        className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 border border-slate-200 rounded"
                        title="Move Tile Earlier"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === sortedTiles.length - 1}
                        onClick={() =>
                          reorderDashboardTile(
                            activeDashboard.id,
                            tile.id,
                            "down"
                          )
                        }
                        className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 border border-slate-200 rounded"
                        title="Move Tile Later"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          refreshSingleTile(activeDashboard.id, tile.id)
                        }
                        className="p-1.5 text-teal-700 hover:text-teal-900 border border-slate-200 rounded"
                        title="Recalculate Tile Now"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          removeTileFromDashboard(activeDashboard.id, tile.id)
                        }
                        className="p-1.5 text-slate-600 hover:text-red-700 border border-slate-200 rounded"
                        title="Remove Tile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Stale Data Warning */}
                  {liveSnap.isStaleWarning && (
                    <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>
                        Underlying data source exceeds {ins.freshnessRequirementHours}h freshness SLA — refresh source sync before acting.
                      </span>
                    </div>
                  )}

                  {/* Headline Value */}
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {liveSnap.headlineMetric}
                    </div>
                    <div
                      className={`text-xs font-mono tabular-nums font-medium ${
                        liveSnap.trendDirection === "negative"
                          ? "text-red-700"
                          : liveSnap.trendDirection === "positive"
                            ? "text-emerald-700"
                            : "text-slate-700"
                      }`}
                    >
                      {liveSnap.trendLabel}
                    </div>
                  </div>

                  {/* Live Synthetic Data Visualization across all tile sizes */}
                  <VisualizationRenderer
                    chartType={effectiveChartType}
                    chartData={visualSpec.chartData}
                    heatmapData={visualSpec.heatmapData}
                    funnelData={visualSpec.funnelData}
                    height={tile.size === "compact" ? 145 : 205}
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-mono">
                    {ins.kpiIdsAndVersions[0]}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      setActiveNav("advisor");
                      await askAdvisor(ins.question);
                    }}
                    className="font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1"
                  >
                    Open Supporting Details <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
