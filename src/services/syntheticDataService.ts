import {
  DailySalonMetric,
  FunnelStage,
  HeatmapCell,
  MetricDefinition,
  MonthlySalonMetric,
  PersonaId,
  PersonaProfile,
  SalonMetadata,
  SourceSystemStatus,
} from "../types/domain";

// Deterministic Mulberry32 PRNG so synthetic figures are 100% reproducible across sessions
function createSeededRng(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SALONS: SalonMetadata[] = [
  // Region 1: Pacific Northwest (5 Regional Salons)
  {
    id: "SLN-PNW-01",
    name: "Bellevue Flagship Studio",
    city: "Bellevue, WA",
    region: "Pacific Northwest",
    managerName: "Elena Vance",
    chairs: 14,
    monthlyRevenueTarget: 94000,
    deliberateFlags: ["declining_repeat_visits", "declining_region_utilization"],
  },
  {
    id: "SLN-PNW-02",
    name: "Capitol Hill Atelier",
    city: "Seattle, WA",
    region: "Pacific Northwest",
    managerName: "Marcus Sterling",
    chairs: 12,
    monthlyRevenueTarget: 86000,
    deliberateFlags: [
      "declining_repeat_visits",
      "elevated_cancellations",
      "declining_region_utilization",
    ],
  },
  {
    id: "SLN-PNW-03",
    name: "Pearl District Sanctuary",
    city: "Portland, OR",
    region: "Pacific Northwest",
    managerName: "Hannah Cho",
    chairs: 12,
    monthlyRevenueTarget: 84000,
    deliberateFlags: [
      "declining_repeat_visits",
      "low_retail_attachment",
      "declining_region_utilization",
    ],
  },
  {
    id: "SLN-PNW-04",
    name: "Kirkland Waterfront Spa",
    city: "Kirkland, WA",
    region: "Pacific Northwest",
    managerName: "Devon Brooks",
    chairs: 13,
    monthlyRevenueTarget: 88000,
    deliberateFlags: ["declining_region_utilization"],
  },
  {
    id: "SLN-PNW-05",
    name: "Fremont Urban Lounge",
    city: "Seattle, WA",
    region: "Pacific Northwest",
    managerName: "Priya Nair",
    chairs: 11,
    monthlyRevenueTarget: 79000,
    deliberateFlags: [
      "low_retail_attachment",
      "declining_region_utilization",
      "stale_pos_retail_sync",
    ],
  },

  // Region 2: Southwest (5 Salons)
  {
    id: "SLN-SW-01",
    name: "Scottsdale Kierland Retreat",
    city: "Scottsdale, AZ",
    region: "Southwest",
    managerName: "Camila Reyes",
    chairs: 16,
    monthlyRevenueTarget: 108000,
    deliberateFlags: ["strong_revenue_margin_compression"],
  },
  {
    id: "SLN-SW-02",
    name: "Austin Domain Collective",
    city: "Austin, TX",
    region: "Southwest",
    managerName: "Jordan Mercer",
    chairs: 13,
    monthlyRevenueTarget: 91000,
    deliberateFlags: ["elevated_cancellations"],
  },
  {
    id: "SLN-SW-03",
    name: "Phoenix Biltmore Salon",
    city: "Phoenix, AZ",
    region: "Southwest",
    managerName: "Tessa Gallagher",
    chairs: 12,
    monthlyRevenueTarget: 87000,
    deliberateFlags: [],
  },
  {
    id: "SLN-SW-04",
    name: "Plano Legacy Studio",
    city: "Plano, TX",
    region: "Southwest",
    managerName: "Omar Farooq",
    chairs: 12,
    monthlyRevenueTarget: 84000,
    deliberateFlags: ["low_retail_attachment"],
  },
  {
    id: "SLN-SW-05",
    name: "Sedona Wellness House",
    city: "Sedona, AZ",
    region: "Southwest",
    managerName: "Claire Winslow",
    chairs: 11,
    monthlyRevenueTarget: 89000,
    deliberateFlags: [],
  },

  // Region 3: Midwest (5 Salons)
  {
    id: "SLN-MW-01",
    name: "Lincoln Park House",
    city: "Chicago, IL",
    region: "Midwest",
    managerName: "Noah Lindqvist",
    chairs: 13,
    monthlyRevenueTarget: 90000,
    deliberateFlags: [],
  },
  {
    id: "SLN-MW-02",
    name: "Oak Brook Terrace",
    city: "Oak Brook, IL",
    region: "Midwest",
    managerName: "Rachel Kim",
    chairs: 12,
    monthlyRevenueTarget: 85000,
    deliberateFlags: ["low_retail_attachment"],
  },
  {
    id: "SLN-MW-03",
    name: "Edina Galleria Salon",
    city: "Edina, MN",
    region: "Midwest",
    managerName: "Lauren Sorensen",
    chairs: 12,
    monthlyRevenueTarget: 88000,
    deliberateFlags: [],
  },
  {
    id: "SLN-MW-04",
    name: "Naperville Reserve",
    city: "Naperville, IL",
    region: "Midwest",
    managerName: "Victor Alvarez",
    chairs: 11,
    monthlyRevenueTarget: 83000,
    deliberateFlags: [],
  },
  {
    id: "SLN-MW-05",
    name: "Ann Arbor Botanical",
    city: "Ann Arbor, MI",
    region: "Midwest",
    managerName: "Maya Patel",
    chairs: 11,
    monthlyRevenueTarget: 82000,
    deliberateFlags: [],
  },

  // Region 4: Northeast (5 Salons)
  {
    id: "SLN-NE-01",
    name: "SoHo Mercer Loft",
    city: "New York, NY",
    region: "Northeast",
    managerName: "Julian Laurent",
    chairs: 15,
    monthlyRevenueTarget: 106000,
    deliberateFlags: [],
  },
  {
    id: "SLN-NE-02",
    name: "Back Bay Newbury Spa",
    city: "Boston, MA",
    region: "Northeast",
    managerName: "Natalie O'Connor",
    chairs: 14,
    monthlyRevenueTarget: 98000,
    deliberateFlags: [],
  },
  {
    id: "SLN-NE-03",
    name: "Short Hills Atelier",
    city: "Short Hills, NJ",
    region: "Northeast",
    managerName: "Sophia Rossi",
    chairs: 12,
    monthlyRevenueTarget: 89000,
    deliberateFlags: ["low_retail_attachment"],
  },
  {
    id: "SLN-NE-04",
    name: "Greenwich Harbor Studio",
    city: "Greenwich, CT",
    region: "Northeast",
    managerName: "Audrey Vance",
    chairs: 13,
    monthlyRevenueTarget: 96000,
    deliberateFlags: [],
  },
  {
    id: "SLN-NE-05",
    name: "Bethesda Row Sanctuary",
    city: "Bethesda, MD",
    region: "Northeast",
    managerName: "Daniel Cho",
    chairs: 12,
    monthlyRevenueTarget: 88000,
    deliberateFlags: [],
  },
];

export const PERSONAS: Record<PersonaId, PersonaProfile> = {
  arjun: {
    id: "arjun",
    name: "Regional Manager",
    roleTitle: "Regional Manager · Pacific Northwest (5 Salons)",
    shortLabel: "Regional Manager",
    assignedRegion: "Pacific Northwest",
    allowedSalonIds: SALONS.filter((s) => s.region === "Pacific Northwest").map((s) => s.id),
    allowedNav: [
      "dashboard",
      "cockpit",
      "staff",
      "settings",
      "overview",
      "advisor",
      "saved-insights",
      "dashboards",
      "opportunities",
      "reports",
      "alerts",
    ],
    canConfigureGovernance: false,
    canViewAllRegions: false,
    canExportAudit: false,
    goals: [
      "Improve repeat visits across 5 Pacific Northwest salons",
      "Reduce unused stylist hours and schedule gaps",
      "Identify declining service and retail revenue early",
      "Save Zenne research conversations to Dashboard with scheduled refresh",
    ],
  },
  meera: {
    id: "meera",
    name: "Chief Operating Officer",
    roleTitle: "Chief Operating Officer (COO) · All 20 Salons",
    shortLabel: "COO",
    assignedRegion: "All Regions",
    allowedSalonIds: SALONS.map((s) => s.id),
    allowedNav: [
      "dashboard",
      "cockpit",
      "staff",
      "settings",
      "overview",
      "advisor",
      "saved-insights",
      "dashboards",
      "opportunities",
      "reports",
      "alerts",
      "governance",
      "control-tower",
    ],
    canConfigureGovernance: false,
    canViewAllRegions: true,
    canExportAudit: false,
    goals: [
      "Monitor organization-wide revenue, contribution margin, and retention",
      "Compare regional performance and spot margin leakage with Zenne",
      "Save executive research widgets and schedule refreshes on Dashboard",
      "Validate financial ROI of operational interventions and AI spend",
    ],
  },
  neha: {
    id: "neha",
    name: "Customer Admin",
    roleTitle: "Customer Admin · AI Agents & Advisor Governance",
    shortLabel: "Customer Admin",
    assignedRegion: "All Regions",
    allowedSalonIds: SALONS.map((s) => s.id),
    allowedNav: [
      "dashboard",
      "cockpit",
      "staff",
      "settings",
      "overview",
      "advisor",
      "saved-insights",
      "dashboards",
      "opportunities",
      "reports",
      "alerts",
      "governance",
      "control-tower",
      "audit",
    ],
    canConfigureGovernance: true,
    canViewAllRegions: true,
    canExportAudit: true,
    goals: [
      "Govern AI Agents and Zenne (AI Business Advisor) settings via Settings",
      "Configure role-scoped RBAC boundaries, clarifying research mode, and approved channels",
      "Enforce tenant AI token and monthly dollar budgets across all AI agents",
      "Audit queries, scheduled refreshes, exports, and safety evaluation checks",
    ],
  },
};

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  total_revenue: {
    id: "kpi.total_revenue",
    version: "v3.1",
    name: "Total Net Revenue",
    formula: "Service Net Revenue + Retail Net Revenue + Recognized Membership Revenue",
    unit: "currency",
    sourceSystemId: "SRC-WAREHOUSE-DAILY",
    cadenceNote: "Updated once daily at 04:00 local time via Daily Financial Batch.",
    businessMeaning: "Total recognized top-line sales after point-of-sale discounts.",
  },
  repeat_visit_rate: {
    id: "kpi.repeat_visit_rate",
    version: "v2.4",
    name: "Repeat-Visit Rate",
    formula: "(Completed Visits by Returning Guests ÷ Total Completed Paid Visits) × 100",
    unit: "percent",
    sourceSystemId: "SRC-WAREHOUSE-DAILY",
    cadenceNote: "Daily batch reconciliation of closed guest invoices.",
    businessMeaning: "Measures guest retention momentum and repeat patronage stability.",
  },
  rebooking_rate: {
    id: "kpi.rebooking_rate",
    version: "v2.2",
    name: "Checkout Rebooking Rate",
    formula: "(Invoices With Next Appointment Booked Within 24h ÷ Completed Paid Visits) × 100",
    unit: "percent",
    sourceSystemId: "SRC-BOOKING-STREAM",
    cadenceNote: "Operational appointment event feed updated every 30 minutes.",
    businessMeaning: "Leading operational indicator of future 30–60 day repeat visits.",
  },
  staff_utilization: {
    id: "kpi.staff_utilization",
    version: "v2.0",
    name: "Stylist Utilization %",
    formula: "(Utilized Service Hours ÷ Rosters Available Stylist Hours) × 100",
    unit: "percent",
    sourceSystemId: "SRC-BOOKING-STREAM",
    cadenceNote: "Operational roster & appointment event stream (30-min lag).",
    businessMeaning: "Proportion of paid floor roster actively delivering guest services.",
  },
  cancellation_rate: {
    id: "kpi.cancellation_rate",
    version: "v1.9",
    name: "Appointment Cancellation Rate",
    formula: "(Cancelled Bookings Within 48h ÷ Total Scheduled Appointments) × 100",
    unit: "percent",
    sourceSystemId: "SRC-BOOKING-STREAM",
    cadenceNote: "Operational appointment event stream (30-min lag).",
    businessMeaning: "Captures late schedule churn that creates unrecoverable chair gaps.",
  },
  retail_attachment: {
    id: "kpi.retail_attachment",
    version: "v2.1",
    name: "Retail Attachment Rate",
    formula: "(Service Visits Containing ≥1 Retail SKU ÷ Completed Paid Visits) × 100",
    unit: "percent",
    sourceSystemId: "SRC-POS-RETAIL",
    cadenceNote: "POS Retail & Inventory Sync batch (24h SLA; subject to terminal sync).",
    businessMeaning: "Take-home product conversion rate driving high-margin ticket expansion.",
  },
  contribution_margin: {
    id: "kpi.contribution_margin",
    version: "v3.0",
    name: "Estimated Contribution Margin",
    formula: "(Total Net Revenue − Stylist Commission/Labor − Backbar & Retail COGS) ÷ Total Net Revenue",
    unit: "percent",
    sourceSystemId: "SRC-WAREHOUSE-DAILY",
    cadenceNote: "Daily batch estimate using standard commission tiers and SKU cost tables.",
    businessMeaning: "Salon-level operating contribution prior to corporate overhead.",
  },
  rev_per_available_hour: {
    id: "kpi.rev_per_available_hour",
    version: "v1.8",
    name: "Revenue per Available Hour (RevPAH)",
    formula: "Total Net Revenue ÷ Available Stylist Hours",
    unit: "currency",
    sourceSystemId: "SRC-WAREHOUSE-DAILY",
    cadenceNote: "Daily batch rollup combining closed invoices and roster hours.",
    businessMeaning: "Core productivity yield per staffed stylist hour.",
  },
};

