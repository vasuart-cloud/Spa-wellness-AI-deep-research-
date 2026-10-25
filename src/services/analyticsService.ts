import {
  MonthlySalonMetric,
  RegionName,
  SalonMetadata,
} from "../types/domain";
import {
  getSyntheticDataset,
  SALONS,
} from "./syntheticDataService";

export interface SalonVarianceComparison {
  salon: SalonMetadata;
  current: MonthlySalonMetric; // Oct 2026
  priorMonth: MonthlySalonMetric; // Sep 2026
  baseline3MoAvg: {
    repeatVisitRate: number;
    rebookingRate: number;
    totalRevenue: number;
    retailRevenue: number;
    staffUtilizationPct: number;
    cancellationRatePct: number;
    retailAttachmentPct: number;
    contributionMarginPct: number;
    discountRatePct: number;
  };
  repeatRateDeltaPts: number;
  rebookingDeltaPts: number;
  revenueDeltaPct: number;
  retailRevenueDeltaPct: number;
  utilizationDeltaPts: number;
  unusedHoursCurrent: number;
  targetVarianceDollars: number;
  marginDeltaPts: number;
}

export interface RegionalSummary {
  region: RegionName;
  salonCount: number;
  totalRevenue: number;
  priorMonthRevenue: number;
  revenueGrowthPct: number;
  serviceRevenue: number;
  retailRevenue: number;
  completedVisits: number;
  avgRepeatVisitRate: number;
  avgRebookingRate: number;
  avgStaffUtilizationPct: number;
  unusedStylistHours: number;
  avgCancellationRatePct: number;
  avgRetailAttachmentPct: number;
  avgContributionMarginPct: number;
  estimatedContributionDollars: number;
  revenueAtRiskDollars: number;
}

export function formatCurrency(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
}

export function formatPct(val: number, decimals = 1): string {
  return `${val.toFixed(decimals)}%`;
}

export function formatSignedPts(val: number, decimals = 1): string {
  const prefix = val > 0 ? "+" : "";
  return `${prefix}${val.toFixed(decimals)} pts`;
}

export function formatSignedPct(val: number, decimals = 1): string {
  const prefix = val > 0 ? "+" : "";
  return `${prefix}${val.toFixed(decimals)}%`;
}

export function getSalonComparisons(
  scopedSalonIds: string[],
  dataVersion = 1
): SalonVarianceComparison[] {
  const dataset = getSyntheticDataset(dataVersion);
  const targetSalons = SALONS.filter((s) => scopedSalonIds.includes(s.id));

  return targetSalons.map((salon) => {
    const salonMonths = dataset.monthly.filter((m) => m.salonId === salon.id);
    const current = salonMonths.find((m) => m.monthKey === "2026-10")!;
    const priorMonth = salonMonths.find((m) => m.monthKey === "2026-09")!;
    // Baseline: May, Jun, Jul 2026 (pre-drift 3-month baseline)
    const baseSlice = salonMonths.filter((m) =>
      ["2026-05", "2026-06", "2026-07"].includes(m.monthKey)
    );
    const avg = (fn: (m: MonthlySalonMetric) => number) =>
      baseSlice.reduce((acc, item) => acc + fn(item), 0) /
      Math.max(1, baseSlice.length);

    const baseline3MoAvg = {
      repeatVisitRate: Number(avg((m) => m.repeatVisitRate).toFixed(1)),
      rebookingRate: Number(avg((m) => m.rebookingRate).toFixed(1)),
      totalRevenue: Math.round(avg((m) => m.totalRevenue)),
      retailRevenue: Math.round(avg((m) => m.retailRevenue)),
      staffUtilizationPct: Number(avg((m) => m.staffUtilizationPct).toFixed(1)),
      cancellationRatePct: Number(avg((m) => m.cancellationRatePct).toFixed(1)),
      retailAttachmentPct: Number(avg((m) => m.retailAttachmentPct).toFixed(1)),
      contributionMarginPct: Number(avg((m) => m.contributionMarginPct).toFixed(1)),
      discountRatePct: Number(avg((m) => m.discountRatePct).toFixed(1)),
    };

    const repeatRateDeltaPts = Number(
      (current.repeatVisitRate - baseline3MoAvg.repeatVisitRate).toFixed(1)
    );
    const rebookingDeltaPts = Number(
      (current.rebookingRate - baseline3MoAvg.rebookingRate).toFixed(1)
    );
    const revenueDeltaPct = Number(
      (
        ((current.totalRevenue - priorMonth.totalRevenue) /
          Math.max(1, priorMonth.totalRevenue)) *
        100
      ).toFixed(1)
    );
    const retailRevenueDeltaPct = Number(
      (
        ((current.retailRevenue - baseline3MoAvg.retailRevenue) /
          Math.max(1, baseline3MoAvg.retailRevenue)) *
        100
      ).toFixed(1)
    );
    const utilizationDeltaPts = Number(
      (current.staffUtilizationPct - baseline3MoAvg.staffUtilizationPct).toFixed(1)
    );
    const unusedHoursCurrent =
      current.availableStylistHours - current.utilizedStylistHours;
    const targetVarianceDollars =
      current.totalRevenue - salon.monthlyRevenueTarget;
    const marginDeltaPts = Number(
      (
        current.contributionMarginPct - baseline3MoAvg.contributionMarginPct
      ).toFixed(1)
    );

    return {
      salon,
      current,
      priorMonth,
      baseline3MoAvg,
      repeatRateDeltaPts,
      rebookingDeltaPts,
      revenueDeltaPct,
      retailRevenueDeltaPct,
      utilizationDeltaPts,
      unusedHoursCurrent,
      targetVarianceDollars,
      marginDeltaPts,
    };
  });
}

