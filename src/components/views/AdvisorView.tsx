import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  BookmarkPlus,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  FileSpreadsheet,
  Info,
  LayoutGrid,
  Lock,
  MessageSquareText,
  Pin,
  RefreshCw,
  Send,
  Share2,
  ShieldAlert,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useAppState } from "../../context/AppStateContext";
import { getSuggestedQuestionsForSession } from "../../services/agentService";
import {
  downloadTableAsCsv,
  exportExecutiveBriefPdf,
  exportInsightReportPdf,
} from "../../services/exportShareService";
import { PERSONAS, SALONS } from "../../services/syntheticDataService";
import { AIResponseContract, ChatbotMode } from "../../types/domain";
import {
  MetricDefinitionsModal,
  ScheduleConfigModal,
  ShareReportModal,
} from "../common/ShareAndScheduleModals";
import { TanStackDataTable } from "../common/TanStackDataTable";
import { VisualizationRenderer } from "../common/VisualizationRenderer";

const CHATBOT_MODES: Array<{
  id: ChatbotMode;
  label: string;
  description: string;
}> = [
  {
    id: "business-advisor",
    label: "AI Business Advisor",
    description:
      "Strategic & operational advisor mode: explains drivers, anomalies, financial impact, and prioritized human-approved actions.",
  },
  {
    id: "data-qa",
    label: "Concise Data Q&A",
    description:
      "Direct certified KPI readout mode: fast numeric lookups, baselines, and salon variance tables.",
  },
  {
    id: "retention-coach",
    label: "Retention & Capacity Coach",
    description:
      "Focused coaching mode for repeat-visit recovery, chairside rebooking funnels, and unused stylist hours.",
  },
];

function formatModeLabel(mode?: ChatbotMode): string {
  if (mode === "data-qa") return "Concise Data Q&A";
  if (mode === "retention-coach") return "Retention & Capacity Coach";
  return "AI Business Advisor";
}

