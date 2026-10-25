import React, { useMemo, useState } from "react";
import {
  Clock,
  Database,
  Download,
  FileSpreadsheet,
  Lock,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sliders,
} from "lucide-react";
import { useAppState } from "../../context/AppStateContext";
import { queryCacheService } from "../../services/cacheService";
import {
  downloadTableAsCsv,
  exportAuditReportPdf,
} from "../../services/exportShareService";
import {
  getSourceSystems,
  METRIC_DEFINITIONS,
  PERSONAS,
} from "../../services/syntheticDataService";
import { AuditEvent } from "../../types/domain";
import { TanStackDataTable } from "../common/TanStackDataTable";

const AUDIT_CATEGORIES: Array<AuditEvent["category"] | "ALL"> = [
  "ALL",
  "QUERY_EXECUTED",
  "INSIGHT_SAVED",
  "SCHEDULE_RUN",
  "REPORT_EXPORTED",
  "SHARE_SIMULATED",
  "POLICY_UPDATED",
  "ALERT_TRIGGERED",
  "ACTION_APPROVED",
  "ACCESS_BLOCKED",
];

export const AuditObservabilityView: React.FC = () => {
  const {
    activePersona,
    auditLog,
    appendAuditEvent,
    verifyExportChannelAllowed,
    dataVersion,
    setActiveNav,
    notify,
    presenterHintsEnabled,
  } = useAppState();

  const persona = PERSONAS[activePersona];
  const [categoryFilter, setCategoryFilter] = useState<
    AuditEvent["category"] | "ALL"
  >("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState<
    AuditEvent["outcome"] | "ALL"
  >("ALL");

  // Scope audit log visibility by role
  const scopedEvents = useMemo(() => {
    const base =
      persona.canViewAllRegions || persona.canExportAudit
        ? auditLog
        : auditLog.filter((e) => e.actorPersona === activePersona);

    return base.filter((e) => {
      if (categoryFilter !== "ALL" && e.category !== categoryFilter) {
        return false;
      }
      if (outcomeFilter !== "ALL" && e.outcome !== outcomeFilter) {
        return false;
      }
      return true;
    });
  }, [auditLog, persona, activePersona, categoryFilter, outcomeFilter]);

  // Recompute cache observability snapshot whenever audit log or dataVersion updates
  const cacheStats = useMemo(() => {
    void auditLog.length;
    void dataVersion;
    return queryCacheService.getObservabilityStats();
  }, [auditLog.length, dataVersion]);

  const allowedCount = scopedEvents.filter((e) => e.outcome === "Allowed").length;
  const blockedOrWarnCount = scopedEvents.filter(
    (e) => e.outcome !== "Allowed"
  ).length;

  const handleExportPdf = () => {
    if (!persona.canExportAudit) {
      appendAuditEvent(
        "ACCESS_BLOCKED",
        "Blocked attempt to export tenant-wide audit report PDF",
        "Blocked",
        "RBAC: Audit export restricted to Tenant Governance Admin"
      );
      notify(
        "Audit log export requires Tenant Governance Admin permissions.",
        "red"
      );
      return;
    }
    if (!verifyExportChannelAllowed("PDF", "Tenant Governance & Audit Report PDF")) {
      return;
    }
    const ok = exportAuditReportPdf(scopedEvents, activePersona);
    if (ok) {
      appendAuditEvent(
        "REPORT_EXPORTED",
        `Exported Tenant Governance & Audit Report PDF (${scopedEvents.length} records)`,
        "Allowed",
        "Format: PDF · Append-Only Audit Ledger"
      );
      notify("Downloaded Tenant Governance & Audit Report PDF.", "teal");
    }
  };

  const handleExportCsv = () => {
    if (!persona.canExportAudit) {
      appendAuditEvent(
        "ACCESS_BLOCKED",
        "Blocked attempt to export tenant-wide audit CSV",
        "Blocked",
        "RBAC: Audit export restricted to Tenant Governance Admin"
      );
      notify(
        "Audit log export requires Tenant Governance Admin permissions.",
        "red"
      );
      return;
    }
    if (!verifyExportChannelAllowed("CSV", "Tenant Audit Ledger CSV")) {
      return;
    }
    downloadTableAsCsv(
      `InsightFlow_Audit_Ledger_dv${dataVersion}.csv`,
      [
        { key: "timestamp", header: "Timestamp (UTC)" },
        { key: "actorName", header: "Actor" },
        { key: "category", header: "Category" },
        { key: "outcome", header: "Outcome" },
        { key: "scopeLabel", header: "Scope" },
        { key: "summary", header: "Event Summary" },
        { key: "metadata", header: "Telemetry Metadata" },
      ],
      scopedEvents.map((e) => ({
        timestamp: e.timestamp,
        actorName: e.actorName,
        category: e.category,
        outcome: e.outcome,
        scopeLabel: e.scopeLabel,
        summary: e.summary,
        metadata: e.metadata,
      }))
    );
    appendAuditEvent(
      "REPORT_EXPORTED",
      `Exported Tenant Audit Ledger CSV (${scopedEvents.length} records)`,
      "Allowed",
      "Format: CSV · Append-Only Audit Ledger"
    );
    notify("Downloaded Tenant Audit Ledger CSV.", "teal");
  };

  const auditRows = useMemo(
    () =>
      scopedEvents.map((e) => ({
        timestamp: e.timestamp,
        actorName: e.actorName,
        category: e.category,
        outcome: e.outcome,
        scopeLabel: e.scopeLabel,
        summary: e.summary,
        metadata: e.metadata || "—",
      })),
    [scopedEvents]
  );

  const cacheRows = useMemo(
    () =>
      cacheStats.entries.map((entry) => ({
        persona: PERSONAS[entry.personaId].name,
        scopeSummary: entry.scopeSummary,
        queryIntent: entry.queryIntent,
        dataVersion: `dv:${entry.dataVersion}`,
        hitCount: entry.hitCount,
        tokensSaved: entry.estimatedTokensSavedTotal.toLocaleString(),
        compositeKey: entry.cacheKey,
      })),
    [cacheStats.entries]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-slate-500">
            Append-Only Event Ledger · Scoped Query Cache Observability
            {presenterHintsEnabled && " · [Proposed Enhancement]"}
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 mt-0.5">
            Audit &amp; Observability
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Immutable operational trace of natural-language queries, RBAC policy
            gates, scheduled refreshes, simulated outbound deliveries, and
            composite-key cache reuse.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className={`px-3 py-2 text-xs font-semibold rounded-md border inline-flex items-center gap-1.5 whitespace-nowrap ${
              persona.canExportAudit
                ? "bg-white hover:bg-slate-50 text-slate-800 border-slate-300"
                : "bg-slate-100 text-slate-400 border-slate-200"
            }`}
          >
            {persona.canExportAudit ? (
              <FileSpreadsheet className="w-3.5 h-3.5" />
            ) : (
              <Lock className="w-3.5 h-3.5" />
            )}
            Export Audit CSV
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className={`px-3 py-2 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 whitespace-nowrap ${
              persona.canExportAudit
                ? "bg-slate-900 hover:bg-slate-800 text-white"
                : "bg-slate-200 text-slate-500"
            }`}
          >
            {persona.canExportAudit ? (
              <Download className="w-3.5 h-3.5" />
            ) : (
              <Lock className="w-3.5 h-3.5" />
            )}
            Export Audit PDF
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">
            Visible Audit Records
          </div>
          <div className="text-2xl font-semibold text-slate-900 font-mono tabular-nums mt-1">
            {scopedEvents.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {persona.canViewAllRegions || persona.canExportAudit
              ? "Tenant-wide visibility"
              : "Scoped to Regional Manager"}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">
            Allowed Operations
          </div>
          <div className="text-2xl font-semibold text-teal-700 font-mono tabular-nums mt-1">
            {allowedCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Verified scope &amp; policy compliant
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">
            Blocked / Policy Warnings
          </div>
          <div className="text-2xl font-semibold text-amber-700 font-mono tabular-nums mt-1">
            {blockedOrWarnCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            RBAC, budget, or injection blocks
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">
            Scoped Cache Hit Rate
          </div>
          <div className="text-2xl font-semibold text-slate-900 font-mono tabular-nums mt-1">
            {cacheStats.hitRatePct.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            {cacheStats.totalHits} hits / {cacheStats.totalLookups} lookups
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">
            Est. Tokens Saved by Cache
          </div>
          <div className="text-2xl font-semibold text-teal-700 font-mono tabular-nums mt-1">
            {cacheStats.estimatedTokensSaved.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            Active Dataset dv:{dataVersion}
          </div>
        </div>
      </div>

      {/* Append-Only Audit Ledger */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Append-Only Governance &amp; Activity Ledger
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Every query, schedule run, alert evaluation, policy update, and
              blocked access attempt is recorded with actor scope and outcome.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by event category"
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(
                  e.target.value as AuditEvent["category"] | "ALL"
                )
              }
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:border-teal-600"
            >
              {AUDIT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "ALL" ? "All Categories" : cat}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by event outcome"
              value={outcomeFilter}
              onChange={(e) =>
                setOutcomeFilter(
                  e.target.value as AuditEvent["outcome"] | "ALL"
                )
              }
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:border-teal-600"
            >
              <option value="ALL">All Outcomes</option>
              <option value="Allowed">Allowed</option>
              <option value="Blocked">Blocked</option>
              <option value="Warning">Warning</option>
            </select>
          </div>
        </div>

        <TanStackDataTable
          columns={[
            { key: "timestamp", header: "Timestamp (UTC)" },
            { key: "actorName", header: "Actor" },
            { key: "category", header: "Category" },
            { key: "outcome", header: "Outcome" },
            { key: "scopeLabel", header: "Authorized Scope" },
            { key: "summary", header: "Activity Summary" },
            { key: "metadata", header: "Telemetry" },
          ]}
          rows={auditRows}
          searchPlaceholder="Search actor, summary, salon, or category..."
          pageSize={10}
        />
      </section>

      {/* Normalized Scoped Query Cache Inspector */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-teal-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Normalized Scoped Query Cache Inspector
              </h2>
            </div>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl">
              Composite isolation key format:{" "}
              <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
                tenant | role | scope | kpis | intent | range | mode | dv
              </code>
              . Cache hits never cross persona salon boundaries and are
              automatically purged whenever the certified dataset version (
              <span className="font-mono">dv:{dataVersion}</span>) increments.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setActiveNav("advisor")}
            className="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            Test Repeat Query in Advisor
          </button>
        </div>

        {cacheRows.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-lg p-6 text-center space-y-2 bg-slate-50/50">
            <div className="text-xs font-semibold text-slate-700">
              No active composite-key entries cached for dataset version dv:
              {dataVersion}
            </div>
            <p className="text-xs text-slate-500 max-w-xl mx-auto">
              Execute any analytical prompt in AI Business Advisor, then run the
              same prompt a second time to observe sub-30ms certified cache
              reuse and zero incremental token spend.
            </p>
          </div>
        ) : (
          <TanStackDataTable
            columns={[
              { key: "persona", header: "Persona Role" },
              { key: "scopeSummary", header: "Authorized Scope" },
              { key: "queryIntent", header: "Normalized Intent" },
              { key: "dataVersion", header: "Dataset Version" },
              { key: "hitCount", header: "Reuse Hits", align: "right" },
              {
                key: "tokensSaved",
                header: "Est. Tokens Saved",
                align: "right",
              },
              { key: "compositeKey", header: "Composite Isolation Key" },
            ]}
            rows={cacheRows}
            searchPlaceholder="Filter cached composite keys..."
            pageSize={6}
            compact
          />
        )}
      </section>
    </div>
  );
};

export const SettingsView: React.FC = () => {
  const {
    activePersona,
    switchPersona,
    setActiveNav,
    dataVersion,
    demoTimeOffsetHours,
    posSyncRefreshed,
    refreshPosRetailSource,
    triggerDataVersionRefresh,
    advanceDemoTime,
    presenterHintsEnabled,
    setPresenterHintsEnabled,
    setShowOnboarding,
    resetPrototypeState,
  } = useAppState();

  const persona = PERSONAS[activePersona];
  const [confirmingReset, setConfirmingReset] = useState(false);

  const sources = useMemo(
    () => getSourceSystems(demoTimeOffsetHours, posSyncRefreshed),
    [demoTimeOffsetHours, posSyncRefreshed]
  );

  const metricRows = useMemo(
    () =>
      Object.values(METRIC_DEFINITIONS).map((m) => ({
        id: `${m.id} (${m.version})`,
        name: m.name,
        formula: m.formula,
        sourceSystemId: m.sourceSystemId,
        cadenceNote: m.cadenceNote,
      })),
    []
  );

  if (!persona.canConfigureGovernance) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 max-w-xl mx-auto text-center space-y-4 mt-8">
        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-700">
          <Lock className="w-5 h-5" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">
          Tenant Administration Restricted
        </h1>
        <p className="text-sm text-slate-600">
          Current signed-in role <strong>{persona.name}</strong> ({persona.roleTitle})
          does not hold tenant pipeline or workspace configuration privileges.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setActiveNav("overview")}
            className="px-3.5 py-2 text-xs font-semibold border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
          >
            Return to Overview
          </button>
          <button
            type="button"
            onClick={() => switchPersona("neha", "settings")}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800"
          >
            Switch to Tenant Governance Admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-slate-500">
            Tenant Data Pipelines · Semantic KPI Registry · Prototype Controls
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 mt-0.5">
            Workspace &amp; Pipeline Settings
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Manage Elevate Salon &amp; Wellness Group source pipeline freshness,
            certified KPI semantic definitions, and demo simulation state.
          </p>
        </div>

        <div className="text-xs text-slate-600 font-mono tabular-nums bg-white border border-slate-200 rounded-md px-3 py-2">
          Tenant: elevate-salon-group · Dataset dv:{dataVersion} · Clock Offset
          +{demoTimeOffsetHours}h
        </div>
      </div>

      {/* Data Source Freshness & Simulation Controls */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Source System Pipelines &amp; Freshness SLA Status
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Financial KPIs run on daily batch closes; booking events stream
              near-real-time; POS Retail SKU sync enforces a 24-hour freshness
              gate before proactive alerts can recommend action.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshPosRetailSource}
              disabled={posSyncRefreshed}
              className="px-3 py-1.5 text-xs font-semibold bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {posSyncRefreshed
                ? "POS Retail Feed Synced"
                : "Sync POS Retail Feed Now"}
            </button>

            <button
              type="button"
              onClick={triggerDataVersionRefresh}
              className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Database className="w-3.5 h-3.5" />
              Publish New Data Batch (dv:{dataVersion + 1})
            </button>

            <button
              type="button"
              onClick={() => advanceDemoTime(24)}
              className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Clock className="w-3.5 h-3.5" />
              Advance Demo Clock (+24h)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.values(sources).map((src) => {
            const isFresh = src.status === "Fresh";
            return (
              <div
                key={src.id}
                className="border border-slate-200 rounded-lg p-4 space-y-2 bg-slate-50/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-900">
                    {src.name}
                  </div>
                  <span
                    className={`text-xs font-semibold font-mono ${
                      isFresh ? "text-teal-700" : "text-amber-700"
                    }`}
                  >
                    {src.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-slate-600">
                  {src.updateScheduleLabel}
                </div>
                <div className="text-xs text-slate-500 font-mono tabular-nums space-y-0.5 pt-1 border-t border-slate-200/80">
                  <div>Data Through: {src.dataThroughTimestamp}</div>
                  <div>
                    Feed Age: {src.ageHours}h (SLA &le;{src.slaHours}h) ·
                    Completeness: {src.completenessPct}%
                  </div>
                </div>
                <p className="text-xs text-slate-600">{src.notes}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Certified KPI Semantic Layer Registry */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-700" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Certified KPI Semantic Layer Registry
            </h2>
            <p className="text-xs text-slate-500">
              AI Business Advisor narrates exclusively over these governed
              deterministic formulas and never invents ad-hoc calculations.
            </p>
          </div>
        </div>

        <TanStackDataTable
          columns={[
            { key: "id", header: "Semantic Metric ID" },
            { key: "name", header: "Business Metric" },
            { key: "formula", header: "Certified Deterministic Formula" },
            { key: "sourceSystemId", header: "Authoritative Source" },
            { key: "cadenceNote", header: "Refresh Cadence & SLA" },
          ]}
          rows={metricRows}
          searchPlaceholder="Filter certified KPIs..."
          pageSize={8}
          compact
        />
      </section>

      {/* Demo & Presenter Controls */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-slate-700" />
          <h2 className="text-sm font-semibold text-slate-900">
            Presenter Experience &amp; Factory Reset
          </h2>
        </div>

        <div className="divide-y divide-slate-200">
          <div className="py-3 first:pt-0 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-900">
                Show Capability Origin Annotations (Presenter Mode)
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Displays subtle inline markers distinguishing Zenoti-Inspired
                Core capabilities from Proposed Governance &amp; Workflow
                Enhancements.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPresenterHintsEnabled(!presenterHintsEnabled)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md border ${
                presenterHintsEnabled
                  ? "bg-teal-50 text-teal-800 border-teal-300"
                  : "bg-white text-slate-700 border-slate-300"
              }`}
            >
              {presenterHintsEnabled ? "Annotations Visible" : "Annotations Hidden"}
            </button>
          </div>

          <div className="py-3 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-900">
                Launch Welcome &amp; Product Vision Modal
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Re-open the TRUST · ADOPT · REPEAT · PROVE executive onboarding
                screen and persona launcher.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowOnboarding(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md"
            >
              Open Welcome Modal
            </button>
          </div>

          <div className="pt-3 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-900">
                Reset Prototype Workspace State
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Restores default saved insights, custom dashboards, governance
                policies, alert rules, interventions, POS sync lag, and clears
                cached queries.
              </div>
            </div>

            {!confirmingReset ? (
              <button
                type="button"
                onClick={() => setConfirmingReset(true)}
                className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset to Factory Defaults
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-700 font-medium">
                  Confirm full state reset?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    resetPrototypeState();
                    setConfirmingReset(false);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-red-700 hover:bg-red-800 text-white rounded-md"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