export function getRegionalSummaries(
  scopedSalonIds: string[],
  dataVersion = 1
): RegionalSummary[] {
  const comparisons = getSalonComparisons(scopedSalonIds, dataVersion);
  const regions: RegionName[] = [
    "Pacific Northwest",
    "Southwest",
    "Midwest",
    "Northeast",
  ];

  return regions
    .map((region) => {
      const items = comparisons.filter((c) => c.salon.region === region);
      if (items.length === 0) return null;

      const totalRevenue = items.reduce((s, i) => s + i.current.totalRevenue, 0);
      const priorMonthRevenue = items.reduce(
        (s, i) => s + i.priorMonth.totalRevenue,
        0
      );
      const serviceRevenue = items.reduce(
        (s, i) => s + i.current.serviceRevenue,
        0
      );
      const retailRevenue = items.reduce(
        (s, i) => s + i.current.retailRevenue,
        0
      );
      const completedVisits = items.reduce(
        (s, i) => s + i.current.completedPaidVisits,
        0
      );
      const estimatedContributionDollars = items.reduce(
        (s, i) => s + i.current.estimatedContributionDollars,
        0
      );
      const unusedStylistHours = items.reduce(
        (s, i) => s + i.unusedHoursCurrent,
        0
      );

      const mean = (fn: (i: SalonVarianceComparison) => number) =>
        Number(
          (items.reduce((s, i) => s + fn(i), 0) / items.length).toFixed(1)
        );

      const revenueAtRiskDollars = items.reduce((sum, i) => {
        const shortfall = Math.max(0, -i.targetVarianceDollars);
        const repeatLeakage =
          i.repeatRateDeltaPts < -4
            ? Math.round(
                Math.abs(i.repeatRateDeltaPts / 100) *
                  i.current.completedPaidVisits *
                  i.current.averageTicket
              )
            : 0;
        const marginLeak =
          i.marginDeltaPts < -4
            ? Math.round(
                Math.abs(i.marginDeltaPts / 100) * i.current.totalRevenue
              )
            : 0;
        return sum + Math.max(shortfall, repeatLeakage + marginLeak);
      }, 0);

      return {
        region,
        salonCount: items.length,
        totalRevenue,
        priorMonthRevenue,
        revenueGrowthPct: Number(
          (
            ((totalRevenue - priorMonthRevenue) /
              Math.max(1, priorMonthRevenue)) *
            100
          ).toFixed(1)
        ),
        serviceRevenue,
        retailRevenue,
        completedVisits,
        avgRepeatVisitRate: mean((i) => i.current.repeatVisitRate),
        avgRebookingRate: mean((i) => i.current.rebookingRate),
        avgStaffUtilizationPct: mean((i) => i.current.staffUtilizationPct),
        unusedStylistHours,
        avgCancellationRatePct: mean((i) => i.current.cancellationRatePct),
        avgRetailAttachmentPct: mean((i) => i.current.retailAttachmentPct),
        avgContributionMarginPct: Number(
          ((estimatedContributionDollars / Math.max(1, totalRevenue)) * 100).toFixed(1)
        ),
        estimatedContributionDollars,
        revenueAtRiskDollars,
      };
    })
    .filter((r): r is RegionalSummary => r !== null);
}

