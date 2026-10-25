import React, { useMemo } from "react";
import { Calendar, Database, Headphones, Sparkles } from "lucide-react";
import { useAppState } from "../../context/AppStateContext";
import { extractFreshnessMetadata } from "../../services/agentService";
import { getSourceSystems, PERSONAS } from "../../services/syntheticDataService";
import {
  AlertsNotificationsView,
  ReportsExportsView,
} from "./AlertsAndReportsView";
import { CockpitCalendarConsoleView } from "./CockpitCalendarConsoleView";
import { OpportunitiesAndValueView } from "./OpportunitiesAndValueView";
import { OverviewView } from "./OverviewView";

export const CockpitView: React.FC = () => {
  const {
    activePersona,
    authSession,
    cockpitSubTab,
    setCockpitSubTab,
    demoTimeOffsetHours,
    posSyncRefreshed,
    triggeredAlerts,
    opportunities,
    interactions,
    openZenneWithPrompt,
  } = useAppState();

  const persona = PERSONAS[activePersona];
  const activeAlertsCount = triggeredAlerts.filter(
    (a) => a.status === "Active"
  ).length;
  const liveConversationsCount = interactions.filter(
    (i) => i.lifecycle === "Live"
  ).length;

  const freshness = useMemo(() => {
    const sources = getSourceSystems(demoTimeOffsetHours, posSyncRefreshed);
    return extractFreshnessMetadata(sources["SRC-BOOKING-STREAM"]);
  }, [demoTimeOffsetHours, posSyncRefreshed]);

  return (
    <div className="space-y-6">
      {/* Cockpit Navigation & Data Freshness Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <Database className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <span className="font-semibold text-slate-900">Data Freshness:</span>
            <span className="font-mono tabular-nums text-slate-800">
              {freshness.dataDate}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-800">
              {freshness.dataTime}
            </span>
            <span aria-hidden="true">·</span>
            <span>Source: {freshness.sourceName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-emerald-700">
              {freshness.status}
            </span>
          </div>
          <div className="text-sm font-semibold text-slate-900">
            {authSession.roleLabel} Operational Cockpit ·{" "}
            <span className="font-normal text-slate-600">
              {authSession.roleKey === "front_desk_staff"
                ? "Bellevue Flagship Studio (1 Authorized Salon)"
                : `${persona.assignedRegion} (${persona.allowedSalonIds.length} Authorized Salons)`}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Interactive Segmented Cockpit Tabs */}
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setCockpitSubTab("calendar")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                cockpitSubTab === "calendar"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-purple-700" />
              Calendar &amp; Console
            </button>
            <button
              type="button"
              onClick={() => setCockpitSubTab("console")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                cockpitSubTab === "console"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Headphones className="w-3.5 h-3.5 text-purple-700" />
              Live Console ({liveConversationsCount})
            </button>
            <button
              type="button"
              onClick={() => setCockpitSubTab("studios")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                cockpitSubTab === "studios"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Studio Matrix
            </button>
            <button
              type="button"
              onClick={() => setCockpitSubTab("opportunities")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                cockpitSubTab === "opportunities"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Opportunities ({opportunities.length})
            </button>
            <button
              type="button"
              onClick={() => setCockpitSubTab("alerts")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                cockpitSubTab === "alerts"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Alerts ({activeAlertsCount})
            </button>
            <button
              type="button"
              onClick={() => setCockpitSubTab("reports")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                cockpitSubTab === "reports"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Reports &amp; Outbox
            </button>
          </div>

          <button
            type="button"
            onClick={() => openZenneWithPrompt()}
            className="px-3.5 py-2 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Open Zenne
          </button>
        </div>
      </div>

      {/* Selected Cockpit Surface */}
      <div>
        {cockpitSubTab === "calendar" && (
          <CockpitCalendarConsoleView defaultFocus="split" />
        )}
        {cockpitSubTab === "console" && (
          <CockpitCalendarConsoleView defaultFocus="console-full" />
        )}
        {cockpitSubTab === "studios" && <OverviewView />}
        {cockpitSubTab === "opportunities" && <OpportunitiesAndValueView />}
        {cockpitSubTab === "alerts" && <AlertsNotificationsView />}
        {cockpitSubTab === "reports" && <ReportsExportsView />}
      </div>
    </div>
  );
};