export function getSourceSystems(
  demoTimeOffsetHours: number,
  posSyncRefreshed: boolean
): Record<string, SourceSystemStatus> {
  // Base anchor date: 2026-10-24T07:45:00-07:00
  const baseMs = new Date("2026-10-24T14:45:00Z").getTime() + demoTimeOffsetHours * 3600 * 1000;
  const fmt = (ms: number) => new Date(ms).toISOString().replace("T", " ").slice(0, 16) + " UTC";

  const warehouseAge = 4.5 + (demoTimeOffsetHours % 24);
  const bookingAge = 0.4;
  const posAge = posSyncRefreshed ? 2.1 : 39.5 + demoTimeOffsetHours;

  return {
    "SRC-WAREHOUSE-DAILY": {
      id: "SRC-WAREHOUSE-DAILY",
      name: "Daily Financial & KPI Batch Warehouse",
      cadenceType: "Daily Batch Warehouse",
      updateScheduleLabel: "Daily batch at 04:00 AM local (Not real-time)",
      dataThroughTimestamp: fmt(baseMs - warehouseAge * 3600 * 1000),
      ageHours: Number(warehouseAge.toFixed(1)),
      slaHours: 24,
      status: warehouseAge <= 24 ? "Fresh" : "Delayed",
      completenessPct: 99.8,
      notes: "Closed guest invoices reconciled through previous business close.",
    },
    "SRC-BOOKING-STREAM": {
      id: "SRC-BOOKING-STREAM",
      name: "Operational Appointment & Roster Event Stream",
      cadenceType: "Operational Event Stream",
      updateScheduleLabel: "Near-current operational events (~25 min lag)",
      dataThroughTimestamp: fmt(baseMs - bookingAge * 3600 * 1000),
      ageHours: Number(bookingAge.toFixed(1)),
      slaHours: 2,
      status: "Fresh",
      completenessPct: 99.9,
      notes: "Captures bookings, cancellations, no-shows, and clocked roster blocks.",
    },
    "SRC-POS-RETAIL": {
      id: "SRC-POS-RETAIL",
      name: "POS Retail SKU & Discount Ledger Sync",
      cadenceType: "POS Retail Ledger Sync",
      updateScheduleLabel: "Daily POS terminal upload (24h SLA)",
      dataThroughTimestamp: fmt(baseMs - posAge * 3600 * 1000),
      ageHours: Number(posAge.toFixed(1)),
      slaHours: 24,
      status: posAge <= 24 ? "Fresh" : "Stale",
      completenessPct: posSyncRefreshed ? 99.6 : 91.5,
      notes: posSyncRefreshed
        ? "All 20 salon POS retail terminals reconciled."
        : "Fremont Urban Lounge & regional retail SKU sync lagging by 39.5h due to delayed terminal batch.",
    },
  };
}