export function getScopeAggregateKPIs(
  scopedSalonIds: string[],
  dataVersion = 1
) {
  const comparisons = getSalonComparisons(scopedSalonIds, dataVersion);
  const totalRevenue = comparisons.reduce(
    (s, c) => s + c.current.totalRevenue,
    0
  );
  const priorRevenue = comparisons.reduce(
    (s, c) => s + c.priorMonth.totalRevenue,
    0
  );
  const baselineRevenue = comparisons.reduce(
    (s, c) => s + c.baseline3MoAvg.totalRevenue,
    0
  );
  const completedVisits = comparisons.reduce(
    (s, c) => s + c.current.completedPaidVisits,
    0
  );
  const returningVisits = comparisons.reduce(
    (s, c) => s + c.current.returningGuests,
    0
  );
  const availHours = comparisons.reduce(
    (s, c) => s + c.current.availableStylistHours,
    0
  );
  const utilHours = comparisons.reduce(
    (s, c) => s + c.current.utilizedStylistHours,
    0
  );
  const contributionDollars = comparisons.reduce(
    (s, c) => s + c.current.estimatedContributionDollars,
    0
  );
  const retailRevenue = comparisons.reduce(
    (s, c) => s + c.current.retailRevenue,
    0
  );
  const serviceRevenue = comparisons.reduce(
    (s, c) => s + c.current.serviceRevenue,
    0
  );

  const avgRepeatRate = Number(
    ((returningVisits / Math.max(1, completedVisits)) * 100).toFixed(1)
  );
  const baselineRepeatRate = Number(
    (
      comparisons.reduce((s, c) => s + c.baseline3MoAvg.repeatVisitRate, 0) /
      Math.max(1, comparisons.length)
    ).toFixed(1)
  );
  const utilizationPct = Number(
    ((utilHours / Math.max(1, availHours)) * 100).toFixed(1)
  );
  const baselineUtilizationPct = Number(
    (
      comparisons.reduce((s, c) => s + c.baseline3MoAvg.staffUtilizationPct, 0) /
      Math.max(1, comparisons.length)
    ).toFixed(1)
  );
  const contributionMarginPct = Number(
    ((contributionDollars / Math.max(1, totalRevenue)) * 100).toFixed(1)
  );
  const avgTicket = Number(
    (totalRevenue / Math.max(1, completedVisits)).toFixed(2)
  );
  const revGrowthMoMPct = Number(
    (((totalRevenue - priorRevenue) / Math.max(1, priorRevenue)) * 100).toFixed(
      1
    )
  );

  return {
    salonCount: comparisons.length,
    totalRevenue,
    priorRevenue,
    baselineRevenue,
    revGrowthMoMPct,
    serviceRevenue,
    retailRevenue,
    completedVisits,
    avgTicket,
    avgRepeatRate,
    baselineRepeatRate,
    repeatDeltaPts: Number((avgRepeatRate - baselineRepeatRate).toFixed(1)),
    utilizationPct,
    baselineUtilizationPct,
    utilizationDeltaPts: Number(
      (utilizationPct - baselineUtilizationPct).toFixed(1)
    ),
    unusedHours: availHours - utilHours,
    contributionDollars,
    contributionMarginPct,
  };
}

