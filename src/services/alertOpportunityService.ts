import {
  AlertRule,
  InterventionRecord,
  RevenueOpportunity,
  TriggeredAlert,
} from "../types/domain";
import {
  formatCurrency,
  formatPct,
  formatSignedPts,
  getSalonComparisons,
} from "./analyticsService";
import { getSourceSystems, SALONS } from "./syntheticDataService";

export function buildInitialOpportunities(
  dataVersion = 1,
  posSyncRefreshed = false
): RevenueOpportunity[] {
  const allIds = SALONS.map((s) => s.id);
  const comps = getSalonComparisons(allIds, dataVersion);
  const sources = getSourceSystems(0, posSyncRefreshed);
  const posFreshness: "Fresh" | "Stale" =
    sources["SRC-POS-RETAIL"].status === "Stale" ? "Stale" : "Fresh";

  // 1. Declining repeat visits (Bellevue, Capitol Hill, Pearl District)
  const repeatSalons = comps.filter((c) => c.repeatRateDeltaPts < -5);
  const avgRepNow =
    repeatSalons.reduce((s, c) => s + c.current.repeatVisitRate, 0) /
    Math.max(1, repeatSalons.length);
  const avgRepBase =
    repeatSalons.reduce((s, c) => s + c.baseline3MoAvg.repeatVisitRate, 0) /
    Math.max(1, repeatSalons.length);

  // 2. Underutilized stylist capacity (Pacific Northwest)
  const pnwSalons = comps.filter(
    (c) => c.salon.region === "Pacific Northwest"
  );
  const pnwUnused = pnwSalons.reduce((s, c) => s + c.unusedHoursCurrent, 0);
  const pnwUtilAvg =
    pnwSalons.reduce((s, c) => s + c.current.staffUtilizationPct, 0) /
    Math.max(1, pnwSalons.length);

  // 3. Elevated cancellations (Capitol Hill & Austin Domain)
  const cancelSalons = comps.filter((c) => c.current.cancellationRatePct > 12);

  // 4. Declining retail attachment
  const retailSalons = comps.filter((c) => c.current.retailAttachmentPct < 13);

  // 5. Unusual discount levels (Scottsdale Kierland)
  const scottsdale = comps.find((c) => c.salon.id === "SLN-SW-01")!;

  // 6. Revenue variance by salon (Top negative target gap in PNW)
  const targetLaggards = comps.filter((c) => c.targetVarianceDollars < -4500);

  return [
    {
      id: "OPP-01-REPEAT",
      category: "Declining Repeat Visits",
      title: "3 Pacific Northwest Salons Losing 45-Day Repeat Momentum",
      affectedSalonIds: repeatSalons.map((c) => c.salon.id),
      affectedSalonNames: repeatSalons.map((c) => c.salon.name),
      region: "Pacific Northwest",
      currentMetricLabel: `${formatPct(avgRepNow)} repeat-visit rate`,
      expectedBaselineLabel: `${formatPct(avgRepBase)} 3-month baseline`,
      monthlyImpactDollars: 13800,
      annualizedImpactDollars: 165600,
      sourceSystemId: "SRC-WAREHOUSE-DAILY",
      freshnessStatus: "Fresh",
      severity: "Critical",
      supportingEvidence: `Checkout rebooking fell to ~42.8% across Bellevue Flagship, Capitol Hill Atelier, and Pearl District Sanctuary, stretching average guest return intervals by +8 days.`,
      recommendedAction:
        "Reinstate mandatory chairside rebooking prompt on stylist checkout tablets and launch non-discounted 45-day overdue color guest outreach.",
      assignedOwner: "Regional Operations Manager",
      status: "New",
      updatedAt: "2026-10-24 06:10 UTC",
    },
    {
      id: "OPP-02-CAPACITY",
      category: "Underutilized Stylist Capacity",
      title: "Mon–Wed Morning Roster Underutilization in Pacific Northwest",
      affectedSalonIds: pnwSalons.map((c) => c.salon.id),
      affectedSalonNames: pnwSalons.map((c) => c.salon.name),
      region: "Pacific Northwest",
      currentMetricLabel: `${formatPct(pnwUtilAvg)} utilization (${pnwUnused.toLocaleString()} unused hrs)`,
      expectedBaselineLabel: "72.8% regional historical baseline",
      monthlyImpactDollars: 11400,
      annualizedImpactDollars: 136800,
      sourceSystemId: "SRC-BOOKING-STREAM",
      freshnessStatus: "Fresh",
      severity: "High",
      supportingEvidence:
        "Monday and Tuesday 09:00–12:00 blocks operate below 48% utilization while Thursday/Friday evenings carry unbooked waitlist requests.",
      recommendedAction:
        "Reallocate 8–10% of early-week morning roster hours into Thu–Sat afternoon/evening peak blocks.",
      assignedOwner: "Regional Operations Manager",
      status: "Under Review",
      updatedAt: "2026-10-24 07:00 UTC",
    },
    {
      id: "OPP-03-CANCELS",
      category: "Elevated Cancellations",
      title: "48-Hour Late Cancellation Spike Leaving Unfilled Chair Gaps",
      affectedSalonIds: cancelSalons.map((c) => c.salon.id),
      affectedSalonNames: cancelSalons.map((c) => c.salon.name),
      region: "Multiple Regions",
      currentMetricLabel: `${formatPct(
        cancelSalons.reduce((s, c) => s + c.current.cancellationRatePct, 0) /
          Math.max(1, cancelSalons.length)
      )} cancellation rate`,
      expectedBaselineLabel: "7.4% peer baseline (<12% rule threshold)",
      monthlyImpactDollars: 8900,
      annualizedImpactDollars: 106800,
      sourceSystemId: "SRC-BOOKING-STREAM",
      freshnessStatus: "Fresh",
      severity: "High",
      supportingEvidence:
        "Capitol Hill Atelier (PNW) and Austin Domain Collective (SW) show elevated cancellations within 48h without automated SMS waitlist backfill.",
      recommendedAction:
        "Enable automated SMS one-tap reschedule + opted-in waitlist backfill for cancellations within 48h.",
      assignedOwner: "Regional Operations Manager & SW Lead",
      status: "Action Approved",
      updatedAt: "2026-10-23 18:20 UTC",
    },
    {
      id: "OPP-04-RETAIL",
      category: "Declining Retail Attachment",
      title: "Low Take-Home Retail Attachment Across 5 Urban Studios",
      affectedSalonIds: retailSalons.map((c) => c.salon.id),
      affectedSalonNames: retailSalons.map((c) => c.salon.name),
      region: "Multiple Regions",
      currentMetricLabel: `${formatPct(
        retailSalons.reduce((s, c) => s + c.current.retailAttachmentPct, 0) /
          Math.max(1, retailSalons.length)
      )} retail attach`,
      expectedBaselineLabel: "19.5% organization target",
      monthlyImpactDollars: 7600,
      annualizedImpactDollars: 91200,
      sourceSystemId: "SRC-POS-RETAIL",
      freshnessStatus: posFreshness,
      severity: "Moderate",
      supportingEvidence:
        posFreshness === "Stale"
          ? "POS Retail Ledger Sync is 39.5h old (Fremont terminal lag). Multi-week trend shows ~11.4% attachment, but hold commission targets until terminal sync completes."
          : "POS Retail Sync verified current: Fremont, Pearl District, Plano, Oak Brook, and Short Hills trail baseline due to hero SKU stockouts.",
      recommendedAction:
        posFreshness === "Stale"
          ? "Verify POS Retail terminal upload first; do not issue final store targets on stale feed."
          : "Replenish top 5 bond-repair SKUs and surface service-matched product prompts on stylist tablets.",
      assignedOwner: "Retail Merchandising & Regional Managers",
      status: "New",
      updatedAt: "2026-10-24 05:45 UTC",
    },
    {
      id: "OPP-05-DISCOUNT",
      category: "Unusual Discount Levels",
      title: "Unapproved Promo Code Stacking in Scottsdale Kierland Retreat",
      affectedSalonIds: [scottsdale.salon.id],
      affectedSalonNames: [scottsdale.salon.name],
      region: "Southwest",
      currentMetricLabel: `${formatPct(scottsdale.current.discountRatePct)} discount rate (${formatCurrency(scottsdale.current.discountAmount)}/mo)`,
      expectedBaselineLabel: `${formatPct(scottsdale.baseline3MoAvg.discountRatePct)} historical baseline`,
      monthlyImpactDollars: 11900,
      annualizedImpactDollars: 142800,
      sourceSystemId: "SRC-WAREHOUSE-DAILY",
      freshnessStatus: "Fresh",
      severity: "Critical",
      supportingEvidence:
        "Local autumn campaign codes are stacking on top of existing membership discounts on high-ticket balayage services.",
      recommendedAction:
        "Enforce POS mutual-exclusion rule preventing promo stacking with member pricing; cap ad-hoc manager discounts at 8%.",
      assignedOwner: "Chief Operating Officer & SW Director",
      status: "In Progress",
      updatedAt: "2026-10-24 06:30 UTC",
    },
    {
      id: "OPP-06-MARGIN",
      category: "Margin Compression",
      title: "Strong Revenue Masking Severe Contribution Margin Erosion",
      affectedSalonIds: [scottsdale.salon.id],
      affectedSalonNames: [scottsdale.salon.name],
      region: "Southwest",
      currentMetricLabel: `${formatPct(scottsdale.current.contributionMarginPct)} contribution margin on ${formatCurrency(scottsdale.current.totalRevenue)} rev`,
      expectedBaselineLabel: `${formatPct(scottsdale.baseline3MoAvg.contributionMarginPct)} baseline (${formatSignedPts(scottsdale.marginDeltaPts)})`,
      monthlyImpactDollars: 12800,
      annualizedImpactDollars: 153600,
      sourceSystemId: "SRC-WAREHOUSE-DAILY",
      freshnessStatus: "Fresh",
      severity: "Critical",
      supportingEvidence: `Scottsdale beat revenue target (${formatCurrency(scottsdale.current.totalRevenue)} vs $108k) yet lost ${formatSignedPts(scottsdale.marginDeltaPts)} of margin from promo stacking and unmeasured backbar color usage.`,
      recommendedAction:
        "Audit backbar color dispense per ticket and remove stacked promotional codes.",
      assignedOwner: "Chief Operating Officer",
      status: "Under Review",
      updatedAt: "2026-10-24 06:40 UTC",
    },
    {
      id: "OPP-07-VARIANCE",
      category: "Revenue Variance by Salon",
      title: "Monthly Revenue Shortfall vs Budget Target in Flagged Studios",
      affectedSalonIds:
        targetLaggards.length > 0
          ? targetLaggards.map((c) => c.salon.id)
          : ["SLN-PNW-01", "SLN-PNW-02"],
      affectedSalonNames:
        targetLaggards.length > 0
          ? targetLaggards.map((c) => c.salon.name)
          : ["Bellevue Flagship Studio", "Capitol Hill Atelier"],
      region: "Pacific Northwest",
      currentMetricLabel: `${formatCurrency(
        (targetLaggards.length > 0 ? targetLaggards : comps.slice(0, 2)).reduce(
          (s, c) => s + c.targetVarianceDollars,
          0
        )
      )} combined target gap`,
      expectedBaselineLabel: "100% of FY26 monthly salon budget",
      monthlyImpactDollars: 10200,
      annualizedImpactDollars: 122400,
      sourceSystemId: "SRC-WAREHOUSE-DAILY",
      freshnessStatus: "Fresh",
      severity: "High",
      supportingEvidence:
        "Target variance correlates directly with unbooked repeat visits and mid-week roster gaps.",
      recommendedAction:
        "Run weekly regional target bridge review using certified Saved Insight tile.",
      assignedOwner: "Regional Operations Manager",
      status: "New",
      updatedAt: "2026-10-24 06:50 UTC",
    },
  ];
}

