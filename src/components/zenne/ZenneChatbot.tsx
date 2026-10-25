import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookmarkPlus,
  Bot,
  CalendarClock,
  Check,
  Clock,
   Compass,
  Database,
  Download,
  FileSpreadsheet,
  FileUp,
  Lock,
  Maximize2,
  MessageSquare,
  Minimize2,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Table,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";
import { useAppState } from "../../context/AppStateContext";
import { extractFreshnessMetadata } from "../../services/agentService";
import {
  downloadTableAsCsv,
  exportInsightReportPdf,
} from "../../services/exportShareService";
import { getSourceSystems, PERSONAS } from "../../services/syntheticDataService";
import {
  AIResponseContract,
  ZenneAgentSelection,
  ZenneToolMode,
  ZenneUploadedDoc,
} from "../../types/domain";
import { TanStackDataTable } from "../common/TanStackDataTable";
import { VisualizationRenderer } from "../common/VisualizationRenderer";

function computeSystemGreeting(now: Date): {
  salutation: string;
  formattedTime: string;
  formattedDate: string;
} {
  const hour = now.getHours();
  const salutation =
    hour < 12
      ? "Good morning"
      : hour < 17
        ? "Good afternoon"
        : "Good evening";

  const formattedTime = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const formattedDate = now.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return { salutation, formattedTime, formattedDate };
}

function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatAgentLabel(agent: ZenneAgentSelection): string {
  return agent === "ai-retention-manager"
    ? "AI Retention Manager"
    : "AI Business Advisor";
}

function formatToolModeLabel(mode: ZenneToolMode): string {
  if (mode === "ask") return "Ask";
  if (mode === "search") return "Search";
  return "Deep Research";
}

const STARTER_ADVISOR_BY_ROLE: Record<"arjun" | "meera" | "neha", string[]> = {
  arjun: [
    "Which salons had the biggest decline in repeat visits in the last 30 days?",
    "Which salons have the highest unused stylist capacity?",
    "Where did retail product sales decline this month?",
    "Which salons are at risk of missing monthly revenue expectations?",
  ],
  meera: [
    "Where should I focus to improve profitability this quarter?",
    "Summarize monthly performance across all salons and regions.",
    "Which regions are losing the most revenue from unused stylist capacity?",
    "Which completed interventions created measurable business value?",
  ],
  neha: [
    "Summarize monthly performance across all salons and regions.",
    "Where should I focus to improve profitability this quarter?",
    "Which regions are losing the most revenue from unused stylist capacity?",
  ],
};

const STARTER_RETENTION_BY_ROLE: Record<"arjun" | "meera" | "neha", string[]> = {
  arjun: [
    "Which salons had the biggest decline in repeat visits in the last 30 days?",
    "Why are three salons losing repeat customers?",
    "What should I do to improve repeat visits?",
    "Show the estimated financial impact of these opportunities.",
  ],
  meera: [
    "Which retention intervention generated incremental sales?",
    "Where are we losing revenue despite having available capacity?",
    "Which regions are reducing our profitability?",
    "Which actions should I prioritize in the next executive review?",
  ],
  neha: [
    "Which retention intervention generated incremental sales?",
    "Which salons had the biggest decline in repeat visits in the last 30 days?",
    "How confident should I be in these recommendations?",
  ],
};

interface AnswerCardProps {
  response: AIResponseContract;
  originalQuestion: string;
  clarificationFocus?: string;
  agentSelection?: ZenneAgentSelection;
  toolMode?: ZenneToolMode;
  uploadedDoc?: ZenneUploadedDoc;
}