export function getMonthlySeriesForSalons(
  scopedSalonIds: string[],
  monthsCount: 6 | 12 = 6,
  dataVersion = 1
) {
  const dataset = getSyntheticDataset(dataVersion);
  const allMonthKeys = Array.from(
    new Set(dataset.monthly.map((m) => m.monthKey))
  ).slice(-monthsCount);

  return allMonthKeys.map((monthKey) => {
    const rows = dataset.monthly.filter(
      (m) => m.monthKey === monthKey && scopedSalonIds.includes(m.salonId)
    );
    const totalRevenue = rows.reduce((s, r) => s + r.totalRevenue, 0);
    const serviceRevenue = rows.reduce((s, r) => s + r.serviceRevenue, 0);
    const retailRevenue = rows.reduce((s, r) => s + r.retailRevenue, 0);
    const visits = rows.reduce((s, r) => s + r.completedPaidVisits, 0);
    const repeatVisitRate = Number(
      (
        rows.reduce((s, r) => s + r.repeatVisitRate, 0) /
        Math.max(1, rows.length)
      ).toFixed(1)
    );
    const rebookingRate = Number(
      (
        rows.reduce((s, r) => s + r.rebookingRate, 0) /
        Math.max(1, rows.length)
      ).toFixed(1)
    );
    const staffUtilizationPct = Number(
      (
        rows.reduce((s, r) => s + r.staffUtilizationPct, 0) /
        Math.max(1, rows.length)
      ).toFixed(1)
    );
    const contributionMarginPct = Number(
      (
        (rows.reduce((s, r) => s + r.estimatedContributionDollars, 0) /
          Math.max(1, totalRevenue)) *
        100
      ).toFixed(1)
    );

    return {
      monthKey,
      monthLabel: rows[0]?.monthLabel ?? monthKey,
      totalRevenue,
      serviceRevenue,
      retailRevenue,
      visits,
      repeatVisitRate,
      rebookingRate,
      staffUtilizationPct,
      contributionMarginPct,
    };
  });
}

// Section 14 Transparent Illustrative Business Value & Sensitivity Model
export interface SensitivityScenarioRow {
  upliftPct: number;
  label: string;
  annualBaselineVisits: number;
  incrementalCompletedVisits: number;
  averageTicketDollars: number;
  additionalAnnualSalesDollars: number;
  contributionMarginPct: number;
  additionalAnnualContributionDollars: number;
  modeledSteadyStateNetDollars: number;
  modeledFirstYearRolloutNetDollars: number;
}

export function computeIllustrativeValueScenarios(params?: {
  salonCount?: number;
  monthlyVisitsPerSalon?: number;
  averageTicket?: number;
  contributionMarginPct?: number;
  annualPlatformLicenseDollars?: number;
  firstYearImplementationCostDollars?: number;
}): SensitivityScenarioRow[] {
  const salonCount = params?.salonCount ?? 20;
  const monthlyVisitsPerSalon = params?.monthlyVisitsPerSalon ?? 900;
  const averageTicket = params?.averageTicket ?? 95;
  const contributionMarginPct = params?.contributionMarginPct ?? 35;
  const annualLicense = params?.annualPlatformLicenseDollars ?? 14400; // $60/salon/mo illustrative
  const rolloutCost = params?.firstYearImplementationCostDollars ?? 6500; // Year-1 enablement/training

  const annualBaselineVisits = salonCount * monthlyVisitsPerSalon * 12; // 216,000 for default 20 salons
  const uplifts = [
    { pct: 0.25, label: "Conservative (0.25% relative uplift)" },
    { pct: 0.5, label: "Reference Illustrative Case (0.50% relative uplift)" },
    { pct: 1.0, label: "Upper Sensitivity Case (1.00% relative uplift)" },
  ];

  return uplifts.map((u) => {
    const incrementalCompletedVisits = Math.round(
      annualBaselineVisits * (u.pct / 100)
    );
    const additionalAnnualSalesDollars = Math.round(
      incrementalCompletedVisits * averageTicket
    );
    const additionalAnnualContributionDollars = Math.round(
      additionalAnnualSalesDollars * (contributionMarginPct / 100)
    );
    return {
      upliftPct: u.pct,
      label: u.label,
      annualBaselineVisits,
      incrementalCompletedVisits,
      averageTicketDollars: averageTicket,
      additionalAnnualSalesDollars,
      contributionMarginPct,
      additionalAnnualContributionDollars,
      modeledSteadyStateNetDollars:
        additionalAnnualContributionDollars - annualLicense,
      modeledFirstYearRolloutNetDollars:
        additionalAnnualContributionDollars - annualLicense - rolloutCost,
    };
  });
}
