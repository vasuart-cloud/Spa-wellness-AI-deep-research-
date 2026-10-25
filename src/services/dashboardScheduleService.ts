import {
  CustomDashboard,
  FunnelStage,
  HeatmapCell,
  SavedInsight,
  VisualizationType,
} from "../types/domain";
import {
  computeIllustrativeValueScenarios,
  formatCurrency,
  formatPct,
  formatSignedPct,
  formatSignedPts,
  getMonthlySeriesForSalons,
  getRegionalSummaries,
  getSalonComparisons,
  getScopeAggregateKPIs,
} from "./analyticsService";
import {
  buildRebookingFunnel,
  buildUtilizationHeatmap,
  getSourceSystems,
  PERSONAS,
  SALONS,
} from "./syntheticDataService";

export function createInitialSavedInsights(
  dataVersion = 1,
  posSyncRefreshed = false
): SavedInsight[] {
  const pnwIds = PERSONAS.arjun.allowedSalonIds;
  const allIds = SALONS.map((s) => s.id);
  const pnwAgg = getScopeAggregateKPIs(pnwIds, dataVersion);
  const orgAgg = getScopeAggregateKPIs(allIds, dataVersion);
  const pnwComps = getSalonComparisons(pnwIds, dataVersion);
  const sources = getSourceSystems(0, posSyncRefreshed);

  const avgPnwAttach = Number(
    (
      pnwComps.reduce((s, c) => s + c.current.retailAttachmentPct, 0) /
      pnwComps.length
    ).toFixed(1)
  );

  return [
    {
      id: "INS-PNW-REPEAT",
      title: "PNW Repeat-Visit Rate & Rebooking Watchlist",
      question:
        "Which salons had the biggest decline in repeat visits in the last 30 days?",
      topicKey: "repeat_visits",
      kpiIdsAndVersions: [
        "kpi.repeat_visit_rate@v2.4",
        "kpi.rebooking_rate@v2.2",
      ],
      authorizedSalonIds: pnwIds,
      scopeLabel: "Pacific Northwest · 5 Salons",
      regionFilter: "Pacific Northwest",
      relativeDateRange: "Last 30 Days",
      chartType: "bar",
      ownerPersona: "arjun",
      ownerName: "Regional Operations Manager",
      createdAt: "2026-10-18 09:15 UTC",
      lastRefreshedAt: "2026-10-24 06:00 UTC",
      freshnessRequirementHours: 24,
      recommendedRefreshFrequency: "Weekly",
      schedule: {
        enabled: true,
        cadence: "Weekly",
        dayOfWeek: "Monday",
        timeLocal: "08:00",
        timezone: "America/Los_Angeles",
        nextRunAt: "2026-10-26 08:00 PDT",
        lastRunAt: "2026-10-19 08:00 PDT",
        lastRunStatus: "Succeeded",
      },
      cachedSnapshot: {
        headlineMetric: formatPct(pnwAgg.avgRepeatRate),
        trendLabel: `${formatSignedPts(pnwAgg.repeatDeltaPts)} vs 3-mo baseline`,
        trendDirection: "negative",
        isStaleWarning: false,
      },
    },
    {
      id: "INS-PNW-CAPACITY",
      title: "PNW Unused Stylist Roster Capacity",
      question: "Which salons have the highest unused stylist capacity?",
      topicKey: "unused_capacity",
      kpiIdsAndVersions: [
        "kpi.staff_utilization@v2.0",
        "kpi.rev_per_available_hour@v1.8",
      ],
      authorizedSalonIds: pnwIds,
      scopeLabel: "Pacific Northwest · 5 Salons",
      regionFilter: "Pacific Northwest",
      relativeDateRange: "Last 30 Days",
      chartType: "heatmap",
      ownerPersona: "arjun",
      ownerName: "Regional Operations Manager",
      createdAt: "2026-10-19 14:20 UTC",
      lastRefreshedAt: "2026-10-24 07:15 UTC",
      freshnessRequirementHours: 4,
      recommendedRefreshFrequency: "Daily",
      schedule: {
        enabled: true,
        cadence: "Daily",
        timeLocal: "07:30",
        timezone: "America/Los_Angeles",
        nextRunAt: "2026-10-25 07:30 PDT",
        lastRunAt: "2026-10-24 07:30 PDT",
        lastRunStatus: "Succeeded",
      },
      cachedSnapshot: {
        headlineMetric: `${pnwAgg.unusedHours.toLocaleString()} unused hrs`,
        trendLabel: `${formatPct(pnwAgg.utilizationPct)} utilization (${formatSignedPts(pnwAgg.utilizationDeltaPts)})`,
        trendDirection: "negative",
        isStaleWarning: false,
      },
    },
    {
      id: "INS-PNW-RETAIL",
      title: "PNW Retail Attachment & Take-Home Revenue",
      question: "Where did retail product sales decline this month?",
      topicKey: "retail_decline",
      kpiIdsAndVersions: ["kpi.retail_attachment@v2.1"],
      authorizedSalonIds: pnwIds,
      scopeLabel: "Pacific Northwest · 5 Salons",
      regionFilter: "Pacific Northwest",
      relativeDateRange: "Last 30 Days",
      chartType: "bar",
      ownerPersona: "arjun",
      ownerName: "Regional Operations Manager",
      createdAt: "2026-10-20 11:05 UTC",
      lastRefreshedAt: "2026-10-23 05:00 UTC",
      freshnessRequirementHours: 24,
      recommendedRefreshFrequency: "Daily",
      schedule: {
        enabled: true,
        cadence: "Daily",
        timeLocal: "08:30",
        timezone: "America/Los_Angeles",
        nextRunAt: "2026-10-25 08:30 PDT",
        lastRunAt: "2026-10-23 08:30 PDT",
        lastRunStatus:
          sources["SRC-POS-RETAIL"].status === "Stale"
            ? "Stale Source Warning"
            : "Succeeded",
      },
      cachedSnapshot: {
        headlineMetric: formatPct(avgPnwAttach),
        trendLabel: `${formatCurrency(pnwAgg.retailRevenue)} retail sales`,
        trendDirection: "negative",
        isStaleWarning: sources["SRC-POS-RETAIL"].status === "Stale",
      },
    },
    {
      id: "INS-ORG-MARGIN",
      title: "Organization Contribution Margin & Discount Guardrail",
      question: "Where should I focus to improve profitability this quarter?",
      topicKey: "coo_profitability",
      kpiIdsAndVersions: [
        "kpi.contribution_margin@v3.0",
        "kpi.total_revenue@v3.1",
      ],
      authorizedSalonIds: allIds,
      scopeLabel: "All 20 Salons · 4 Regions",
      regionFilter: "All Regions",
      relativeDateRange: "Quarter-to-Date",
      chartType: "bar",
      ownerPersona: "meera",
      ownerName: "Chief Operating Officer",
      createdAt: "2026-10-15 16:00 UTC",
      lastRefreshedAt: "2026-10-24 06:05 UTC",
      freshnessRequirementHours: 24,
      recommendedRefreshFrequency: "Weekly",
      schedule: {
        enabled: true,
        cadence: "Weekly",
        dayOfWeek: "Monday",
        timeLocal: "07:00",
        timezone: "America/New_York",
        nextRunAt: "2026-10-26 07:00 EDT",
        lastRunAt: "2026-10-19 07:00 EDT",
        lastRunStatus: "Succeeded",
      },
      cachedSnapshot: {
        headlineMetric: `${formatCurrency(orgAgg.contributionDollars)} (${formatPct(orgAgg.contributionMarginPct)})`,
        trendLabel: `Org Net Rev ${formatCurrency(orgAgg.totalRevenue)} (${formatSignedPct(orgAgg.revGrowthMoMPct)} MoM)`,
        trendDirection: "neutral",
        isStaleWarning: false,
      },
    },
  ];
}

