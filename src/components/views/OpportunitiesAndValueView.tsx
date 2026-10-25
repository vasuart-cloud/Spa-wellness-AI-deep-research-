import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Plus,
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
  computeIllustrativeValueScenarios,
  formatCurrency,
  formatPct,
} from "../../services/analyticsService";
import { PERSONAS, SALONS } from "../../services/syntheticDataService";
import {
  OpportunityStatus,
  RevenueOpportunity,
} from "../../types/domain";
import { TanStackDataTable } from "../common/TanStackDataTable";

const ALL_STATUSES: OpportunityStatus[] = [
  "New",
  "Under Review",
  "Action Approved",
  "In Progress",
  "Completed",
  "Dismissed",
];

export const OpportunitiesAndValueView: React.FC = () => {
  const {
    activePersona,
    opportunitiesSubTab,
    setOpportunitiesSubTab,
    opportunities,
    updateOpportunityStatus,
    interventions,
    recordIntervention,
    presenterHintsEnabled,
  } = useAppState();

  const persona = PERSONAS[activePersona];
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [logModalOpp, setLogModalOpp] = useState<RevenueOpportunity | null>(
    null
  );

  // Intervention Modal Form State
  const [intTitle, setIntTitle] = useState("");
  const [intStartDate, setIntStartDate] = useState("2026-10-24");
  const [intOwner, setIntOwner] = useState(persona.name);
  const [intComparison, setIntComparison] = useState<
    "Matched Regional Holdout Salons" | "Pre/Post 4-Week Baseline"
  >("Matched Regional Holdout Salons");

  // Economics toggle: Steady-State vs Year-1 Rollout
  const [economicsView, setEconomicsView] = useState<
    "steady-state" | "first-year"
  >("steady-state");

  const scopedOpportunities = opportunities.filter((o) => {
    const allowed =
      persona.canViewAllRegions ||
      o.region === persona.assignedRegion ||
      o.affectedSalonIds.some((id) => persona.allowedSalonIds.includes(id));
    if (!allowed) return false;
    if (statusFilter !== "All" && o.status !== statusFilter) return false;
    return true;
  });

  const scopedInterventions = interventions.filter(
    (i) =>
      persona.canViewAllRegions ||
      i.region === persona.assignedRegion ||
      i.affectedSalonIds.some((id) => persona.allowedSalonIds.includes(id))
  );

  const sensitivityRows = computeIllustrativeValueScenarios({
    salonCount: 20,
    monthlyVisitsPerSalon: 900,
    averageTicket: 95,
    contributionMarginPct: 35,
  });

  const openLogModal = (opp: RevenueOpportunity) => {
    setLogModalOpp(opp);
    setIntTitle(`${opp.category} Recovery — ${opp.region}`);
    setIntOwner(persona.name);
    setIntStartDate("2026-10-24");
  };

  const handleCreateIntervention = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logModalOpp) return;
    const allowedSalonSubset = logModalOpp.affectedSalonIds.filter((id) =>
      persona.allowedSalonIds.includes(id)
    );
    const chosenIds =
      allowedSalonSubset.length > 0
        ? allowedSalonSubset
        : logModalOpp.affectedSalonIds;
    const salonNames = SALONS.filter((s) => chosenIds.includes(s.id)).map(
      (s) => s.name
    );

    recordIntervention({
      title: intTitle,
      opportunityId: logModalOpp.id,
      problemStatement: `${logModalOpp.title} (${logModalOpp.currentMetricLabel} vs ${logModalOpp.expectedBaselineLabel})`,
      insightDelivered: logModalOpp.supportingEvidence,
      actionTaken: logModalOpp.recommendedAction,
      affectedSalonIds: chosenIds,
      affectedSalonNames: salonNames,
      region:
        logModalOpp.region === "Multiple Regions"
          ? "Pacific Northwest"
          : logModalOpp.region,
      owner: intOwner,
      startDate: intStartDate,
      status: "Active Holdout Trial",
      comparisonApproach: intComparison,
      beforeMetricLabel: logModalOpp.currentMetricLabel,
      afterMetricLabel: "Validation readout scheduled at +28 days",
      holdoutGroupDeltaLabel:
        intComparison === "Matched Regional Holdout Salons"
          ? persona.canViewAllRegions
            ? "Kirkland Waterfront Spa & Naperville Reserve assigned as non-intervention holdouts"
            : "Kirkland Waterfront Spa assigned as matched Pacific Northwest non-intervention holdout"
          : "Compared against trailing 4-week pre-intervention studio baseline",
      incrementalVisitsMonthly: Math.round(
        logModalOpp.monthlyImpactDollars / 95
      ),
      incrementalSalesMonthly: logModalOpp.monthlyImpactDollars,
      contributionMarginPct: 35,
      interventionDiscountAndTrainingCost: 340,
      estimatedNetContributionMonthly: Math.round(
        logModalOpp.monthlyImpactDollars * 0.35 - 340
      ),
      managerHoursSavedWeekly: 3.5,
      confidenceNote:
        "Illustrative demo tracking: Estimated outcome requires full 28-day invoice close and holdout variance check.",
    });

    setLogModalOpp(null);
    setOpportunitiesSubTab("business-value");
  };

  return (
    <div className="space-y-6">
      {/* Header + Segmented View Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <div className="text-xs text-slate-500">
            Actionable Operational Pipeline &amp; Holdout-Validated Value Tracking
            {presenterHintsEnabled && (
              <span> · Proposed Enhancement (ADOPT &amp; PROVE Pillars)</span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {opportunitiesSubTab === "pipeline"
              ? "Revenue & Margin Opportunities"
              : "Business Value & Validated Outcomes"}
          </h1>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setOpportunitiesSubTab("pipeline")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              opportunitiesSubTab === "pipeline"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Opportunities Pipeline ({scopedOpportunities.length})
          </button>
          <button
            type="button"
            onClick={() => setOpportunitiesSubTab("business-value")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              opportunitiesSubTab === "business-value"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Business Value &amp; ROI ({scopedInterventions.length})
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* TAB 1: REVENUE OPPORTUNITIES PIPELINE      */}
      {/* ========================================== */}
      {opportunitiesSubTab === "pipeline" && (
        <div className="space-y-5">
          {/* Status Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {["All", ...ALL_STATUSES].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    statusFilter === st
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums">
              Total Scoped Monthly Potential:{" "}
              <strong className="text-slate-900">
                {formatCurrency(
                  scopedOpportunities.reduce(
                    (s, o) => s + o.monthlyImpactDollars,
                    0
                  )
                )}
                /mo
              </strong>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {scopedOpportunities.map((opp) => (
              <div
                key={opp.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500">
                      {opp.category} · <strong className="text-slate-700">{opp.region}</strong> · Severity:{" "}
                      <span
                        className={
                          opp.severity === "Critical"
                            ? "text-red-700 font-semibold"
                            : opp.severity === "High"
                              ? "text-amber-800 font-semibold"
                              : "text-slate-700 font-medium"
                        }
                      >
                        {opp.severity}
                      </span>
                    </span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      Est. {formatCurrency(opp.monthlyImpactDollars)}/mo
                    </span>
                  </div>

                  <h2 className="text-base font-semibold text-slate-900">
                    {opp.title}
                  </h2>

                  {opp.freshnessStatus === "Stale" && (
                    <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>
                        Source Stale (POS Retail Sync &gt;24h): Verify terminal refresh before issuing final store targets.
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                    <div>
                      <div className="text-slate-500">Observed Metric</div>
                      <div className="font-mono font-semibold text-slate-900 mt-0.5">
                        {opp.currentMetricLabel}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Expected Baseline</div>
                      <div className="font-mono text-slate-700 mt-0.5">
                        {opp.expectedBaselineLabel}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <div>
                      <strong className="text-slate-800">Affected Salons:</strong>{" "}
                      {opp.affectedSalonNames.join(", ")}
                    </div>
                    <div>
                      <strong className="text-slate-800">Evidence:</strong>{" "}
                      {opp.supportingEvidence}
                    </div>
                    <div>
                      <strong className="text-slate-800">Recommended Action:</strong>{" "}
                      {opp.recommendedAction}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Status:</span>
                    <select
                      value={opp.status}
                      onChange={(e) =>
                        updateOpportunityStatus(
                          opp.id,
                          e.target.value as OpportunityStatus
                        )
                      }
                      className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-800"
                    >
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={opp.freshnessStatus === "Stale"}
                    onClick={() => openLogModal(opp)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-40 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Record Management Action
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: BUSINESS VALUE & VALIDATED OUTCOMES */}
      {/* ========================================== */}
      {opportunitiesSubTab === "business-value" && (
        <div className="space-y-8">
          {/* Methodological Guardrail Note */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-teal-800">
                Attribution &amp; Value Measurement Discipline
              </div>
              <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
                Improved insights alone do not cause revenue growth. A salon or regional manager must execute an operational action, and incremental lift must be validated against a matched holdout group or pre/post baseline after accounting for discounts and intervention costs. All figures below are clearly labeled illustrative demo calculations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpportunitiesSubTab("pipeline")}
              className="px-3.5 py-2 text-xs font-semibold text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              + Log Action From Pipeline
            </button>
          </div>

          {/* Recorded Interventions (Scenario 5: Executive Value Verification) */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Recorded Management Interventions &amp; Holdout Comparisons
            </h2>

            <div className="grid grid-cols-1 gap-5">
              {scopedInterventions.map((intv) => (
                <div
                  key={intv.id}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <div className="text-xs text-slate-500">
                        {intv.region} · Started {intv.startDate} · Owner:{" "}
                        <strong className="text-slate-700">{intv.owner}</strong> · Comparison:{" "}
                        <span className="text-teal-800 font-medium">
                          {intv.comparisonApproach}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-0.5">
                        {intv.title}
                      </h3>
                    </div>

                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{intv.status} (Illustrative)</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-800">
                        1. Original Problem &amp; Insight
                      </div>
                      <p className="text-slate-600">{intv.problemStatement}</p>
                      <p className="text-slate-500">{intv.insightDelivered}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-800">
                        2. Management Action Taken
                      </div>
                      <p className="text-slate-600">{intv.actionTaken}</p>
                      <div className="text-slate-500">
                        Salons: {intv.affectedSalonNames.join(", ")}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-800">
                        3. Treatment vs Holdout Readout
                      </div>
                      <div className="font-mono text-slate-700">
                        Before: {intv.beforeMetricLabel}
                      </div>
                      <div className="font-mono text-teal-800 font-semibold">
                        After: {intv.afterMetricLabel}
                      </div>
                      <p className="text-slate-500">
                        {intv.holdoutGroupDeltaLabel}
                      </p>
                    </div>
                  </div>

                  {/* Modeled Financial Outcome Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                    <div>
                      <div className="text-slate-500">Addl. Paid Visits</div>
                      <div className="font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                        +{intv.incrementalVisitsMonthly}/mo
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Incremental Sales</div>
                      <div className="font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                        {formatCurrency(intv.incrementalSalesMonthly)}/mo
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Contrib. Margin</div>
                      <div className="font-mono font-semibold text-slate-800 tabular-nums mt-0.5">
                        {formatPct(intv.contributionMarginPct)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Discount/Intervention Cost</div>
                      <div className="font-mono text-slate-700 tabular-nums mt-0.5">
                        -{formatCurrency(intv.interventionDiscountAndTrainingCost)}/mo
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Est. Net Contribution</div>
                      <div className="font-mono font-bold text-teal-800 tabular-nums mt-0.5">
                        +{formatCurrency(intv.estimatedNetContributionMonthly)}/mo
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                    <span>Confidence Limitation: {intv.confidenceNote}</span>
                    <span className="font-mono tabular-nums">
                      Est. Manager Time Saved: {intv.managerHoursSavedWeekly} hrs/week
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 14 Transparent 20-Salon Illustrative Sensitivity Model */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-teal-700" />
                  20-Salon Illustrative Annual Sensitivity Model (Hypothetical — Not a Forecast)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Transparent baseline: 20 salons × 900 visits/mo × 12 months = 216,000 annual visits · $95 average ticket · 35% contribution margin
                </p>
              </div>

              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                <button
                  type="button"
                  onClick={() => setEconomicsView("steady-state")}
                  className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                    economicsView === "steady-state"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600"
                  }`}
                >
                  Steady-State Annual Economics
                </button>
                <button
                  type="button"
                  onClick={() => setEconomicsView("first-year")}
                  className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                    economicsView === "first-year"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600"
                  }`}
                >
                  Year-1 Rollout Economics
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-5 h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sensitivityRows.map((s) => ({
                      name: `${s.upliftPct.toFixed(2)}% Uplift`,
                      "Addl. Sales ($)": s.additionalAnnualSalesDollars,
                      "Addl. Contribution ($)": s.additionalAnnualContributionDollars,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#334155" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#334155" }} />
                    <Tooltip contentStyle={{ fontSize: "12px" }} />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="Addl. Sales ($)" fill="#0284c7" radius={[4, 4, 0, 0]} />
                    <Bar
                      dataKey="Addl. Contribution ($)"
                      fill="#0d9488"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="lg:col-span-7">
                <TanStackDataTable
                  compact
                  columns={[
                    { key: "scenario", header: "Hypothetical Relative Uplift" },
                    { key: "visits", header: "Incr. Visits", align: "right" },
                    { key: "sales", header: "Addl. Sales ($95)", align: "right" },
                    { key: "contrib", header: "Addl. Contrib (35%)", align: "right" },
                    {
                      key: "net",
                      header:
                        economicsView === "steady-state"
                          ? "Steady-State Net*"
                          : "Year-1 Rollout Net*",
                      align: "right",
                    },
                  ]}
                  rows={sensitivityRows.map((r) => ({
                    scenario: r.label,
                    visits: r.incrementalCompletedVisits.toLocaleString(),
                    sales: formatCurrency(r.additionalAnnualSalesDollars),
                    contrib: formatCurrency(r.additionalAnnualContributionDollars),
                    net: formatCurrency(
                      economicsView === "steady-state"
                        ? r.modeledSteadyStateNetDollars
                        : r.modeledFirstYearRolloutNetDollars
                    ),
                  }))}
                />
                <p className="text-xs text-slate-600 mt-2">
                  *Modeled fee assumptions (labeled for transparency): Steady-state deducts illustrative $14,400/yr platform license ($60/salon/mo); Year-1 Rollout additionally deducts $6,500 one-time implementation &amp; manager enablement cost. Note that at 0.50% hypothetical uplift: 216,000 × 0.5% = 1,080 visits × $95 = $102,600 sales × 35% = $35,910 gross contribution.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal to Record Management Intervention */}
      {logModalOpp && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateIntervention}
            className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-lg"
          >
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <ClipboardCheck className="w-4 h-4 text-teal-700" />
              <span>Record Management Action &amp; Holdout Tracking</span>
            </div>
            <p className="text-xs text-slate-600">
              Links operational action on <strong>{logModalOpp.title}</strong> to the Business Value tracker for validation.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Intervention Title
              </label>
              <input
                type="text"
                required
                value={intTitle}
                onChange={(e) => setIntTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Intervention Start Date
                </label>
                <input
                  type="date"
                  required
                  value={intStartDate}
                  onChange={(e) => setIntStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Assigned Owner
                </label>
                <input
                  type="text"
                  required
                  value={intOwner}
                  onChange={(e) => setIntOwner(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Validation &amp; Comparison Methodology
              </label>
              <select
                value={intComparison}
                onChange={(e) =>
                  setIntComparison(
                    e.target.value as
                      | "Matched Regional Holdout Salons"
                      | "Pre/Post 4-Week Baseline"
                  )
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                <option value="Matched Regional Holdout Salons">
                  Matched Regional Holdout Salons (Recommended)
                </option>
                <option value="Pre/Post 4-Week Baseline">
                  Pre/Post 4-Week Baseline
                </option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLogModalOpp(null)}
                className="px-4 py-2 text-xs border border-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-teal-700 text-white rounded-lg"
              >
                Save &amp; Track Outcome
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