const MONTHS_12 = [
  { key: "2025-11", label: "Nov 2025", season: 1.02 },
  { key: "2025-12", label: "Dec 2025", season: 1.09 },
  { key: "2026-01", label: "Jan 2026", season: 0.94 },
  { key: "2026-02", label: "Feb 2026", season: 0.96 },
  { key: "2026-03", label: "Mar 2026", season: 0.99 },
  { key: "2026-04", label: "Apr 2026", season: 1.01 },
  { key: "2026-05", label: "May 2026", season: 1.03 },
  { key: "2026-06", label: "Jun 2026", season: 1.04 },
  { key: "2026-07", label: "Jul 2026", season: 1.01 },
  { key: "2026-08", label: "Aug 2026", season: 1.0 },
  { key: "2026-09", label: "Sep 2026", season: 0.99 },
  { key: "2026-10", label: "Oct 2026", season: 1.0 },
];

export interface GeneratedDataset {
  salons: SalonMetadata[];
  monthly: MonthlySalonMetric[];
  daily30: DailySalonMetric[];
  dataVersion: number;
}

const cachedDatasets = new Map<number, GeneratedDataset>();

export function getSyntheticDataset(dataVersion = 1): GeneratedDataset {
  const existing = cachedDatasets.get(dataVersion);
  if (existing) return existing;

  const rng = createSeededRng(20261024 + (dataVersion - 1) * 17);
  const monthly: MonthlySalonMetric[] = [];
  const daily30: DailySalonMetric[] = [];

  SALONS.forEach((salon, sIdx) => {
    // Baseline visits ~900/mo with realistic scale per chair count
    const baseVisits = 820 + (salon.chairs - 11) * 32 + Math.round((rng() - 0.5) * 30);
    const baseTicket =
      salon.region === "Northeast"
        ? 103 + (sIdx % 3) * 4
        : salon.id === "SLN-SW-01"
          ? 106
          : 91 + (sIdx % 4) * 3;

    const isRepeatDecliner = salon.deliberateFlags.includes("declining_repeat_visits");
    const isCancelElevated = salon.deliberateFlags.includes("elevated_cancellations");
    const isPnwUtilDecline = salon.deliberateFlags.includes("declining_region_utilization");
    const isLowRetail = salon.deliberateFlags.includes("low_retail_attachment");
    const isMarginCompressed = salon.deliberateFlags.includes(
      "strong_revenue_margin_compression"
    );

    MONTHS_12.forEach((m, mIdx) => {
      const noise = 1 + (rng() - 0.5) * 0.03;
      const lateMonthsFactor = mIdx >= 9 ? mIdx - 8 : 0; // Aug=0, Sep=1, Oct=2 (progressive recent drift)

      // 1. Repeat visit rate & rebooking rate
      let repeatRate = 62.5 + (rng() - 0.5) * 2.4;
      let rebookingRate = 57.5 + (rng() - 0.5) * 2.8;
      if (salon.id === "SLN-NE-04") {
        repeatRate += 5.2;
        rebookingRate += 6.5;
      }
      if (isRepeatDecliner && mIdx >= 8) {
        const dropStep = mIdx - 7; // Aug=1, Sep=2, Oct=3
        const severityMult =
          salon.id === "SLN-PNW-01" ? 3.7 : salon.id === "SLN-PNW-02" ? 3.3 : 2.7;
        repeatRate -= dropStep * severityMult;
        rebookingRate -= dropStep * (severityMult + 1.6);
      }

      // 2. Cancellations & no-shows
      let cancelRate = 7.4 + (rng() - 0.5) * 1.1;
      if (isCancelElevated && mIdx >= 8) {
        const step = mIdx - 7;
        cancelRate += step * (salon.id === "SLN-PNW-02" ? 2.8 : 2.5);
      }
      const noShowRate = Number((2.1 + (isCancelElevated && mIdx >= 9 ? 1.2 : 0) + rng() * 0.5).toFixed(1));

      // Completed visits impacted by seasonality + repeat/cancellation drift
      let visitDrag = 1.0;
      if (isRepeatDecliner && mIdx >= 9) {
        visitDrag -= lateMonthsFactor * (salon.id === "SLN-PNW-01" ? 0.048 : 0.038);
      }
      if (isMarginCompressed) {
        // Strong top-line traffic driven by aggressive promos!
        visitDrag += 0.14;
      }

      const completedPaidVisits = Math.round(baseVisits * m.season * noise * visitDrag);
      const returningGuests = Math.round(completedPaidVisits * (repeatRate / 100));
      const newGuests = completedPaidVisits - returningGuests;

      // 3. Stylist hours & utilization
      const availableStylistHours = Math.round(salon.chairs * 158 * (0.98 + rng() * 0.04));
      let targetUtilPct = 73.8 + (rng() - 0.5) * 3.2;
      if (isPnwUtilDecline && mIdx >= 7) {
        const uStep = mIdx - 6; // Jul=1..Oct=4
        targetUtilPct -= uStep * (salon.id === "SLN-PNW-05" ? 4.1 : 3.4);
      }
      if (salon.id === "SLN-NE-01" || salon.id === "SLN-SW-01") {
        targetUtilPct = Math.min(82.5, targetUtilPct + 5.2);
      }
      const utilizedStylistHours = Math.round(availableStylistHours * (targetUtilPct / 100));
      const staffUtilizationPct = Number(
        ((utilizedStylistHours / availableStylistHours) * 100).toFixed(1)
      );

      // 4. Retail attachment & revenue mix
      let retailAttachmentPct = 19.6 + (rng() - 0.5) * 1.8;
      if (isLowRetail) {
        retailAttachmentPct = mIdx >= 8 ? 10.9 + (sIdx % 3) * 0.55 : 14.8 + rng();
      }
      retailAttachmentPct = Number(retailAttachmentPct.toFixed(1));

      // 5. Discounts & contribution margin
      let discountRatePct = 4.6 + rng() * 1.1;
      if (isMarginCompressed && mIdx >= 7) {
        discountRatePct = 11.5 + (mIdx - 6) * 1.45; // Reaches ~17.3% in Oct!
      }
      discountRatePct = Number(discountRatePct.toFixed(1));

      const grossTicket = baseTicket * (1 + (rng() - 0.5) * 0.02);
      const grossServiceRev = completedPaidVisits * grossTicket * 0.82;
      const discountAmount = Math.round(grossServiceRev * (discountRatePct / 100));
      const serviceRevenue = Math.round(grossServiceRev - discountAmount);
      const retailRevenue = Math.round(
        completedPaidVisits * (retailAttachmentPct / 100) * 44
      );
      const membershipRevenue = Math.round(completedPaidVisits * 9.4);
      const totalRevenue = serviceRevenue + retailRevenue + membershipRevenue;
      const averageTicket = Number((totalRevenue / completedPaidVisits).toFixed(2));

      // Contribution margin: org baseline ~35.2%, compressed in Scottsdale Kierland
      let contributionMarginPct =
        35.4 +
        (retailAttachmentPct - 18) * 0.22 -
        (discountRatePct - 5) * 0.72 -
        (72 - staffUtilizationPct) * 0.14;
      if (isMarginCompressed && mIdx >= 8) {
        contributionMarginPct -= (mIdx - 7) * 1.35; // Extra chemical/backbar cost overrun
      }
      contributionMarginPct = Number(
        Math.max(19.5, Math.min(43.5, contributionMarginPct)).toFixed(1)
      );
      const estimatedContributionDollars = Math.round(
        totalRevenue * (contributionMarginPct / 100)
      );

      const totalScheduled = Math.round(
        completedPaidVisits / (1 - (cancelRate + noShowRate) / 100)
      );
      const cancellations = Math.round(totalScheduled * (cancelRate / 100));
      const noShows = Math.round(totalScheduled * (noShowRate / 100));
      const repeatVisitIntervalDays = Math.round(
        41 + (62 - repeatRate) * 0.85 + (rng() - 0.5) * 2
      );

      monthly.push({
        salonId: salon.id,
        salonName: salon.name,
        region: salon.region,
        monthKey: m.key,
        monthLabel: m.label,
        completedPaidVisits,
        newGuests,
        returningGuests,
        repeatVisitRate: Number(repeatRate.toFixed(1)),
        rebookingRate: Number(rebookingRate.toFixed(1)),
        repeatVisitIntervalDays,
        averageTicket,
        serviceRevenue,
        retailRevenue,
        membershipRevenue,
        totalRevenue,
        discountAmount,
        discountRatePct,
        cancellations,
        cancellationRatePct: Number(cancelRate.toFixed(1)),
        noShows,
        noShowRatePct: noShowRate,
        availableStylistHours,
        utilizedStylistHours,
        staffUtilizationPct,
        retailAttachmentPct,
        contributionMarginPct,
        estimatedContributionDollars,
        revenuePerAvailableHour: Number(
          (totalRevenue / availableStylistHours).toFixed(2)
        ),
      });
    });

    // Generate last 30 days daily records (2026-09-25 through 2026-10-24) consistent with Oct/Sep monthly profile
    const octRecord = monthly.find(
      (r) => r.salonId === salon.id && r.monthKey === "2026-10"
    )!;
    const sepRecord = monthly.find(
      (r) => r.salonId === salon.id && r.monthKey === "2026-09"
    )!;
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dowWeights = [0.85, 0.72, 0.84, 0.96, 1.08, 1.26, 1.29];

    for (let d = 0; d < 30; d++) {
      const dateObj = new Date(Date.UTC(2026, 8, 25 + d)); // Sep 25 .. Oct 24, 2026
      const dateStr = dateObj.toISOString().slice(0, 10);
      const dow = dateObj.getUTCDay();
      const weight = dowWeights[dow];
      const blend = d / 29; // transitions from Sep profile toward Oct profile
      const refVisits =
        (sepRecord.completedPaidVisits * (1 - blend) +
          octRecord.completedPaidVisits * blend) /
        30;
      const dailyVisits = Math.max(
        12,
        Math.round(refVisits * weight * (0.95 + rng() * 0.1))
      );
      const dailyRepeatPct = Number(
        (
          sepRecord.repeatVisitRate * (1 - blend) +
          octRecord.repeatVisitRate * blend +
          (rng() - 0.5) * 1.8
        ).toFixed(1)
      );
      const dailyRebookPct = Number(
        (
          sepRecord.rebookingRate * (1 - blend) +
          octRecord.rebookingRate * blend +
          (rng() - 0.5) * 2.0
        ).toFixed(1)
      );
      const dailyAvailHrs = Math.round(
        (octRecord.availableStylistHours / 30) * (dow === 0 || dow === 1 ? 0.86 : 1.05)
      );
      const dailyUtilPct = Number(
        Math.min(
          94,
          Math.max(
            42,
            octRecord.staffUtilizationPct * (dow >= 4 ? 1.09 : 0.92) +
              (rng() - 0.5) * 2.5
          )
        ).toFixed(1)
      );
      const dailyUtilHrs = Math.round(dailyAvailHrs * (dailyUtilPct / 100));
      const dailyServiceRev = Math.round(
        dailyVisits * (octRecord.serviceRevenue / octRecord.completedPaidVisits)
      );
      const dailyRetailRev = Math.round(
        dailyVisits * (octRecord.retailRevenue / octRecord.completedPaidVisits)
      );
      const dailyMembRev = Math.round(
        dailyVisits * (octRecord.membershipRevenue / octRecord.completedPaidVisits)
      );
      const dailyTotalRev = dailyServiceRev + dailyRetailRev + dailyMembRev;
      const dailyCancelPct = Number(
        Math.max(3, octRecord.cancellationRatePct + (rng() - 0.5) * 1.6).toFixed(1)
      );

      daily30.push({
        salonId: salon.id,
        salonName: salon.name,
        region: salon.region,
        date: dateStr,
        dayOfWeek: dayNames[dow],
        completedPaidVisits: dailyVisits,
        returningGuests: Math.round(dailyVisits * (dailyRepeatPct / 100)),
        repeatVisitRate: dailyRepeatPct,
        rebookingRate: dailyRebookPct,
        serviceRevenue: dailyServiceRev,
        retailRevenue: dailyRetailRev,
        totalRevenue: dailyTotalRev,
        discountAmount: Math.round(
          dailyTotalRev * (octRecord.discountRatePct / 100)
        ),
        cancellations: Math.max(1, Math.round(dailyVisits * (dailyCancelPct / 100))),
        cancellationRatePct: dailyCancelPct,
        noShows: Math.max(0, Math.round(dailyVisits * (octRecord.noShowRatePct / 100))),
        availableStylistHours: dailyAvailHrs,
        utilizedStylistHours: dailyUtilHrs,
        staffUtilizationPct: dailyUtilPct,
        retailAttachmentPct: octRecord.retailAttachmentPct,
        estimatedContributionDollars: Math.round(
          dailyTotalRev * (octRecord.contributionMarginPct / 100)
        ),
      });
    }
  });

  const dataset: GeneratedDataset = {
    salons: SALONS,
    monthly,
    daily30,
    dataVersion,
  };
  cachedDatasets.set(dataVersion, dataset);
  return dataset;
}