export function recalculateSavedInsightSnapshot(
  insight: SavedInsight,
  dataVersion: number,
  demoTimeOffsetHours: number,
  posSyncRefreshed: boolean,
  salonFilter: string | "all" = "all"
): SavedInsight["cachedSnapshot"] {
  const targetIds =
    !salonFilter || salonFilter.toLowerCase() === "all"
      ? insight.authorizedSalonIds
      : insight.authorizedSalonIds.filter((id) => id === salonFilter);
  const safeIds =
    targetIds.length > 0 ? targetIds : insight.authorizedSalonIds;

  const agg = getScopeAggregateKPIs(safeIds, dataVersion);
  const comps = getSalonComparisons(safeIds, dataVersion);
  const sources = getSourceSystems(demoTimeOffsetHours, posSyncRefreshed);
  const warehouseStale =
    sources["SRC-WAREHOUSE-DAILY"].ageHours > insight.freshnessRequirementHours;
  const bookingStale =
    sources["SRC-BOOKING-STREAM"].ageHours > insight.freshnessRequirementHours;
  const posStale =
    sources["SRC-POS-RETAIL"].status === "Stale" ||
    sources["SRC-POS-RETAIL"].ageHours > insight.freshnessRequirementHours;

  if (
    insight.topicKey === "repeat_visits" ||
    insight.topicKey === "repeat_drivers" ||
    insight.topicKey === "repeat_actions"
  ) {
    return {
      headlineMetric: formatPct(agg.avgRepeatRate),
      trendLabel: `${formatSignedPts(agg.repeatDeltaPts)} vs 3-mo baseline`,
      trendDirection: agg.repeatDeltaPts >= 0 ? "positive" : "negative",
      isStaleWarning: warehouseStale,
    };
  }

  if (
    insight.topicKey === "unused_capacity" ||
    insight.topicKey === "coo_capacity_loss"
  ) {
    return {
      headlineMetric: `${agg.unusedHours.toLocaleString()} unused hrs`,
      trendLabel: `${formatPct(agg.utilizationPct)} utilization (${formatSignedPts(agg.utilizationDeltaPts)})`,
      trendDirection: agg.utilizationDeltaPts >= 0 ? "positive" : "negative",
      isStaleWarning: bookingStale,
    };
  }

  if (insight.topicKey === "retail_decline") {
    const avgAttach = Number(
      (
        comps.reduce((s, c) => s + c.current.retailAttachmentPct, 0) /
        Math.max(1, comps.length)
      ).toFixed(1)
    );
    return {
      headlineMetric: formatPct(avgAttach),
      trendLabel: `${formatCurrency(agg.retailRevenue)} retail sales`,
      trendDirection: avgAttach >= 18 ? "positive" : "negative",
      isStaleWarning: posStale,
    };
  }

  if (insight.topicKey === "coo_profitability") {
    return {
      headlineMetric: `${formatCurrency(agg.contributionDollars)} (${formatPct(agg.contributionMarginPct)})`,
      trendLabel: `Net Rev ${formatCurrency(agg.totalRevenue)} (${formatSignedPct(agg.revGrowthMoMPct)} MoM)`,
      trendDirection: agg.contributionMarginPct >= 34 ? "positive" : "neutral",
      isStaleWarning: warehouseStale,
    };
  }

  if (insight.topicKey === "coo_interventions") {
    const refCase = computeIllustrativeValueScenarios()[1];
    return {
      headlineMetric: "+$14,200 pilot lift",
      trendLabel: `${formatCurrency(refCase.additionalAnnualContributionDollars)} modeled @ 0.50% uplift`,
      trendDirection: "positive",
      isStaleWarning: warehouseStale,
    };
  }

  if (insight.topicKey === "financial_impact") {
    const recVisits = comps.reduce((sum, c) => {
      if (c.repeatRateDeltaPts < -2) {
        return (
          sum +
          Math.round(
            (Math.abs(c.repeatRateDeltaPts) *
              0.5 *
              c.current.completedPaidVisits) /
              100
          )
        );
      }
      return sum + 4;
    }, 0);
    const recSales = Math.round(recVisits * agg.avgTicket);
    return {
      headlineMetric: `${formatCurrency(recSales)}/mo modeled`,
      trendLabel: `50% gap recovery @ ${formatPct(agg.contributionMarginPct)} margin`,
      trendDirection: "positive",
      isStaleWarning: warehouseStale,
    };
  }

  if (
    insight.topicKey === "revenue_risk" ||
    insight.topicKey === "weekly_priorities"
  ) {
    const worstGap = [...comps].sort(
      (a, b) => a.targetVarianceDollars - b.targetVarianceDollars
    )[0];
    return {
      headlineMetric: formatCurrency(worstGap?.targetVarianceDollars ?? 0),
      trendLabel: `${worstGap?.salon.name.split(" ")[0] ?? "Top"} target gap · ${formatPct(agg.avgRepeatRate)} repeat`,
      trendDirection: (worstGap?.targetVarianceDollars ?? 0) >= 0 ? "positive" : "negative",
      isStaleWarning: warehouseStale,
    };
  }

  return {
    headlineMetric: `${formatCurrency(agg.totalRevenue)}`,
    trendLabel: `${formatPct(agg.contributionMarginPct)} margin · ${formatSignedPct(agg.revGrowthMoMPct)} MoM`,
    trendDirection: agg.revGrowthMoMPct >= 0 ? "positive" : "negative",
    isStaleWarning: warehouseStale,
  };
}

