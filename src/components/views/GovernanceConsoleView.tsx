import React, { useState } from "react";
import {
  AlertOctagon,
  CheckCircle2,
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  UserLock,
  X,
} from "lucide-react";
import { useAppState } from "../../context/AppStateContext";
import { PERSONAS } from "../../services/syntheticDataService";

export const GovernanceConsoleView: React.FC = () => {
  const {
    activePersona,
    policy,
    updatePolicy,
    restorePreviousApprovedPolicy,
    agents,
    toggleAgentEnabled,
    auditLog,
    controlTowerEvents,
    safetyResults,
    executeSafetyTestSuite,
    setActiveNav,
    askAdvisor,
    presenterHintsEnabled,
  } = useAppState();

  const persona = PERSONAS[activePersona];
  const isAdmin = persona.canConfigureGovernance;
  const [newRecipient, setNewRecipient] = useState("");

  // Monitoring & Cost Pillar metrics
  const totalQueries = controlTowerEvents.length;
  const successQueries = controlTowerEvents.filter(
    (e) => e.status === "Success"
  ).length;
  const errorOrBlocked = totalQueries - successQueries;
  const totalTokens = controlTowerEvents.reduce(
    (s, e) => s + e.tokensConsumed,
    0
  );
  const totalSpend = controlTowerEvents.reduce((s, e) => s + e.costUsd, 0);
  const avgLatency = Math.round(
    controlTowerEvents.reduce((s, e) => s + e.latencyMs, 0) /
      Math.max(1, totalQueries)
  );
  const cacheHits = controlTowerEvents.filter((e) => e.cacheHit).length;
  const cacheHitRate = ((cacheHits / Math.max(1, totalQueries)) * 100).toFixed(
    1
  );
  const costPerInsight = (totalSpend / Math.max(1, successQueries)).toFixed(3);

  const toggleExportChannel = (
    ch: "Email" | "WhatsApp" | "SMS" | "PDF" | "CSV"
  ) => {
    const exists = policy.allowedExportChannels.includes(ch);
    const next = exists
      ? policy.allowedExportChannels.filter((c) => c !== ch)
      : [...policy.allowedExportChannels, ch];
    updatePolicy(
      { allowedExportChannels: next },
      `${exists ? "Disabled" : "Enabled"} export channel: ${ch}`
    );
  };

  const handleAddRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newRecipient.trim().toLowerCase();
    if (!cleaned) return;
    if (policy.approvedRecipients.some((r) => r.toLowerCase() === cleaned)) {
      setNewRecipient("");
      return;
    }
    updatePolicy(
      {
        approvedRecipients: [...policy.approvedRecipients, cleaned],
      },
      `Added approved recipient: ${cleaned}`
    );
    setNewRecipient("");
  };

  const handleRemoveRecipient = (target: string) => {
    if (!isAdmin || policy.approvedRecipients.length <= 1) return;
    updatePolicy(
      {
        approvedRecipients: policy.approvedRecipients.filter(
          (r) => r !== target
        ),
      },
      `Removed approved recipient: ${target}`
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-600">
            Six-Pillar Enterprise AI Governance Console · Policy {policy.versionLabel}
            {presenterHintsEnabled && (
              <span> · Proposed Enhancement (TRUST &amp; PROVE Pillars)</span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            AI Governance Console
          </h1>
          <p className="text-sm text-slate-700 max-w-3xl">
            {isAdmin
              ? "Configure agent identities, scoped RBAC permissions, emergency kill-switches, cost guardrails, and live safety evaluations."
              : "Read-only executive view of active tenant governance controls (Sign in as Tenant Governance Admin to edit policies)."}
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={restorePreviousApprovedPolicy}
            className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-teal-700" />
            Restore Approved Policy
          </button>
        )}
      </div>

      {/* PILLAR 4: EMERGENCY CONTROLS (Prominent Top Action Bar) */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-red-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              Pillar 4 · Emergency Operational Controls
            </h2>
          </div>
          <span className="text-xs text-slate-600">
            Changes immediately govern AI Business Advisor, Scheduled Jobs, Alerts, and Sharing
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-lg border border-slate-200 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-900">
                AI Business Advisor
              </div>
              <div className="text-xs text-slate-600">
                {policy.advisorPaused ? "Paused (Queries Blocked)" : "Active"}
              </div>
            </div>
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() =>
                updatePolicy(
                  { advisorPaused: !policy.advisorPaused },
                  policy.advisorPaused
                    ? "Resumed AI Business Advisor"
                    : "Emergency Pause: AI Business Advisor"
                )
              }
              className={`px-3 py-1.5 text-xs font-semibold rounded-md disabled:opacity-40 whitespace-nowrap ${
                policy.advisorPaused
                  ? "bg-teal-700 text-white"
                  : "bg-red-50 text-red-800 border border-red-200 hover:bg-red-100"
              }`}
            >
              {policy.advisorPaused ? "Resume" : "Pause Advisor"}
            </button>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-900">
                Scheduled Refreshes
              </div>
              <div className="text-xs text-slate-600">
                {policy.schedulingEnabled ? "Enabled" : "Disabled"}
              </div>
            </div>
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() =>
                updatePolicy(
                  { schedulingEnabled: !policy.schedulingEnabled },
                  policy.schedulingEnabled
                    ? "Disabled Scheduled Analysis Execution"
                    : "Re-enabled Scheduled Analysis Execution"
                )
              }
              className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
            >
              {policy.schedulingEnabled ? "Disable" : "Enable"}
            </button>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-900">
                Alert Delivery
              </div>
              <div className="text-xs text-slate-600">
                {policy.alertDeliveryEnabled ? "Active" : "Suspended"}
              </div>
            </div>
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() =>
                updatePolicy(
                  { alertDeliveryEnabled: !policy.alertDeliveryEnabled },
                  policy.alertDeliveryEnabled
                    ? "Suspended Proactive Alert Delivery"
                    : "Resumed Proactive Alert Delivery"
                )
              }
              className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
            >
              {policy.alertDeliveryEnabled ? "Suspend" : "Resume"}
            </button>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-900">
                External Report Sharing
              </div>
              <div className="text-xs text-slate-600">
                {policy.sharingEnabled ? "Allowed" : "Disabled"}
              </div>
            </div>
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() =>
                updatePolicy(
                  { sharingEnabled: !policy.sharingEnabled },
                  policy.sharingEnabled
                    ? "Disabled External Report Sharing"
                    : "Enabled External Report Sharing"
                )
              }
              className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
            >
              {policy.sharingEnabled ? "Disable" : "Enable"}
            </button>
          </div>
        </div>
      </section>

      {/* PILLAR 1: AGENT IDENTITY & PILLAR 5: MONITORING SNAPSHOT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              Pillar 1 · Registered Agent Identities
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {agents.map((ag) => (
              <div key={ag.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-slate-900">
                      {ag.productName}
                    </span>
                    <span className="text-xs font-mono text-slate-600 ml-2">
                      {ag.agentCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => toggleAgentEnabled(ag.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded border disabled:opacity-50 whitespace-nowrap ${
                      ag.enabled
                        ? "border-teal-200 bg-teal-50 text-teal-900"
                        : "border-slate-300 bg-slate-100 text-slate-700"
                    }`}
                  >
                    {ag.enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
                <div className="text-xs text-slate-700">
                  Owner: {ag.owner} · Scope: {ag.tenantScope} · Model: {ag.modelTier}
                </div>
                <div className="text-xs text-slate-600">
                  Allowed Capabilities: {ag.allowedCapabilities.join(" · ")}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Pillar 5 · Monitoring &amp; Cost Snapshot
            </h2>
            <button
              type="button"
              onClick={() => setActiveNav("control-tower")}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap"
            >
              Open Control Tower &rarr;
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-slate-600">Query Volume (7d)</div>
              <div className="text-base font-bold font-mono tabular-nums mt-0.5 text-slate-900">
                {totalQueries}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-slate-600">Tokens Consumed</div>
              <div className="text-base font-bold font-mono tabular-nums mt-0.5 text-slate-900">
                {totalTokens.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-slate-600">Estimated Spend</div>
              <div className="text-base font-bold font-mono tabular-nums mt-0.5 text-slate-900">
                ${totalSpend.toFixed(2)}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-slate-600">Cost / Successful Insight</div>
              <div className="text-base font-bold font-mono tabular-nums mt-0.5 text-slate-900">
                ${costPerInsight}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-slate-600">Avg Latency / Cache Hit</div>
              <div className="text-base font-bold font-mono tabular-nums mt-0.5 text-slate-900">
                {avgLatency}ms · {cacheHitRate}%
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-slate-600">Blocked / Failures</div>
              <div className="text-base font-bold font-mono tabular-nums text-amber-800 mt-0.5">
                {errorOrBlocked} ({((errorOrBlocked / Math.max(1, totalQueries)) * 100).toFixed(1)}%)
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-600 pt-1 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 font-mono tabular-nums">
            <span>Rate Limit: {policy.userHourlyQueryLimit} queries/hr</span>
            <span>Max Window: {policy.maxQueryWindowMonths} months</span>
          </div>
        </section>
      </div>

      {/* PILLAR 3: SCOPED PERMISSIONS & PILLAR 2: APPEND-ONLY AUDIT PREVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <UserLock className="w-4 h-4 text-teal-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              Pillar 3 · Scoped Role Permissions &amp; Export Channels
            </h2>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-2 flex flex-wrap justify-between gap-2">
              <span className="font-medium text-slate-800">Regional Operations Manager</span>
              <span className="font-mono text-slate-600">
                Pacific Northwest Only (5 Salons) · AI Chatbot Authorized · No Audit Export
              </span>
            </div>
            <div className="py-2 flex flex-wrap justify-between gap-2">
              <span className="font-medium text-slate-800">Chief Operating Officer</span>
              <span className="font-mono text-slate-600">
                All 4 Regions (20 Salons) · AI Chatbot &amp; Executive Briefs · Read Governance
              </span>
            </div>
            <div className="py-2 flex flex-wrap justify-between gap-2">
              <span className="font-medium text-slate-800">Tenant Governance Admin</span>
              <span className="font-mono text-slate-600">
                Tenant Policy Editor · Control Tower · AI Chatbot · Audit Compliance Export
              </span>
            </div>
            <div className="py-2 flex flex-wrap justify-between gap-2">
              <span className="font-medium text-slate-800">Studio Front-Desk Staff / POS Terminal</span>
              <span className="font-mono text-red-700">
                Single Reception Scope · AI Chatbot Restricted by RBAC
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-800">
              Allowed Export &amp; Share Channels
            </div>
            <div className="flex flex-wrap gap-2">
              {(["Email", "WhatsApp", "SMS", "PDF", "CSV"] as const).map(
                (ch) => {
                  const active = policy.allowedExportChannels.includes(ch);
                  return (
                    <button
                      key={ch}
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => toggleExportChannel(ch)}
                      className={`px-3 py-1 text-xs font-medium rounded-md border whitespace-nowrap disabled:opacity-50 ${
                        active
                          ? "bg-teal-50 border-teal-300 text-teal-900"
                          : "bg-slate-50 border-slate-300 text-slate-600"
                      }`}
                    >
                      {ch}: {active ? "Allowed" : "Blocked"}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            <div className="font-semibold text-slate-800">
              Approved Outbound Recipients ({policy.approvedRecipients.length})
            </div>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-slate-50/50">
              {policy.approvedRecipients.map((rec) => (
                <div
                  key={rec}
                  className="px-3 py-1.5 flex items-center justify-between gap-2 font-mono text-slate-700"
                >
                  <span className="truncate">{rec}</span>
                  {isAdmin && policy.approvedRecipients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(rec)}
                      title={`Remove ${rec}`}
                      className="text-slate-400 hover:text-red-700 p-0.5 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {isAdmin && (
            <form onSubmit={handleAddRecipient} className="flex gap-2 pt-1">
              <input
                type="email"
                placeholder="Add approved recipient email..."
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-800"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg whitespace-nowrap"
              >
                Add Recipient
              </button>
            </form>
          )}
        </section>

        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Pillar 2 · Append-Only Audit Trail (Latest Events)
            </h2>
            {persona.allowedNav.includes("audit") && (
              <button
                type="button"
                onClick={() => setActiveNav("audit")}
                className="text-xs font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap"
              >
                Full Audit Log ({auditLog.length}) &rarr;
              </button>
            )}
          </div>
          <p className="text-xs text-slate-600">
            Prototype records events in append-only session storage (does not claim WORM legal immutability without external archival storage).
          </p>
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto text-xs">
            {auditLog.slice(0, 7).map((evt) => (
              <div key={evt.id} className="py-2.5 space-y-0.5">
                <div className="flex items-center justify-between font-mono text-xs text-slate-600 tabular-nums">
                  <span>
                    {evt.timestamp} · {evt.actorName}
                  </span>
                  <span
                    className={
                      evt.outcome === "Blocked"
                        ? "text-red-700 font-semibold"
                        : evt.outcome === "Warning"
                          ? "text-amber-800 font-semibold"
                          : "text-teal-700 font-medium"
                    }
                  >
                    {evt.category} ({evt.outcome})
                  </span>
                </div>
                <div className="text-slate-800">{evt.summary}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* PILLAR 6: LIVE EVALUATION & SAFETY TESTS */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Pillar 6 · Automated Evaluation &amp; Safety Verification Suite
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Statuses reflect actual live checks executed against the Policy, Freshness, and KPI Reconciliation services.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                setActiveNav("advisor");
                await askAdvisor(
                  "Show Scottsdale Kierland Retreat margin details",
                  { overridePersona: "arjun" }
                );
              }}
              className="px-3 py-1.5 text-xs font-medium text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Simulate Unauthorized Request (Regional Ops &rarr; SW)
            </button>
            <button
              type="button"
              onClick={executeSafetyTestSuite}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              Run All 6 Safety Checks
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {safetyResults.map((test) => (
            <div
              key={test.id}
              className="p-4 rounded-lg border border-slate-200 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">
                  {test.category}
                </span>
                <span
                  className={`font-mono font-semibold inline-flex items-center gap-1 whitespace-nowrap ${
                    test.status === "Pass"
                      ? "text-emerald-700"
                      : test.status === "Amber"
                        ? "text-amber-800"
                        : "text-red-700"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {test.status === "Pass"
                    ? "Green · Pass"
                    : test.status === "Amber"
                      ? "Amber · Caution"
                      : "Red · Fail"}
                </span>
              </div>
              <div className="text-slate-700">{test.description}</div>
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800">
                {test.observedOutput}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