/**
 * Ensures dummy / synthetic salon data is always populated for the active workspace.
 * If cached records are missing or empty, regenerates the full 20-salon dataset immediately.
 */
export function ensureSyntheticDatasetReady(dataVersion = 1): GeneratedDataset {
  const existing = cachedDatasets.get(dataVersion);
  if (
    existing &&
    existing.salons.length > 0 &&
    existing.monthly.length > 0 &&
    existing.daily30.length > 0
  ) {
    return existing;
  }
  cachedDatasets.delete(dataVersion);
  return getSyntheticDataset(dataVersion);
}

export function regenerateDummyDataset(nextVersion: number): GeneratedDataset {
  cachedDatasets.delete(nextVersion);
  return getSyntheticDataset(nextVersion);
}

export function buildUtilizationHeatmap(
  scopedSalonIds: string[],
  dataVersion = 1
): HeatmapCell[] {
  const dataset = getSyntheticDataset(dataVersion);
  const octRows = dataset.monthly.filter(
    (m) => m.monthKey === "2026-10" && scopedSalonIds.includes(m.salonId)
  );
  const avgUtil =
    octRows.reduce((acc, r) => acc + r.staffUtilizationPct, 0) /
    Math.max(1, octRows.length);
  const totalAvailWeekly =
    octRows.reduce((acc, r) => acc + r.availableStylistHours, 0) / 4.3;

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const slots = [
    { label: "09:00–12:00", factor: 0.78 },
    { label: "12:00–15:00", factor: 0.94 },
    { label: "15:00–18:00", factor: 1.14 },
    { label: "18:00–20:00", factor: 1.06 },
  ];
  const dayFactors = [0.76, 0.82, 0.93, 1.04, 1.16, 1.24, 0.89];

  const cells: HeatmapCell[] = [];
  days.forEach((day, dIdx) => {
    slots.forEach((slot) => {
      const util = Math.min(
        96,
        Math.max(38, Math.round(avgUtil * dayFactors[dIdx] * slot.factor))
      );
      const slotAvail = totalAvailWeekly / 28;
      const unused = Math.max(0, Math.round(slotAvail * (1 - util / 100)));
      cells.push({
        day,
        slot: slot.label,
        utilizationPct: util,
        unusedHours: unused,
      });
    });
  });
  return cells;
}