const ZenneAnswerCard: React.FC<AnswerCardProps> = ({
  response,
  originalQuestion,
  clarificationFocus,
  agentSelection = "ai-business-advisor",
  toolMode = "deep-research",
  uploadedDoc,
}) => {
  const {
    saveZenneConversationToDashboard,
    setActiveNav,
    setZenneOpen,
    sendZenneMessage,
    markResponseFeedback,
    verifyExportChannelAllowed,
    appendAuditEvent,
    notify,
  } = useAppState();

  const [showTable, setShowTable] = useState(() => toolMode === "search");
  const [showSaveDrawer, setShowSaveDrawer] = useState(false);
  const [widgetName, setWidgetName] = useState(response.title);
  const [scheduledTime, setScheduledTime] = useState("08:00");
  const [cadence, setCadence] = useState<"Daily" | "Weekly">("Daily");
  const [savedWidgetInfo, setSavedWidgetInfo] = useState<{
    name: string;
    time: string;
    cadence: "Daily" | "Weekly";
  } | null>(null);

  const freshness = useMemo(
    () => extractFreshnessMetadata(response.sourceFreshness),
    [response.sourceFreshness]
  );

  const isBlockedOrUnsupported =
    response.topicKey === "access_denied" ||
    response.topicKey === "policy_blocked" ||
    response.topicKey === "unsupported";

  const handleSaveWidget = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = widgetName.trim() || response.title;
    saveZenneConversationToDashboard({
      response,
      originalQuestion,
      clarificationFocus,
      widgetName: cleanName,
      scheduledTime: scheduledTime || "08:00",
      cadence,
    });
    setSavedWidgetInfo({
      name: cleanName,
      time: scheduledTime || "08:00",
      cadence,
    });
    setShowSaveDrawer(false);
  };

  const handleExportPdf = () => {
    if (!verifyExportChannelAllowed("PDF", `Zenne Insight PDF: ${response.title}`)) {
      return;
    }
    exportInsightReportPdf(response);
    appendAuditEvent(
      "REPORT_EXPORTED",
      `Exported Zenne insight report PDF: "${response.title}"`,
      "Allowed",
      "Format: PDF"
    );
    notify("Downloaded Zenne analytical report PDF.", "teal");
  };

  const handleExportCsv = () => {
    if (!verifyExportChannelAllowed("CSV", `Zenne Evidence CSV: ${response.title}`)) {
      return;
    }
    downloadTableAsCsv(
      `Zenne_${response.topicKey}`,
      response.tableColumns,
      response.tableRows
    );
    appendAuditEvent(
      "REPORT_EXPORTED",
      `Exported Zenne breakdown CSV: "${response.title}"`,
      "Allowed",
      "Format: CSV"
    );
    notify("Downloaded Zenne breakdown CSV.", "teal");
  };

  return (
    <div className="bg-white border border-purple-200/90 rounded-xl p-4 space-y-4 shadow-xs">
      {/* Explicit Data Freshness & Agent Mode Metadata Header */}
      <div className="pb-2.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
        <div className="flex flex-wrap items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-purple-700 shrink-0" />
          <span className="font-semibold text-purple-900">
            {formatAgentLabel(agentSelection)} · {formatToolModeLabel(toolMode)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-semibold text-slate-800">Freshness:</span>
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
          <span
            className={`font-semibold ${
              freshness.status === "Fresh"
                ? "text-emerald-700"
                : "text-amber-700"
            }`}
          >
            {freshness.status} ({freshness.completenessPct}% complete)
          </span>
        </div>
        <span className="font-mono tabular-nums text-slate-500">
          {response.businessScope}
        </span>
      </div>

      {/* Stale Data Warning if applicable */}
      {freshness.status !== "Fresh" && (
        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950">
          <span className="font-semibold">Freshness Advisory:</span>{" "}
          {response.sourceFreshness.notes}
        </div>
      )}

      {/* Uploaded Document Context Reference if attached */}
      {uploadedDoc && (
        <div className="p-2.5 rounded-lg bg-purple-50/70 border border-purple-200/80 text-[11px] text-purple-950 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Paperclip className="w-3.5 h-3.5 text-purple-700 shrink-0" />
            <span>Document Context Analyzed:</span>
            <span className="font-semibold">{uploadedDoc.name}</span>
          </span>
          <span className="font-mono tabular-nums text-purple-800">
            {uploadedDoc.sizeLabel}
            {uploadedDoc.rowOrLineCount
              ? ` · ${uploadedDoc.rowOrLineCount} lines`
              : ""}
          </span>
        </div>
      )}

      {/* Title & Summary */}
      <div className="space-y-1.5">
        {clarificationFocus && (
          <div className="text-[11px] text-purple-800 font-medium">
            Research Focus Applied: {clarificationFocus}
          </div>
        )}
        <h4 className="text-sm font-semibold text-slate-900">
          {response.title}
        </h4>
        <p className="text-xs text-slate-700 leading-relaxed">
          {response.summary}
        </p>
      </div>

      {/* Certified KPI Strip */}
      {response.kpis.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {response.kpis.map((kpi) => (
            <div
              key={kpi.id}
              className="p-3 rounded-lg bg-slate-50/90 border border-slate-200/80 space-y-0.5"
            >
              <div className="text-[11px] text-slate-600">{kpi.label}</div>
              <div className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                {kpi.currentValue}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono tabular-nums">
                <span
                  className={
                    kpi.varianceDirection === "positive"
                      ? "text-emerald-700 font-medium"
                      : kpi.varianceDirection === "negative"
                        ? "text-red-700 font-medium"
                        : "text-slate-600"
                  }
                >
                  {kpi.varianceLabel}
                </span>
                <span aria-hidden="true" className="text-slate-400">
                  ·
                </span>
                <span className="text-slate-500">
                  {kpi.baselineLabel}: {kpi.baselineValue}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Interactive Chart */}
      {response.chartType !== "table-only" &&
        (response.chartData.length > 0 ||
          (response.heatmapData && response.heatmapData.length > 0) ||
          (response.funnelData && response.funnelData.length > 0)) && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  {response.chartTitle}
                </div>
                <div className="text-[11px] text-slate-500">
                  {response.chartSubtitle}
                </div>
              </div>
              {response.tableRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowTable(!showTable)}
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <Table className="w-3 h-3" />
                  {showTable ? "Hide Table" : "Studio Table"}
                </button>
              )}
            </div>
            <VisualizationRenderer
              chartType={response.chartType}
              chartData={response.chartData}
              secondaryChartData={response.secondaryChartData}
              heatmapData={response.heatmapData}
              funnelData={response.funnelData}
              height={220}
            />
          </div>
        )}

      {/* Supporting Studio Evidence Table (Auto-shown in Search mode) */}
      {(showTable || response.chartType === "table-only") &&
        response.tableRows.length > 0 && (
          <div className="pt-2">
            <TanStackDataTable
              columns={response.tableColumns}
              rows={response.tableRows}
              pageSize={5}
              compact
            />
          </div>
        )}

      {/* Key Insights & Drivers */}
      {(response.interpretation || response.likelyDrivers.length > 0) && (
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="text-xs font-semibold text-slate-900">
            {toolMode === "search"
              ? "Certified Metric & Studio Notes"
              : "Insights & Root-Cause Drivers"}
          </div>
          {response.interpretation && (
            <p className="text-xs text-slate-700 leading-relaxed">
              {response.interpretation}
            </p>
          )}
          {response.likelyDrivers.length > 0 && (
            <ul className="space-y-1 text-xs text-slate-700 list-disc pl-4">
              {response.likelyDrivers.map((drv, i) => (
                <li key={i}>{drv}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Actionable Recommendations */}
      {response.recommendedActions.length > 0 && (
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="text-xs font-semibold text-purple-950">
            Recommended Management Actions
          </div>
          <div className="space-y-2">
            {response.recommendedActions.map((act) => (
              <div
                key={act.id}
                className="p-3 rounded-lg bg-purple-50/40 border border-purple-200/70 space-y-1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-900">
                    {act.title}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-purple-800">
                    {act.priority} · Owner: {act.responsiblePersona}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {act.rationale}
                </p>
                <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-emerald-800">
                    Expected Impact: {act.expectedImpactDirection}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Approval: {act.requiredHumanApproval}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Conversation to Dashboard & Schedule Refresh Time */}
      {!isBlockedOrUnsupported && (
        <div className="pt-3 border-t border-slate-200 space-y-3">
          {savedWidgetInfo ? (
            <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="space-y-0.5">
                <div className="font-semibold text-purple-950 inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-purple-700" />
                  Saved Widget: &ldquo;{savedWidgetInfo.name}&rdquo;
                </div>
                <div className="text-purple-800 font-mono tabular-nums text-[11px]">
                  Scheduled Refresh: {savedWidgetInfo.cadence} at{" "}
                  {savedWidgetInfo.time}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveNav("dashboard");
                  setZenneOpen(false);
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-md inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>Open Dashboard</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : showSaveDrawer ? (
            <form
              onSubmit={handleSaveWidget}
              className="p-3.5 rounded-lg bg-purple-50/60 border border-purple-200 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-purple-950 inline-flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-purple-700" />
                  Save Conversation to Dashboard &amp; Schedule Refresh
                </div>
                <button
                  type="button"
                  onClick={() => setShowSaveDrawer(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-700">
                  Dashboard Widget Name
                </label>
                <input
                  type="text"
                  required
                  value={widgetName}
                  onChange={(e) => setWidgetName(e.target.value)}
                  placeholder="e.g., PNW Repeat-Visit Recovery Tracker"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-purple-300 rounded-md text-slate-900 focus:outline-none focus:border-purple-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Refresh Schedule Cadence
                  </label>
                  <select
                    value={cadence}
                    onChange={(e) =>
                      setCadence(e.target.value as "Daily" | "Weekly")
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-purple-300 rounded-md text-slate-900 focus:outline-none focus:border-purple-700"
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly (Mondays)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Scheduled Refresh Time
                  </label>
                  <input
                    type="time"
                    required
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-purple-300 rounded-md text-slate-900 focus:outline-none focus:border-purple-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-600">
                  Widget auto-refreshes at{" "}
                  <span className="font-mono font-semibold text-purple-900">
                    {scheduledTime}
                  </span>{" "}
                  from {freshness.sourceName}.
                </span>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-md whitespace-nowrap shrink-0"
                >
                  Save Widget &amp; Schedule
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSaveDrawer(true)}
                  className="px-3 py-1.5 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  Save to Dashboard &amp; Schedule Refresh
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Download className="w-3 h-3" />
                  PDF
                </button>
                {response.tableRows.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    CSV
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => markResponseFeedback(response.id, "useful")}
                  title="Mark insight helpful"
                  className={`p-1.5 rounded border text-xs ${
                    response.userFeedback === "useful"
                      ? "bg-purple-100 border-purple-300 text-purple-800"
                      : "border-slate-200 text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <ThumbsUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    markResponseFeedback(response.id, "not_useful")
                  }
                  title="Flag for review"
                  className={`p-1.5 rounded border text-xs ${
                    response.userFeedback === "not_useful"
                      ? "bg-amber-100 border-amber-300 text-amber-800"
                      : "border-slate-200 text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <ThumbsDown className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Suggested Next Follow-Up Prompts */}
          {response.followUpSuggestions.length > 0 && (
            <div className="pt-2 space-y-1.5">
              <div className="text-[11px] font-medium text-slate-500">
                Continue Research Conversation:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {response.followUpSuggestions.slice(0, 3).map((followUp) => (
                  <button
                    key={followUp}
                    type="button"
                    onClick={() =>
                      sendZenneMessage(followUp, { skipClarification: true })
                    }
                    className="px-2.5 py-1 text-[11px] font-medium text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md text-left transition-colors"
                  >
                    {followUp}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ZenneChatbot: React.FC = () => {
  const {
    authSession,
    loginWithRole,
    activePersona,
    zenneOpen,
    setZenneOpen,
    zenneExpanded,
    setZenneExpanded,
    zenneThread,
    pendingClarification,
    sendZenneMessage,
    clearZenneConversation,
    zenneAgent,
    setZenneAgent,
    zenneToolMode,
    setZenneToolMode,
    zenneAttachedDoc,
    setZenneAttachedDoc,
    advisorLoading,
    policy,
    agents,
    demoTimeOffsetHours,
    posSyncRefreshed,
    pendingHighCostQuestion,
    confirmHighCostQuery,
    cancelHighCostQuery,
    policyWarningBanner,
    appendAuditEvent,
    notify,
  } = useAppState();

  const [inputValue, setInputValue] = useState("");
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [systemNow, setSystemNow] = useState<Date>(() => new Date());

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const plusMenuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSystemNow(new Date());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (zenneOpen) {
      setSystemNow(new Date());
    }
  }, [zenneOpen]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [zenneThread, advisorLoading, pendingHighCostQuestion, zenneOpen]);

  // Close bottom + menu on outside click or Escape
  useEffect(() => {
    if (!plusMenuOpen) return;
    const handleMouseDown = (evt: MouseEvent) => {
      if (
        plusMenuRef.current &&
        !plusMenuRef.current.contains(evt.target as Node)
      ) {
        setPlusMenuOpen(false);
      }
    };
    const handleKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === "Escape") {
        setPlusMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [plusMenuOpen]);

  const persona = PERSONAS[activePersona];
  const greeting = useMemo(
    () => computeSystemGreeting(systemNow),
    [systemNow]
  );

  const primaryWarehouseFreshness = useMemo(() => {
    const sources = getSourceSystems(demoTimeOffsetHours, posSyncRefreshed);
    return extractFreshnessMetadata(sources["SRC-WAREHOUSE-DAILY"]);
  }, [demoTimeOffsetHours, posSyncRefreshed]);

  const activeAgentProductName =
    zenneAgent === "ai-retention-manager"
      ? "AI Retention Manager"
      : "AI Business Advisor";

  const advisorAgentRecord = useMemo(
    () => agents.find((a) => a.productName === "AI Business Advisor"),
    [agents]
  );
  const retentionAgentRecord = useMemo(
    () => agents.find((a) => a.productName === "AI Retention Manager"),
    [agents]
  );
  const selectedAgentRecord =
    zenneAgent === "ai-retention-manager"
      ? retentionAgentRecord
      : advisorAgentRecord;

  const starterQuestions =
    zenneAgent === "ai-retention-manager"
      ? STARTER_RETENTION_BY_ROLE[activePersona] ??
        STARTER_RETENTION_BY_ROLE.arjun
      : STARTER_ADVISOR_BY_ROLE[activePersona] ??
        STARTER_ADVISOR_BY_ROLE.arjun;

  const welcomeBody = useMemo(() => {
    if (zenneAgent === "ai-retention-manager") {
      return `Welcome to Zenne · AI Retention Manager. How can I help you today? Analyze repeat-visit rates, chairside rebooking gaps, overdue 45-day cohorts, and holdout uplift across ${
        activePersona === "meera"
          ? "all 20 salons and 4 regions"
          : `your ${persona.allowedSalonIds.length} authorized salons`
      }, or switch agents and modes anytime from the + menu below.`;
    }
    if (activePersona === "meera") {
      return "Welcome to Elevate Wellness executive intelligence. How can I help you today? Ask a question across all 20 salons and 4 regions—use the + icon below to switch between AI Business Advisor, AI Retention Manager, Upload Document, Deep Research, Ask, or Search, and save live scheduled widgets to your Dashboard.";
    }
    if (activePersona === "neha") {
      return "Welcome to Elevate Wellness governance intelligence. How can I help you today? Test governed Zenne queries across AI Business Advisor or AI Retention Manager using the + icon below, or configure agent policies, budgets, and safety guardrails under Settings.";
    }
    return "Welcome to your Pacific Northwest regional wellness workspace. How can I help you today? Ask across your 5 authorized salons—use the + icon below to select AI Business Advisor, AI Retention Manager, Upload Document, Deep Research, Ask, or Search, and save auto-refreshing widgets to your Dashboard.";
  }, [activePersona, persona.allowedSalonIds.length, zenneAgent]);

  const handleSelectAgent = (nextAgent: ZenneAgentSelection) => {
    setZenneAgent(nextAgent);
    setPlusMenuOpen(false);
    notify(`Switched Zenne agent to ${formatAgentLabel(nextAgent)}.`, "teal");
  };

  const handleSelectToolMode = (nextMode: ZenneToolMode) => {
    setZenneToolMode(nextMode);
    setPlusMenuOpen(false);
    notify(`Switched Zenne mode to ${formatToolModeLabel(nextMode)}.`, "teal");
  };

  const handleTriggerUploadClick = () => {
    setPlusMenuOpen(false);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const rawContent = typeof reader.result === "string" ? reader.result : "";
      const printable = rawContent
        .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const lines = rawContent
        ? rawContent.split(/\r?\n/).filter((l) => l.trim().length > 0).length
        : undefined;
      const excerpt =
        printable.length > 0
          ? printable.slice(0, 1200)
          : `Attached file ${file.name} (${formatByteSize(file.size)})`;

      const docPayload: ZenneUploadedDoc = {
        name: file.name,
        sizeLabel: formatByteSize(file.size),
        rowOrLineCount: lines,
        excerpt,
        uploadedAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setZenneAttachedDoc(docPayload);
      appendAuditEvent(
        "ACTION_APPROVED",
        `Uploaded document "${file.name}" (${docPayload.sizeLabel}) into Zenne context`,
        "Allowed",
        `Agent: ${activeAgentProductName}`
      );
      notify(
        `Attached "${file.name}" (${docPayload.sizeLabel}) for Zenne analysis.`,
        "teal"
      );
    };

    reader.onerror = () => {
      notify(`Could not read "${file.name}". Please try another file.`, "red");
    };

    reader.readAsText(file);
    e.target.value = "";
  };

  const handleComposerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if ((!trimmed && !zenneAttachedDoc) || advisorLoading) return;
    setInputValue("");
    setPlusMenuOpen(false);
    await sendZenneMessage(trimmed);
  };

  // Closed State: Purple Floating Right-Bottom Launcher Button named "Zenne" (no agent tag)
  if (!zenneOpen) {
    return (
      <div className="fixed bottom-5 right-5 z-40">
        <button
          type="button"
          onClick={() => setZenneOpen(true)}
          aria-label="Open Zenne Chatbot"
          className="group flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white shadow-lg border border-purple-500/40 transition-transform duration-150 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
        >
          <div className="w-8 h-8 rounded-xl bg-purple-900/70 border border-purple-400/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-purple-200" />
          </div>
          <span className="text-sm font-bold tracking-tight pr-0.5">
            Zenne
          </span>
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Zenne Chatbot"
      className={`fixed bottom-4 right-4 z-40 bg-white border border-purple-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-opacity duration-150 ${
        zenneExpanded
          ? "w-[calc(100vw-2rem)] sm:w-[780px] lg:w-[880px] h-[min(88vh,790px)]"
          : "w-[calc(100vw-2rem)] sm:w-[480px] md:w-[530px] h-[min(84vh,730px)]"
      }`}
    >
      {/* Purple Theme Header */}
      <div className="bg-purple-800 text-white px-4 py-3.5 border-b border-purple-900 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-purple-950/70 border border-purple-500/40 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-purple-200" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight whitespace-nowrap">
                Zenne
              </span>
            </div>
            <div className="text-[11px] text-purple-200 truncate">
              {authSession.roleLabel} · {persona.assignedRegion} (
              {persona.allowedSalonIds.length} Salons)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={clearZenneConversation}
            title="Start fresh conversation"
            className="p-1.5 rounded-md text-purple-200 hover:text-white hover:bg-purple-700/70 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setZenneExpanded(!zenneExpanded)}
            title={zenneExpanded ? "Compact Zenne panel" : "Expand Zenne panel"}
            className="hidden sm:inline-flex p-1.5 rounded-md text-purple-200 hover:text-white hover:bg-purple-700/70 transition-colors"
          >
            {zenneExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setZenneOpen(false)}
            aria-label="Close Zenne"
            className="p-1.5 rounded-md text-purple-200 hover:text-white hover:bg-purple-700/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* RBAC Denial Screen if Front-Desk Staff / Restricted Terminal */}
      {!authSession.canAccessChatbot ? (
        <div className="flex-1 p-6 bg-slate-50 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-11 h-11 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-800">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 max-w-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Zenne Access Restricted by RBAC
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {authSession.rbacDenialReason}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() =>
                loginWithRole(
                  "Operations Portal",
                  "regional_manager",
                  "dashboard"
                )
              }
              className="px-3.5 py-2 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg"
            >
              Sign In as Regional Manager
            </button>
            <button
              type="button"
              onClick={() =>
                loginWithRole(
                  "Executive Suite",
                  "chief_operating_officer",
                  "dashboard"
                )
              }
              className="px-3.5 py-2 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg"
            >
              Sign In as COO
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Policy / Governance Warning Strip */}
          {(policy.advisorPaused ||
            selectedAgentRecord?.enabled === false ||
            policyWarningBanner) && (
            <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-950 flex items-start gap-2 shrink-0">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                {policy.advisorPaused
                  ? "Customer Admin has paused Zenne AI agents via Emergency Controls in Settings."
                  : selectedAgentRecord?.enabled === false
                    ? `Customer Admin has disabled ${activeAgentProductName} in Settings. Select another agent from the + menu or re-enable in Settings.`
                    : policyWarningBanner}
              </div>
            </div>
          )}

          {/* Conversation Scrollable Body */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/70"
          >
            {/* Dynamic System-Time Greeting & Welcome Card */}
            <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-purple-900">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-purple-700" />
                  <span>System Time:</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {greeting.formattedTime}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{greeting.formattedDate}</span>
                </span>
                <span className="font-mono text-purple-800">
                  {activeAgentProductName} · {formatToolModeLabel(zenneToolMode)}
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-purple-950">
                  {greeting.salutation}, {persona.name}.
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {welcomeBody}
                </p>
              </div>

              {/* Explicit Data Freshness Summary */}
              <div className="pt-2.5 border-t border-purple-200/70 text-[11px] text-slate-700 flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-purple-950">
                  Certified Data Freshness:
                </span>
                <span className="font-mono tabular-nums">
                  {primaryWarehouseFreshness.dataDate}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {primaryWarehouseFreshness.dataTime}
                </span>
                <span aria-hidden="true">·</span>
                <span>Source: {primaryWarehouseFreshness.sourceName}</span>
              </div>

              {/* Starter Prompts */}
              {zenneThread.length === 0 && (
                <div className="pt-2 space-y-1.5">
                  <div className="text-[11px] font-semibold text-purple-900">
                    Suggested {activeAgentProductName} Prompts for {persona.name}:
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {starterQuestions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        disabled={advisorLoading}
                        onClick={() => sendZenneMessage(q)}
                        className="text-left px-3 py-2 rounded-lg bg-white hover:bg-purple-100/60 border border-purple-200/90 text-xs font-medium text-slate-800 hover:text-purple-950 transition-colors flex items-center justify-between gap-2"
                      >
                        <span>{q}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Thread Entries */}
            {zenneThread.map((entry) => {
              if (entry.kind === "user") {
                return (
                  <div key={entry.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-xl bg-purple-700 text-white px-3.5 py-2.5 space-y-1.5 shadow-xs">
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-purple-200 font-medium">
                        {entry.agentSelection && (
                          <span>{formatAgentLabel(entry.agentSelection)}</span>
                        )}
                        {entry.toolMode && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{formatToolModeLabel(entry.toolMode)}</span>
                          </>
                        )}
                        {entry.isClarificationReply && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Clarification Reply</span>
                          </>
                        )}
                      </div>
                      {entry.uploadedDoc && (
                        <div className="px-2.5 py-1.5 rounded-lg bg-purple-800/90 border border-purple-500/50 text-[11px] text-purple-100 flex items-center gap-1.5">
                          <Paperclip className="w-3 h-3 shrink-0" />
                          <span className="truncate font-medium">
                            {entry.uploadedDoc.name}
                          </span>
                          <span className="text-purple-200 font-mono tabular-nums shrink-0">
                            ({entry.uploadedDoc.sizeLabel})
                          </span>
                        </div>
                      )}
                      <div className="text-xs leading-relaxed">{entry.text}</div>
                      <div className="text-[10px] text-purple-200 font-mono tabular-nums text-right">
                        {entry.timestamp}
                      </div>
                    </div>
                  </div>
                );
              }

              if (entry.kind === "clarification") {
                const clar = entry.clarification;
                const isPending =
                  pendingClarification?.id === clar.id && !entry.answeredWith;
                return (
                  <div
                    key={entry.id}
                    className="bg-white border border-purple-200 rounded-xl p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 pb-2 border-b border-slate-100">
                      <span className="font-semibold text-purple-900">
                        Zenne · {formatAgentLabel(entry.agentSelection ?? "ai-business-advisor")} · Clarifying Scope
                      </span>
                      <span className="font-mono tabular-nums text-slate-500">
                        {clar.dataFreshness.dataDate} ·{" "}
                        {clar.dataFreshness.dataTime} ·{" "}
                        {clar.dataFreshness.sourceName}
                      </span>
                    </div>

                    <p className="text-xs text-slate-800 leading-relaxed">
                      {clar.introText}
                    </p>

                    <ol className="space-y-1.5 text-xs text-slate-700 list-decimal pl-4">
                      {clar.followUpQuestions.map((fq, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {fq}
                        </li>
                      ))}
                    </ol>

                    {isPending ? (
                      <div className="pt-2 space-y-1.5">
                        <div className="text-[11px] font-medium text-purple-900">
                          Select a focus below or type your custom answer:
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {clar.quickReplies.map((reply) => (
                            <button
                              key={reply}
                              type="button"
                              disabled={advisorLoading}
                              onClick={() => sendZenneMessage(reply)}
                              className="text-left px-3 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-xs font-medium text-purple-950 transition-colors"
                            >
                              {reply}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      entry.answeredWith && (
                        <div className="pt-1 text-[11px] text-purple-800 font-medium">
                          Selected Direction: {entry.answeredWith}
                        </div>
                      )
                    )}
                  </div>
                );
              }

              return (
                <ZenneAnswerCard
                  key={entry.id}
                  response={entry.response}
                  originalQuestion={entry.originalQuestion}
                  clarificationFocus={entry.clarificationFocus}
                  agentSelection={entry.agentSelection}
                  toolMode={entry.toolMode}
                  uploadedDoc={entry.uploadedDoc}
                />
              );
            })}

            {/* High-Cost Governance Approval Gate */}
            {pendingHighCostQuestion && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-3">
                <div className="text-xs font-semibold text-amber-950">
                  Customer Admin Governance Gate: High-Cost Deep Research Query
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  Deep Research mode consumes ~2,480 tokens on{" "}
                  <span className="font-medium">
                    &ldquo;{pendingHighCostQuestion}&rdquo;
                  </span>
                  . Confirm execution under current tenant AI budget policy?
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={confirmHighCostQuery}
                    className="px-3 py-1.5 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-md"
                  >
                    Approve &amp; Run Deep Research
                  </button>
                  <button
                    type="button"
                    onClick={cancelHighCostQuery}
                    className="px-3 py-1.5 text-xs font-medium bg-white border border-amber-300 text-amber-950 rounded-md hover:bg-amber-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Loading State */}
            {advisorLoading && (
              <div className="bg-white border border-purple-200 rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-purple-900">
                  Zenne ({activeAgentProductName} ·{" "}
                  {formatToolModeLabel(zenneToolMode)}) is computing certified
                  salon metrics...
                </div>
                <div className="h-2 w-2/3 bg-purple-100 rounded" />
                <div className="h-2 w-1/2 bg-slate-100 rounded" />
              </div>
            )}
          </div>

          {/* Bottom Composer with + Icon Mode & Agent Selector */}
          <div
            ref={plusMenuRef}
            className="relative bg-white border-t border-slate-200 px-3 pt-2 pb-3 space-y-2 shrink-0"
          >
            {/* Hidden Local File Input for Upload Document */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.md,.json,.tsv,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Upward + Menu Popover */}
            {plusMenuOpen && (
              <div
                role="menu"
                aria-label="Select AI agent, capability, or mode"
                className="absolute bottom-full left-3 mb-2 w-72 sm:w-80 bg-white border border-purple-200 rounded-xl shadow-xl py-1.5 z-50 divide-y divide-slate-100"
              >
                {/* AI Agents Section */}
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    AI Agents
                  </div>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={zenneAgent === "ai-business-advisor"}
                    onClick={() => handleSelectAgent("ai-business-advisor")}
                    className={`w-full px-3 py-2 text-left flex items-start justify-between gap-2 hover:bg-purple-50 transition-colors ${
                      zenneAgent === "ai-business-advisor"
                        ? "bg-purple-50/70"
                        : ""
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Sparkles className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                          <span>AI Business Advisor</span>
                          {advisorAgentRecord?.enabled === false && (
                            <span className="text-[10px] font-normal text-amber-700">
                              (Disabled in Settings)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Revenue, margin, utilization &amp; studio KPIs
                        </div>
                      </div>
                    </div>
                    {zenneAgent === "ai-business-advisor" && (
                      <Check className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={zenneAgent === "ai-retention-manager"}
                    onClick={() => handleSelectAgent("ai-retention-manager")}
                    className={`w-full px-3 py-2 text-left flex items-start justify-between gap-2 hover:bg-purple-50 transition-colors ${
                      zenneAgent === "ai-retention-manager"
                        ? "bg-purple-50/70"
                        : ""
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Users className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                          <span>AI Retention Manager</span>
                          {retentionAgentRecord?.enabled === false && (
                            <span className="text-[10px] font-normal text-amber-700">
                              (Disabled in Settings)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Repeat visits, rebooking funnel &amp; lapsed cohorts
                        </div>
                      </div>
                    </div>
                    {zenneAgent === "ai-retention-manager" && (
                      <Check className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                    )}
                  </button>
                </div>

                {/* Upload Document Capability */}
                <div className="py-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleTriggerUploadClick}
                    className="w-full px-3 py-2 text-left flex items-start gap-2.5 hover:bg-purple-50 transition-colors"
                  >
                    <FileUp className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900">
                        Upload Document
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Attach CSV, TXT, JSON, MD, or PDF studio notes
                      </div>
                    </div>
                  </button>
                </div>

                {/* Modes: Deep Research, Ask, Search */}
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Modes
                  </div>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={zenneToolMode === "deep-research"}
                    onClick={() => handleSelectToolMode("deep-research")}
                    className={`w-full px-3 py-2 text-left flex items-start justify-between gap-2 hover:bg-purple-50 transition-colors ${
                      zenneToolMode === "deep-research"
                        ? "bg-purple-50/70"
                        : ""
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Compass className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900">
                          Deep Research
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Clarifying follow-ups, root causes &amp; action plan
                        </div>
                      </div>
                    </div>
                    {zenneToolMode === "deep-research" && (
                      <Check className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={zenneToolMode === "ask"}
                    onClick={() => handleSelectToolMode("ask")}
                    className={`w-full px-3 py-2 text-left flex items-start justify-between gap-2 hover:bg-purple-50 transition-colors ${
                      zenneToolMode === "ask" ? "bg-purple-50/70" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <MessageSquare className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900">
                          Ask
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Direct Q&amp;A answer on certified metrics
                        </div>
                      </div>
                    </div>
                    {zenneToolMode === "ask" && (
                      <Check className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={zenneToolMode === "search"}
                    onClick={() => handleSelectToolMode("search")}
                    className={`w-full px-3 py-2 text-left flex items-start justify-between gap-2 hover:bg-purple-50 transition-colors ${
                      zenneToolMode === "search" ? "bg-purple-50/70" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Search className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900">
                          Search
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Instant studio, KPI &amp; metric table lookup
                        </div>
                      </div>
                    </div>
                    {zenneToolMode === "search" && (
                      <Check className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Compact Interactive Selection & Attached File Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setPlusMenuOpen((prev) => !prev)}
                className="text-purple-900 hover:text-purple-700 font-medium inline-flex items-center gap-1.5 transition-colors"
                title="Click + or here to switch AI agent or mode"
              >
                <span className="font-semibold">{activeAgentProductName}</span>
                <span aria-hidden="true" className="text-slate-400">
                  ·
                </span>
                <span>{formatToolModeLabel(zenneToolMode)}</span>
              </button>

              {zenneAttachedDoc && (
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-950 max-w-full">
                  <Paperclip className="w-3 h-3 text-purple-700 shrink-0" />
                  <span className="truncate max-w-[150px] font-medium">
                    {zenneAttachedDoc.name}
                  </span>
                  <span className="font-mono tabular-nums text-purple-700 shrink-0">
                    {zenneAttachedDoc.sizeLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => setZenneAttachedDoc(null)}
                    aria-label={`Remove ${zenneAttachedDoc.name}`}
                    className="p-0.5 text-purple-700 hover:text-purple-950 shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Composer Input Bar with Bottom + Button and "Ask me anything" Placeholder */}
            <form
              onSubmit={handleComposerSubmit}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => setPlusMenuOpen((prev) => !prev)}
                aria-expanded={plusMenuOpen}
                aria-haspopup="menu"
                aria-label="Select AI agent, mode, or upload document"
                title="Select AI agent, mode, or upload document"
                className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                  plusMenuOpen
                    ? "bg-purple-700 border-purple-700 text-white"
                    : "bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-800"
                }`}
              >
                <Plus
                  className={`w-4 h-4 transition-transform duration-150 ${
                    plusMenuOpen ? "rotate-45" : ""
                  }`}
                />
              </button>

              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={advisorLoading}
                placeholder="Ask me anything"
                className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-purple-700"
              />

              <button
                type="submit"
                disabled={
                  advisorLoading || (!inputValue.trim() && !zenneAttachedDoc)
                }
                className="px-3.5 py-2 text-xs font-semibold bg-purple-700 hover:bg-purple-800 disabled:opacity-40 text-white rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </>
      )}
    </aside>
  );
};