export const AdvisorView: React.FC = () => {
  const {
    authSession,
    loginWithRole,
    setShowOnboarding,
    activePersona,
    chatbotMode,
    setChatbotMode,
    analysisMode,
    setAnalysisMode,
    advisorLoading,
    currentMessages,
    conversationContext,
    savedQuestions,
    saveQuestionPrompt,
    policyWarningBanner,
    pendingHighCostQuestion,
    confirmHighCostQuery,
    cancelHighCostQuery,
    askAdvisor,
    markResponseFeedback,
    clearConversation,
    saveResponseAsInsight,
    pinInsightToDashboard,
    updateInsightSchedule,
    recordIntervention,
    opportunities,
    interventions,
    dataVersion,
    demoTimeOffsetHours,
    posSyncRefreshed,
    dummyDatasetSummary,
    ensureOrReloadDummyData,
    presenterHintsEnabled,
    verifyExportChannelAllowed,
    appendAuditEvent,
    notify,
  } = useAppState();

  const [inputText, setInputText] = useState("");
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(
    null
  );
  const [supportingDataExpanded, setSupportingDataExpanded] =
    useState<boolean>(true);
  const [execDeepDiveOpen, setExecDeepDiveOpen] = useState<boolean>(false);

  // Modals
  const [shareTarget, setShareTarget] = useState<AIResponseContract | null>(
    null
  );
  const [scheduleTarget, setScheduleTarget] =
    useState<AIResponseContract | null>(null);
  const [metricModalOpen, setMetricModalOpen] = useState<boolean>(false);

  const persona = PERSONAS[activePersona];
  const suggestedPrompts = getSuggestedQuestionsForSession(
    activePersona,
    chatbotMode
  );

  const latestMessageId =
    currentMessages.length > 0
      ? currentMessages[currentMessages.length - 1].id
      : null;

  // Automatically focus newly appended responses
  useEffect(() => {
    if (latestMessageId) {
      setSelectedResponseId(latestMessageId);
    } else {
      setSelectedResponseId(null);
    }
  }, [latestMessageId]);

  const activeResponse: AIResponseContract | null =
    currentMessages.find((m) => m.id === selectedResponseId) ??
    (currentMessages.length > 0
      ? currentMessages[currentMessages.length - 1]
      : null);

  // RBAC Gate: Block chatbot display if login type or role lacks bi.chatbot.advisor permission
  if (!authSession.canAccessChatbot) {
    return (
      <div className="max-w-2xl mx-auto mt-6 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-700 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-red-700">
              RBAC Entitlement Enforcement · Chatbot Access Restricted
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              AI Chatbot Not Available for Current Login &amp; Role
            </h1>
            <p className="text-sm text-slate-700 leading-relaxed">
              {authSession.rbacDenialReason ??
                "Your active login type and organizational role do not hold permissions to open the AI Chatbot or AI Business Advisor mode."}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-slate-700">
            <span className="font-semibold text-slate-900">Active Login Type:</span>
            <span>{authSession.loginType}</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-slate-900">Selected Role:</span>
            <span>{authSession.roleLabel}</span>
          </div>
          <div className="text-slate-600">
            Scope: {authSession.departmentScope} · Required Entitlement:{" "}
            <span className="font-mono text-slate-800">bi.chatbot.advisor</span>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() =>
              loginWithRole("Operations Portal", "regional_manager", "advisor")
            }
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap"
          >
            Sign In as Regional Operations Manager
          </button>
          <button
            type="button"
            onClick={() =>
              loginWithRole(
                "Executive Suite",
                "chief_operating_officer",
                "advisor"
              )
            }
            className="px-4 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap"
          >
            Sign In as Chief Operating Officer
          </button>
          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 rounded-lg whitespace-nowrap"
          >
            Choose Custom Login Type &amp; Role
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || advisorLoading) return;
    setInputText("");
    const res = await askAdvisor(trimmed);
    if (res) {
      setSelectedResponseId(res.id);
    }
  };

  const handleQuickPrompt = async (q: string) => {
    if (advisorLoading) return;
    const res = await askAdvisor(q);
    if (res) {
      setSelectedResponseId(res.id);
    }
  };

  const handleManualRefresh = async (resp: AIResponseContract) => {
    if (advisorLoading) return;
    const res = await askAdvisor(resp.question, { forceRefresh: true });
    if (res) {
      setSelectedResponseId(res.id);
      if (
        res.topicKey !== "policy_blocked" &&
        res.topicKey !== "access_denied"
      ) {
        notify(
          "Recalculated insight directly from certified warehouse dataset (cache bypassed).",
          "teal"
        );
      }
    }
  };

  const handlePinResponse = (resp: AIResponseContract) => {
    const saved = saveResponseAsInsight(resp, "Weekly");
    pinInsightToDashboard(saved.id);
  };

  const handleScheduleResponse = (resp: AIResponseContract) => {
    setScheduleTarget(resp);
  };

  const activeModeMeta =
    CHATBOT_MODES.find((m) => m.id === chatbotMode) ?? CHATBOT_MODES[0];

  return (
    <div className="space-y-5">
      {/* Page Header + Chatbot Mode Switcher */}
      <div className="border-b border-slate-200 pb-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
              <span>{authSession.loginType}</span>
              <span aria-hidden="true">·</span>
              <span className="text-teal-800 font-semibold">
                {authSession.roleLabel}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                RBAC Scope: {persona.assignedRegion} (
                <span className="font-mono tabular-nums">
                  {persona.allowedSalonIds.length}
                </span>{" "}
                Salons)
              </span>
              {presenterHintsEnabled && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Deterministic KPI Engine + Gemini 3.8 Flash</span>
                </>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Enterprise AI Chatbot
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={ensureOrReloadDummyData}
              className="px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
              title="Verify or regenerate synthetic salon dataset"
            >
              <Database className="w-3.5 h-3.5 text-teal-700" />
              <span>
                Dummy Data Ready (v{dummyDatasetSummary.dataVersion} ·{" "}
                {dummyDatasetSummary.salonCount} Salons)
              </span>
            </button>

            {activePersona === "meera" && (
              <button
                type="button"
                onClick={() => {
                  if (
                    !verifyExportChannelAllowed("PDF", "Executive Brief PDF")
                  ) {
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
                    "Exported Executive Brief PDF from AI Chatbot",
                    "Allowed",
                    "PDF"
                  );
                  notify("Downloaded Executive Brief PDF.", "teal");
                }}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Generate Executive Brief
              </button>
            )}

            {currentMessages.length > 0 && (
              <button
                type="button"
                onClick={clearConversation}
                className="px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg whitespace-nowrap"
              >
                Reset Context
              </button>
            )}
          </div>
        </div>

        {/* Chatbot Mode Bar (AI Business Advisor is a prominent mode inside the Chatbot) */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-800 whitespace-nowrap">
              Chatbot Mode:
            </span>
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {CHATBOT_MODES.map((m) => {
                const selected = chatbotMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setChatbotMode(m.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      selected
                        ? "bg-teal-700 text-white shadow-xs"
                        : "text-slate-700 hover:text-slate-900"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-slate-600">
            {activeModeMeta.description}
          </div>
        </div>
      </div>

      {/* High-Cost Query Approval Gate Banner */}
      {pendingHighCostQuestion && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-amber-950 space-y-0.5">
            <div className="font-semibold">
              Governance Approval Required for Deep Analysis (~2,350 est. tokens)
            </div>
            <div>
              Tenant policy requires human confirmation before running high-cost Deep Analysis queries: &ldquo;{pendingHighCostQuestion}&rdquo;
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={cancelHighCostQuery}
              className="px-3 py-1.5 text-xs font-medium border border-amber-300 bg-white rounded-md text-amber-950 hover:bg-amber-100 whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmHighCostQuery}
              className="px-3 py-1.5 text-xs font-semibold bg-amber-800 text-white rounded-md hover:bg-amber-900 whitespace-nowrap"
            >
              Approve &amp; Run Query
            </button>
          </div>
        </div>
      )}

      {policyWarningBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs font-medium text-amber-950 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>{policyWarningBanner}</span>
        </div>
      )}

      {/* Main Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Analysis Tier, Context Memory, Role Questions & Saved Prompts */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          {/* Fast vs Deep Selector */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900">Analysis Tier</span>
              <span className="text-xs text-violet-700 font-semibold">
                Gemini 3.8 Flash
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setAnalysisMode("fast")}
                className={`py-1.5 px-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  analysisMode === "fast"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-700 hover:text-slate-900"
                }`}
              >
                Fast Analysis
              </button>
              <button
                type="button"
                onClick={() => setAnalysisMode("deep")}
                className={`py-1.5 px-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  analysisMode === "deep"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-700 hover:text-slate-900"
                }`}
              >
                Deep Analysis
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {analysisMode === "fast"
                ? "Low latency · Certified KPI lookup + concise summary (~700 tokens)."
                : "Extended multi-driver reasoning & deeper variance checks (~2,000+ tokens)."}
            </p>
          </div>

          {/* Active Conversation Context Indicator */}
          {conversationContext.turnCount > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5 text-xs">
              <div className="font-semibold text-slate-900">
                Active Analytical Context (Turn {conversationContext.turnCount})
              </div>
              <div className="text-slate-700">
                Focused Salons:{" "}
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {conversationContext.focusedSalonIds.length}
                </span>{" "}
                · Topic:{" "}
                <span className="font-mono font-medium text-teal-800">
                  {conversationContext.lastTopicKey}
                </span>
              </div>
              <div className="text-xs text-slate-600 leading-relaxed">
                Follow-up prompts (&ldquo;Why did that happen?&rdquo;, &ldquo;Show only the worst two&rdquo;) automatically inherit this selection.
              </div>
            </div>
          )}

          {/* Suggested Questions for Signed-In Role & Chatbot Mode */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-slate-900">
                Role Questions · {formatModeLabel(chatbotMode)}
              </div>
              <div className="text-[11px] text-slate-500">
                Authorized for {authSession.roleLabel}
              </div>
            </div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {suggestedPrompts.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={advisorLoading}
                  onClick={() => handleQuickPrompt(q)}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-800 bg-slate-50 hover:bg-teal-50/70 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors leading-snug"
                >
                  {q}
                </button>
              ))}

              {/* RBAC Cross-Region Governance Test Helper for Regional Manager */}
              {activePersona === "arjun" && (
                <button
                  type="button"
                  disabled={advisorLoading}
                  onClick={() =>
                    handleQuickPrompt(
                      "Show me contribution margin for Scottsdale Kierland Retreat in Southwest."
                    )
                  }
                  className="w-full text-left px-3 py-2 text-xs font-medium text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors leading-snug"
                >
                  [Test RBAC Scope Gate] Query unauthorized salon: Scottsdale Kierland Retreat
                </button>
              )}
            </div>
          </div>

          {/* Saved Questions */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="text-xs font-semibold text-slate-900">
              Saved Prompts ({savedQuestions.length})
            </div>
            <div className="space-y-1">
              {savedQuestions.map((sq) => (
                <button
                  key={sq}
                  type="button"
                  onClick={() => handleQuickPrompt(sq)}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-md truncate"
                >
                  {sq}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER + RIGHT CHATBOT CONVERSATION & ANALYTICAL EVIDENCE */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {/* Interactive Chatbot Conversation Thread */}
          {currentMessages.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="font-semibold text-slate-900 inline-flex items-center gap-1.5">
                  <MessageSquareText className="w-3.5 h-3.5 text-teal-700" />
                  <span>
                    Conversation Thread ({currentMessages.length}{" "}
                    {currentMessages.length === 1 ? "turn" : "turns"})
                  </span>
                </div>
                <span className="text-slate-500">
                  Select any turn to inspect its charts, KPIs, and supporting data
                </span>
              </div>

              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {currentMessages.map((msg, idx) => {
                  const isFocused = activeResponse?.id === msg.id;
                  return (
                    <div
                      key={msg.id}
                      onClick={() => setSelectedResponseId(msg.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors space-y-1.5 ${
                        isFocused
                          ? "border-teal-600 bg-teal-50/30"
                          : "border-slate-200 bg-slate-50/40 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                        <span>
                          Turn {idx + 1} · {authSession.roleLabel} ·{" "}
                          <strong className="text-teal-800">
                            {formatModeLabel(msg.chatbotMode ?? chatbotMode)}
                          </strong>
                        </span>
                        <span className="font-mono tabular-nums">
                          {msg.lastAnalysisTimestamp}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-900">
                        Q: &ldquo;{msg.question}&rdquo;
                      </div>
                      <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                        {msg.summary}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Prompt Input Bar */}
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-violet-700 ml-1 shrink-0" />
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Ask ${formatModeLabel(chatbotMode)} about ${persona.assignedRegion === "All Regions" ? "all 20 salons, margins, capacity, or ROI" : "your 5 Pacific Northwest salons, repeat visits, capacity, or retail"}...`}
              className="flex-1 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none px-1 py-1"
            />
            {inputText.trim().length > 5 && (
              <button
                type="button"
                onClick={() => saveQuestionPrompt(inputText.trim())}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg whitespace-nowrap"
                title="Save Prompt"
              >
                Save Prompt
              </button>
            )}
            <button
              type="submit"
              disabled={advisorLoading || !inputText.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              {advisorLoading
                ? "Analyzing..."
                : chatbotMode === "business-advisor"
                  ? "Ask Business Advisor"
                  : "Send Question"}
            </button>
          </form>

          {/* Loading Skeleton */}
          {advisorLoading && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="h-4 w-56 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-20 bg-slate-100 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty Starter State */}
          {!advisorLoading && !activeResponse && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
              <div className="max-w-xl mx-auto space-y-2">
                <div className="text-xs font-semibold text-teal-800">
                  {formatModeLabel(chatbotMode)} · {authSession.roleLabel}
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Ask a Business Question Grounded in Certified Salon Data
                </h2>
                <p className="text-sm text-slate-700">
                  Synthetic dataset verified ({dummyDatasetSummary.salonCount} salons,{" "}
                  {dummyDatasetSummary.monthlyRows} monthly &amp;{" "}
                  {dummyDatasetSummary.dailyRows} daily records). Select a starter question below or enter a custom prompt above.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {suggestedPrompts.slice(0, 3).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleQuickPrompt(q)}
                    className="px-3.5 py-2 text-xs font-semibold text-teal-900 bg-teal-50/80 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Structured Analytical Response Card */}
          {!advisorLoading && activeResponse && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
              {/* Top Question + Certified Cache / Execution Status */}
              <div className="p-5 sm:p-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-teal-800">
                      {formatModeLabel(
                        activeResponse.chatbotMode ?? chatbotMode
                      )}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-violet-700">
                      {activeResponse.executiveStyle
                        ? "Executive Briefing"
                        : "Operational Diagnostic"}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-700">
                      {activeResponse.businessScope}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{activeResponse.timeRange}</span>
                  </div>
                  <div className="font-mono text-xs text-slate-600 tabular-nums">
                    {activeResponse.calculationDetails.executionSource} ·{" "}
                    {activeResponse.calculationDetails.latencyMs}ms ·{" "}
                    {activeResponse.calculationDetails.tokensUsed.toLocaleString()}{" "}
                    tokens
                    {activeResponse.calculationDetails.isSimulatedTokenEstimate
                      ? " (est.)"
                      : " (live)"}
                  </div>
                </div>

                {activeResponse.calculationDetails.cacheStatusBanner && (
                  <div className="px-3.5 py-2 rounded-lg bg-teal-50/80 border border-teal-200 text-xs font-semibold text-teal-900">
                    {activeResponse.calculationDetails.cacheStatusBanner}
                  </div>
                )}

                {activeResponse.sourceFreshness.status === "Stale" && (
                  <div className="px-3.5 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">
                        Stale Source Warning ({activeResponse.sourceFreshness.name} ·{" "}
                        {activeResponse.sourceFreshness.ageHours}h old):
                      </span>{" "}
                      Source exceeds its {activeResponse.sourceFreshness.slaHours}h freshness SLA ({activeResponse.sourceFreshness.completenessPct}% completeness). High-stakes operational changes should wait for source refresh.
                    </div>
                  </div>
                )}

                {(activeResponse.topicKey === "access_denied" ||
                  activeResponse.topicKey === "policy_blocked") && (
                  <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-950 flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-semibold text-sm">
                        {activeResponse.title}
                      </div>
                      <div className="leading-relaxed">
                        {activeResponse.summary}
                      </div>
                    </div>
                  </div>
                )}

                {activeResponse.topicKey !== "access_denied" &&
                  activeResponse.topicKey !== "policy_blocked" && (
                    <>
                      <div className="text-xs font-medium text-slate-600">
                        Question: &ldquo;{activeResponse.question}&rdquo;
                      </div>
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                        {activeResponse.title}
                      </h2>

                      {/* A. DIRECT ANSWER / EXECUTIVE SUMMARY */}
                      <div className="space-y-1 pt-1">
                        <div className="text-xs font-semibold text-slate-700">
                          {activeResponse.executiveStyle
                            ? "Executive Summary (Concise 2–3 Sentence Readout)"
                            : "Advisor Response"}
                        </div>
                        <p className="text-sm sm:text-base text-slate-800 leading-relaxed">
                          {activeResponse.summary}
                        </p>
                      </div>
                    </>
                  )}

                {/* B. BUSINESS METRICS (KPI CARDS) */}
                {activeResponse.kpis.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pt-2">
                    {activeResponse.kpis.map((kpi) => (
                      <div
                        key={kpi.id}
                        className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1"
                      >
                        <div className="text-xs font-medium text-slate-600">
                          {kpi.label}
                        </div>
                        <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
                          {kpi.currentValue}
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs font-mono tabular-nums">
                          <span className="text-slate-600">
                            {kpi.baselineLabel}: {kpi.baselineValue}
                          </span>
                          <span
                            className={
                              kpi.varianceDirection === "positive"
                                ? "text-emerald-700 font-semibold"
                                : kpi.varianceDirection === "negative"
                                  ? "text-red-700 font-semibold"
                                  : "text-slate-700 font-medium"
                            }
                          >
                            {kpi.varianceLabel}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Executive Concise Risks + Recommendations + Expandable "Explore deeper" */}
              {activeResponse.executiveStyle &&
                activeResponse.topicKey !== "policy_blocked" &&
                activeResponse.topicKey !== "access_denied" && (
                  <div className="p-5 sm:p-6 bg-slate-50/50 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-900">
                          What Needs Attention (Evidence-Backed Drivers &amp; Risks)
                        </div>
                        <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700 list-disc pl-4 leading-relaxed">
                          {activeResponse.likelyDrivers.map((drv, i) => (
                            <li key={i}>{drv}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-900">
                          Prioritized Executive Recommendations &amp; Financial Implication
                        </div>
                        <div className="space-y-2">
                          {activeResponse.recommendedActions.map((act) => (
                            <div
                              key={act.id}
                              className="p-3.5 rounded-lg bg-white border border-slate-200 text-xs space-y-1"
                            >
                              <div className="font-semibold text-slate-900">
                                {act.priority} · {act.title}
                              </div>
                              <div className="text-slate-700 leading-relaxed">
                                {act.rationale}
                              </div>
                              <div className="font-mono text-teal-800 text-xs font-medium">
                                Expected Impact: {act.expectedImpactDirection}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExecDeepDiveOpen(!execDeepDiveOpen)}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5"
                    >
                      {execDeepDiveOpen ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                      {execDeepDiveOpen
                        ? "Collapse Evidence Deep Dive"
                        : "Explore Deeper (Regional Graphs, Salon Table, KPI Formulas & Caveats)"}
                    </button>
                  </div>
                )}

              {/* C. VISUAL EVIDENCE */}
              {(!activeResponse.executiveStyle || execDeepDiveOpen) &&
                activeResponse.chartType !== "table-only" && (
                  <div className="p-5 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Visual Evidence: {activeResponse.chartTitle}
                        </h3>
                        <p className="text-xs text-slate-600">
                          {activeResponse.chartSubtitle}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-slate-600">
                        Chart Type: {activeResponse.chartType}
                      </span>
                    </div>

                    <VisualizationRenderer
                      chartType={activeResponse.chartType}
                      chartData={activeResponse.chartData}
                      secondaryChartData={activeResponse.secondaryChartData}
                      heatmapData={activeResponse.heatmapData}
                      funnelData={activeResponse.funnelData}
                    />
                  </div>
                )}

              {/* E & F & G: ANOMALY, DRIVERS, RECOMMENDED ACTIONS (Operational View) */}
              {!activeResponse.executiveStyle &&
                chatbotMode !== "data-qa" &&
                activeResponse.topicKey !== "access_denied" &&
                activeResponse.topicKey !== "policy_blocked" &&
                activeResponse.topicKey !== "ambiguous" &&
                activeResponse.topicKey !== "unsupported" && (
                  <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* E. What Looks Unusual + F. Likely Drivers */}
                    <div className="lg:col-span-6 space-y-4">
                      {activeResponse.anomaly && (
                        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/60 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-amber-950">
                              What Looks Unusual? ({activeResponse.anomaly.severity} Severity)
                            </span>
                            <span className="text-xs font-medium text-amber-900">
                              {activeResponse.anomaly.evidenceQuality}
                            </span>
                          </div>
                          <div className="text-xs text-slate-800 leading-relaxed">
                            <span className="font-semibold">
                              {activeResponse.anomaly.affectedEntity}
                            </span>{" "}
                            recorded{" "}
                            <span className="font-mono font-semibold tabular-nums">
                              {activeResponse.anomaly.actualValue}
                            </span>{" "}
                            on {activeResponse.anomaly.metricName} vs{" "}
                            <span className="font-mono tabular-nums">
                              {activeResponse.anomaly.historicalBaseline}
                            </span>{" "}
                            baseline ({activeResponse.anomaly.absoluteDeviation} /{" "}
                            {activeResponse.anomaly.percentageDeviation}).
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-slate-900">
                          Likely Operational Drivers (Observed Co-Movement)
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                          {activeResponse.interpretation}
                        </p>
                        <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4 leading-relaxed">
                          {activeResponse.likelyDrivers.map((d, idx) => (
                            <li key={idx}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* G. Recommended Next Actions */}
                    <div className="lg:col-span-6 space-y-2.5">
                      <h4 className="text-xs font-semibold text-slate-900">
                        Recommended Next Actions (Human Approval Required)
                      </h4>
                      <div className="space-y-2.5">
                        {activeResponse.recommendedActions.map((act) => (
                          <div
                            key={act.id}
                            className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-900">
                                {act.title}
                              </span>
                              <span className="font-mono text-xs font-semibold text-teal-800 whitespace-nowrap">
                                {act.priority}
                              </span>
                            </div>
                            <p className="text-slate-700 leading-relaxed">
                              {act.rationale}
                            </p>
                            <div className="text-xs text-slate-600">
                              Expected Impact:{" "}
                              <span className="text-slate-900 font-medium">
                                {act.expectedImpactDirection}
                              </span>{" "}
                              · Owner: {act.responsiblePersona}
                            </div>
                            <div className="flex items-center justify-between gap-2 pt-1">
                              <span className="text-xs text-slate-600">
                                Approval: {act.requiredHumanApproval}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const salonObjs = SALONS.filter((s) =>
                                    act.affectedSalonIds.includes(s.id)
                                  );
                                  recordIntervention({
                                    title: act.title,
                                    problemStatement: activeResponse.title,
                                    insightDelivered: activeResponse.summary,
                                    actionTaken: act.rationale,
                                    affectedSalonIds: act.affectedSalonIds,
                                    affectedSalonNames: salonObjs.map(
                                      (s) => s.name
                                    ),
                                    region:
                                      salonObjs[0]?.region ??
                                      "Pacific Northwest",
                                    owner: authSession.roleLabel,
                                    startDate: "2026-10-24",
                                    status: "Active Holdout Trial",
                                    comparisonApproach:
                                      "Matched Regional Holdout Salons",
                                    beforeMetricLabel:
                                      activeResponse.kpis[0]?.currentValue ??
                                      "Baseline logged",
                                    afterMetricLabel:
                                      "Pending 28-day validation window",
                                    holdoutGroupDeltaLabel:
                                      "Matched regional peer studio assigned as control",
                                    incrementalVisitsMonthly: 65,
                                    incrementalSalesMonthly: 6175,
                                    contributionMarginPct: 35,
                                    interventionDiscountAndTrainingCost: 250,
                                    estimatedNetContributionMonthly: 1911,
                                    managerHoursSavedWeekly: 3.5,
                                    confidenceNote:
                                      "Illustrative newly logged action: track against matched control salon over 4 weeks.",
                                  });
                                }}
                                className="px-2.5 py-1 text-xs font-semibold text-teal-800 bg-white border border-teal-300 hover:bg-teal-50 rounded-md whitespace-nowrap"
                              >
                                Approve &amp; Log Action
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              {/* SUPPORTING DATA TABLE & D. DATA FRESHNESS */}
              {(!activeResponse.executiveStyle || execDeepDiveOpen) &&
                activeResponse.tableRows.length > 0 && (
                  <div className="p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-slate-900">
                        Supporting Salon &amp; Regional Records
                      </h4>
                      <button
                        type="button"
                        onClick={() =>
                          setSupportingDataExpanded(!supportingDataExpanded)
                        }
                        className="text-xs font-semibold text-teal-700 hover:text-teal-900"
                      >
                        {supportingDataExpanded ? "Hide Table" : "Show Table"}
                      </button>
                    </div>

                    {supportingDataExpanded && (
                      <TanStackDataTable
                        columns={activeResponse.tableColumns}
                        rows={activeResponse.tableRows}
                        compact
                      />
                    )}

                    {/* D. Data Freshness & Calculation Lineage */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
                      <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5 text-teal-700" />
                          Data Freshness &amp; Source Lineage
                        </div>
                        <div className="text-slate-700">
                          Source: {activeResponse.sourceFreshness.name} (
                          {activeResponse.sourceFreshness.status})
                        </div>
                        <div className="font-mono text-xs text-slate-600 tabular-nums">
                          Data Through: {activeResponse.sourceFreshness.dataThroughTimestamp} · Completeness:{" "}
                          {activeResponse.sourceFreshness.completenessPct}%
                        </div>
                        <div className="text-xs text-slate-600">
                          Cadence: {activeResponse.sourceFreshness.updateScheduleLabel} · Executed:{" "}
                          {activeResponse.lastAnalysisTimestamp}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                        <div className="font-semibold text-slate-900">
                          Calculation &amp; Caveats
                        </div>
                        <div className="text-slate-700">
                          {activeResponse.calculationDetails.formulaSummary}
                        </div>
                        {activeResponse.caveats.map((cav, i) => (
                          <div key={i} className="text-xs text-slate-600">
                            · {cav}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              {/* H. CONTEXTUAL FOLLOW-UP QUESTIONS */}
              <div className="px-5 py-4 bg-slate-50/70 space-y-2">
                <div className="text-xs font-semibold text-slate-800">
                  Contextual Follow-Up Questions
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeResponse.followUpSuggestions.map((fq) => (
                    <button
                      key={fq}
                      type="button"
                      onClick={() => handleQuickPrompt(fq)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-lg transition-colors"
                    >
                      {fq}
                    </button>
                  ))}
                </div>
              </div>

              {/* I. ALL 10 WORKING ACTION CONTROLS */}
              <div className="px-5 py-3.5 bg-white flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={
                      activeResponse.topicKey === "access_denied" ||
                      activeResponse.topicKey === "policy_blocked"
                    }
                    onClick={() => saveResponseAsInsight(activeResponse, "Weekly")}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 disabled:opacity-40 border border-slate-200 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5 text-teal-700" />
                    Save Insight
                  </button>
                  <button
                    type="button"
                    disabled={
                      activeResponse.topicKey === "access_denied" ||
                      activeResponse.topicKey === "policy_blocked"
                    }
                    onClick={() => handlePinResponse(activeResponse)}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 disabled:opacity-40 border border-slate-200 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Pin className="w-3.5 h-3.5 text-teal-700" />
                    Pin to Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => handleManualRefresh(activeResponse)}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh
                  </button>
                  <button
                    type="button"
                    disabled={
                      activeResponse.topicKey === "access_denied" ||
                      activeResponse.topicKey === "policy_blocked"
                    }
                    onClick={() => handleScheduleResponse(activeResponse)}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 disabled:opacity-40 border border-slate-200 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    Schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!verifyExportChannelAllowed("PDF", activeResponse.title)) {
                        return;
                      }
                      exportInsightReportPdf(activeResponse);
                      appendAuditEvent(
                        "REPORT_EXPORTED",
                        `Exported Insight PDF: "${activeResponse.title}"`,
                        "Allowed",
                        "PDF"
                      );
                      notify("Downloaded Insight Report PDF.", "teal");
                    }}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!verifyExportChannelAllowed("CSV", activeResponse.title)) {
                        return;
                      }
                      downloadTableAsCsv(
                        `InsightFlow_${activeResponse.topicKey}`,
                        activeResponse.tableColumns,
                        activeResponse.tableRows
                      );
                      appendAuditEvent(
                        "REPORT_EXPORTED",
                        `Exported CSV records for "${activeResponse.title}"`,
                        "Allowed",
                        "CSV"
                      );
                      notify("Downloaded supporting table CSV.", "teal");
                    }}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareTarget(activeResponse)}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetricModalOpen(true)}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Info className="w-3.5 h-3.5" />
                    Explain Metric
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExecDeepDiveOpen(true);
                      setSupportingDataExpanded(true);
                      notify("Supporting salon records & lineage expanded above.", "teal");
                    }}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    View Supporting Data
                  </button>
                </div>

                {/* Useful / Not Useful Feedback */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      markResponseFeedback(activeResponse.id, "useful")
                    }
                    className={`p-1.5 rounded border text-xs inline-flex items-center gap-1 ${
                      activeResponse.userFeedback === "useful"
                        ? "bg-teal-50 border-teal-300 text-teal-800"
                        : "border-slate-200 text-slate-600 hover:text-slate-900"
                    }`}
                    title="Mark Useful"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      markResponseFeedback(activeResponse.id, "not_useful")
                    }
                    className={`p-1.5 rounded border text-xs inline-flex items-center gap-1 ${
                      activeResponse.userFeedback === "not_useful"
                        ? "bg-red-50 border-red-300 text-red-800"
                        : "border-slate-200 text-slate-600 hover:text-slate-900"
                    }`}
                    title="Mark Not Useful"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Share, Schedule & Metric Modals */}
      <ShareReportModal
        open={Boolean(shareTarget)}
        onClose={() => setShareTarget(null)}
        reportTitle={shareTarget?.title ?? "Analytical Insight"}
        reportType="AI Advisor Insight Report"
        defaultSummary={shareTarget?.summary ?? ""}
      />

      <ScheduleConfigModal
        open={Boolean(scheduleTarget)}
        onClose={() => setScheduleTarget(null)}
        title={scheduleTarget?.title ?? "Recurring Insight"}
        initialSchedule={null}
        onSave={(sched) => {
          if (!scheduleTarget) return;
          const created = saveResponseAsInsight(
            scheduleTarget,
            sched.cadence === "Custom" ? "Weekly" : sched.cadence
          );
          updateInsightSchedule(created.id, sched);
        }}
      />

      <MetricDefinitionsModal
        open={metricModalOpen}
        onClose={() => setMetricModalOpen(false)}
      />
    </div>
  );
};
