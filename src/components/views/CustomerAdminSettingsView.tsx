import React, { useMemo } from "react";
import {
  Bot,
  Database,
  Lock,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAppState } from "../../context/AppStateContext";
import { extractFreshnessMetadata } from "../../services/agentService";
import { getSourceSystems, PERSONAS } from "../../services/syntheticDataService";
import {
  AuditObservabilityView,
  SettingsView,
} from "./AuditAndSettingsView";
import { ControlTowerView } from "./ControlTowerView";
import { GovernanceConsoleView } from "./GovernanceConsoleView";

export const CustomerAdminSettingsView: React.FC = () => {
  const {
    activePersona,
    authSession,
    loginWithRole,
    settingsSubTab,
    setSettingsSubTab,
    policy,
    updatePolicy,
    agents,
    toggleAgentEnabled,
    demoTimeOffsetHours,
    posSyncRefreshed,
    openZenneWithPrompt,
  } = useAppState();

  const persona = PERSONAS[activePersona];
  const isCustomerAdmin = persona.canConfigureGovernance;

  const sources = useMemo(
    () => getSourceSystems(demoTimeOffsetHours, posSyncRefreshed),
    [demoTimeOffsetHours, posSyncRefreshed]
  );

  // If Regional Manager, COO, or Front-Desk Staff clicks Settings, show governed read-only overview + 1-click switch to Customer Admin
  if (!isCustomerAdmin) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Lock className="w-3.5 h-3.5 text-purple-700" />
              <span>
                Signed in as <strong>{authSession.roleLabel}</strong> · Read-Only
                Workspace Settings View
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Platform Settings &amp; Data Freshness Status
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl">
              Governing AI Agents and Zenne (AI Business Advisor) policies,
              token budgets, and emergency controls requires{" "}
              <strong>Customer Admin</strong> credentials.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              loginWithRole("Governance Console", "governance_admin", "settings")
            }
            className="px-4 py-2.5 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-4 h-4" />
            Switch to Customer Admin to Govern AI Agents
          </button>
        </div>

        {/* Read-only summary of Active AI Agents & Zenne Governance */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Active AI Agents &amp; Zenne Business Advisor Governance
              </h2>
              <p className="text-xs text-slate-500">
                Active Policy {policy.versionLabel} · Managed by Customer Admin
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-600">
              Daily Budget: {policy.dailyTenantTokenBudget.toLocaleString()}{" "}
              tokens · Monthly Cap: ${policy.monthlyAiSpendBudgetUsd}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {agents.map((ag) => (
              <div
                key={ag.id}
                className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-900">
                    {ag.productName === "AI Business Advisor"
                      ? "Zenne · AI Business Advisor"
                      : ag.productName}
                  </span>
                  <span
                    className={`font-mono font-semibold ${
                      ag.enabled &&
                      !(
                        ag.productName === "AI Business Advisor" &&
                        policy.advisorPaused
                      )
                        ? "text-emerald-700"
                        : "text-red-700"
                    }`}
                  >
                    {ag.enabled &&
                    !(
                      ag.productName === "AI Business Advisor" &&
                      policy.advisorPaused
                    )
                      ? "ACTIVE"
                      : "PAUSED"}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-500 truncate">
                  {ag.agentCode}
                </div>
                <div className="text-xs text-slate-600">
                  Scope: {ag.tenantScope} · Tier: {ag.modelTier}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Read-only Live Data Freshness Sources */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Certified Data Sources &amp; Freshness Timestamps
            </h2>
            <p className="text-xs text-slate-500">
              Live date, time, and source pipeline status backing Zenne and
              Dashboard widgets.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.values(sources).map((src) => {
              const meta = extractFreshnessMetadata(src);
              return (
                <div
                  key={src.id}
                  className="p-4 rounded-lg border border-slate-200 bg-slate-50/40 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-900">
                      {src.name}
                    </span>
                    <span
                      className={`font-mono font-semibold ${
                        src.status === "Fresh"
                          ? "text-emerald-700"
                          : "text-amber-700"
                      }`}
                    >
                      {src.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-700">
                    Date: {meta.dataDate} · Time: {meta.dataTime}
                  </div>
                  <div className="text-xs text-slate-600">
                    {src.updateScheduleLabel}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Customer Admin Top Header & Segmented Governance Navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-purple-900 font-medium">
              <SettingsIcon className="w-3.5 h-3.5 text-purple-700" />
              <span>Customer Admin · Enterprise AI Governance &amp; Settings</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{policy.versionLabel}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Govern AI Agents &amp; Zenne (AI Business Advisor)
            </h1>
            <p className="text-sm text-slate-600 max-w-3xl">
              Configure AI Agent identities, Zenne clarifying research behavior,
              RBAC salon isolation, emergency pause switches, tenant token/spend
              budgets, data freshness SLAs, and immutable audit trails.
            </p>
          </div>

          <button
            type="button"
            onClick={() => openZenneWithPrompt()}
            className="px-4 py-2 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Test Policy Live in Zenne
          </button>
        </div>

        {/* Segmented Governance Sub-Navigation */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setSettingsSubTab("agents")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                settingsSubTab === "agents"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              AI Agents &amp; Business Advisor Policy
            </button>
            <button
              type="button"
              onClick={() => setSettingsSubTab("control-tower")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                settingsSubTab === "control-tower"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              AI Budgets &amp; Control Tower
            </button>
            <button
              type="button"
              onClick={() => setSettingsSubTab("freshness")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                settingsSubTab === "freshness"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Data Freshness &amp; Semantic KPIs
            </button>
            <button
              type="button"
              onClick={() => setSettingsSubTab("audit")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                settingsSubTab === "audit"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Audit Trail &amp; Cache
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Database className="w-3.5 h-3.5 text-teal-700" />
            <span>
              Updated: <strong className="font-mono">{policy.updatedAt}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Dedicated Zenne (AI Business Advisor) & AI Agent Quick Controls when on Agents tab */}
      {settingsSubTab === "agents" && (
        <section className="bg-purple-50/50 border border-purple-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-700" />
              <h2 className="text-sm font-semibold text-purple-950">
                Zenne (AI Business Advisor) &amp; Multi-Agent Conversational
                Settings
              </h2>
            </div>
            <span className="text-xs text-purple-800">
              Directly governs how Zenne interacts with Regional Manager &amp;
              COO
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Zenne Clarifying Follow-Up Questions Toggle */}
            <div className="bg-white border border-purple-200/80 rounded-lg p-3.5 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-900">
                  Zenne Clarifying Follow-Up Step
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Requires Zenne to ask targeted follow-up questions on deep
                  research prompts before generating insights &amp;
                  recommendations.
                </p>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-mono font-semibold text-purple-900">
                  {policy.requireClarifyingFollowUp !== false
                    ? "Enabled (2-Step)"
                    : "Direct Answer"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updatePolicy(
                      {
                        requireClarifyingFollowUp:
                          policy.requireClarifyingFollowUp === false,
                      },
                      policy.requireClarifyingFollowUp === false
                        ? "Enabled Zenne clarifying follow-up questions"
                        : "Switched Zenne to direct single-step response mode"
                    )
                  }
                  className="px-3 py-1 text-xs font-semibold rounded-md bg-purple-700 hover:bg-purple-800 text-white"
                >
                  {policy.requireClarifyingFollowUp !== false
                    ? "Disable Step"
                    : "Enable Step"}
                </button>
              </div>
            </div>

            {/* Deep Research Model Access */}
            <div className="bg-white border border-purple-200/80 rounded-lg p-3.5 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-900">
                  Deep Research Model Tier
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Permits Regional Manager and COO to run multi-factor root
                  cause &amp; holdout ROI analysis in Zenne.
                </p>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span
                  className={`text-xs font-mono font-semibold ${
                    policy.allowDeepAnalysis
                      ? "text-emerald-700"
                      : "text-amber-700"
                  }`}
                >
                  {policy.allowDeepAnalysis ? "Allowed" : "Restricted to Fast"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updatePolicy(
                      { allowDeepAnalysis: !policy.allowDeepAnalysis },
                      policy.allowDeepAnalysis
                        ? "Restricted Zenne Deep Research tier"
                        : "Allowed Zenne Deep Research tier"
                    )
                  }
                  className="px-3 py-1 text-xs font-semibold rounded-md border border-slate-300 hover:bg-slate-50 text-slate-800"
                >
                  {policy.allowDeepAnalysis ? "Restrict" : "Allow"}
                </button>
              </div>
            </div>

            {/* High-Cost Query Confirmation Gate */}
            <div className="bg-white border border-purple-200/80 rounded-lg p-3.5 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-900">
                  High-Cost Query Approval Gate
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Prompts users inside Zenne to confirm token consumption before
                  executing uncached Deep Research runs.
                </p>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-mono font-semibold text-slate-700">
                  {policy.requireApprovalForHighCost
                    ? "Gate Active"
                    : "Seamless Run"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updatePolicy(
                      {
                        requireApprovalForHighCost:
                          !policy.requireApprovalForHighCost,
                      },
                      policy.requireApprovalForHighCost
                        ? "Disabled High-Cost Query Approval Gate"
                        : "Enabled High-Cost Query Approval Gate"
                    )
                  }
                  className="px-3 py-1 text-xs font-semibold rounded-md border border-slate-300 hover:bg-slate-50 text-slate-800"
                >
                  {policy.requireApprovalForHighCost ? "Disable" : "Require"}
                </button>
              </div>
            </div>

            {/* Active AI Agents Quick Enablement */}
            <div className="bg-white border border-purple-200/80 rounded-lg p-3.5 flex flex-col justify-between gap-2">
              <div className="text-xs font-semibold text-slate-900">
                Governed AI Agent Identities
              </div>
              <div className="space-y-1.5">
                {agents.map((ag) => (
                  <div
                    key={ag.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate text-slate-700">
                      {ag.productName === "AI Business Advisor"
                        ? "Zenne Advisor"
                        : ag.productName}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleAgentEnabled(ag.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${
                        ag.enabled
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-red-50 text-red-800 border-red-200"
                      }`}
                    >
                      {ag.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Selected Governance View */}
      <div>
        {settingsSubTab === "agents" && <GovernanceConsoleView />}
        {settingsSubTab === "control-tower" && <ControlTowerView />}
        {settingsSubTab === "freshness" && <SettingsView />}
        {settingsSubTab === "audit" && <AuditObservabilityView />}
      </div>
    </div>
  );
};