export const INITIAL_ALERT_RULES: AlertRule[] = [
  {
    id: "RULE-REPEAT-01",
    name: "Repeat-Visit Rate Contraction > 5 pts",
    metricKey: "repeat_visit_rate",
    metricLabel: "Repeat-Visit Rate",
    condition: "Falls by more than",
    thresholdPct: 5,
    comparisonBaseline: "Previous 4-week baseline",
    scopeRegion: "Pacific Northwest",
    selectedSalonIds: [
      "SLN-PNW-01",
      "SLN-PNW-02",
      "SLN-PNW-03",
      "SLN-PNW-04",
      "SLN-PNW-05",
    ],
    channel: "Email",
    recipientRole: "Regional Manager",
    frequency: "Once daily",
    minFreshnessHours: 24,
    enabled: true,
    createdBy: "Regional Operations Manager",
  },
  {
    id: "RULE-CANCEL-02",
    name: "Late Cancellation Rate Above 12%",
    metricKey: "cancellation_rate",
    metricLabel: "Appointment Cancellation Rate",
    condition: "Exceeds",
    thresholdPct: 12,
    comparisonBaseline: "Organization peer average",
    scopeRegion: "All Regions",
    selectedSalonIds: SALONS.map((s) => s.id),
    channel: "WhatsApp",
    recipientRole: "Regional Manager",
    frequency: "Once daily",
    minFreshnessHours: 24,
    enabled: true,
    createdBy: "Tenant Governance Admin",
  },
  {
    id: "RULE-UTIL-03",
    name: "Stylist Utilization Below 65%",
    metricKey: "staff_utilization",
    metricLabel: "Stylist Utilization %",
    condition: "Falls below",
    thresholdPct: 65,
    comparisonBaseline: "Previous 4-week baseline",
    scopeRegion: "Pacific Northwest",
    selectedSalonIds: [
      "SLN-PNW-01",
      "SLN-PNW-02",
      "SLN-PNW-03",
      "SLN-PNW-04",
      "SLN-PNW-05",
    ],
    channel: "Email",
    recipientRole: "Regional Manager",
    frequency: "Weekly digest",
    minFreshnessHours: 24,
    enabled: true,
    createdBy: "Regional Operations Manager",
  },
  {
    id: "RULE-RETAIL-04",
    name: "Retail Attachment Decline > 10% (Requires 24h Fresh POS)",
    metricKey: "retail_attachment",
    metricLabel: "Retail Attachment Rate",
    condition: "Falls by more than",
    thresholdPct: 10,
    comparisonBaseline: "Previous 4-week baseline",
    scopeRegion: "Pacific Northwest",
    selectedSalonIds: ["SLN-PNW-03", "SLN-PNW-05"],
    channel: "Email",
    recipientRole: "Regional Manager",
    frequency: "Once daily",
    minFreshnessHours: 24,
    enabled: true,
    createdBy: "Tenant Governance Admin",
  },
  {
    id: "RULE-DISC-05",
    name: "Unusual Discount Rate Above 12%",
    metricKey: "discount_rate",
    metricLabel: "Promotional Discount %",
    condition: "Exceeds",
    thresholdPct: 12,
    comparisonBaseline: "Organization peer average",
    scopeRegion: "Southwest",
    selectedSalonIds: ["SLN-SW-01", "SLN-SW-02", "SLN-SW-03", "SLN-SW-04", "SLN-SW-05"],
    channel: "Email",
    recipientRole: "COO",
    frequency: "Once daily",
    minFreshnessHours: 24,
    enabled: true,
    createdBy: "Chief Operating Officer",
  },
];

