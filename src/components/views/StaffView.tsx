import React, { useMemo, useState } from "react";
import { Database, Download, Sparkles, Users } from "lucide-react";
import { useAppState } from "../../context/AppStateContext";
import { extractFreshnessMetadata } from "../../services/agentService";
import {
  formatCurrency,
  formatPct,
  formatSignedPts,
  getSalonComparisons,
} from "../../services/analyticsService";
import { downloadTableAsCsv } from "../../services/exportShareService";
import {
  buildUtilizationHeatmap,
  getSourceSystems,
  PERSONAS,
  SALONS,
} from "../../services/syntheticDataService";
import { RegionName } from "../../types/domain";
import { TanStackDataTable } from "../common/TanStackDataTable";
import { VisualizationRenderer } from "../common/VisualizationRenderer";

export const StaffView: React.FC = () => {
  const {
    activePersona,
    authSession,
    dataVersion,
    demoTimeOffsetHours,
    posSyncRefreshed,
    openZenneWithPrompt,
    verifyExportChannelAllowed,
    appendAuditEvent,
    notify,
  } = useAppState();

  const persona = PERSONAS[activePersona];
  const [regionFilter, setRegionFilter] = useState<RegionName | "ALL">("ALL");

  const scopedSalonIds = useMemo(
    () =>
      persona.canViewAllRegions
        ? SALONS.map((s) => s.id)
        : persona.allowedSalonIds,
    [persona]
  );

  const comparisons = useMemo(() => {
    const all = getSalonComparisons(scopedSalonIds, dataVersion);
    if (regionFilter === "ALL") return all;
    return all.filter((c) => c.salon.region === regionFilter);
  }, [scopedSalonIds, dataVersion, regionFilter]);

  const filteredSalonIds = useMemo(
    () => comparisons.map((c) => c.salon.id),
    [comparisons]
  );

  const bookingFreshness = useMemo(() => {
    const sources = getSourceSystems(demoTimeOffsetHours, posSyncRefreshed);
    return extractFreshnessMetadata(sources["SRC-BOOKING-STREAM"]);
  }, [demoTimeOffsetHours, posSyncRefreshed]);

  const heatmapData = useMemo(
    () =>
      buildUtilizationHeatmap(
        filteredSalonIds.length > 0 ? filteredSalonIds : scopedSalonIds,
        dataVersion
      ),
    [filteredSalonIds, scopedSalonIds, dataVersion]
  );

  const staffMetrics = useMemo(() => {
    const totalChairs = comparisons.reduce((s, c) => s + c.salon.chairs, 0);
    const availableHours = comparisons.reduce(
      (s, c) => s + c.current.availableStylistHours,
      0
    );
    const utilizedHours = comparisons.reduce(
      (s, c) => s + c.current.utilizedStylistHours,
      0
    );
    const unusedHours = availableHours - utilizedHours;
    const utilizationPct = Number(
      ((utilizedHours / Math.max(1, availableHours)) * 100).toFixed(1)
    );
    const baselineUtil = Number(
      (
        comparisons.reduce(
          (s, c) => s + c.baseline3MoAvg.staffUtilizationPct,
          0
        ) / Math.max(1, comparisons.length)
      ).toFixed(1)
    );
    const totalRev = comparisons.reduce(
      (s, c) => s + c.current.totalRevenue,
      0
    );
    const revPerAvailHour = Number(
      (totalRev / Math.max(1, availableHours)).toFixed(2)
    );
    const avgRebooking = Number(
      (
        comparisons.reduce((s, c) => s + c.current.rebookingRate, 0) /
        Math.max(1, comparisons.length)
      ).toFixed(1)
    );

    return {
      totalChairs,
      availableHours,
      utilizedHours,
      unusedHours,
      utilizationPct,
      utilDeltaPts: Number((utilizationPct - baselineUtil).toFixed(1)),
      revPerAvailHour,
      avgRebooking,
    };
  }, [comparisons]);

  const tableColumns = useMemo(
    () => [
      { key: "salonName", header: "Salon Studio" },
      { key: "region", header: "Region" },
      { key: "studioLead", header: "Studio Operations Lead" },
      { key: "chairs", header: "Chairs", align: "right" as const },
      { key: "availableHrs", header: "Available Hrs", align: "right" as const },
      { key: "utilizedHrs", header: "Utilized Hrs", align: "right" as const },
      { key: "unusedHrs", header: "Unused Hrs", align: "right" as const },
      { key: "utilizationPct", header: "Utilization %", align: "right" as const },
      { key: "vsBaseline", header: "vs 3-Mo Base", align: "right" as const },
      { key: "rebookingPct", header: "Checkout Rebook %", align: "right" as const },
      { key: "revPerHr", header: "Rev / Avail Hr", align: "right" as const },
    ],
    []
  );

  const tableRows = useMemo(
    () =>
      [...comparisons]
        .sort((a, b) => b.unusedHoursCurrent - a.unusedHoursCurrent)
        .map((c) => ({
          salonName: c.salon.name,
          region: c.salon.region,
          studioLead: `${c.salon.city} Studio Lead`,
          chairs: c.salon.chairs,
          availableHrs: c.current.availableStylistHours.toLocaleString(),
          utilizedHrs: c.current.utilizedStylistHours.toLocaleString(),
          unusedHrs: c.unusedHoursCurrent.toLocaleString(),
          utilizationPct: formatPct(c.current.staffUtilizationPct),
          vsBaseline: formatSignedPts(c.utilizationDeltaPts),
          rebookingPct: formatPct(c.current.rebookingRate),
          revPerHr: `$${c.current.revenuePerAvailableHour.toFixed(0)}`,
        })),
    [comparisons]
  );

  const handleExportRosterCsv = () => {
    if (!verifyExportChannelAllowed("CSV", "Staff & Stylist Roster Utilization CSV")) {
      return;
    }
    downloadTableAsCsv(
      `Wellness_Staff_Capacity_dv${dataVersion}`,
      tableColumns,
      tableRows
    );
    appendAuditEvent(
      "REPORT_EXPORTED",
      `Exported Staff & Stylist Roster Utilization CSV (${tableRows.length} salons)`,
      "Allowed",
      "Format: CSV"
    );
    notify("Downloaded Staff & Stylist Roster Utilization CSV.", "teal");
  };

  return (
    <div className="space-y-8">
      {/* Header & Explicit Data Freshness */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <Users className="w-3.5 h-3.5 text-teal-700" />
            <span className="font-semibold text-slate-900">
              {authSession.roleLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {persona.assignedRegion} ({comparisons.length} Salons)
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Staff &amp; Stylist Capacity Operations
          </h1>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <Database className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <span className="font-semibold text-slate-800">
              Data Freshness:
            </span>
            <span className="font-mono tabular-nums text-slate-900">
              {bookingFreshness.dataDate}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-900">
              {bookingFreshness.dataTime}
            </span>
            <span aria-hidden="true">·</span>
            <span>Source: {bookingFreshness.sourceName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-emerald-700">
              {bookingFreshness.status} ({bookingFreshness.completenessPct}%
              complete)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {persona.canViewAllRegions && (
            <select
              aria-label="Filter staff roster by region"
              value={regionFilter}
              onChange={(e) =>
                setRegionFilter(e.target.value as RegionName | "ALL")
              }
              className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-teal-600"
            >
              <option value="ALL">All 4 Regions (20 Salons)</option>
              <option value="Pacific Northwest">Pacific Northwest</option>
              <option value="Southwest">Southwest</option>
              <option value="Midwest">Midwest</option>
              <option value="Northeast">Northeast</option>
            </select>
          )}

          <button
            type="button"
            onClick={handleExportRosterCsv}
            className="px-3.5 py-2 text-xs font-medium bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export Roster CSV
          </button>

          <button
            type="button"
            onClick={() =>
              openZenneWithPrompt(
                activePersona === "meera"
                  ? "Which regions are losing the most revenue from unused stylist capacity?"
                  : "Which salons have the highest unused stylist capacity?"
              )
            }
            className="px-4 py-2 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Analyze Staff Capacity in Zenne
          </button>
        </div>
      </div>

      {/* 4-Card Staff & Roster KPI Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">
            Stylist Roster Utilization
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatPct(staffMetrics.utilizationPct)}
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-600">
            <span
              className={
                staffMetrics.utilDeltaPts >= 0
                  ? "text-emerald-700 font-semibold"
                  : "text-red-700 font-semibold"
              }
            >
              {formatSignedPts(staffMetrics.utilDeltaPts)}
            </span>{" "}
            vs 3-mo baseline
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">
            Unused Stylist Capacity (30d)
          </div>
          <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums">
            {staffMetrics.unusedHours.toLocaleString()} hrs
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-500">
            {staffMetrics.utilizedHours.toLocaleString()} utilized /{" "}
            {staffMetrics.availableHours.toLocaleString()} avail hrs
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">
            Revenue per Available Stylist Hour
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatCurrency(staffMetrics.revPerAvailHour)}
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-500">
            Across {staffMetrics.totalChairs} active wellness chairs
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">
            Chairside Checkout Rebooking Rate
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatPct(staffMetrics.avgRebooking)}
          </div>
          <div className="text-xs text-slate-500">
            Primary staff retention &amp; repeat-visit lever
          </div>
        </div>
      </section>

      {/* Weekly Shift Block Utilization Heatmap */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Weekly Time-Block Stylist Utilization Heatmap
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Identifies Mon–Wed midday roster over-scheduling vs Fri–Sat peak
              chair demand across authorized salons.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            Source: {bookingFreshness.sourceName} · {bookingFreshness.dataDate}{" "}
            {bookingFreshness.dataTime}
          </span>
        </div>

        <VisualizationRenderer
          chartType="heatmap"
          chartData={[]}
          heatmapData={heatmapData}
        />
      </section>

      {/* Studio Staff & Roster Capacity Table */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Studio Roster Capacity &amp; Chairside Productivity Breakdown
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Sorted by unused stylist hours to highlight immediate shift
            rebalancing and chairside rebooking coaching priorities.
          </p>
        </div>

        <TanStackDataTable
          columns={tableColumns}
          rows={tableRows}
          searchPlaceholder="Filter salon studio or region..."
          pageSize={10}
        />
      </section>
    </div>
  );
};