export function buildRebookingFunnel(
  scopedSalonIds: string[],
  dataVersion = 1
): FunnelStage[] {
  const dataset = getSyntheticDataset(dataVersion);
  const octRows = dataset.monthly.filter(
    (m) => m.monthKey === "2026-10" && scopedSalonIds.includes(m.salonId)
  );
  const totalVisits = octRows.reduce((acc, r) => acc + r.completedPaidVisits, 0);
  const avgRebook =
    octRows.reduce((acc, r) => acc + r.rebookingRate, 0) / Math.max(1, octRows.length);
  const avgRepeat =
    octRows.reduce((acc, r) => acc + r.repeatVisitRate, 0) /
    Math.max(1, octRows.length);

  const promptedPct = Number(Math.min(92, avgRebook + 23.5).toFixed(1));
  const rebookedAtDeskPct = Number(avgRebook.toFixed(1));
  const keptBookingPct = Number((avgRebook * 0.88).toFixed(1));
  const completedRepeatPct = Number(avgRepeat.toFixed(1));

  return [
    {
      stage: "1. Completed Paid Service Visits",
      guests: totalVisits,
      conversionPct: 100,
      benchmarkPct: 100,
    },
    {
      stage: "2. Stylist Recommended Next Visit Cadence",
      guests: Math.round(totalVisits * (promptedPct / 100)),
      conversionPct: promptedPct,
      benchmarkPct: 84.0,
    },
    {
      stage: "3. Rebooked at Front Desk / Mobile Checkout",
      guests: Math.round(totalVisits * (rebookedAtDeskPct / 100)),
      conversionPct: rebookedAtDeskPct,
      benchmarkPct: 58.0,
    },
    {
      stage: "4. Retained Booking (Not Cancelled 48h Prior)",
      guests: Math.round(totalVisits * (keptBookingPct / 100)),
      conversionPct: keptBookingPct,
      benchmarkPct: 53.5,
    },
    {
      stage: "5. Returned Within 60-Day Repeat Window",
      guests: Math.round(totalVisits * (completedRepeatPct / 100)),
      conversionPct: completedRepeatPct,
      benchmarkPct: 62.5,
    },
  ];
}
