import React, { useState } from "react";
import {
  AlertTriangle,
  BellPlus,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  Lock,
  Play,
  Share2,
  ShieldAlert,
} from "lucide-react";
import { useAppState } from "../../context/AppStateContext";
import {
  formatCurrency,
  getSalonComparisons,
} from "../../services/analyticsService";
import {
  downloadTableAsCsv,
  exportAuditReportPdf,
  exportExecutiveBriefPdf,
  exportInsightReportPdf,
} from "../../services/exportShareService";
import { PERSONAS, SALONS } from "../../services/syntheticDataService";
import { AlertRule, RegionName, TriggeredAlert } from "../../types/domain";
import { ShareReportModal } from "../common/ShareAndScheduleModals";
import { TanStackDataTable } from "../common/TanStackDataTable";

export const AlertsNotificationsView: React.FC = () => {
  const {
    activePersona,
    alertRules,
    addAlertRule,
    toggleAlertRule,
    triggeredAlerts,
    simulateAlertTrigger,
    updateAlertActionState,
    refreshPosRetailSource,
    posSyncRefreshed,
    policy,
    setActiveNav,
    askAdvisor,
    presenterHintsEnabled,
  } = useAppState();

  const persona = PERSONAS[activePersona];
  const [evidenceAlert, setEvidenceAlert] = useState<TriggeredAlert | null>(
    null
  );

  // Rule Builder State
  const [ruleName, setRuleName] = useState(
    "Repeat-Visit Contraction > 5% Alert"
  );
  const [metricKey, setMetricKey] =
    useState<AlertRule["metricKey"]>("repeat_visit_rate");
  const [condition, setCondition] =
    useState<AlertRule["condition"]>("Falls by more than");
  const [thresholdPct, setThresholdPct] = useState<number>(5);
  const [comparisonBaseline, setComparisonBaseline] = useState<
    AlertRule["comparisonBaseline"]
  >("Previous 4-week baseline");
  const [scopeRegion, setScopeRegion] = useState<RegionName | "All Regions">(
    "Pacific Northwest"
  );
  const [channel, setChannel] = useState<AlertRule["channel"]>("Email");
  const [recipientRole, setRecipientRole] =
    useState<AlertRule["recipientRole"]>("Regional Manager");
  const [minFreshnessHours, setMinFreshnessHours] = useState<number>(24);

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    const metricLabels: Record<AlertRule["metricKey"], string> = {
      repeat_visit_rate: "Repeat-Visit Rate",
      cancellation_rate: "Appointment Cancellation Rate",
      staff_utilization: "Stylist Utilization %",
      total_revenue_change: "Monthly Net Revenue",
      retail_attachment: "Retail Attachment Rate",
      discount_rate: "Promotional Discount %",
    };

    const effectiveScope: RegionName | "All Regions" = persona.canViewAllRegions
      ? scopeRegion
      : "Pacific Northwest";

    const salonSubset =
      effectiveScope === "All Regions"
        ? SALONS.map((s) => s.id)
        : SALONS.filter((s) => s.region === effectiveScope).map((s) => s.id);

    const created = addAlertRule({
      name: ruleName.trim() || `${metricLabels[metricKey]} Rule`,
      metricKey,
      metricLabel: metricLabels[metricKey],
      condition,
      thresholdPct,
      comparisonBaseline,
      scopeRegion: effectiveScope,
      selectedSalonIds: salonSubset,
      channel,
      recipientRole,
      frequency: "Once daily",
      minFreshnessHours,
      enabled: true,
      createdBy: persona.name,
    });
    // Pass created AlertRule object directly so evaluation runs synchronously with zero state delay
    simulateAlertTrigger(created);
  };

  const getAdvisorPromptForAlert = (alt: TriggeredAlert): string => {
    const label = alt.metricLabel.toLowerCase();
    if (label.includes("retail")) {
      return "Where did retail product sales decline this month?";
    }
    if (label.includes("util")) {
      return "Which salons have the highest unused stylist capacity?";
    }
    if (label.includes("discount") || label.includes("margin")) {
      return "Where should I focus to improve profitability this quarter?";
    }
    if (label.includes("cancel")) {
      return "Which salons are at risk of missing monthly revenue targets?";
    }
    return "Which salons had the biggest decline in repeat visits in the last 30 days?";
  };

  const visibleRules = alertRules.filter(
    (r) =>
      persona.canViewAllRegions ||
      r.scopeRegion === "Pacific Northwest" ||
      r.scopeRegion === "All Regions"
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-600">
            Proactive Anomaly Detection &amp; Freshness-Gated Alerting
            {presenterHintsEnabled && (
              <span> · Proposed Enhancement (Thresholds are configurable demo values)</span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Alerts &amp; Notifications
          </h1>
          <p className="text-sm text-slate-700 max-w-3xl">
            Evaluates configured KPI rules against the shared dataset and automatically holds confident recommendations when source data is stale.
          </p>
        </div>

        {!posSyncRefreshed && (
          <button
            type="button"
            onClick={refreshPosRetailSource}
            className="px-3.5 py-2 text-xs font-semibold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg whitespace-nowrap shrink-0"
          >
            Refresh Stale POS Retail Sync
          </button>
        )}
      </div>

      {/* Emergency Governance Suspension Banner */}
      {!policy.alertDeliveryEnabled && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs font-medium text-red-950 flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-red-700 shrink-0" />
          <span>
            Proactive Alert Delivery is currently suspended by Tenant Governance Admin in AI Governance Emergency Controls. Simulated alert deliveries will be blocked until resumed.
          </span>
        </div>
      )}

      {/* Triggered Alerts Inbox */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          Triggered Alerts ({triggeredAlerts.length})
        </h2>

        <div className="grid grid-cols-1 gap-4">
          {triggeredAlerts.map((alt) => (
            <div
              key={alt.id}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-600">
                    {alt.metricLabel} · {alt.region} · Triggered {alt.triggeredAt} · Status:{" "}
                    <strong className="text-slate-900">{alt.status}</strong> · Assigned:{" "}
                    <strong className="text-teal-800">{alt.assignedTo}</strong>
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900 mt-0.5">
                    {alt.ruleName}
                  </h3>
                </div>
                <span
                  className={`text-xs font-mono tabular-nums font-semibold ${
                    alt.sourceFreshnessStatus === "Stale"
                      ? "text-amber-700"
                      : alt.severity === "High"
                        ? "text-red-700"
                        : "text-slate-800"
                  }`}
                >
                  {alt.observedValue}
                </span>
              </div>

              {/* Mandatory Stale Verification Guardrail Banner */}
              {alt.staleVerificationBanner && (
                <div className="px-3.5 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>{alt.staleVerificationBanner}</span>
                </div>
              )}

              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                <strong className="text-slate-900">Salons:</strong>{" "}
                {alt.affectedSalons.join(", ")} ·{" "}
                <strong className="text-slate-900">Evidence:</strong>{" "}
                {alt.evidenceSummary}
              </p>

              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-700">
                  <strong className="text-slate-900">Next Step:</strong>{" "}
                  {alt.recommendedAction}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEvidenceAlert(alt)}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Evidence
                  </button>
                  <button
                    type="button"
                    disabled={alt.sourceFreshnessStatus === "Stale"}
                    onClick={() =>
                      updateAlertActionState(
                        alt.id,
                        "Action Assigned",
                        persona.name
                      )
                    }
                    className="px-2.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 disabled:opacity-40 border border-teal-200 rounded-md whitespace-nowrap"
                  >
                    Assign Action
                  </button>
                  <button
                    type="button"
                    onClick={() => updateAlertActionState(alt.id, "Snoozed")}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
                  >
                    Snooze 24h
                  </button>
                  <button
                    type="button"
                    onClick={() => updateAlertActionState(alt.id, "Resolved")}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    Resolve
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evidence Inspection Drawer */}
      {evidenceAlert && (
        <div className="bg-slate-900 text-white rounded-xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-teal-300 font-mono">
                Supporting Alert Evidence · {evidenceAlert.thresholdLabel}
              </div>
              <div className="text-base font-semibold mt-0.5">
                {evidenceAlert.ruleName}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEvidenceAlert(null)}
              className="px-3 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 rounded"
            >
              Close
            </button>
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            {evidenceAlert.evidenceSummary}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={async () => {
                const prompt = getAdvisorPromptForAlert(evidenceAlert);
                setActiveNav("advisor");
                await askAdvisor(prompt);
              }}
              className="px-3.5 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-500 rounded-md"
            >
              Open Full Diagnostic in AI Business Advisor
            </button>
          </div>
        </div>
      )}

      {/* Configurable Alert Rule Builder + Active Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleCreateRule}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <BellPlus className="w-4 h-4 text-teal-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              Configurable Alert Rule Builder
            </h2>
          </div>
          <p className="text-xs text-slate-600">
            Thresholds are demo configuration values evaluated live against the synthetic salon dataset.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-800 mb-1">
              Rule Name
            </label>
            <input
              type="text"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-800 mb-1">
                Metric
              </label>
              <select
                value={metricKey}
                onChange={(e) =>
                  setMetricKey(e.target.value as AlertRule["metricKey"])
                }
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900"
              >
                <option value="repeat_visit_rate">Repeat-Visit Rate</option>
                <option value="cancellation_rate">Cancellation Rate</option>
                <option value="staff_utilization">Staff Utilization %</option>
                <option value="retail_attachment">Retail Attachment Rate</option>
                <option value="discount_rate">Promotional Discount %</option>
                <option value="total_revenue_change">Revenue Change %</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-800 mb-1">
                Condition
              </label>
              <select
                value={condition}
                onChange={(e) =>
                  setCondition(e.target.value as AlertRule["condition"])
                }
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900"
              >
                <option value="Falls by more than">Falls by more than</option>
                <option value="Exceeds">Exceeds</option>
                <option value="Falls below">Falls below</option>
                <option value="Increases by more than">
                  Increases by more than
                </option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-800 mb-1">
                Threshold (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={thresholdPct}
                onChange={(e) => setThresholdPct(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-800 mb-1">
                Min Source Freshness (hrs)
              </label>
              <input
                type="number"
                value={minFreshnessHours}
                onChange={(e) => setMinFreshnessHours(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-800 mb-1">
                Comparison Baseline
              </label>
              <select
                value={comparisonBaseline}
                onChange={(e) =>
                  setComparisonBaseline(
                    e.target.value as AlertRule["comparisonBaseline"]
                  )
                }
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900"
              >
                <option value="Previous 4-week baseline">
                  Previous 4-week baseline
                </option>
                <option value="Organization peer average">
                  Organization peer average
                </option>
                <option value="Monthly target">Monthly target</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-800 mb-1">
                Scope
              </label>
              <select
                value={persona.canViewAllRegions ? scopeRegion : "Pacific Northwest"}
                disabled={!persona.canViewAllRegions}
                onChange={(e) =>
                  setScopeRegion(e.target.value as RegionName | "All Regions")
                }
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 disabled:bg-slate-50"
              >
                <option value="Pacific Northwest">Pacific Northwest</option>
                {persona.canViewAllRegions && (
                  <>
                    <option value="Southwest">Southwest</option>
                    <option value="Midwest">Midwest</option>
                    <option value="Northeast">Northeast</option>
                    <option value="All Regions">All Regions</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-800 mb-1">
                Channel
              </label>
              <select
                value={channel}
                onChange={(e) =>
                  setChannel(e.target.value as AlertRule["channel"])
                }
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900"
              >
                <option value="Email">Email</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="SMS">SMS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-800 mb-1">
                Recipient
              </label>
              <select
                value={recipientRole}
                onChange={(e) =>
                  setRecipientRole(e.target.value as AlertRule["recipientRole"])
                }
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900"
              >
                <option value="Regional Manager">Regional Manager</option>
                <option value="COO">COO</option>
                <option value="Salon Director">Salon Director</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
          >
            Create Rule &amp; Evaluate Live Dataset
          </button>
        </form>

        {/* Configured Rules Table */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Configured Alert Rules ({visibleRules.length})
          </h2>
          <div className="divide-y divide-slate-100">
            {visibleRules.map((rule) => (
              <div
                key={rule.id}
                className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-900">
                    {rule.name}
                  </div>
                  <div className="text-slate-600">
                    {rule.metricLabel} {rule.condition.toLowerCase()}{" "}
                    <span className="font-mono font-semibold text-slate-800 tabular-nums">
                      {rule.thresholdPct}%
                    </span>{" "}
                    · Scope:{" "}
                    {!persona.canViewAllRegions &&
                    rule.scopeRegion === "All Regions"
                      ? "Pacific Northwest (Scoped)"
                      : rule.scopeRegion}{" "}
                    · Channel: {rule.channel} · Freshness SLA: &le;
                    {rule.minFreshnessHours}h
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => simulateAlertTrigger(rule.id)}
                    className="px-2.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <Play className="w-3 h-3" /> Simulate Alert
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAlertRule(rule.id)}
                    className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-md text-slate-800 hover:bg-slate-50"
                  >
                    {rule.enabled ? "Enabled" : "Paused"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ReportsExportsView: React.FC = () => {
  const {
    activePersona,
    currentMessages,
    opportunities,
    interventions,
    auditLog,
    outbox,
    dataVersion,
    demoTimeOffsetHours,
    posSyncRefreshed,
    verifyExportChannelAllowed,
    appendAuditEvent,
    notify,
  } = useAppState();

  const persona = PERSONAS[activePersona];
  const isAllRegions = persona.canViewAllRegions;

  const [shareModalInfo, setShareModalInfo] = useState<{
    title: string;
    type: string;
    summary: string;
  } | null>(null);

  const salonComps = getSalonComparisons(persona.allowedSalonIds, dataVersion);

  const briefTitle = isAllRegions
    ? "COO Executive Performance & Sensitivity Brief"
    : "Regional Operations Performance Brief (Pacific Northwest · 5 Salons)";

  const briefDescription = isAllRegions
    ? "Includes executive summary, 4-region scorecard, top risks, validated interventions, 20-salon sensitivity assumptions, and freshness caveats."
    : "Strictly role-scoped to your 5 Pacific Northwest salons: includes regional KPI summary, studio scorecard, PNW retention risks, and freshness caveats.";

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-4 space-y-1">
        <div className="text-xs font-medium text-slate-600">
          Role-Enforced PDF/CSV Exports &amp; Simulated Expiring-Link Delivery Outbox
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Reports &amp; Exports
        </h1>
        <p className="text-sm text-slate-700 max-w-3xl">
          Download formatted PDFs with metric definitions and freshness lineage, export tabular CSVs, or test simulated Email/WhatsApp/SMS delivery.
        </p>
      </div>

      {/* Export Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 1. Executive or Scoped Regional Brief */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-600">
              {isAllRegions
                ? "Board & Leadership Pack (All 20 Salons)"
                : "Regional Operations Pack (5 Authorized Salons)"}
            </div>
            <h2 className="text-base font-semibold text-slate-900">
              {briefTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {briefDescription}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!verifyExportChannelAllowed("PDF", briefTitle)) {
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
                  `Downloaded ${briefTitle} PDF`,
                  "Allowed",
                  "PDF"
                );
                notify(`Downloaded ${briefTitle} PDF.`, "teal");
              }}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Download PDF
            </button>
            <button
              type="button"
              onClick={() =>
                setShareModalInfo({
                  title: briefTitle,
                  type: isAllRegions ? "Executive Brief" : "Regional Brief",
                  summary: isAllRegions
                    ? "Sharing certified October performance summary and regional contribution margin scorecard via 24h expiring link."
                    : "Sharing certified October Pacific Northwest 5-salon performance summary via 24h expiring link.",
                })
              }
              className="px-3.5 py-2 text-xs font-medium text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" /> Share Link
            </button>
          </div>
        </div>

        {/* 2. Scoped Salon KPI CSV & Latest Insight PDF */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-600">
              Scoped Operational Export ({persona.assignedRegion})
            </div>
            <h2 className="text-base font-semibold text-slate-900">
              Authorized Salon Scorecard &amp; Latest Advisor Insight
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              Exports only the {persona.allowedSalonIds.length} salons authorized for {persona.name}. Cross-region unauthorized rows are excluded automatically.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (
                  !verifyExportChannelAllowed(
                    "CSV",
                    "Authorized Salon Scorecard CSV"
                  )
                ) {
                  return;
                }
                downloadTableAsCsv(
                  `Elevate_Scoped_Salons_${activePersona}`,
                  [
                    { key: "salon", header: "Salon" },
                    { key: "region", header: "Region" },
                    { key: "revenue", header: "Oct Net Revenue" },
                    { key: "repeat", header: "Repeat Visit %" },
                    { key: "rebook", header: "Rebooking %" },
                    { key: "util", header: "Staff Utilization %" },
                    { key: "margin", header: "Contribution Margin %" },
                  ],
                  salonComps.map((c) => ({
                    salon: c.salon.name,
                    region: c.salon.region,
                    revenue: c.current.totalRevenue,
                    repeat: c.current.repeatVisitRate,
                    rebook: c.current.rebookingRate,
                    util: c.current.staffUtilizationPct,
                    margin: c.current.contributionMarginPct,
                  }))
                );
                appendAuditEvent(
                  "REPORT_EXPORTED",
                  `Exported scoped CSV for ${persona.allowedSalonIds.length} salons`,
                  "Allowed",
                  "CSV"
                );
                notify("Downloaded scoped salon CSV.", "teal");
              }}
              className="px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg inline-flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Export Scoped CSV
            </button>
            {currentMessages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const last = currentMessages[currentMessages.length - 1];
                  if (!verifyExportChannelAllowed("PDF", last.title)) {
                    return;
                  }
                  exportInsightReportPdf(last);
                  appendAuditEvent(
                    "REPORT_EXPORTED",
                    `Exported Advisor Insight PDF: ${last.title}`,
                    "Allowed",
                    "PDF"
                  );
                  notify("Downloaded Latest Insight PDF.", "teal");
                }}
                className="px-3.5 py-2 text-xs font-medium text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Latest Insight PDF
              </button>
            )}
          </div>
        </div>

        {/* 3. Revenue Opportunity Summary */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-600">
              Action Pipeline ({persona.assignedRegion})
            </div>
            <h2 className="text-base font-semibold text-slate-900">
              Revenue Opportunities &amp; Action Status Summary
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              Tabular CSV and shareable summary of flagged retention, capacity, cancellation, retail, and margin opportunities within your authorized scope.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (
                  !verifyExportChannelAllowed(
                    "CSV",
                    "Revenue Opportunities CSV"
                  )
                ) {
                  return;
                }
                downloadTableAsCsv(
                  `Elevate_Revenue_Opportunities_${activePersona}`,
                  [
                    { key: "category", header: "Category" },
                    { key: "title", header: "Title" },
                    { key: "region", header: "Region" },
                    { key: "salons", header: "Affected Salons" },
                    { key: "impact", header: "Est Monthly Impact ($)" },
                    { key: "status", header: "Status" },
                    { key: "owner", header: "Owner" },
                  ],
                  opportunities.map((o) => ({
                    category: o.category,
                    title: o.title,
                    region: o.region,
                    salons: o.affectedSalonNames.join("; "),
                    impact: o.monthlyImpactDollars,
                    status: o.status,
                    owner: o.assignedOwner,
                  }))
                );
                appendAuditEvent(
                  "REPORT_EXPORTED",
                  "Exported Revenue Opportunities CSV",
                  "Allowed",
                  "CSV"
                );
                notify("Downloaded Revenue Opportunities CSV.", "teal");
              }}
              className="px-3.5 py-2 text-xs font-semibold text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Download CSV
            </button>
            <button
              type="button"
              onClick={() =>
                setShareModalInfo({
                  title: "Scoped Revenue Opportunities Summary",
                  type: "Revenue Opportunity Summary",
                  summary:
                    "Review prioritized repeat-visit and stylist utilization action items for this week.",
                })
              }
              className="px-3.5 py-2 text-xs font-medium text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" /> Share via WhatsApp / Email
            </button>
          </div>
        </div>

        {/* 4. Tenant Governance & Audit Report (Admin Only!) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-600 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-violet-700" />
              Restricted Compliance Export (Customer Admin Only)
            </div>
            <h2 className="text-base font-semibold text-slate-900">
              Tenant Governance &amp; Append-Only Audit Report
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              Contains query logs, policy changes, blocked unauthorized attempts, and simulated alert deliveries.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!persona.canExportAudit) {
                  appendAuditEvent(
                    "ACCESS_BLOCKED",
                    "Denied Audit Report PDF export to non-admin role",
                    "Blocked",
                    "Requires Customer Admin"
                  );
                  notify(
                    "Permission Denied: Only Tenant Governance Admin can export Tenant Audit Reports.",
                    "red"
                  );
                  return;
                }
                if (
                  !verifyExportChannelAllowed("PDF", "Tenant Audit Report PDF")
                ) {
                  return;
                }
                const ok = exportAuditReportPdf(auditLog, activePersona);
                if (ok) {
                  appendAuditEvent(
                    "REPORT_EXPORTED",
                    "Exported Tenant Governance & Audit Report PDF",
                    "Allowed",
                    "Admin Compliance PDF"
                  );
                  notify("Downloaded Tenant Audit Report PDF.", "teal");
                }
              }}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-violet-700 hover:bg-violet-800 rounded-lg inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export Audit PDF
            </button>
          </div>
        </div>
      </div>

      {/* Simulated Delivery Outbox */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            Simulated Delivery Outbox ({outbox.length})
          </h2>
          <span className="text-xs text-slate-600">
            Demo delivery — no external emails, SMS, or WhatsApp messages are actually transmitted
          </span>
        </div>

        <TanStackDataTable
          emptyMessage="No simulated shares sent yet. Click 'Share' on any report or AI Advisor insight to test delivery."
          columns={[
            { key: "timestamp", header: "Timestamp" },
            { key: "channel", header: "Channel" },
            { key: "recipient", header: "Recipient" },
            { key: "reportType", header: "Report Type" },
            { key: "expires", header: "Link Expiry" },
            { key: "status", header: "Prototype Status" },
          ]}
          rows={outbox.map((m) => ({
            timestamp: m.timestamp,
            channel: m.channel,
            recipient: m.recipient,
            reportType: m.reportType,
            expires: m.linkExpiresAt,
            status: `Demo delivery — not actually sent (${formatCurrency(0)} external cost)`,
          }))}
        />
      </div>

      <ShareReportModal
        open={Boolean(shareModalInfo)}
        onClose={() => setShareModalInfo(null)}
        reportTitle={shareModalInfo?.title ?? ""}
        reportType={shareModalInfo?.type ?? "Report"}
        defaultSummary={shareModalInfo?.summary ?? ""}
      />
    </div>
  );
};