export function evaluateAlertRulesAgainstData(params: {
  rules: AlertRule[];
  dataVersion: number;
  demoTimeOffsetHours: number;
  posSyncRefreshed: boolean;
  existingStatuses?: Record<string, TriggeredAlert["status"]>;
  existingAssignees?: Record<string, string>;
}): TriggeredAlert[] {
  const {
    rules,
    dataVersion,
    demoTimeOffsetHours,
    posSyncRefreshed,
    existingStatuses = {},
    existingAssignees = {},
  } = params;

  const sources = getSourceSystems(demoTimeOffsetHours, posSyncRefreshed);
  const allComps = getSalonComparisons(
    SALONS.map((s) => s.id),
    dataVersion
  );
  const alerts: TriggeredAlert[] = [];

  rules.forEach((rule) => {
    if (!rule.enabled) return;

    const scopedComps = allComps.filter(
      (c) =>
        (rule.scopeRegion === "All Regions" ||
          c.salon.region === rule.scopeRegion) &&
        (rule.selectedSalonIds.length === 0 ||
          rule.selectedSalonIds.includes(c.salon.id))
    );

    const sourceForMetric =
      rule.metricKey === "retail_attachment"
        ? sources["SRC-POS-RETAIL"]
        : rule.metricKey === "cancellation_rate" ||
            rule.metricKey === "staff_utilization"
          ? sources["SRC-BOOKING-STREAM"]
          : sources["SRC-WAREHOUSE-DAILY"];

    const isStaleForRule = sourceForMetric.ageHours > rule.minFreshnessHours;

    // Peer averages for baseline comparison if requested
    const peerRepeatAvg =
      allComps.reduce((s, c) => s + c.current.repeatVisitRate, 0) /
      Math.max(1, allComps.length);
    const peerCancelAvg =
      allComps.reduce((s, c) => s + c.current.cancellationRatePct, 0) /
      Math.max(1, allComps.length);
    const peerUtilAvg =
      allComps.reduce((s, c) => s + c.current.staffUtilizationPct, 0) /
      Math.max(1, allComps.length);
    const peerRetailAvg =
      allComps.reduce((s, c) => s + c.current.retailAttachmentPct, 0) /
      Math.max(1, allComps.length);
    const peerDiscAvg =
      allComps.reduce((s, c) => s + c.current.discountRatePct, 0) /
      Math.max(1, allComps.length);

    const evaluateCondition = (
      currentVal: number,
      signedDelta: number,
      extraRelativeDropPct?: number
    ): boolean => {
      switch (rule.condition) {
        case "Falls by more than":
          return (
            signedDelta < -rule.thresholdPct ||
            (typeof extraRelativeDropPct === "number" &&
              extraRelativeDropPct < -rule.thresholdPct)
          );
        case "Increases by more than":
          return signedDelta > rule.thresholdPct;
        case "Exceeds":
          return currentVal > rule.thresholdPct;
        case "Falls below":
          return currentVal < rule.thresholdPct;
        default:
          return false;
      }
    };

    let matchingSalons = scopedComps;
    let observedSummary = "";

    if (rule.metricKey === "repeat_visit_rate") {
      matchingSalons = scopedComps.filter((c) => {
        const delta =
          rule.comparisonBaseline === "Organization peer average"
            ? c.current.repeatVisitRate - peerRepeatAvg
            : c.repeatRateDeltaPts;
        return evaluateCondition(c.current.repeatVisitRate, delta);
      });
      if (matchingSalons.length > 0) {
        const worst = [...matchingSalons].sort(
          (a, b) => a.repeatRateDeltaPts - b.repeatRateDeltaPts
        )[0];
        observedSummary = `${worst.salon.name} at ${formatPct(worst.current.repeatVisitRate)} (${formatSignedPts(worst.repeatRateDeltaPts)} vs baseline)`;
      }
    } else if (rule.metricKey === "cancellation_rate") {
      matchingSalons = scopedComps.filter((c) => {
        const delta =
          rule.comparisonBaseline === "Organization peer average"
            ? c.current.cancellationRatePct - peerCancelAvg
            : c.current.cancellationRatePct -
              c.baseline3MoAvg.cancellationRatePct;
        return evaluateCondition(c.current.cancellationRatePct, delta);
      });
      if (matchingSalons.length > 0) {
        observedSummary = matchingSalons
          .map(
            (m) =>
              `${m.salon.name.split(" ")[0]} (${formatPct(m.current.cancellationRatePct)})`
          )
          .join(", ");
      }
    } else if (rule.metricKey === "staff_utilization") {
      matchingSalons = scopedComps.filter((c) => {
        const delta =
          rule.comparisonBaseline === "Organization peer average"
            ? c.current.staffUtilizationPct - peerUtilAvg
            : c.utilizationDeltaPts;
        return evaluateCondition(c.current.staffUtilizationPct, delta);
      });
      if (matchingSalons.length > 0) {
        const avgU =
          matchingSalons.reduce(
            (s, c) => s + c.current.staffUtilizationPct,
            0
          ) / matchingSalons.length;
        observedSummary = `${matchingSalons.length} salons averaging ${formatPct(avgU)} utilization`;
      }
    } else if (rule.metricKey === "retail_attachment") {
      matchingSalons = scopedComps.filter((c) => {
        const ptsDelta =
          rule.comparisonBaseline === "Organization peer average"
            ? c.current.retailAttachmentPct - peerRetailAvg
            : c.current.retailAttachmentPct -
              c.baseline3MoAvg.retailAttachmentPct;
        return evaluateCondition(
          c.current.retailAttachmentPct,
          ptsDelta,
          c.retailRevenueDeltaPct
        );
      });
      if (matchingSalons.length > 0) {
        const worstRet = [...matchingSalons].sort(
          (a, b) =>
            a.current.retailAttachmentPct - b.current.retailAttachmentPct
        )[0];
        observedSummary = `${worstRet.salon.name} attach at ${formatPct(worstRet.current.retailAttachmentPct)} (${worstRet.retailRevenueDeltaPct}% retail rev)`;
      }
    } else if (rule.metricKey === "discount_rate") {
      matchingSalons = scopedComps.filter((c) => {
        const delta =
          rule.comparisonBaseline === "Organization peer average"
            ? c.current.discountRatePct - peerDiscAvg
            : c.current.discountRatePct - c.baseline3MoAvg.discountRatePct;
        return evaluateCondition(c.current.discountRatePct, delta);
      });
      if (matchingSalons.length > 0) {
        const topDisc = [...matchingSalons].sort(
          (a, b) => b.current.discountRatePct - a.current.discountRatePct
        )[0];
        observedSummary = `${topDisc.salon.name} at ${formatPct(topDisc.current.discountRatePct)} discount rate`;
      }
    } else {
      // total_revenue_change
      matchingSalons = scopedComps.filter((c) => {
        const targetGapPct = Number(
          (
            (c.targetVarianceDollars /
              Math.max(1, c.salon.monthlyRevenueTarget)) *
            100
          ).toFixed(1)
        );
        const metricVal =
          rule.comparisonBaseline === "Monthly target"
            ? targetGapPct
            : c.revenueDeltaPct;
        return evaluateCondition(metricVal, metricVal);
      });
      if (matchingSalons.length > 0) {
        const worstRev = [...matchingSalons].sort(
          (a, b) => a.revenueDeltaPct - b.revenueDeltaPct
        )[0];
        observedSummary = `${worstRev.salon.name} (${worstRev.revenueDeltaPct >= 0 ? "+" : ""}${worstRev.revenueDeltaPct}% MoM, ${formatCurrency(worstRev.targetVarianceDollars)} vs target)`;
      }
    }

    if (matchingSalons.length === 0) return;

    const alertId = `ALT-${rule.id}`;
    alerts.push({
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      metricLabel: rule.metricLabel,
      affectedSalons: matchingSalons.map((m) => m.salon.name),
      region:
        rule.scopeRegion === "All Regions"
          ? "Multiple Regions"
          : rule.scopeRegion,
      observedValue: isStaleForRule
        ? `${observedSummary} (Unverified — Stale Source)`
        : observedSummary,
      thresholdLabel: `${rule.condition} ${rule.thresholdPct}% (${rule.comparisonBaseline})`,
      severity:
        rule.metricKey === "repeat_visit_rate" ||
        rule.metricKey === "discount_rate" ||
        rule.thresholdPct >= 10
          ? "High"
          : "Moderate",
      triggeredAt: "2026-10-24 07:10 UTC",
      sourceFreshnessStatus: isStaleForRule ? "Stale" : "Fresh",
      staleVerificationBanner: isStaleForRule
        ? "Cannot verify current condition — source data requires refresh."
        : undefined,
      evidenceSummary: isStaleForRule
        ? `Underlying feed (${sourceForMetric.name}) is ${sourceForMetric.ageHours}h old, exceeding rule SLA of ${rule.minFreshnessHours}h. Refresh POS sync before taking action.`
        : `Triggered across ${matchingSalons.length} salon(s) using certified ${sourceForMetric.name} data through ${sourceForMetric.dataThroughTimestamp}.`,
      recommendedAction: isStaleForRule
        ? "Hold operational intervention until source data refresh completes."
        : rule.metricKey === "repeat_visit_rate"
          ? "Audit checkout rebooking compliance and initiate 45-day overdue returning guest outreach."
          : rule.metricKey === "cancellation_rate"
            ? "Enable automated SMS waitlist backfill for <48h cancellations."
            : rule.metricKey === "discount_rate"
              ? "Disable promotional discount stacking with membership pricing."
              : rule.metricKey === "retail_attachment"
                ? "Replenish top 5 bond-repair SKUs and enable tablet take-home prompts."
                : "Rebalance Mon–Wed morning stylist roster blocks toward Thu–Sat demand.",
      assignedTo: existingAssignees[alertId] ?? rule.recipientRole,
      status: existingStatuses[alertId] ?? "Active",
    });
  });

  return alerts;
}