export function buildSavedInsightVisualSpec(
  insight: SavedInsight,
  dataVersion: number,
  salonFilter: string | "all" = "all"
): {
  chartType: VisualizationType;
  chartData: Array<Record<string, string | number>>;
  heatmapData?: HeatmapCell[];
  funnelData?: FunnelStage[];
} {
  const targetIds =
    !salonFilter || salonFilter.toLowerCase() === "all"
      ? insight.authorizedSalonIds
      : insight.authorizedSalonIds.filter((id) => id === salonFilter);
  const safeIds =
    targetIds.length > 0 ? targetIds : insight.authorizedSalonIds;

  const comps = getSalonComparisons(safeIds, dataVersion);
  const series6m = getMonthlySeriesForSalons(safeIds, 6, dataVersion);

  if (
    insight.chartType === "heatmap" ||
    insight.topicKey === "unused_capacity" ||
    insight.topicKey === "coo_capacity_loss"
  ) {
    const rankedUnused = [...comps].sort(
      (a, b) => b.unusedHoursCurrent - a.unusedHoursCurrent
    );
    return {
      chartType: "heatmap",
      chartData: rankedUnused.slice(0, 6).map((c) => ({
        name: c.salon.name.split(" ")[0],
        "Utilization %": c.current.staffUtilizationPct,
        "Baseline %": c.baseline3MoAvg.staffUtilizationPct,
      })),
      heatmapData: buildUtilizationHeatmap(safeIds, dataVersion),
    };
  }

  if (insight.chartType === "funnel" || insight.topicKey === "repeat_drivers") {
    const funnel = buildRebookingFunnel(safeIds, dataVersion);
    return {
      chartType: "funnel",
      chartData: funnel.map((f) => ({
        name: f.stage,
        "Actual %": f.conversionPct,
        "Benchmark %": f.benchmarkPct,
      })),
      funnelData: funnel,
    };
  }

  if (insight.chartType === "stacked-bar" || insight.topicKey === "revenue_6m") {
    return {
      chartType: "stacked-bar",
      chartData: series6m.map((m) => ({
        name: m.monthLabel.split(" ")[0],
        Service: Math.round(m.serviceRevenue / 1000),
        Retail: Math.round(m.retailRevenue / 1000),
      })),
    };
  }

  if (insight.chartType === "line" || insight.topicKey === "month_change") {
    return {
      chartType: "line",
      chartData: series6m.map((m) => ({
        name: m.monthLabel.split(" ")[0],
        "Repeat %": m.repeatVisitRate,
        "Utilization %": m.staffUtilizationPct,
      })),
    };
  }

  if (
    insight.topicKey === "coo_profitability" ||
    insight.topicKey === "coo_monthly_perf"
  ) {
    if (safeIds.length > 5) {
      const regions = getRegionalSummaries(safeIds, dataVersion);
      return {
        chartType: "bar",
        chartData: regions.map((r) => ({
          name:
            r.region === "Pacific Northwest"
              ? "PNW"
              : r.region === "Northeast"
                ? "NE"
                : r.region === "Southwest"
                  ? "SW"
                  : "MW",
          "Margin %": r.avgContributionMarginPct,
          "Repeat %": r.avgRepeatVisitRate,
        })),
      };
    }
    return {
      chartType: "bar",
      chartData: comps.map((c) => ({
        name: c.salon.name.split(" ")[0],
        "Margin %": c.current.contributionMarginPct,
        "Baseline %": c.baseline3MoAvg.contributionMarginPct,
      })),
    };
  }

  if (insight.topicKey === "retail_decline") {
    return {
      chartType: "bar",
      chartData: comps.slice(0, 6).map((c) => ({
        name: c.salon.name.split(" ")[0],
        "Attach %": c.current.retailAttachmentPct,
        "Baseline %": c.baseline3MoAvg.retailAttachmentPct,
      })),
    };
  }

  if (insight.topicKey === "coo_interventions") {
    const sensitivity = computeIllustrativeValueScenarios();
    return {
      chartType: "bar",
      chartData: sensitivity.map((s) => ({
        name: `${s.upliftPct.toFixed(2)}%`,
        "Sales ($k)": Math.round(s.additionalAnnualSalesDollars / 1000),
        "Contrib ($k)": Math.round(s.additionalAnnualContributionDollars / 1000),
      })),
    };
  }

  // Default repeat_visits / operational bar chart (or 6m trend if filtered to 1 salon)
  if (safeIds.length === 1) {
    return {
      chartType: "line",
      chartData: series6m.map((m) => ({
        name: m.monthLabel.split(" ")[0],
        "Repeat %": m.repeatVisitRate,
        "Rebook %": m.rebookingRate,
      })),
    };
  }

  const rankedRepeat = [...comps].sort(
    (a, b) => a.repeatRateDeltaPts - b.repeatRateDeltaPts
  );
  return {
    chartType: "bar",
    chartData: rankedRepeat.slice(0, 6).map((c) => ({
      name: c.salon.name.split(" ")[0],
      "Repeat %": c.current.repeatVisitRate,
      "Baseline %": c.baseline3MoAvg.repeatVisitRate,
    })),
  };
}

export function createInitialDashboards(): CustomDashboard[] {
  return [
    {
      id: "DASH-PNW-OPS",
      name: "Pacific Northwest Weekly Regional Pulse",
      description:
        "Refreshable regional salon retention, roster capacity, and retail attachment board.",
      ownerPersona: "arjun",
      sharedWithOrg: true,
      createdAt: "2026-10-18 09:30 UTC",
      updatedAt: "2026-10-24 06:00 UTC",
      tiles: [
        {
          id: "TILE-1",
          savedInsightId: "INS-PNW-REPEAT",
          size: "wide",
          order: 0,
          salonFilter: "all",
        },
        {
          id: "TILE-2",
          savedInsightId: "INS-PNW-CAPACITY",
          size: "compact",
          order: 1,
          salonFilter: "all",
        },
        {
          id: "TILE-3",
          savedInsightId: "INS-PNW-RETAIL",
          size: "compact",
          order: 2,
          salonFilter: "all",
        },
      ],
    },
    {
      id: "DASH-COO-EXEC",
      name: "COO Multi-Region Margin & Growth Board",
      description:
        "Organization-wide contribution margin, regional retention, and capacity watchlist.",
      ownerPersona: "meera",
      sharedWithOrg: true,
      createdAt: "2026-10-15 16:15 UTC",
      updatedAt: "2026-10-24 06:05 UTC",
      tiles: [
        {
          id: "TILE-4",
          savedInsightId: "INS-ORG-MARGIN",
          size: "wide",
          order: 0,
          salonFilter: "all",
        },
        {
          id: "TILE-5",
          savedInsightId: "INS-PNW-REPEAT",
          size: "compact",
          order: 1,
          salonFilter: "all",
        },
        {
          id: "TILE-6",
          savedInsightId: "INS-PNW-CAPACITY",
          size: "compact",
          order: 2,
          salonFilter: "all",
        },
      ],
    },
  ];
}