export const INITIAL_INTERVENTIONS: InterventionRecord[] = [
  {
    id: "INT-COMPLETED-01",
    title: "Chairside Tablet Rebooking & 45-Day Color Cohort Pilot",
    problemStatement:
      "Summer repeat-visit rate softened from 64.0% to 59.1% in Back Bay Newbury Spa and Edina Galleria Salon as express front-desk payments bypassed rebooking.",
    insightDelivered:
      "AI Business Advisor funnel diagnostic isolated a 14-pt drop at checkout rebooking while average ticket and service ratings remained steady.",
    actionTaken:
      "Enabled chairside tablet rebooking prompt prior to invoice close and sent non-discounted 45-day booking reminders.",
    affectedSalonIds: ["SLN-NE-02", "SLN-MW-03"],
    affectedSalonNames: ["Back Bay Newbury Spa", "Edina Galleria Salon"],
    region: "Northeast",
    owner: "Chief Operating Officer & Regional Leads",
    startDate: "2026-08-15",
    status: "Completed & Validated",
    comparisonApproach: "Matched Regional Holdout Salons",
    beforeMetricLabel: "59.1% repeat-visit rate (44.2% rebooking)",
    afterMetricLabel: "63.8% repeat-visit rate (56.9% rebooking)",
    holdoutGroupDeltaLabel:
      "+3.8 pts net lift above matched holdout salons (Bethesda Row & Lincoln Park stayed +0.9 pts seasonal)",
    incrementalVisitsMonthly: 112,
    incrementalSalesMonthly: 11420,
    contributionMarginPct: 36.5,
    interventionDiscountAndTrainingCost: 480,
    estimatedNetContributionMonthly: 3688,
    managerHoursSavedWeekly: 4.5,
    confidenceNote:
      "Illustrative demo measurement: Matched holdout reduces seasonal bias, though two salons represent a directional operational sample rather than a randomized trial.",
  },
  {
    id: "INT-ACTIVE-02",
    title: "Scottsdale Promo Code Stacking Guardrail",
    opportunityId: "OPP-05-DISCOUNT",
    problemStatement:
      "Scottsdale Kierland Retreat contribution margin compressed to 24.8% despite $114k+ monthly sales due to 17.1% stacked promotional discounting.",
    insightDelivered:
      "COO Profitability Diagnostic flagged $12,800/mo contribution leakage from autumn promo codes stacking on membership pricing.",
    actionTaken:
      "Configured POS mutual-exclusion rule capping ad-hoc promotional discounts at 8% while preserving standard member perks.",
    affectedSalonIds: ["SLN-SW-01"],
    affectedSalonNames: ["Scottsdale Kierland Retreat"],
    region: "Southwest",
    owner: "Camila Reyes (Salon Manager) · Approved by Chief Operating Officer",
    startDate: "2026-10-18",
    status: "Active Holdout Trial",
    comparisonApproach: "Pre/Post 4-Week Baseline",
    beforeMetricLabel: "24.8% contribution margin (17.1% discount rate)",
    afterMetricLabel: "Early 7-day read: 31.4% margin (9.2% discount rate)",
    holdoutGroupDeltaLabel:
      "Phoenix Biltmore Salon tracked as local Southwest control (steady 35.1% margin)",
    incrementalVisitsMonthly: 0,
    incrementalSalesMonthly: 9600,
    contributionMarginPct: 34.0,
    interventionDiscountAndTrainingCost: 150,
    estimatedNetContributionMonthly: 7450,
    managerHoursSavedWeekly: 3.0,
    confidenceNote:
      "Illustrative in-flight readout: 7 days elapsed out of 28-day validation window; monitor guest rebooking to verify zero volume attrition.",
  },
];
