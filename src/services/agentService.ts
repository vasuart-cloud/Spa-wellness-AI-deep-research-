import {
  AIResponseContract,
  ChatbotMode,
  ConversationContextState,
  GovernancePolicy,
  PersonaId,
  SavedDashboardWidget,
  SourceSystemStatus,
  ZenneClarificationPrompt,
  ZenneToolMode,
  ZenneUploadedDoc,
} from "../types/domain";
import {
  computeIllustrativeValueScenarios,
  formatCurrency,
  formatPct,
  formatSignedPct,
  formatSignedPts,
  getMonthlySeriesForSalons,
  getRegionalSummaries,
  getSalonComparisons,
  getScopeAggregateKPIs,
} from "./analyticsService";
import { queryCacheService } from "./cacheService";
import { evaluateQueryPolicy } from "./policyService";
import {
  buildRebookingFunnel,
  buildUtilizationHeatmap,
  ensureSyntheticDatasetReady,
  getSourceSystems,
  METRIC_DEFINITIONS,
  PERSONAS,
  SALONS,
} from "./syntheticDataService";

export const REGIONAL_SUGGESTED_QUESTIONS = [
  "Which salons had the biggest decline in repeat visits in the last 30 days?",
  "Why are three salons losing repeat customers?",
  "Show me revenue by salon for the last six months.",
  "Which salons have the highest unused stylist capacity?",
  "Where did retail product sales decline this month?",
  "Which salons are at risk of missing revenue targets?",
  "Which salons should I prioritize this week?",
  "What should I do to improve repeat visits?",
  "What changed compared with last month?",
  "Show the estimated financial impact of these opportunities.",
];

export const EXECUTIVE_SUGGESTED_QUESTIONS = [
  "How is our business performing this month?",
  "Where should I focus to improve profitability this quarter?",
  "Which regions are reducing our profitability?",
  "Where are we losing revenue despite having available capacity?",
  "Which retention intervention generated incremental sales?",
  "How confident should I be in these recommendations?",
  "How much business value did our managers generate this quarter?",
  "Which actions should I prioritize in the next executive review?",
];

export const GOVERNANCE_SUGGESTED_QUESTIONS = [
  "How confident should I be in these recommendations?",
  "Where did retail product sales decline this month?",
  "How is our business performing this month?",
  "Which regions are reducing our profitability?",
  "Show me revenue by salon for the last six months.",
  "Which salons have the highest unused stylist capacity?",
];

export function getSuggestedQuestionsForSession(
  personaId: PersonaId,
  chatbotMode: ChatbotMode = "business-advisor"
): string[] {
  if (chatbotMode === "retention-coach") {
    return personaId === "meera"
      ? [
          "Which retention intervention generated incremental sales?",
          "Where are we losing revenue despite having available capacity?",
          "Which regions are reducing our profitability?",
          "Which actions should I prioritize in the next executive review?",
          "How confident should I be in these recommendations?",
        ]
      : [
          "Which salons had the biggest decline in repeat visits in the last 30 days?",
          "Why are three salons losing repeat customers?",
          "What should I do to improve repeat visits?",
          "Which salons have the highest unused stylist capacity?",
          "Show the estimated financial impact of these opportunities.",
        ];
  }

  if (chatbotMode === "data-qa") {
    return personaId === "meera"
      ? [
          "How is our business performing this month?",
          "Which regions are reducing our profitability?",
          "Show me revenue by salon for the last six months.",
          "Where are we losing revenue despite having available capacity?",
          "How confident should I be in these recommendations?",
        ]
      : [
          "Show me revenue by salon for the last six months.",
          "What changed compared with last month?",
          "Which salons are at risk of missing revenue targets?",
          "Where did retail product sales decline this month?",
          "Which salons had the biggest decline in repeat visits in the last 30 days?",
        ];
  }

  if (personaId === "meera") return EXECUTIVE_SUGGESTED_QUESTIONS;
  if (personaId === "neha") return GOVERNANCE_SUGGESTED_QUESTIONS;
  return REGIONAL_SUGGESTED_QUESTIONS;
}

interface ExecuteQueryOptions {
  question: string;
  clarificationFocus?: string;
  personaId: PersonaId;
  analysisMode: "fast" | "deep";
  chatbotMode?: ChatbotMode;
  agentProductName?: "AI Business Advisor" | "AI Retention Manager";
  toolMode?: ZenneToolMode;
  uploadedDoc?: ZenneUploadedDoc;
  context: ConversationContextState;
  policy: GovernancePolicy;
  agentEnabled: boolean;
  todayTokensUsed: number;
  monthSpendUsd: number;
  userQueriesLastHour?: number;
  dataVersion: number;
  demoTimeOffsetHours: number;
  posSyncRefreshed: boolean;
  forceRefresh?: boolean;
  highCostApproved?: boolean;
  scopedOverrideSalonIds?: string[];
}

export interface ExecuteQueryOutcome {
  response: AIResponseContract;
  nextContext: ConversationContextState;
  policyBlocked: boolean;
  policyWarningBanner?: string;
  requiresHighCostConfirmation?: boolean;
}

function resolveIntent(
  question: string,
  personaId: PersonaId,
  context: ConversationContextState,
  opts?: {
    agentProductName?: "AI Business Advisor" | "AI Retention Manager";
    toolMode?: ZenneToolMode;
    uploadedDoc?: ZenneUploadedDoc;
  }
): {
  topicKey: AIResponseContract["topicKey"];
  filterWorstCount?: number;
} {
  const combinedSource = opts?.uploadedDoc
    ? `${question} ${opts.uploadedDoc.name} ${opts.uploadedDoc.excerpt.slice(0, 260)}`
    : question;
  const q = combinedSource.toLowerCase().trim();
  const rawQ = question.toLowerCase().trim();

  // Unsupported domains (payroll, individual employee SSNs, competitor scraping, weather, tax advice)
  if (
    /payroll|salary|ssn|credit card|competitor|instagram|tiktok|tax filing|bank account/.test(
      rawQ
    )
  ) {
    return { topicKey: "unsupported" };
  }

  // Explicit vague short prompts when not in Search mode and no document attached
  if (
    !opts?.uploadedDoc &&
    opts?.toolMode !== "search" &&
    (rawQ === "compare" ||
      rawQ === "how are things?" ||
      rawQ === "show metrics" ||
      rawQ === "analyze salons")
  ) {
    return { topicKey: "ambiguous" };
  }

  // Contextual follow-up: "Show only the worst two" / "top 2" / "worst 2"
  if (/worst two|worst 2|bottom two|bottom 2|only the two/.test(q)) {
    const baseTopic =
      context.lastTopicKey &&
      context.lastTopicKey !== "access_denied" &&
      context.lastTopicKey !== "policy_blocked" &&
      context.lastTopicKey !== "ambiguous" &&
      context.lastTopicKey !== "unsupported"
        ? context.lastTopicKey
        : "repeat_visits";
    return {
      topicKey: baseTopic,
      filterWorstCount: 2,
    };
  }

  // Explicit repeat-customer root cause question
  if (/why are (three|these|those)? ?salons losing repeat/.test(q)) {
    return { topicKey: "repeat_drivers" };
  }

  // Contextual follow-up: "Why did that happen?" / "Why is that?" / "What caused that?"
  if (/why did that happen|why is that|what caused/.test(q)) {
    if (
      context.lastTopicKey === "unused_capacity" ||
      context.lastTopicKey === "coo_capacity_loss" ||
      context.lastTopicKey === "retail_decline" ||
      context.lastTopicKey === "coo_profitability"
    ) {
      return { topicKey: context.lastTopicKey };
    }
    return { topicKey: "repeat_drivers" };
  }

  // Contextual follow-up: "What should I do next?" or "improve repeat visits"
  if (/what should i do|improve repeat visits|recommended action|next step/.test(q)) {
    if (personaId === "meera" && (/executive review/.test(q) || context.lastTopicKey?.startsWith("coo_"))) {
      return { topicKey: "coo_exec_actions" };
    }
    return { topicKey: "repeat_actions" };
  }

  // Contextual or general financial impact
  if (/financial impact|how much.*worth|incremental|business value did our managers/.test(q)) {
    if (personaId === "meera" && /managers generate|intervention/.test(q)) {
      return { topicKey: "coo_interventions" };
    }
    return { topicKey: "financial_impact" };
  }

  // COO specific prompts
  if (/how is our business performing|executive summary/.test(q)) {
    return { topicKey: "coo_monthly_perf" };
  }
  if (/profitability|reducing our profitability|margin/.test(q)) {
    return { topicKey: "coo_profitability" };
  }
  if (/losing revenue despite.*capacity|available capacity/.test(q)) {
    return {
      topicKey: personaId === "meera" ? "coo_capacity_loss" : "unused_capacity",
    };
  }
  if (/retention intervention|incremental sales/.test(q)) {
    return { topicKey: "coo_interventions" };
  }
  if (/how confident|confidence|caveat/.test(q)) {
    return { topicKey: "coo_confidence" };
  }
  if (/executive review|prioritize in the next executive/.test(q)) {
    return { topicKey: "coo_exec_actions" };
  }

  // Operational / Regional Operations Manager prompts
  if (/repeat visit|repeat customer|returning/.test(q)) {
    return { topicKey: "repeat_visits" };
  }
  if (/six months|6 months|revenue by salon/.test(q)) {
    return { topicKey: "revenue_6m" };
  }
  if (/unused.*capacity|stylist capacity|utilization|unused.*hour/.test(q)) {
    return { topicKey: "unused_capacity" };
  }
  if (/retail|product sales|attachment/.test(q)) {
    return { topicKey: "retail_decline" };
  }
  if (/missing revenue target|at risk|target/.test(q)) {
    return { topicKey: "revenue_risk" };
  }
  if (/prioritize this week|focus this week/.test(q)) {
    return { topicKey: "weekly_priorities" };
  }
  if (/changed compared with last month|last month|month over month/.test(q)) {
    return { topicKey: "month_change" };
  }
  if (/churn|lapsed|rebook|retention|cohort|overdue/.test(q)) {
    return {
      topicKey: personaId === "meera" ? "coo_interventions" : "repeat_visits",
    };
  }

  // Very short unmatched non-search queries ask for clarification
  if (!opts?.uploadedDoc && opts?.toolMode !== "search" && rawQ.length < 5) {
    return { topicKey: "ambiguous" };
  }

  // Default fallback by role and active agent selection
  if (opts?.agentProductName === "AI Retention Manager") {
    return {
      topicKey: personaId === "meera" ? "coo_interventions" : "repeat_visits",
    };
  }
  return {
    topicKey: personaId === "meera" ? "coo_monthly_perf" : "repeat_visits",
  };
}

export async function executeAdvisorQuery(
  opts: ExecuteQueryOptions
): Promise<ExecuteQueryOutcome> {
  // Guarantee dummy / synthetic salon dataset is populated before querying
  ensureSyntheticDatasetReady(opts.dataVersion);

  const activeAgentProduct = opts.agentProductName ?? "AI Business Advisor";
  const activeToolMode: ZenneToolMode =
    opts.toolMode ?? (opts.analysisMode === "deep" ? "deep-research" : "ask");
  const activeChatbotMode: ChatbotMode =
    opts.chatbotMode ??
    (activeAgentProduct === "AI Retention Manager"
      ? "retention-coach"
      : activeToolMode === "search"
        ? "data-qa"
        : "business-advisor");
  const nowStamp =
    new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const persona = PERSONAS[opts.personaId];
  const sources = getSourceSystems(
    opts.demoTimeOffsetHours,
    opts.posSyncRefreshed
  );

  // 1. Pre-resolve analytical intent + conversational context + optional follow-up clarification focus
  const baseIntent = resolveIntent(
    opts.question,
    opts.personaId,
    opts.context,
    {
      agentProductName: activeAgentProduct,
      toolMode: activeToolMode,
      uploadedDoc: opts.uploadedDoc,
    }
  );
  let topicKey = baseIntent.topicKey;
  let filterWorstCount = baseIntent.filterWorstCount;

  if (opts.clarificationFocus) {
    const focusLower = opts.clarificationFocus.toLowerCase();
    if (/worst 2|worst two|bottom 2|bottom two|steepest 2/.test(focusLower)) {
      filterWorstCount = 2;
    } else if (/worst 3|worst three|bottom 3/.test(focusLower)) {
      filterWorstCount = 3;
    }
    if (
      topicKey === "repeat_visits" &&
      /funnel|root-cause|root cause|checkout|cancellation driver/.test(focusLower) &&
      !filterWorstCount
    ) {
      topicKey = "repeat_drivers";
    } else if (
      (topicKey === "repeat_visits" || topicKey === "unused_capacity") &&
      /financial impact|dollar impact|revenue recovery|30-day revenue impact/.test(
        focusLower
      ) &&
      /quantify/.test(focusLower)
    ) {
      topicKey = "financial_impact";
    } else if (
      (topicKey === "coo_monthly_perf" || topicKey === "coo_profitability") &&
      /holdout|sensitivity|incremental sales/.test(focusLower)
    ) {
      topicKey = "coo_interventions";
    } else if (
      topicKey === "coo_monthly_perf" &&
      /margin|discount|profitability/.test(focusLower)
    ) {
      topicKey = "coo_profitability";
    }
  }

  // Authorized salon scope (intersect any override with persona's allowed salons!)
  const baseAllowedIds = opts.scopedOverrideSalonIds
    ? opts.scopedOverrideSalonIds.filter((id) =>
        persona.allowedSalonIds.includes(id)
      )
    : persona.allowedSalonIds;

  // Carry forward focused salon subset on contextual follow-up turns
  let activeSalonIds = [...baseAllowedIds];
  const isContextualFollowUp =
    topicKey === "repeat_drivers" ||
    topicKey === "repeat_actions" ||
    topicKey === "financial_impact" ||
    Boolean(filterWorstCount);

  if (isContextualFollowUp && opts.context.focusedSalonIds.length > 0) {
    const validFocused = opts.context.focusedSalonIds.filter((id) =>
      baseAllowedIds.includes(id)
    );
    if (validFocused.length > 0) {
      activeSalonIds = validFocused;
    }
  }

  if (filterWorstCount && filterWorstCount > 0) {
    // Rank against the full authorized scope if activeSalonIds already has <= filterWorstCount
    const poolIds =
      activeSalonIds.length >= filterWorstCount ? activeSalonIds : baseAllowedIds;
    const preComps = getSalonComparisons(poolIds, opts.dataVersion);
    const sortedWorst = [...preComps].sort((a, b) => {
      if (topicKey === "unused_capacity" || topicKey === "coo_capacity_loss") {
        return b.unusedHoursCurrent - a.unusedHoursCurrent;
      }
      if (topicKey === "retail_decline") {
        return a.current.retailAttachmentPct - b.current.retailAttachmentPct;
      }
      if (topicKey === "coo_profitability") {
        return a.current.contributionMarginPct - b.current.contributionMarginPct;
      }
      if (topicKey === "revenue_risk" || topicKey === "weekly_priorities") {
        return a.targetVarianceDollars - b.targetVarianceDollars;
      }
      return a.repeatRateDeltaPts - b.repeatRateDeltaPts;
    });
    activeSalonIds = sortedWorst.slice(0, filterWorstCount).map((s) => s.salon.id);
  }

  const focusTag = opts.clarificationFocus
    ? opts.clarificationFocus.trim().toLowerCase().slice(0, 48)
    : "std";
  const docTag = opts.uploadedDoc
    ? `doc:${opts.uploadedDoc.name}:${opts.uploadedDoc.sizeLabel}`
    : "nodoc";
  const normalizedIntentKey = `${activeAgentProduct}:${activeToolMode}:${activeChatbotMode}:${topicKey}:w${filterWorstCount ?? "all"}:${focusTag}:${docTag}`;
  const kpiVersionTags = Object.values(METRIC_DEFINITIONS).map(
    (m) => `${m.id}@${m.version}`
  );
  const cacheInput = {
    tenantId: "elevate-wellness-group",
    personaId: opts.personaId,
    scopedSalonIds: activeSalonIds,
    metricIdsAndVersions: kpiVersionTags,
    normalizedQueryIntent: normalizedIntentKey,
    dateRange: topicKey === "revenue_6m" ? "Last 6 Months" : "Last 30 Days",
    analysisMode: opts.analysisMode,
    dataVersion: opts.dataVersion,
  };

  // Peek scoped cache before budget check so 0-token cached insights remain accessible during Hard Stop
  const canUseCache =
    !opts.forceRefresh &&
    !opts.uploadedDoc &&
    topicKey !== "unsupported" &&
    topicKey !== "ambiguous" &&
    opts.policy.cachePolicy !== "Bypass Cache";

  const preCheckedCached = canUseCache
    ? queryCacheService.lookup(cacheInput, false)
    : null;

  // 2. Evaluate governance, RBAC, rate limits, & budget policy BEFORE returning data or calling LLM
  const combinedQuestionForPolicy = [
    opts.question,
    opts.clarificationFocus,
    opts.uploadedDoc ? opts.uploadedDoc.excerpt.slice(0, 240) : "",
  ]
    .filter(Boolean)
    .join(" ");
  const policyEval = evaluateQueryPolicy({
    question: combinedQuestionForPolicy,
    personaId: opts.personaId,
    analysisMode: opts.analysisMode,
    policy: opts.policy,
    agentEnabled: opts.agentEnabled,
    agentProductName: activeAgentProduct,
    todayTokensUsed: opts.todayTokensUsed,
    monthSpendUsd: opts.monthSpendUsd,
    highCostApproved: opts.highCostApproved,
    isCachedHit: Boolean(preCheckedCached),
    userQueriesLastHour: opts.userQueriesLastHour,
  });

  if (!policyEval.allowed) {
    const isAccessDenied = policyEval.reasonCode === "UNAUTHORIZED_SALON_SCOPE";
    const blockedResponse: AIResponseContract = {
      id: `RESP-BLK-${Date.now()}`,
      question: opts.question,
      title: isAccessDenied
        ? "Scoped Data Access Denied"
        : "Governance Policy Enforcement Gate",
      summary:
        policyEval.userMessage ??
        "This analytical request cannot be completed under active tenant governance rules.",
      executiveStyle: opts.personaId === "meera",
      timeRange: "N/A",
      businessScope: `${persona.assignedRegion} (${persona.allowedSalonIds.length} Authorized Salons)`,
      scopedSalonIds: persona.allowedSalonIds,
      topicKey: isAccessDenied ? "access_denied" : "policy_blocked",
      kpis: [],
      chartType: "table-only",
      chartTitle: "No Data Returned",
      chartSubtitle: "Governance gate intercepted query prior to warehouse execution.",
      chartData: [],
      tableColumns: [
        { key: "check", header: "Governance Control" },
        { key: "result", header: "Enforcement Result" },
      ],
      tableRows: [
        {
          check: "Active Role Scope",
          result: `${persona.name} · ${persona.assignedRegion}`,
        },
        {
          check: "Policy Rule Triggered",
          result: policyEval.reasonCode ?? "POLICY_GATE",
        },
        {
          check: "Policy Version",
          result: opts.policy.versionLabel,
        },
      ],
      sourceFreshness: sources["SRC-WAREHOUSE-DAILY"],
      lastAnalysisTimestamp: nowStamp,
      anomaly: null,
      interpretation:
        "InsightFlow enforces role-based salon permissions, prompt safety filters, rate limits, and tenant cost caps prior to query execution.",
      likelyDrivers: [],
      recommendedActions: [],
      caveats: ["Event logged in append-only Tenant Audit Trail."],
      followUpSuggestions:
        opts.personaId === "arjun"
          ? [
              "Which salons had the biggest decline in repeat visits in the last 30 days?",
              "Which salons have the highest unused stylist capacity?",
              "Show me revenue by salon for the last six months.",
            ]
          : [
              "How is our business performing this month?",
              "Where should I focus to improve profitability this quarter?",
              "Which regions are reducing our profitability?",
            ],
      calculationDetails: {
        kpiIds: [],
        formulaSummary: "No calculation executed (Blocked by Policy Service).",
        validationChecks: ["RBAC & Governance pre-flight check enforced"],
        executionSource: "Governance Policy Gate",
        tokensUsed: 0,
        estimatedCostUsd: 0,
        latencyMs: 28,
        isSimulatedTokenEstimate: true,
      },
      chatbotMode: activeChatbotMode,
    };

    return {
      response: blockedResponse,
      nextContext: opts.context,
      policyBlocked: true,
      requiresHighCostConfirmation:
        policyEval.reasonCode === "HIGH_COST_APPROVAL_REQUIRED",
    };
  }

  // Handle unsupported or ambiguous cleanly without fabricating data
  if (topicKey === "unsupported" || topicKey === "ambiguous") {
    const isUnsupported = topicKey === "unsupported";
    const resp: AIResponseContract = {
      id: `RESP-CLAR-${Date.now()}`,
      question: opts.question,
      title: isUnsupported
        ? "Metric Outside Supported Analytical Scope"
        : "Clarification Requested for Analytical Precision",
      summary: isUnsupported
        ? "InsightFlow does not have access to individual employee payroll records, raw guest payment credentials, or external competitor pricing feeds. You can analyze certified salon revenue, repeat-visit retention, stylist utilization, retail attachment, cancellations, or contribution margin."
        : "Your question could apply to multiple timeframes or KPIs. Please specify whether you want to compare revenue growth, repeat-visit retention, stylist utilization, or contribution margin over the last 30 days or 6 months.",
      executiveStyle: opts.personaId === "meera",
      timeRange: "Clarification Pending",
      businessScope: `${persona.assignedRegion} (${baseAllowedIds.length} Salons)`,
      scopedSalonIds: baseAllowedIds,
      topicKey,
      kpis: [],
      chartType: "table-only",
      chartTitle: "Supported Certified KPI Domains",
      chartSubtitle: "Select any follow-up prompt below to run a verified calculation.",
      chartData: [],
      tableColumns: [
        { key: "domain", header: "Certified Domain" },
        { key: "metrics", header: "Available Metrics" },
        { key: "cadence", header: "Update Cadence" },
      ],
      tableRows: [
        {
          domain: "Guest Retention",
          metrics: "Repeat-Visit Rate, Checkout Rebooking %, Visit Interval",
          cadence: "Daily Batch + 30m Booking Stream",
        },
        {
          domain: "Revenue & Margin",
          metrics: "Service/Retail/Membership Net Sales, Discounts, Contribution Margin",
          cadence: "Daily Batch Warehouse (04:00 Local)",
        },
        {
          domain: "Capacity & Operations",
          metrics: "Stylist Utilization %, Unused Hours, Cancellations, No-Shows",
          cadence: "Operational Event Stream (~25m lag)",
        },
      ],
      sourceFreshness: sources["SRC-WAREHOUSE-DAILY"],
      lastAnalysisTimestamp: nowStamp,
      anomaly: null,
      interpretation: isUnsupported
        ? "Honest boundary enforcement prevents hallucinated figures on unavailable data sources."
        : "Disambiguating metric definitions ensures every chart reflects certified warehouse formulas.",
      likelyDrivers: [],
      recommendedActions: [],
      caveats: ["No numerical estimate generated until scope and KPI are selected."],
      followUpSuggestions:
        opts.personaId === "meera"
          ? EXECUTIVE_SUGGESTED_QUESTIONS.slice(0, 3)
          : REGIONAL_SUGGESTED_QUESTIONS.slice(0, 3),
      calculationDetails: {
        kpiIds: [],
        formulaSummary: "Metadata lookup only.",
        validationChecks: ["Domain availability check"],
        executionSource: "Deterministic Engine (Fallback Narrative)",
        tokensUsed: 110,
        estimatedCostUsd: 0.001,
        latencyMs: 42,
        isSimulatedTokenEstimate: true,
      },
      chatbotMode: activeChatbotMode,
    };
    return {
      response: resp,
      nextContext: opts.context,
      policyBlocked: false,
      policyWarningBanner: policyEval.warningBanner,
    };
  }

  // 3. Return Scoped Query Cache Hit if present
  if (preCheckedCached) {
    return {
      response: {
        ...preCheckedCached,
        id: `RESP-CACHE-${Date.now()}`,
        question: opts.question,
      },
      nextContext: {
        lastTopicKey: topicKey,
        focusedSalonIds: preCheckedCached.scopedSalonIds,
        lastTimeRange: preCheckedCached.timeRange,
        turnCount: opts.context.turnCount + 1,
      },
      policyBlocked: false,
      policyWarningBanner: policyEval.warningBanner,
    };
  }

  // 4. Deterministic Calculation Layer builds structured response
  const built = buildDeterministicResponse({
    question: opts.question,
    topicKey,
    personaId: opts.personaId,
    scopedSalonIds: activeSalonIds,
    allAuthorizedSalonIds: baseAllowedIds,
    filterWorstCount,
    analysisMode: opts.analysisMode,
    dataVersion: opts.dataVersion,
    sources,
    nowStamp,
  });

  // 5. Optional Server-Side Gemini 3.8 Flash narrative synthesis (strictly grounded in computed numbers)
  const docContextNote = opts.uploadedDoc
    ? `Cross-checked attached document "${opts.uploadedDoc.name}" (${opts.uploadedDoc.sizeLabel}${
        opts.uploadedDoc.rowOrLineCount
          ? ` · ${opts.uploadedDoc.rowOrLineCount} lines`
          : ""
      }) against certified ${built.response.businessScope} warehouse metrics.`
    : "";

  let finalSummary =
    activeToolMode === "search"
      ? `Search Match (${activeAgentProduct}): ${built.response.summary}`
      : built.response.summary;
  let finalInterpretation = [
    opts.clarificationFocus
      ? `Tailored to your requested focus (${opts.clarificationFocus}): ${built.response.interpretation}`
      : built.response.interpretation,
    docContextNote,
  ]
    .filter(Boolean)
    .join(" ");
  let executionSource: AIResponseContract["calculationDetails"]["executionSource"] =
    "Deterministic Engine (Fallback Narrative)";
  let tokensUsed = opts.analysisMode === "deep" ? 1940 : 690;
  let estimatedCostUsd = opts.analysisMode === "deep" ? 0.015 : 0.005;
  let latencyMs = opts.analysisMode === "deep" ? 310 : 145;
  let isSimulatedTokenEstimate = true;

  try {
    const apiRes = await fetch("/api/advisor/narrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: opts.question,
        clarificationFocus: opts.clarificationFocus,
        personaName: persona.name,
        personaRole: persona.roleTitle,
        analysisMode: opts.analysisMode,
        chatbotMode: activeChatbotMode,
        agentProductName: activeAgentProduct,
        toolMode: activeToolMode,
        uploadedDoc: opts.uploadedDoc
          ? {
              name: opts.uploadedDoc.name,
              sizeLabel: opts.uploadedDoc.sizeLabel,
              excerpt: opts.uploadedDoc.excerpt.slice(0, 900),
            }
          : undefined,
        computedContext: {
          title: built.response.title,
          scopeLabel: built.response.businessScope,
          timeRange: built.response.timeRange,
          kpis: built.response.kpis.map((k) => ({
            label: k.label,
            value: k.currentValue,
            baseline: `${k.baselineValue} (${k.baselineLabel})`,
            variance: k.varianceLabel,
          })),
          anomaly: built.response.anomaly
            ? {
                metric: built.response.anomaly.metricName,
                actual: built.response.anomaly.actualValue,
                baseline: built.response.anomaly.historicalBaseline,
                deviationPct: built.response.anomaly.percentageDeviation,
                severity: built.response.anomaly.severity,
              }
            : undefined,
          drivers: built.response.likelyDrivers,
          actions: built.response.recommendedActions.map((a) => ({
            title: a.title,
            rationale: a.rationale,
            priority: a.priority,
          })),
          isStale: built.response.sourceFreshness.status === "Stale",
          staleSourceName: built.response.sourceFreshness.name,
          fallbackSummary: finalSummary,
          fallbackInterpretation: finalInterpretation,
        },
      }),
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.usedGemini) {
        finalSummary = data.summary || finalSummary;
        finalInterpretation = data.interpretation
          ? [data.interpretation, docContextNote].filter(Boolean).join(" ")
          : finalInterpretation;
        executionSource = "Deterministic Engine + Gemini 3.8 Flash";
        latencyMs = data.latencyMs || latencyMs;
        if (data.usage && typeof data.usage.totalTokens === "number") {
          tokensUsed = data.usage.totalTokens;
          estimatedCostUsd = Number(((tokensUsed / 1_000_000) * 6.5).toFixed(4));
          isSimulatedTokenEstimate = false;
        }
      }
    }
  } catch {
    // Graceful deterministic fallback — never breaks live demo
  }

  const modeFilteredActions =
    activeToolMode === "search"
      ? built.response.recommendedActions.slice(0, 1)
      : activeToolMode === "ask"
        ? built.response.recommendedActions.slice(0, 2)
        : built.response.recommendedActions;

  const enrichedCaveats = opts.uploadedDoc
    ? [
        `Uploaded file "${opts.uploadedDoc.name}" (${opts.uploadedDoc.sizeLabel}) evaluated alongside certified salon warehouse records.`,
        ...built.response.caveats,
      ]
    : built.response.caveats;

  const completedResponse: AIResponseContract = {
    ...built.response,
    title:
      activeAgentProduct === "AI Retention Manager" &&
      !built.response.title.toLowerCase().includes("retention")
        ? `Retention Intelligence · ${built.response.title}`
        : built.response.title,
    chartSubtitle:
      activeToolMode === "search"
        ? `Studio & Metric Search Results · ${built.response.chartSubtitle}`
        : built.response.chartSubtitle,
    summary: finalSummary,
    interpretation: finalInterpretation,
    recommendedActions: modeFilteredActions,
    caveats: enrichedCaveats,
    chatbotMode: activeChatbotMode,
    calculationDetails: {
      ...built.response.calculationDetails,
      executionSource,
      tokensUsed,
      estimatedCostUsd,
      latencyMs,
      isSimulatedTokenEstimate,
    },
  };

  // Store in scoped cache when no ad-hoc local file was attached
  if (!opts.uploadedDoc) {
    queryCacheService.put(cacheInput, completedResponse, tokensUsed);
  }

  return {
    response: completedResponse,
    nextContext: {
      lastTopicKey: topicKey,
      focusedSalonIds: built.focusedSalonIds,
      lastTimeRange: completedResponse.timeRange,
      turnCount: opts.context.turnCount + 1,
    },
    policyBlocked: false,
    policyWarningBanner: policyEval.warningBanner,
  };
}

function buildDeterministicResponse(params: {
  question: string;
  topicKey: AIResponseContract["topicKey"];
  personaId: PersonaId;
  scopedSalonIds: string[];
  allAuthorizedSalonIds: string[];
  filterWorstCount?: number;
  analysisMode: "fast" | "deep";
  dataVersion: number;
  sources: ReturnType<typeof getSourceSystems>;
  nowStamp: string;
}): { response: AIResponseContract; focusedSalonIds: string[] } {
  const {
    question,
    topicKey,
    personaId,
    scopedSalonIds,
    allAuthorizedSalonIds,
    filterWorstCount,
    dataVersion,
    sources,
    nowStamp,
  } = params;

  const persona = PERSONAS[personaId];
  const isExec = personaId === "meera";
  const comps = getSalonComparisons(scopedSalonIds, dataVersion);
  const allAuthComps = getSalonComparisons(allAuthorizedSalonIds, dataVersion);
  const agg = getScopeAggregateKPIs(scopedSalonIds, dataVersion);
  const regional = getRegionalSummaries(allAuthorizedSalonIds, dataVersion);
  const series6m = getMonthlySeriesForSalons(scopedSalonIds, 6, dataVersion);

  const scopeLabel =
    scopedSalonIds.length === 20
      ? "All 20 Salons · 4 Regions"
      : scopedSalonIds.length === 5 && persona.assignedRegion === "Pacific Northwest"
        ? "Pacific Northwest Region · 5 Salons"
        : `Filtered Selection (${scopedSalonIds.length} Salons: ${SALONS.filter((s) => scopedSalonIds.includes(s.id))
            .map((s) => s.name.split(" ")[0])
            .join(", ")})`;

  // 1. REPEAT VISITS DECLINE
  if (topicKey === "repeat_visits") {
    const ranked = [...comps].sort(
      (a, b) => a.repeatRateDeltaPts - b.repeatRateDeltaPts
    );
    const declining = ranked.filter((r) => r.repeatRateDeltaPts < -3);
    const focusIds =
      filterWorstCount && filterWorstCount > 0
        ? ranked.slice(0, filterWorstCount).map((r) => r.salon.id)
        : declining.length > 0
          ? declining.map((r) => r.salon.id)
          : ranked.slice(0, 3).map((r) => r.salon.id);

    const worst = ranked[0];
    const second = ranked[1];

    return {
      focusedSalonIds: focusIds,
      response: {
        id: `RESP-${Date.now()}`,
        question,
        title: filterWorstCount
          ? `Worst ${filterWorstCount} Salons by Repeat-Visit Decline (Last 30 Days)`
          : "Repeat-Visit Rate Variance by Salon (Last 30 Days vs 3-Month Baseline)",
        summary: filterWorstCount
          ? `Filtering to the ${filterWorstCount} steepest declines: ${worst.salon.name} fell ${formatSignedPts(worst.repeatRateDeltaPts)} to ${formatPct(worst.current.repeatVisitRate)}${second ? `, and ${second.salon.name} fell ${formatSignedPts(second.repeatRateDeltaPts)} to ${formatPct(second.current.repeatVisitRate)}` : ""}. Combined checkout rebooking across this subset dropped to ${formatPct((worst.current.rebookingRate + (second?.current.rebookingRate ?? worst.current.rebookingRate)) / (second ? 2 : 1))}.`
          : `Across ${scopeLabel}, ${declining.length} salons experienced material repeat-visit contraction over the last 30 days, led by ${worst.salon.name} (${formatPct(worst.current.repeatVisitRate)}, ${formatSignedPts(worst.repeatRateDeltaPts)} vs baseline) and ${second?.salon.name ?? "peer studios"} (${formatPct(second?.current.repeatVisitRate ?? 0)}, ${formatSignedPts(second?.repeatRateDeltaPts ?? 0)}). Regional average repeat-visit rate now stands at ${formatPct(agg.avgRepeatRate)} against a ${formatPct(agg.baselineRepeatRate)} baseline.`,
        executiveStyle: isExec,
        timeRange: "Last 30 Days (Oct 2026 vs May–Jul Baseline)",
        businessScope: scopeLabel,
        scopedSalonIds,
        topicKey,
        kpis: [
          {
            id: "k1",
            label: "Scoped Repeat-Visit Rate",
            currentValue: formatPct(agg.avgRepeatRate),
            baselineLabel: "3-Mo Baseline",
            baselineValue: formatPct(agg.baselineRepeatRate),
            varianceLabel: formatSignedPts(agg.repeatDeltaPts),
            varianceDirection: agg.repeatDeltaPts >= 0 ? "positive" : "negative",
            metricId: "repeat_visit_rate",
          },
          {
            id: "k2",
            label: `Steepest Drop (${worst.salon.name.split(" ")[0]})`,
            currentValue: formatPct(worst.current.repeatVisitRate),
            baselineLabel: "Salon Baseline",
            baselineValue: formatPct(worst.baseline3MoAvg.repeatVisitRate),
            varianceLabel: formatSignedPts(worst.repeatRateDeltaPts),
            varianceDirection: "negative",
            metricId: "repeat_visit_rate",
          },
          {
            id: "k3",
            label: "Avg Checkout Rebooking",
            currentValue: formatPct(
              comps.reduce((s, c) => s + c.current.rebookingRate, 0) /
                Math.max(1, comps.length)
            ),
            baselineLabel: "3-Mo Baseline",
            baselineValue: formatPct(
              comps.reduce((s, c) => s + c.baseline3MoAvg.rebookingRate, 0) /
                Math.max(1, comps.length)
            ),
            varianceLabel: formatSignedPts(
              comps.reduce((s, c) => s + c.rebookingDeltaPts, 0) /
                Math.max(1, comps.length)
            ),
            varianceDirection: "negative",
            metricId: "rebooking_rate",
          },
          {
            id: "k4",
            label: "Completed Paid Visits",
            currentValue: agg.completedVisits.toLocaleString(),
            baselineLabel: "Avg Ticket",
            baselineValue: `$${agg.avgTicket.toFixed(2)}`,
            varianceLabel: `${declining.length} salons flagged`,
            varianceDirection: declining.length > 0 ? "negative" : "neutral",
            metricId: "total_revenue",
          },
        ],
        chartType: "bar",
        chartTitle: "Repeat-Visit Rate: Current 30 Days vs Historical Baseline (%)",
        chartSubtitle: "Ranked from steepest repeat-visit contraction to strongest retention",
        chartData: ranked.map((r) => ({
          name: r.salon.name.replace(/ Studio| Atelier| Sanctuary| Spa| Lounge/g, ""),
          Current: r.current.repeatVisitRate,
          Baseline: r.baseline3MoAvg.repeatVisitRate,
          deltaPts: r.repeatRateDeltaPts,
        })),
        secondaryChartData: series6m.map((m) => ({
          name: m.monthLabel,
          "Repeat Rate %": m.repeatVisitRate,
          "Rebooking %": m.rebookingRate,
        })),
        tableColumns: [
          { key: "salon", header: "Salon" },
          { key: "region", header: "Region" },
          { key: "currentRepeat", header: "Current Repeat %", align: "right" },
          { key: "baseRepeat", header: "Baseline %", align: "right" },
          { key: "variance", header: "Variance", align: "right" },
          { key: "rebooking", header: "Rebooking %", align: "right" },
          { key: "interval", header: "Visit Interval", align: "right" },
        ],
        tableRows: ranked.map((r) => ({
          salon: r.salon.name,
          region: r.salon.region,
          currentRepeat: formatPct(r.current.repeatVisitRate),
          baseRepeat: formatPct(r.baseline3MoAvg.repeatVisitRate),
          variance: formatSignedPts(r.repeatRateDeltaPts),
          rebooking: formatPct(r.current.rebookingRate),
          interval: `${r.current.repeatVisitIntervalDays} days`,
        })),
        sourceFreshness: sources["SRC-WAREHOUSE-DAILY"],
        lastAnalysisTimestamp: nowStamp,
        anomaly: {
          detected: true,
          metricName: "Repeat-Visit Rate",
          affectedEntity: worst.salon.name,
          actualValue: formatPct(worst.current.repeatVisitRate),
          historicalBaseline: formatPct(worst.baseline3MoAvg.repeatVisitRate),
          absoluteDeviation: formatSignedPts(worst.repeatRateDeltaPts),
          percentageDeviation: formatSignedPct(
            (worst.repeatRateDeltaPts / worst.baseline3MoAvg.repeatVisitRate) * 100
          ),
          severity: "High",
          evidenceQuality: "High (Certified Daily Batch)",
        },
        interpretation:
          "Declining repeat visits are concentrated in three Pacific Northwest salons where front-desk checkout rebooking fell over the preceding 6–8 weeks, stretching average return intervals from ~41 days to 49+ days.",
        likelyDrivers: [
          `Checkout rebooking at ${worst.salon.name} dropped ${formatSignedPts(worst.rebookingDeltaPts)} (${formatPct(worst.current.rebookingRate)} vs ${formatPct(worst.baseline3MoAvg.rebookingRate)} baseline), strongly co-moving with lower 45-day return visits.`,
          `Capitol Hill Atelier experienced elevated 48-hour appointment cancellations (${formatPct(ranked.find((x) => x.salon.id === "SLN-PNW-02")?.current.cancellationRatePct ?? 15.2)}), disrupting habitual rebooking cycles.`,
          "Evening consultation slots (18:00–20:00) tightened on Thursdays and Fridays, delaying color-refresh rebookings.",
        ],
        recommendedActions: [
          {
            id: "ACT-REP-1",
            title: "Reinstate Stylist-Led Chairside Rebooking Prompts",
            rationale:
              "Restoring checkout rebooking toward the 57% historical baseline addresses the largest observed funnel drop-off.",
            expectedImpactDirection: "+3.5 to +5.5 pts checkout rebooking within 4 weeks",
            priority: "P1 - High",
            responsiblePersona: "Regional Manager & Salon Directors",
            requiredHumanApproval: "Regional Manager sign-off on front-desk script & KPI coaching",
            affectedSalonIds: focusIds,
          },
          {
            id: "ACT-REP-2",
            title: "Launch 45-Day Overdue Color & Cut Outreach Cohort",
            rationale:
              "Targets returning guests whose repeat interval stretched past 48 days without offering margin-eroding blanket discounts.",
            expectedImpactDirection: "Recover 85–130 overdue visits/month across 3 salons",
            priority: "P1 - High",
            responsiblePersona: "Regional Manager + CRM Retention Lead",
            requiredHumanApproval: "Approval of non-discounted priority booking message list",
            affectedSalonIds: focusIds,
          },
          {
            id: "ACT-REP-3",
            title: "Audit 48-Hour Cancellation Re-Booking Workflow at Capitol Hill",
            rationale:
              "Guests who cancel without immediate reschedule convert back at less than half the normal repeat rate.",
            expectedImpactDirection: "-2.5 pts unrecovered cancellation churn",
            priority: "P2 - Medium",
            responsiblePersona: "Salon Manager (Capitol Hill Atelier)",
            requiredHumanApproval: "Salon Manager review of SMS reschedule link timing",
            affectedSalonIds: ["SLN-PNW-02"],
          },
        ],
        caveats: [
          "Repeat-Visit Rate is reconciled once daily at 04:00 AM local time; intraday walk-ins from today are excluded until tonight's close.",
          "Observed correlation with checkout rebooking is strong, though local seasonal travel can also extend visit intervals.",
        ],
        followUpSuggestions: [
          "Why did that happen?",
          "Show only the worst two.",
          "What is the estimated financial impact?",
        ],
        calculationDetails: {
          kpiIds: ["kpi.repeat_visit_rate@v2.4", "kpi.rebooking_rate@v2.2"],
          formulaSummary:
            "Returning Paid Visits ÷ Total Completed Paid Visits compared against May–Jul 2026 3-month salon baseline.",
          validationChecks: [
            "Closed paid invoices reconciled against guest ID history",
            "Excluded complimentary redo appointments",
          ],
          executionSource: "Deterministic Engine (Fallback Narrative)",
          tokensUsed: 0,
          estimatedCostUsd: 0,
          latencyMs: 0,
          isSimulatedTokenEstimate: true,
        },
      },
    };
  }

  // 2. WHY ARE SALONS LOSING REPEAT CUSTOMERS? (FUNNEL + DRIVERS)
  if (topicKey === "repeat_drivers") {
    const funnel = buildRebookingFunnel(scopedSalonIds, dataVersion);
    const ranked = [...comps].sort(
      (a, b) => a.rebookingDeltaPts - b.rebookingDeltaPts
    );
    const worst = ranked[0];

    return {
      focusedSalonIds: scopedSalonIds,
      response: {
        id: `RESP-${Date.now()}`,
        question,
        title: "Root-Indicator Diagnostic: Checkout Rebooking & Cancellation Funnel",
        summary: `Diagnostic analysis across ${scopeLabel} shows the primary breakdown occurs between service completion and checkout rebooking: only ${formatPct(funnel[2].conversionPct)} of guests leave with their next appointment booked versus the ${formatPct(funnel[2].benchmarkPct)} benchmark. Compounded by ${formatPct(worst.current.cancellationRatePct)} late cancellations in affected studios, average repeat-visit intervals lengthened to ${worst.current.repeatVisitIntervalDays} days.`,
        executiveStyle: isExec,
        timeRange: "Last 30 Days Operational Funnel + 6-Month Co-Movement",
        businessScope: scopeLabel,
        scopedSalonIds,
        topicKey,
        kpis: [
          {
            id: "d1",
            label: "Checkout Rebooking Rate",
            currentValue: formatPct(funnel[2].conversionPct),
            baselineLabel: "Org Benchmark",
            baselineValue: formatPct(funnel[2].benchmarkPct),
            varianceLabel: formatSignedPts(
              funnel[2].conversionPct - funnel[2].benchmarkPct
            ),
            varianceDirection: "negative",
            metricId: "rebooking_rate",
          },
          {
            id: "d2",
            label: "Retained Bookings (Post-Cancel)",
            currentValue: formatPct(funnel[3].conversionPct),
            baselineLabel: "Org Benchmark",
            baselineValue: formatPct(funnel[3].benchmarkPct),
            varianceLabel: formatSignedPts(
              funnel[3].conversionPct - funnel[3].benchmarkPct
            ),
            varianceDirection: "negative",
            metricId: "cancellation_rate",
          },
          {
            id: "d3",
            label: "Avg Repeat Interval",
            currentValue: `${Math.round(
              comps.reduce((s, c) => s + c.current.repeatVisitIntervalDays, 0) /
                Math.max(1, comps.length)
            )} days`,
            baselineLabel: "Healthy Target",
            baselineValue: "42 days",
            varianceLabel: "+8 days stretch",
            varianceDirection: "negative",
            metricId: "repeat_visit_rate",
          },
          {
            id: "d4",
            label: "60-Day Repeat Conversion",
            currentValue: formatPct(funnel[4].conversionPct),
            baselineLabel: "Org Benchmark",
            baselineValue: formatPct(funnel[4].benchmarkPct),
            varianceLabel: formatSignedPts(
              funnel[4].conversionPct - funnel[4].benchmarkPct
            ),
            varianceDirection: "negative",
            metricId: "repeat_visit_rate",
          },
        ],
        chartType: "funnel",
        chartTitle: "Guest Retention & Rebooking Conversion Funnel",
        chartSubtitle: "Comparing scoped salon cohort conversion against 20-salon benchmark",
        chartData: funnel.map((f) => ({
          name: f.stage,
          "Actual %": f.conversionPct,
          "Benchmark %": f.benchmarkPct,
          guests: f.guests,
        })),
        funnelData: funnel,
        tableColumns: [
          { key: "salon", header: "Salon" },
          { key: "rebookNow", header: "Rebooking %", align: "right" },
          { key: "rebookDrop", header: "Rebook Delta", align: "right" },
          { key: "cancelPct", header: "Cancel %", align: "right" },
          { key: "interval", header: "Repeat Interval", align: "right" },
        ],
        tableRows: ranked.map((r) => ({
          salon: r.salon.name,
          rebookNow: formatPct(r.current.rebookingRate),
          rebookDrop: formatSignedPts(r.rebookingDeltaPts),
          cancelPct: formatPct(r.current.cancellationRatePct),
          interval: `${r.current.repeatVisitIntervalDays} days`,
        })),
        sourceFreshness: sources["SRC-BOOKING-STREAM"],
        lastAnalysisTimestamp: nowStamp,
        anomaly: {
          detected: true,
          metricName: "Checkout Rebooking Conversion",
          affectedEntity: worst.salon.name,
          actualValue: formatPct(worst.current.rebookingRate),
          historicalBaseline: formatPct(worst.baseline3MoAvg.rebookingRate),
          absoluteDeviation: formatSignedPts(worst.rebookingDeltaPts),
          percentageDeviation: formatSignedPct(
            (worst.rebookingDeltaPts / worst.baseline3MoAvg.rebookingRate) * 100
          ),
          severity: "High",
          evidenceQuality: "High (Certified Daily Batch)",
        },
        interpretation:
          "Service satisfaction tickets and average spend remained stable, indicating guests are not churning over pricing—instead, operational friction at checkout and unrescheduled cancellations are driving passive lapse.",
        likelyDrivers: [
          "Front-desk express mobile checkout adoption rose without an embedded 'Book Next 6-Week Visit' prompt.",
          "Two senior stylists in Bellevue & Capitol Hill shifted schedules, leaving returning guests unable to find Thursday/Friday evening slots.",
          "Automated 48h cancellation confirmations lacked a one-tap reschedule calendar link.",
        ],
        recommendedActions: [
          {
            id: "ACT-DRV-1",
            title: "Enable Mandatory Rebooking Prompt on Stylist Tablet Closeout",
            rationale:
              "Captures next booking chairside before the guest reaches express payment.",
            expectedImpactDirection: "+8 to +12 pts rebooking conversion",
            priority: "P1 - High",
            responsiblePersona: "Regional Manager",
            requiredHumanApproval: "Approve POS tablet workflow toggle with Salon Managers",
            affectedSalonIds: scopedSalonIds,
          },
          {
            id: "ACT-DRV-2",
            title: "Reallocate 12 Peak Evening Stylist Hours in Bellevue & Capitol Hill",
            rationale:
              "Unblocks returning color/cut guests seeking Thu/Fri 17:00–20:00 appointments.",
            expectedImpactDirection: "+35–50 retained monthly appointments",
            priority: "P2 - Medium",
            responsiblePersona: "Salon Managers",
            requiredHumanApproval: "Stylist roster shift agreement",
            affectedSalonIds: scopedSalonIds,
          },
        ],
        caveats: [
          "Stylist chairside recommendation step (Stage 2) is inferred from consultation notes logged on closed invoices.",
        ],
        followUpSuggestions: [
          "Show only the worst two.",
          "What should I do to improve repeat visits?",
          "Show the estimated financial impact of these opportunities.",
        ],
        calculationDetails: {
          kpiIds: [
            "kpi.rebooking_rate@v2.2",
            "kpi.cancellation_rate@v1.9",
            "kpi.repeat_visit_rate@v2.4",
          ],
          formulaSummary:
            "5-stage cohort funnel linking Completed Visits -> Consultation Note -> 24h Rebook -> Kept Booking -> 60-Day Return.",
          validationChecks: [
            "Cross-checked operational booking stream with closed daily invoices",
          ],
          executionSource: "Deterministic Engine (Fallback Narrative)",
          tokensUsed: 0,
          estimatedCostUsd: 0,
          latencyMs: 0,
          isSimulatedTokenEstimate: true,
        },
      },
    };
  }

  // 3. REVENUE BY SALON FOR LAST 6 MONTHS (STACKED BAR / LINE)
  if (topicKey === "revenue_6m") {
    const rankedRev = [...comps].sort(
      (a, b) => b.current.totalRevenue - a.current.totalRevenue
    );
    return {
      focusedSalonIds: scopedSalonIds,
      response: {
        id: `RESP-${Date.now()}`,
        question,
        title: "Service, Retail & Membership Net Revenue Performance (Last 6 Months)",
        summary: `Over the past six months, ${scopeLabel} generated ${formatCurrency(series6m.reduce((s, m) => s + m.totalRevenue, 0))} in cumulative net revenue, with October reaching ${formatCurrency(agg.totalRevenue)} (${formatSignedPct(agg.revGrowthMoMPct)} vs September). Service revenue accounts for ${formatPct((agg.serviceRevenue / Math.max(1, agg.totalRevenue)) * 100)} of total sales while retail contributes ${formatCurrency(agg.retailRevenue)}.`,
        executiveStyle: isExec,
        timeRange: "May 2026 – Oct 2026 (6 Completed Months)",
        businessScope: scopeLabel,
        scopedSalonIds,
        topicKey,
        kpis: [
          {
            id: "r1",
            label: "Oct Total Net Revenue",
            currentValue: formatCurrency(agg.totalRevenue),
            baselineLabel: "Sep 2026",
            baselineValue: formatCurrency(agg.priorRevenue),
            varianceLabel: formatSignedPct(agg.revGrowthMoMPct),
            varianceDirection: agg.revGrowthMoMPct >= 0 ? "positive" : "negative",
            metricId: "total_revenue",
          },
          {
            id: "r2",
            label: "Oct Service Revenue",
            currentValue: formatCurrency(agg.serviceRevenue),
            baselineLabel: "Share of Total",
            baselineValue: formatPct(
              (agg.serviceRevenue / Math.max(1, agg.totalRevenue)) * 100
            ),
            varianceLabel: "Core Service Line",
            varianceDirection: "neutral",
            metricId: "total_revenue",
          },
          {
            id: "r3",
            label: "Oct Retail Revenue",
            currentValue: formatCurrency(agg.retailRevenue),
            baselineLabel: "Avg Attach Rate",
            baselineValue: formatPct(
              comps.reduce((s, c) => s + c.current.retailAttachmentPct, 0) /
                Math.max(1, comps.length)
            ),
            varianceLabel: "POS Retail Sync",
            varianceDirection: "neutral",
            metricId: "retail_attachment",
          },
          {
            id: "r4",
            label: "Estimated Contribution",
            currentValue: formatCurrency(agg.contributionDollars),
            baselineLabel: "Contribution Margin",
            baselineValue: formatPct(agg.contributionMarginPct),
            varianceLabel: `$${agg.avgTicket.toFixed(2)} avg ticket`,
            varianceDirection: "positive",
            metricId: "contribution_margin",
          },
        ],
        chartType: "stacked-bar",
        chartTitle: "Monthly Revenue Mix: Service vs Retail Revenue ($)",
        chartSubtitle: "6-month trajectory across authorized salon scope",
        chartData: series6m.map((m) => ({
          name: m.monthLabel,
          Service: m.serviceRevenue,
          Retail: m.retailRevenue,
          Total: m.totalRevenue,
        })),
        tableColumns: [
          { key: "salon", header: "Salon" },
          { key: "serviceRev", header: "Oct Service", align: "right" },
          { key: "retailRev", header: "Oct Retail", align: "right" },
          { key: "totalRev", header: "Oct Total", align: "right" },
          { key: "vsTarget", header: "vs Target", align: "right" },
          { key: "margin", header: "Contrib. Margin", align: "right" },
        ],
        tableRows: rankedRev.map((r) => ({
          salon: r.salon.name,
          serviceRev: formatCurrency(r.current.serviceRevenue),
          retailRev: formatCurrency(r.current.retailRevenue),
          totalRev: formatCurrency(r.current.totalRevenue),
          vsTarget: formatCurrency(r.targetVarianceDollars),
          margin: formatPct(r.current.contributionMarginPct),
        })),
        sourceFreshness: sources["SRC-WAREHOUSE-DAILY"],
        lastAnalysisTimestamp: nowStamp,
        anomaly:
          rankedRev.some((r) => r.targetVarianceDollars < -4000)
            ? {
                detected: true,
                metricName: "Monthly Revenue vs Target",
                affectedEntity: rankedRev.sort(
                  (a, b) => a.targetVarianceDollars - b.targetVarianceDollars
                )[0].salon.name,
                actualValue: formatCurrency(
                  rankedRev.sort(
                    (a, b) => a.targetVarianceDollars - b.targetVarianceDollars
                  )[0].current.totalRevenue
                ),
                historicalBaseline: formatCurrency(
                  rankedRev.sort(
                    (a, b) => a.targetVarianceDollars - b.targetVarianceDollars
                  )[0].salon.monthlyRevenueTarget
                ),
                absoluteDeviation: formatCurrency(
                  rankedRev.sort(
                    (a, b) => a.targetVarianceDollars - b.targetVarianceDollars
                  )[0].targetVarianceDollars
                ),
                percentageDeviation: "-6.8%",
                severity: "Moderate",
                evidenceQuality: "High (Certified Daily Batch)",
              }
            : null,
        interpretation:
          "Seasonal summer strength peaked in June before softening in September and October primarily in studios experiencing repeat-visit slippage and low retail take-home conversion.",
        likelyDrivers: [
          "Repeat-visit contraction in Pacific Northwest studios reduced high-ticket color maintenance volume.",
          "Retail product attachment below 12% in select studios dampened average ticket expansion.",
        ],
        recommendedActions: [
          {
            id: "ACT-REV-1",
            title: "Target Mid-Week Chair Gaps With Returning Membership Perks",
            rationale:
              "Converts existing member credits into completed service visits without discounting core menu rates.",
            expectedImpactDirection: "+$9,500 to +$14,000 monthly scoped revenue",
            priority: "P2 - Medium",
            responsiblePersona: "Regional Manager",
            requiredHumanApproval: "Approve member perk eligibility window",
            affectedSalonIds: scopedSalonIds,
          },
        ],
        caveats: [
          "October figures represent closed 30-day rolling batch window updated at 04:00 AM.",
        ],
        followUpSuggestions: [
          "Which salons are at risk of missing revenue targets?",
          "Where did retail product sales decline this month?",
          "Which salons have the highest unused stylist capacity?",
        ],
        calculationDetails: {
          kpiIds: ["kpi.total_revenue@v3.1", "kpi.contribution_margin@v3.0"],
          formulaSummary:
            "Sum of net service, retail, and recognized membership revenue across 6 monthly closes.",
          validationChecks: ["Reconciled POS net totals with daily financial batch"],
          executionSource: "Deterministic Engine (Fallback Narrative)",
          tokensUsed: 0,
          estimatedCostUsd: 0,
          latencyMs: 0,
          isSimulatedTokenEstimate: true,
        },
      },
    };
  }

  // 4. UNUSED STYLIST CAPACITY / UTILIZATION HEATMAP
  if (topicKey === "unused_capacity" || topicKey === "coo_capacity_loss") {
    const rankedUnused = [...comps].sort(
      (a, b) => b.unusedHoursCurrent - a.unusedHoursCurrent
    );
    const heatmap = buildUtilizationHeatmap(scopedSalonIds, dataVersion);
    const worstUtil = rankedUnused[0];

    return {
      focusedSalonIds: rankedUnused.slice(0, 3).map((r) => r.salon.id),
      response: {
        id: `RESP-${Date.now()}`,
        question,
        title: "Stylist Roster Utilization & Unused Capacity Heatmap",
        summary: `Across ${scopeLabel}, ${agg.unusedHours.toLocaleString()} rostered stylist hours went unutilized in the last 30 days (average utilization ${formatPct(agg.utilizationPct)} vs ${formatPct(agg.baselineUtilizationPct)} baseline). Unused capacity is concentrated on Monday–Wednesday mornings (09:00–12:00), led by ${worstUtil.salon.name} (${worstUtil.unusedHoursCurrent} unused hours, ${formatPct(worstUtil.current.staffUtilizationPct)} utilization).`,
        executiveStyle: isExec,
        timeRange: "Last 30 Days Roster & Appointment Stream",
        businessScope: scopeLabel,
        scopedSalonIds,
        topicKey,
        kpis: [
          {
            id: "u1",
            label: "Scoped Stylist Utilization",
            currentValue: formatPct(agg.utilizationPct),
            baselineLabel: "3-Mo Baseline",
            baselineValue: formatPct(agg.baselineUtilizationPct),
            varianceLabel: formatSignedPts(agg.utilizationDeltaPts),
            varianceDirection:
              agg.utilizationDeltaPts >= 0 ? "positive" : "negative",
            metricId: "staff_utilization",
          },
          {
            id: "u2",
            label: "Total Unused Stylist Hours",
            currentValue: `${agg.unusedHours.toLocaleString()} hrs`,
            baselineLabel: "Highest Gap Salon",
            baselineValue: worstUtil.salon.name.split(" ")[0],
            varianceLabel: `${worstUtil.unusedHoursCurrent} hrs open`,
            varianceDirection: "negative",
            metricId: "staff_utilization",
          },
          {
            id: "u3",
            label: "Revenue per Available Hour",
            currentValue: `$${(
              comps.reduce(
                (s, c) => s + c.current.revenuePerAvailableHour,
                0
              ) / Math.max(1, comps.length)
            ).toFixed(2)}`,
            baselineLabel: "Org Top Quartile",
            baselineValue: "$49.50",
            varianceLabel: "Yield gap on Mon–Wed",
            varianceDirection: "negative",
            metricId: "rev_per_available_hour",
          },
          {
            id: "u4",
            label: "Late Cancellation Drag",
            currentValue: formatPct(
              comps.reduce((s, c) => s + c.current.cancellationRatePct, 0) /
                Math.max(1, comps.length)
            ),
            baselineLabel: "Target Threshold",
            baselineValue: "< 8.5%",
            varianceLabel: "Unfilled 48h slots",
            varianceDirection: "negative",
            metricId: "cancellation_rate",
          },
        ],
        chartType: "heatmap",
        chartTitle: "Stylist Utilization % by Day of Week and Time Block",
        chartSubtitle: "Operational schedule density highlighting Mon–Wed morning underutilization",
        chartData: rankedUnused.slice(0, 8).map((r) => ({
          name: r.salon.name.split(" ").slice(0, 2).join(" "),
          "Utilization %": r.current.staffUtilizationPct,
          "Baseline %": r.baseline3MoAvg.staffUtilizationPct,
        })),
        heatmapData: heatmap,
        tableColumns: [
          { key: "salon", header: "Salon" },
          { key: "region", header: "Region" },
          { key: "avail", header: "Available Hrs", align: "right" },
          { key: "utilHrs", header: "Utilized Hrs", align: "right" },
          { key: "unused", header: "Unused Hrs", align: "right" },
          { key: "utilPct", header: "Utilization %", align: "right" },
          { key: "revPah", header: "RevPAH", align: "right" },
        ],
        tableRows: rankedUnused.map((r) => ({
          salon: r.salon.name,
          region: r.salon.region,
          avail: r.current.availableStylistHours.toLocaleString(),
          utilHrs: r.current.utilizedStylistHours.toLocaleString(),
          unused: r.unusedHoursCurrent.toLocaleString(),
          utilPct: formatPct(r.current.staffUtilizationPct),
          revPah: `$${r.current.revenuePerAvailableHour.toFixed(2)}`,
        })),
        sourceFreshness: sources["SRC-BOOKING-STREAM"],
        lastAnalysisTimestamp: nowStamp,
        anomaly: {
          detected: true,
          metricName: "Stylist Utilization %",
          affectedEntity: "Pacific Northwest Region",
          actualValue: formatPct(
            regional.find((r) => r.region === "Pacific Northwest")
              ?.avgStaffUtilizationPct ?? agg.utilizationPct
          ),
          historicalBaseline: "72.8%",
          absoluteDeviation: "-13.6 pts",
          percentageDeviation: "-18.7%",
          severity: "High",
          evidenceQuality: "High (Certified Daily Batch)",
        },
        interpretation:
          "Pacific Northwest roster templates kept summer Monday/Tuesday morning shifts unchanged while autumn demand shifted heavily toward Thursday–Saturday afternoons.",
        likelyDrivers: [
          "Static 8-hour morning shift blocks on Mondays and Tuesdays despite <50% booking density.",
          "Elevated 48-hour cancellations at Capitol Hill Atelier & Austin Domain leaving fragmented 45-minute gaps.",
        ],
        recommendedActions: [
          {
            id: "ACT-CAP-1",
            title: "Shift 8% of Mon–Tue Morning Roster Hours to Thu–Sat Peak Blocks",
            rationale:
              "Aligns existing paid stylist hours with high-waitlist evening and weekend demand without adding payroll.",
            expectedImpactDirection: "+5.0 to +7.5 pts regional utilization",
            priority: "P1 - High",
            responsiblePersona: "Regional Manager & Salon Managers",
            requiredHumanApproval: "2-week advance roster notice & stylist sign-off",
            affectedSalonIds: rankedUnused.slice(0, 5).map((r) => r.salon.id),
          },
          {
            id: "ACT-CAP-2",
            title: "Enable Automated Waitlist Backfill for <48h Cancellations",
            rationale:
              "Fills sudden mid-day cancellations automatically from opted-in guests.",
            expectedImpactDirection: "Recover 25–40 cancelled hours/month",
            priority: "P2 - Medium",
            responsiblePersona: "Salon Operations Lead",
            requiredHumanApproval: "Approve SMS waitlist notification window",
            affectedSalonIds: ["SLN-PNW-02", "SLN-SW-02"],
          },
        ],
        caveats: [
          "Available hours reflect scheduled clock-in blocks excluding statutory breaks and training hours.",
        ],
        followUpSuggestions: [
          "Which salons are at risk of missing revenue targets?",
          "Show the estimated financial impact of these opportunities.",
          "Which salons should I prioritize this week?",
        ],
        calculationDetails: {
          kpiIds: [
            "kpi.staff_utilization@v2.0",
            "kpi.rev_per_available_hour@v1.8",
          ],
          formulaSummary:
            "Utilized Service Hours ÷ Rostered Available Stylist Hours segmented across 7 days × 4 dayparts.",
          validationChecks: ["Operational roster sync verified (<30m lag)"],
          executionSource: "Deterministic Engine (Fallback Narrative)",
          tokensUsed: 0,
          estimatedCostUsd: 0,
          latencyMs: 0,
          isSimulatedTokenEstimate: true,
        },
      },
    };
  }

  // 5. RETAIL PRODUCT SALES DECLINE (INCLUDES STALE POS WARNING!)
  if (topicKey === "retail_decline") {
    const rankedRetail = [...comps].sort(
      (a, b) => a.current.retailAttachmentPct - b.current.retailAttachmentPct
    );
    const posSource = sources["SRC-POS-RETAIL"];
    const worstRet = rankedRetail[0];

    return {
      focusedSalonIds: rankedRetail.slice(0, 3).map((r) => r.salon.id),
      response: {
        id: `RESP-${Date.now()}`,
        question,
        title: "Retail Product Sales & Take-Home Attachment Analysis",
        summary: `${posSource.status === "Stale" ? "DATA FRESHNESS CAUTION: POS Retail Ledger Sync is currently 39.5 hours old (exceeding its 24h SLA), so recent terminal uploads from Fremont Urban Lounge are incomplete. " : ""}Based on reconciled invoices through ${posSource.dataThroughTimestamp}, retail attachment is lowest at ${worstRet.salon.name} (${formatPct(worstRet.current.retailAttachmentPct)} vs ${formatPct(worstRet.baseline3MoAvg.retailAttachmentPct)} baseline, ${formatSignedPct(worstRet.retailRevenueDeltaPct)} retail revenue variance).`,
        executiveStyle: isExec,
        timeRange: "Last 30 Days Reconciled POS Retail Batch",
        businessScope: scopeLabel,
        scopedSalonIds,
        topicKey,
        kpis: [
          {
            id: "rt1",
            label: "Scoped Retail Revenue",
            currentValue: formatCurrency(agg.retailRevenue),
            baselineLabel: "POS Completeness",
            baselineValue: `${posSource.completenessPct}%`,
            varianceLabel:
              posSource.status === "Stale" ? "Stale POS Sync" : "Verified Fresh",
            varianceDirection:
              posSource.status === "Stale" ? "negative" : "positive",
            metricId: "retail_attachment",
          },
          {
            id: "rt2",
            label: "Lowest Attach Salon",
            currentValue: formatPct(worstRet.current.retailAttachmentPct),
            baselineLabel: worstRet.salon.name.split(" ")[0],
            baselineValue: formatPct(worstRet.baseline3MoAvg.retailAttachmentPct),
            varianceLabel: formatSignedPct(worstRet.retailRevenueDeltaPct),
            varianceDirection: "negative",
            metricId: "retail_attachment",
          },
          {
            id: "rt3",
            label: "Scoped Avg Attach Rate",
            currentValue: formatPct(
              comps.reduce((s, c) => s + c.current.retailAttachmentPct, 0) /
                Math.max(1, comps.length)
            ),
            baselineLabel: "Org Peer Target",
            baselineValue: "19.5%",
            varianceLabel: "Take-home SKU rate",
            varianceDirection: "negative",
            metricId: "retail_attachment",
          },
          {
            id: "rt4",
            label: "Retail Source Age",
            currentValue: `${posSource.ageHours}h`,
            baselineLabel: "SLA Limit",
            baselineValue: `${posSource.slaHours}h`,
            varianceLabel: posSource.status,
            varianceDirection:
              posSource.status === "Stale" ? "negative" : "positive",
            metricId: "retail_attachment",
          },
        ],
        chartType: "bar",
        chartTitle: "Retail Attachment Rate % by Salon (Current vs Baseline)",
        chartSubtitle:
          posSource.status === "Stale"
            ? "Caution: POS Retail Sync lagging by 39.5h — verify terminal upload before commission changes"
            : "All POS retail terminals reconciled within 24h SLA",
        chartData: rankedRetail.slice(0, 10).map((r) => ({
          name: r.salon.name.split(" ").slice(0, 2).join(" "),
          "Current Attach %": r.current.retailAttachmentPct,
          "Baseline %": r.baseline3MoAvg.retailAttachmentPct,
        })),
        tableColumns: [
          { key: "salon", header: "Salon" },
          { key: "attach", header: "Retail Attach %", align: "right" },
          { key: "baseAttach", header: "Baseline %", align: "right" },
          { key: "retailRev", header: "Retail Revenue", align: "right" },
          { key: "revDelta", header: "vs Baseline", align: "right" },
        ],
        tableRows: rankedRetail.map((r) => ({
          salon: r.salon.name,
          attach: formatPct(r.current.retailAttachmentPct),
          baseAttach: formatPct(r.baseline3MoAvg.retailAttachmentPct),
          retailRev: formatCurrency(r.current.retailRevenue),
          revDelta: formatSignedPct(r.retailRevenueDeltaPct),
        })),
        sourceFreshness: posSource,
        lastAnalysisTimestamp: nowStamp,
        anomaly: {
          detected: true,
          metricName: "Retail Attachment Rate",
          affectedEntity: worstRet.salon.name,
          actualValue: formatPct(worstRet.current.retailAttachmentPct),
          historicalBaseline: formatPct(
            worstRet.baseline3MoAvg.retailAttachmentPct
          ),
          absoluteDeviation: formatSignedPts(
            worstRet.current.retailAttachmentPct -
              worstRet.baseline3MoAvg.retailAttachmentPct
          ),
          percentageDeviation: formatSignedPct(worstRet.retailRevenueDeltaPct),
          severity: "Moderate",
          evidenceQuality:
            posSource.status === "Stale"
              ? "Cautious (Stale POS Source)"
              : "High (Certified Daily Batch)",
        },
        interpretation:
          posSource.status === "Stale"
            ? "While multi-week retail attachment clearly trails baseline in Fremont and Pearl District, the last 39.5 hours of POS SKU batch data have not synced—InsightFlow withholds automated target penalties until sync completes."
            : "With POS terminal sync refreshed, low retail attachment is confirmed in Fremont Urban Lounge and Pearl District Sanctuary due to stockouts on top bond-repair SKUs.",
        likelyDrivers: [
          "Inventory replenishment lag on top 5 hero haircare SKUs in urban studios.",
          "Express checkout flow skips stylist product recommendation cards.",
          posSource.status === "Stale"
            ? "Fremont terminal batch upload delayed (91.5% completeness); confirm sync in Settings before final monthly close."
            : "All POS retail terminals verified current.",
        ],
        recommendedActions: [
          {
            id: "ACT-RET-1",
            title:
              posSource.status === "Stale"
                ? "Refresh POS Retail Terminal Sync Before Issuing Store Targets"
                : "Replenish Top 5 Hero SKUs & Enable Service-Matched Product Prompts",
            rationale:
              posSource.status === "Stale"
                ? "Governance policy prohibits high-confidence operational interventions on stale source feeds."
                : "Restores take-home attachment on color and treatment visits.",
            expectedImpactDirection: "+4.0 to +6.0 pts retail attachment once verified",
            priority: posSource.status === "Stale" ? "P2 - Medium" : "P1 - High",
            responsiblePersona: "Regional Manager & Inventory Coordinator",
            requiredHumanApproval: "Verify POS batch sync & inventory count",
            affectedSalonIds: rankedRetail.slice(0, 3).map((r) => r.salon.id),
          },
        ],
        caveats: [
          posSource.status === "Stale"
            ? "WARNING: POS Retail SKU & Discount Ledger Sync is 39.5 hours old (SLA: 24h). Treat last-48h retail figures as preliminary."
            : "POS Retail Sync verified within 24h SLA.",
        ],
        followUpSuggestions: [
          "Which salons are at risk of missing revenue targets?",
          "Which salons had the biggest decline in repeat visits in the last 30 days?",
          "Show the estimated financial impact of these opportunities.",
        ],
        calculationDetails: {
          kpiIds: ["kpi.retail_attachment@v2.1", "kpi.total_revenue@v3.1"],
          formulaSummary:
            "Invoices containing ≥1 retail SKU ÷ Completed Paid Visits.",
          validationChecks: [
            posSource.status === "Stale"
              ? "STALE SOURCE WARNING FLAGGED: completeness 91.5%"
              : "Completeness check passed (99.6%)",
          ],
          executionSource: "Deterministic Engine (Fallback Narrative)",
          tokensUsed: 0,
          estimatedCostUsd: 0,
          latencyMs: 0,
          isSimulatedTokenEstimate: true,
        },
      },
    };
  }

  // 6. COO PROFITABILITY / MARGIN COMPRESSION (SCOTTSDALE + REGIONAL COMPARISON)
  if (
    topicKey === "coo_profitability" ||
    topicKey === "coo_monthly_perf" ||
    topicKey === "coo_exec_actions" ||
    topicKey === "coo_confidence" ||
    topicKey === "coo_interventions"
  ) {
    const regSortedByMargin = [...regional].sort(
      (a, b) => a.avgContributionMarginPct - b.avgContributionMarginPct
    );
    const scottsdale = allAuthComps.find((c) => c.salon.id === "SLN-SW-01");
    const totalRisk = regional.reduce((s, r) => s + r.revenueAtRiskDollars, 0);
    const sensitivity = computeIllustrativeValueScenarios();
    const refCase = sensitivity[1]; // 0.50% uplift -> $102,600 sales, $35,910 contribution

    if (topicKey === "coo_interventions") {
      return {
        focusedSalonIds: ["SLN-NE-02", "SLN-MW-03", "SLN-PNW-01"],
        response: {
          id: `RESP-${Date.now()}`,
          question,
          title: "Executive Outcome Review: Validated Retention Interventions & Illustrative Value",
          summary: `Completed chairside rebooking pilots in Back Bay Newbury Spa and Edina Galleria Salon delivered +3.8 pts repeat-visit lift over matched holdout salons (+$14,200 validated net contribution across 8 weeks). Scaled across all 20 salons (216,000 annual visits at $95 ticket), a conservative 0.50% relative uplift models to 1,080 incremental visits, $102,600 additional sales, and $35,910 net contribution at 35% margin.`,
          executiveStyle: true,
          timeRange: "Q3–Q4 Intervention Cohort + Annualized 20-Salon Sensitivity",
          businessScope: scopeLabel,
          scopedSalonIds,
          topicKey,
          kpis: [
            {
              id: "iv1",
              label: "Validated Pilot Net Lift",
              currentValue: "+$14,200",
              baselineLabel: "Holdout Comparison",
              baselineValue: "+3.8 pts repeat",
              varianceLabel: "2 Completed Pilots",
              varianceDirection: "positive",
              metricId: "contribution_margin",
            },
            {
              id: "iv2",
              label: "0.50% Org Illustrative Sales",
              currentValue: formatCurrency(refCase.additionalAnnualSalesDollars),
              baselineLabel: "216,000 Annual Visits",
              baselineValue: "+1,080 visits",
              varianceLabel: "Hypothetical Scenario",
              varianceDirection: "positive",
              metricId: "total_revenue",
            },
            {
              id: "iv3",
              label: "0.50% Illustrative Contribution",
              currentValue: formatCurrency(
                refCase.additionalAnnualContributionDollars
              ),
              baselineLabel: "At 35% Margin",
              baselineValue: "$95 Avg Ticket",
              varianceLabel: "Before rollout fees",
              varianceDirection: "positive",
              metricId: "contribution_margin",
            },
            {
              id: "iv4",
              label: "Manager Time Saved",
              currentValue: "4.5 hrs/wk",
              baselineLabel: "Per Regional Lead",
              baselineValue: "Automated KPI prep",
              varianceLabel: "18 hrs/mo per region",
              varianceDirection: "positive",
              metricId: "staff_utilization",
            },
          ],
          chartType: "bar",
          chartTitle: "20-Salon Annual Sensitivity Model: Incremental Sales vs Net Contribution ($)",
          chartSubtitle: "Illustrative scenarios (0.25%, 0.50%, 1.00% relative visit uplift) — not a guaranteed forecast",
          chartData: sensitivity.map((s) => ({
            name: `${s.upliftPct.toFixed(2)}% Uplift`,
            "Incremental Sales": s.additionalAnnualSalesDollars,
            "Additional Contribution (35%)": s.additionalAnnualContributionDollars,
          })),
          tableColumns: [
            { key: "scenario", header: "Illustrative Uplift Scenario" },
            { key: "incVisits", header: "Incremental Visits", align: "right" },
            { key: "incSales", header: "Additional Sales", align: "right" },
            { key: "incContrib", header: "Gross Contribution (35%)", align: "right" },
            { key: "steadyNet", header: "Steady-State Net", align: "right" },
          ],
          tableRows: sensitivity.map((s) => ({
            scenario: s.label,
            incVisits: s.incrementalCompletedVisits.toLocaleString(),
            incSales: formatCurrency(s.additionalAnnualSalesDollars),
            incContrib: formatCurrency(s.additionalAnnualContributionDollars),
            steadyNet: formatCurrency(s.modeledSteadyStateNetDollars),
          })),
          sourceFreshness: sources["SRC-WAREHOUSE-DAILY"],
          lastAnalysisTimestamp: nowStamp,
          anomaly: null,
          interpretation:
            "Insights alone do not create revenue: financial lift materialized only where salon managers executed chairside rebooking coaching and held promotional discounting flat relative to holdout salons.",
          likelyDrivers: [
            "Non-discounted priority rebooking outreach preserved full 35%+ contribution margin.",
            "Matched holdout salons controlled for seasonal October demand shifts.",
          ],
          recommendedActions: [
            {
              id: "ACT-COO-IV1",
              title: "Scale Validated Chairside Rebooking Playbook to 3 Declining PNW Salons",
              rationale:
                "Applies proven non-discounted workflow to Bellevue, Capitol Hill, and Pearl District with matched holdout tracking.",
              expectedImpactDirection: "+$4,800 to +$7,200 monthly net contribution",
              priority: "P1 - High",
              responsiblePersona: "Regional Operations Manager (PNW)",
              requiredHumanApproval: "COO & Regional Manager holdout protocol sign-off",
              affectedSalonIds: ["SLN-PNW-01", "SLN-PNW-02", "SLN-PNW-03"],
            },
          ],
          caveats: [
            "The 0.25% / 0.50% / 1.00% table is a transparent sensitivity model, not a prediction or achieved org-wide result.",
            "First-year rollout economics include $6,500 one-time enablement cost in addition to annual platform licensing.",
          ],
          followUpSuggestions: [
            "Where should I focus to improve profitability this quarter?",
            "How confident should I be in these recommendations?",
            "Which actions should I prioritize in the next executive review?",
          ],
          calculationDetails: {
            kpiIds: [
              "kpi.total_revenue@v3.1",
              "kpi.contribution_margin@v3.0",
              "kpi.repeat_visit_rate@v2.4",
            ],
            formulaSummary:
              "20 salons × 900 visits/mo × 12 mos = 216,000 visits × $95 ticket × uplift % × 35% contribution margin.",
            validationChecks: [
              "Verified pilot holdout baseline parity",
              "Separated steady-state license from Year-1 rollout cost",
            ],
            executionSource: "Deterministic Engine (Fallback Narrative)",
            tokensUsed: 0,
            estimatedCostUsd: 0,
            latencyMs: 0,
            isSimulatedTokenEstimate: true,
          },
        },
      };
    }

    if (topicKey === "coo_confidence") {
      const whSource = sources["SRC-WAREHOUSE-DAILY"];
      const bkSource = sources["SRC-BOOKING-STREAM"];
      const posSource = sources["SRC-POS-RETAIL"];
      return {
        focusedSalonIds: ["SLN-SW-01", "SLN-PNW-01", "SLN-PNW-05"],
        response: {
          id: `RESP-${Date.now()}`,
          question,
          title: "Executive Confidence, Data Completeness & Attribution Assessment",
          summary: `High confidence applies to revenue, margin, and rebooking recommendations (${whSource.completenessPct}% warehouse completeness and ${bkSource.completenessPct}% booking stream completeness), backed by +3.8 pts matched-holdout pilot validation. Retail SKU attachment actions carry ${posSource.status === "Stale" ? `cautious confidence until the ${posSource.ageHours}h POS Retail Sync lag (${posSource.completenessPct}% complete) is refreshed` : `high confidence following verified POS Retail Sync (${posSource.completenessPct}% complete)`}.`,
          executiveStyle: true,
          timeRange: "Current Telemetry & Attribution Audit Window",
          businessScope: scopeLabel,
          scopedSalonIds,
          topicKey,
          kpis: [
            {
              id: "cf1",
              label: "Financial Warehouse SLA",
              currentValue: `${whSource.completenessPct}%`,
              baselineLabel: `Age ${whSource.ageHours}h`,
              baselineValue: `SLA ${whSource.slaHours}h`,
              varianceLabel: whSource.status,
              varianceDirection: whSource.status === "Fresh" ? "positive" : "negative",
              metricId: "total_revenue",
            },
            {
              id: "cf2",
              label: "Booking Event Stream",
              currentValue: `${bkSource.completenessPct}%`,
              baselineLabel: `Age ${bkSource.ageHours}h`,
              baselineValue: `SLA ${bkSource.slaHours}h`,
              varianceLabel: bkSource.status,
              varianceDirection: bkSource.status === "Fresh" ? "positive" : "negative",
              metricId: "rebooking_rate",
            },
            {
              id: "cf3",
              label: "POS Retail Ledger Sync",
              currentValue: `${posSource.completenessPct}%`,
              baselineLabel: `Age ${posSource.ageHours}h`,
              baselineValue: `SLA ${posSource.slaHours}h`,
              varianceLabel: posSource.status,
              varianceDirection: posSource.status === "Fresh" ? "positive" : "negative",
              metricId: "retail_attachment",
            },
            {
              id: "cf4",
              label: "Holdout Attribution Rigor",
              currentValue: "2 Validated",
              baselineLabel: "Active Trials",
              baselineValue: "1 In-Flight",
              varianceLabel: "+3.8 pts net lift",
              varianceDirection: "positive",
              metricId: "repeat_visit_rate",
            },
          ],
          chartType: "bar",
          chartTitle: "Source Completeness % vs SLA Compliance Across Feeds",
          chartSubtitle: "Data hygiene verification governing automated executive recommendations",
          chartData: [
            {
              name: "Daily Warehouse",
              "Completeness %": whSource.completenessPct,
              "Target %": 99.0,
            },
            {
              name: "Booking Stream",
              "Completeness %": bkSource.completenessPct,
              "Target %": 99.0,
            },
            {
              name: "POS Retail Sync",
              "Completeness %": posSource.completenessPct,
              "Target %": 99.0,
            },
          ],
          tableColumns: [
            { key: "domain", header: "Decision Domain" },
            { key: "source", header: "Primary Source" },
            { key: "freshness", header: "Freshness", align: "right" },
            { key: "completeness", header: "Completeness", align: "right" },
            { key: "confidence", header: "Executive Confidence" },
          ],
          tableRows: [
            {
              domain: "Scottsdale Promo Margin Cap",
              source: whSource.name,
              freshness: `${whSource.ageHours}h (${whSource.status})`,
              completeness: `${whSource.completenessPct}%`,
              confidence: "High — Reconciled closed invoices",
            },
            {
              domain: "PNW Rebooking & Roster Shift",
              source: bkSource.name,
              freshness: `${bkSource.ageHours}h (${bkSource.status})`,
              completeness: `${bkSource.completenessPct}%`,
              confidence: "High — Matched holdout precedent (+3.8 pts)",
            },
            {
              domain: "Urban Retail SKU Commission Targets",
              source: posSource.name,
              freshness: `${posSource.ageHours}h (${posSource.status})`,
              completeness: `${posSource.completenessPct}%`,
              confidence:
                posSource.status === "Stale"
                  ? "Cautious — Hold until POS terminal upload"
                  : "High — Terminal sync verified",
            },
          ],
          sourceFreshness: posSource.status === "Stale" ? posSource : whSource,
          lastAnalysisTimestamp: nowStamp,
          anomaly: null,
          interpretation:
            "Confidence is anchored in deterministic invoice reconciliation and matched regional holdout controls rather than unverified LLM extrapolation.",
          likelyDrivers: [
            "Closed service and membership ledgers reconcile to 99.8% across all 20 studios.",
            posSource.status === "Stale"
              ? "Fremont Urban Lounge POS retail batch upload is 39.5h old, automatically suppressing retail target penalties."
              : "All three enterprise feeds are currently operating within SLA.",
          ],
          recommendedActions: [
            {
              id: "ACT-CONF-1",
              title: "Approve Scottsdale Discount Cap & PNW Rebooking Sprint Immediately",
              rationale:
                "Both rely on 99.8%+ verified warehouse and booking streams with clear baseline deviations.",
              expectedImpactDirection: "+$26,600/mo combined modeled recovery",
              priority: "P1 - High",
              responsiblePersona: "Chief Operating Officer",
              requiredHumanApproval: "Executive review sign-off",
              affectedSalonIds: ["SLN-SW-01", "SLN-PNW-01", "SLN-PNW-02", "SLN-PNW-03"],
            },
          ],
          caveats: [
            "Matched holdout comparisons reduce seasonal bias but represent directional operational samples rather than randomized clinical trials.",
          ],
          followUpSuggestions: [
            "Which actions should I prioritize in the next executive review?",
            "Which retention intervention generated incremental sales?",
            "Where should I focus to improve profitability this quarter?",
          ],
          calculationDetails: {
            kpiIds: [
              "kpi.total_revenue@v3.1",
              "kpi.contribution_margin@v3.0",
              "kpi.retail_attachment@v2.1",
            ],
            formulaSummary:
              "Source SLA age check + invoice completeness audit + holdout delta verification.",
            validationChecks: [
              "Verified warehouse reconciliation",
              "Checked POS terminal batch SLA",
            ],
            executionSource: "Deterministic Engine (Fallback Narrative)",
            tokensUsed: 0,
            estimatedCostUsd: 0,
            latencyMs: 0,
            isSimulatedTokenEstimate: true,
          },
        },
      };
    }

    if (topicKey === "coo_exec_actions") {
      const pnwReg = regional.find((r) => r.region === "Pacific Northwest");
      return {
        focusedSalonIds: ["SLN-SW-01", "SLN-PNW-01", "SLN-PNW-02", "SLN-PNW-03"],
        response: {
          id: `RESP-${Date.now()}`,
          question,
          title: "Prioritized Q4 Executive Review Decision Matrix",
          summary: `Three immediate executive decisions address $38,000/mo in identified contribution and revenue-at-risk across Elevate's 20 salons. Priority #1 caps unapproved promo stacking at 8% in Scottsdale Kierland Retreat ($12,800/mo margin leakage at ${formatPct(scottsdale?.current.discountRatePct ?? 17.1)} discounting), followed by scaling chairside rebooking + Mon–Tue roster shifts in Pacific Northwest (${formatPct(pnwReg?.avgRepeatVisitRate ?? 55.8)} repeat rate, ${formatPct(pnwReg?.avgStaffUtilizationPct ?? 59.2)} utilization).`,
          executiveStyle: true,
          timeRange: "Q4 Executive Action Horizon (Next 30 Days)",
          businessScope: scopeLabel,
          scopedSalonIds,
          topicKey,
          kpis: [
            {
              id: "ea1",
              label: "P1 Margin Guardrail (SW)",
              currentValue: "$12,800/mo",
              baselineLabel: "Scottsdale Disc.",
              baselineValue: formatPct(scottsdale?.current.discountRatePct ?? 17.1),
              varianceLabel: "Cap ad-hoc at 8%",
              varianceDirection: "positive",
              metricId: "contribution_margin",
            },
            {
              id: "ea2",
              label: "P1 Retention Sprint (PNW)",
              currentValue: "$13,800/mo",
              baselineLabel: "3 PNW Studios",
              baselineValue: formatPct(pnwReg?.avgRepeatVisitRate ?? 55.8),
              varianceLabel: "Chairside rebook",
              varianceDirection: "positive",
              metricId: "repeat_visit_rate",
            },
            {
              id: "ea3",
              label: "P2 Roster & Cancel Fill",
              currentValue: "$11,400/mo",
              baselineLabel: "PNW Utilization",
              baselineValue: formatPct(pnwReg?.avgStaffUtilizationPct ?? 59.2),
              varianceLabel: "Shift 8% Mon–Tue hrs",
              varianceDirection: "positive",
              metricId: "staff_utilization",
            },
            {
              id: "ea4",
              label: "Combined Monthly Upside",
              currentValue: "$38,000/mo",
              baselineLabel: "Org Net Revenue",
              baselineValue: formatCurrency(agg.totalRevenue),
              varianceLabel: "3 Human-Gated Decisions",
              varianceDirection: "positive",
              metricId: "total_revenue",
            },
          ],
          chartType: "bar",
          chartTitle: "Prioritized Executive Initiatives by Modeled Monthly Impact ($)",
          chartSubtitle: "Ranked by contribution margin flow-through and implementation speed",
          chartData: [
            {
              name: "1. Scottsdale Promo Cap",
              "Monthly Impact ($)": 12800,
              "Net Margin Flow ($)": 11900,
            },
            {
              name: "2. PNW Rebooking Sprint",
              "Monthly Impact ($)": 13800,
              "Net Margin Flow ($)": 4830,
            },
            {
              name: "3. PNW Roster Shift",
              "Monthly Impact ($)": 11400,
              "Net Margin Flow ($)": 3990,
            },
            {
              name: "4. 48h SMS Waitlist Fill",
              "Monthly Impact ($)": 8900,
              "Net Margin Flow ($)": 3115,
            },
          ],
          tableColumns: [
            { key: "rank", header: "Priority" },
            { key: "initiative", header: "Executive Initiative" },
            { key: "owner", header: "Owner" },
            { key: "impact", header: "Est. Monthly Impact", align: "right" },
            { key: "gate", header: "Governance Gate" },
          ],
          tableRows: [
            {
              rank: "P1",
              initiative: "Enforce POS mutual-exclusion cap (8%) on Scottsdale promos",
              owner: "Chief Operating Officer & SW Lead",
              impact: "$12,800",
              gate: "POS Promo Policy Sign-off",
            },
            {
              rank: "P1",
              initiative: "Deploy mandatory tablet rebooking in 3 PNW salons",
              owner: "Regional Operations Manager (PNW)",
              impact: "$13,800",
              gate: "Matched Holdout Tracking",
            },
            {
              rank: "P2",
              initiative: "Reallocate 8–10% of Mon–Tue morning hours to Thu–Sat",
              owner: "Regional Operations Manager (PNW)",
              impact: "$11,400",
              gate: "2-Week Stylist Notice",
            },
            {
              rank: "P2",
              initiative: "Enable 48h cancellation SMS waitlist backfill (Capitol Hill & Austin)",
              owner: "Regional Ops Leads",
              impact: "$8,900",
              gate: "Opt-in SMS Compliance",
            },
          ],
          sourceFreshness: sources["SRC-WAREHOUSE-DAILY"],
          lastAnalysisTimestamp: nowStamp,
          anomaly: null,
          interpretation:
            "Fixing Scottsdale discount stacking delivers the fastest pure-margin dollar recovery, while PNW rebooking and roster shifts rebuild durable multi-quarter visit volume.",
          likelyDrivers: [
            "Zero capital expenditure required; all three actions reconfigure existing POS rules and rostered hours.",
          ],
          recommendedActions: [
            {
              id: "ACT-EXEC-1",
              title: "Sign Off on Scottsdale POS Promo Mutual-Exclusion Rule",
              rationale: "Immediately halts 17.1% stacked discounting on balayage packages.",
              expectedImpactDirection: "+$10,500 to +$12,800/mo contribution",
              priority: "P1 - High",
              responsiblePersona: "Chief Operating Officer",
              requiredHumanApproval: "COO approval in Opportunities pipeline",
              affectedSalonIds: ["SLN-SW-01"],
            },
            {
              id: "ACT-EXEC-2",
              title: "Review PNW Weekly Rebooking Recovery via Shared Saved Insight",
              rationale: "Tracks Bellevue, Capitol Hill, and Pearl District against Kirkland holdout.",
              expectedImpactDirection: "+4.5 pts regional repeat-visit rate",
              priority: "P1 - High",
              responsiblePersona: "Regional Operations Manager (PNW)",
              requiredHumanApproval: "Monday 08:00 AM scheduled review",
              affectedSalonIds: ["SLN-PNW-01", "SLN-PNW-02", "SLN-PNW-03"],
            },
          ],
          caveats: [
            "Monthly impact figures reflect modeled opportunity baselines requiring human execution.",
          ],
          followUpSuggestions: [
            "How confident should I be in these recommendations?",
            "Which retention intervention generated incremental sales?",
            "How is our business performing this month?",
          ],
          calculationDetails: {
            kpiIds: [
              "kpi.contribution_margin@v3.0",
              "kpi.repeat_visit_rate@v2.4",
              "kpi.staff_utilization@v2.0",
            ],
            formulaSummary:
              "Ranked opportunity pipeline weighted by net contribution margin flow-through.",
            validationChecks: ["Cross-checked against active Revenue Opportunities"],
            executionSource: "Deterministic Engine (Fallback Narrative)",
            tokensUsed: 0,
            estimatedCostUsd: 0,
            latencyMs: 0,
            isSimulatedTokenEstimate: true,
          },
        },
      };
    }

    const pnwSummary = regional.find((r) => r.region === "Pacific Northwest");
    return {
      focusedSalonIds: scottsdale
        ? ["SLN-SW-01", "SLN-PNW-01", "SLN-PNW-02"]
        : scopedSalonIds.slice(0, 3),
      response: {
        id: `RESP-${Date.now()}`,
        question,
        title:
          topicKey === "coo_profitability"
            ? "Executive Profitability & Margin Leakage Diagnostic"
            : "COO Executive Performance Summary — Elevate Salon & Wellness Group",
        summary: `October 30-day net revenue reached ${formatCurrency(agg.totalRevenue)} (${formatSignedPct(agg.revGrowthMoMPct)} MoM) with ${formatCurrency(agg.contributionDollars)} contribution (${formatPct(agg.contributionMarginPct)} margin), while ${formatCurrency(totalRisk)} in monthly revenue-at-risk sits in two pockets. Pacific Northwest repeat visits dropped to ${formatPct(pnwSummary?.avgRepeatVisitRate ?? 55.8)} (${formatPct(pnwSummary?.avgStaffUtilizationPct ?? 59.2)} utilization), and Scottsdale Kierland Retreat's margin compressed to ${formatPct(scottsdale?.current.contributionMarginPct ?? 24.8)} on ${formatCurrency(scottsdale?.current.totalRevenue ?? 114000)} sales due to ${formatPct(scottsdale?.current.discountRatePct ?? 17.1)} stacked promo discounting.`,
        executiveStyle: true,
        timeRange: "October 2026 Rolling 30-Day Executive Close",
        businessScope: scopeLabel,
        scopedSalonIds,
        topicKey,
        kpis: [
          {
            id: "ex1",
            label: "Org Net Revenue (30d)",
            currentValue: formatCurrency(agg.totalRevenue),
            baselineLabel: "Prior Month",
            baselineValue: formatCurrency(agg.priorRevenue),
            varianceLabel: formatSignedPct(agg.revGrowthMoMPct),
            varianceDirection: agg.revGrowthMoMPct >= 0 ? "positive" : "negative",
            metricId: "total_revenue",
          },
          {
            id: "ex2",
            label: "Estimated Contribution",
            currentValue: formatCurrency(agg.contributionDollars),
            baselineLabel: "Contrib. Margin",
            baselineValue: formatPct(agg.contributionMarginPct),
            varianceLabel: scottsdale
              ? `Scottsdale at ${formatPct(scottsdale.current.contributionMarginPct)}`
              : "Certified Margin",
            varianceDirection: "neutral",
            metricId: "contribution_margin",
          },
          {
            id: "ex3",
            label: "Org Repeat-Visit Rate",
            currentValue: formatPct(agg.avgRepeatRate),
            baselineLabel: "3-Mo Baseline",
            baselineValue: formatPct(agg.baselineRepeatRate),
            varianceLabel: formatSignedPts(agg.repeatDeltaPts),
            varianceDirection: agg.repeatDeltaPts >= 0 ? "positive" : "negative",
            metricId: "repeat_visit_rate",
          },
          {
            id: "ex4",
            label: "Monthly Revenue at Risk",
            currentValue: formatCurrency(totalRisk),
            baselineLabel: "Staff Utilization",
            baselineValue: formatPct(agg.utilizationPct),
            varianceLabel: `${agg.unusedHours.toLocaleString()} unused hrs`,
            varianceDirection: "negative",
            metricId: "staff_utilization",
          },
        ],
        chartType: "bar",
        chartTitle: "Regional Performance Comparison: Net Revenue vs Contribution Margin",
        chartSubtitle: "Comparing all 4 operating regions across revenue ($k) and margin efficiency",
        chartData: regional.map((r) => ({
          name: r.region,
          "Net Revenue ($k)": Math.round(r.totalRevenue / 1000),
          "Contribution ($k)": Math.round(r.estimatedContributionDollars / 1000),
          "Margin %": r.avgContributionMarginPct,
        })),
        tableColumns: [
          { key: "region", header: "Region" },
          { key: "rev", header: "Net Revenue", align: "right" },
          { key: "growth", header: "MoM Growth", align: "right" },
          { key: "margin", header: "Contrib. Margin", align: "right" },
          { key: "repeat", header: "Repeat Rate", align: "right" },
          { key: "util", header: "Utilization", align: "right" },
          { key: "risk", header: "Rev at Risk", align: "right" },
        ],
        tableRows: regSortedByMargin.map((r) => ({
          region: r.region,
          rev: formatCurrency(r.totalRevenue),
          growth: formatSignedPct(r.revenueGrowthPct),
          margin: formatPct(r.avgContributionMarginPct),
          repeat: formatPct(r.avgRepeatVisitRate),
          util: formatPct(r.avgStaffUtilizationPct),
          risk: formatCurrency(r.revenueAtRiskDollars),
        })),
        sourceFreshness: sources["SRC-WAREHOUSE-DAILY"],
        lastAnalysisTimestamp: nowStamp,
        anomaly: scottsdale
          ? {
              detected: true,
              metricName: "Contribution Margin Compression",
              affectedEntity: "Scottsdale Kierland Retreat (Southwest)",
              actualValue: formatPct(scottsdale.current.contributionMarginPct),
              historicalBaseline: formatPct(
                scottsdale.baseline3MoAvg.contributionMarginPct
              ),
              absoluteDeviation: formatSignedPts(scottsdale.marginDeltaPts),
              percentageDeviation: formatSignedPct(
                (scottsdale.marginDeltaPts /
                  scottsdale.baseline3MoAvg.contributionMarginPct) *
                  100
              ),
              severity: "High",
              evidenceQuality: "High (Certified Daily Batch)",
            }
          : null,
        interpretation:
          "Top-line volume alone masks margin erosion in Southwest (unapproved promo stacking in Scottsdale) and structural Mon–Wed capacity underutilization in Pacific Northwest.",
        likelyDrivers: [
          `Scottsdale Kierland Retreat discount rate climbed to ${formatPct(scottsdale?.current.discountRatePct ?? 17.1)} vs ~4.9% org norm, eroding ~$12,800/mo in net contribution despite strong traffic.`,
          "Pacific Northwest lost repeat-visit momentum across 3 studios while leaving Mon–Wed morning rosters unadjusted.",
          "POS Retail Sync lag (39.5h in Fremont) requires data hygiene enforcement before closing monthly retail incentives.",
        ],
        recommendedActions: [
          {
            id: "ACT-COO-1",
            title: "Cap Promotional Discount Stacking at 8% in Scottsdale Kierland Retreat",
            rationale:
              "Reclaims ~9–11 pts of contribution margin on high-demand color packages without sacrificing core membership retention.",
            expectedImpactDirection: "+$10,500 to +$13,400 monthly contribution recovery",
            priority: "P1 - High",
            responsiblePersona: "COO & Southwest Regional Director",
            requiredHumanApproval: "Executive approval on POS promo code governance rule",
            affectedSalonIds: ["SLN-SW-01"],
          },
          {
            id: "ACT-COO-2",
            title: "Mandate PNW Rebooking Recovery & Roster Rebalancing Sprint",
            rationale:
              "Addresses the largest regional retention and stylist utilization drag simultaneously.",
            expectedImpactDirection: "+4.5 pts repeat rate & +6.0 pts PNW utilization",
            priority: "P1 - High",
            responsiblePersona: "Regional Operations Manager (PNW)",
            requiredHumanApproval: "Weekly executive checkpoint via shared Saved Insight",
            affectedSalonIds: [
              "SLN-PNW-01",
              "SLN-PNW-02",
              "SLN-PNW-03",
              "SLN-PNW-04",
              "SLN-PNW-05",
            ],
          },
        ],
        caveats: [
          "Contribution margin uses standardized commission & backbar COGS tables updated daily at 04:00 AM.",
          "POS Retail SKU feed in Fremont Urban Lounge is currently 39.5h old; service & booking metrics are 99.8%+ complete.",
        ],
        followUpSuggestions: [
          "Which retention intervention generated incremental sales?",
          "Where are we losing revenue despite having available capacity?",
          "How confident should I be in these recommendations?",
        ],
        calculationDetails: {
          kpiIds: [
            "kpi.total_revenue@v3.1",
            "kpi.contribution_margin@v3.0",
            "kpi.repeat_visit_rate@v2.4",
            "kpi.staff_utilization@v2.0",
          ],
          formulaSummary:
            "20-salon rollup of Daily Financial Warehouse + Operational Booking Stream with salon-level baseline variance checks.",
          validationChecks: [
            "Reconciled all 4 regions against salon invoice ledger",
            "Flagged POS retail staleness caveat automatically",
          ],
          executionSource: "Deterministic Engine (Fallback Narrative)",
          tokensUsed: 0,
          estimatedCostUsd: 0,
          latencyMs: 0,
          isSimulatedTokenEstimate: true,
        },
      },
    };
  }

  // 7. FINANCIAL IMPACT / RECOMMENDED REPEAT ACTIONS / WEEKLY PRIORITIES / REVENUE RISK / MONTH CHANGE
  const rankedRisk = [...comps].sort(
    (a, b) => a.targetVarianceDollars - b.targetVarianceDollars
  );
  const worstTarget = rankedRisk[0];

  if (topicKey === "financial_impact") {
    const scopedMonthlyVisits = agg.completedVisits;
    const annualizedVisits = scopedMonthlyVisits * 12;
    const ticket = agg.avgTicket;
    const margin = agg.contributionMarginPct;
    const upliftHalfPctVisits = Math.round(annualizedVisits * 0.005);
    const upliftOnePctVisits = Math.round(annualizedVisits * 0.01);
    const recoveryRepeatVisitsMonthly = comps.reduce((sum, c) => {
      if (c.repeatRateDeltaPts < -2) {
        // Recovering half of lost repeat-visit points
        return (
          sum +
          Math.round(
            (Math.abs(c.repeatRateDeltaPts) * 0.5 * c.current.completedPaidVisits) /
              100
          )
        );
      }
      return sum;
    }, 0);
    const monthlyRecoverySales = Math.round(recoveryRepeatVisitsMonthly * ticket);
    const monthlyRecoveryContribution = Math.round(
      monthlyRecoverySales * (margin / 100)
    );

    return {
      focusedSalonIds: scopedSalonIds,
      response: {
        id: `RESP-${Date.now()}`,
        question,
        title: `Modeled Financial Impact Scenario — ${scopeLabel}`,
        summary: `For the ${scopedSalonIds.length} salons in your current analytical context (${scopedMonthlyVisits.toLocaleString()} monthly visits at $${ticket.toFixed(2)} average ticket), recovering just half of the recent repeat-visit decline models to ~${recoveryRepeatVisitsMonthly} incremental visits/month, or ${formatCurrency(monthlyRecoverySales)} in monthly sales (${formatCurrency(monthlyRecoveryContribution)}/mo net contribution at ${formatPct(margin)} margin). Annualized across a conservative 0.50% to 1.00% relative visit uplift, this represents ${formatCurrency(Math.round(upliftHalfPctVisits * ticket))} to ${formatCurrency(Math.round(upliftOnePctVisits * ticket))} in gross sales.`,
        executiveStyle: isExec,
        timeRange: "12-Month Illustrative Scenario Grounded in Current Salon Metrics",
        businessScope: scopeLabel,
        scopedSalonIds,
        topicKey,
        kpis: [
          {
            id: "fi1",
            label: "50% Repeat Gap Recovery (Mo)",
            currentValue: formatCurrency(monthlyRecoverySales),
            baselineLabel: "Incremental Visits",
            baselineValue: `+${recoveryRepeatVisitsMonthly} visits/mo`,
            varianceLabel: "Modeled Scenario",
            varianceDirection: "positive",
            metricId: "total_revenue",
          },
          {
            id: "fi2",
            label: "Monthly Net Contribution",
            currentValue: formatCurrency(monthlyRecoveryContribution),
            baselineLabel: "Scoped Margin",
            baselineValue: formatPct(margin),
            varianceLabel: "Excludes promo discounts",
            varianceDirection: "positive",
            metricId: "contribution_margin",
          },
          {
            id: "fi3",
            label: "Annualized Recovery Potential",
            currentValue: formatCurrency(monthlyRecoveryContribution * 12),
            baselineLabel: "Annual Sales Lift",
            baselineValue: formatCurrency(monthlyRecoverySales * 12),
            varianceLabel: "Requires Manager Action",
            varianceDirection: "positive",
            metricId: "contribution_margin",
          },
          {
            id: "fi4",
            label: "Scoped Avg Ticket",
            currentValue: `$${ticket.toFixed(2)}`,
            baselineLabel: "Monthly Visits",
            baselineValue: scopedMonthlyVisits.toLocaleString(),
            varianceLabel: "Certified Baseline",
            varianceDirection: "neutral",
            metricId: "total_revenue",
          },
        ],
        chartType: "bar",
        chartTitle: "Modeled Annual Sales & Contribution by Relative Uplift Tier ($)",
        chartSubtitle: "Transparent scenario math using scoped visits, ticket, and contribution margin",
        chartData: [0.25, 0.5, 1.0].map((pct) => {
          const incV = Math.round(annualizedVisits * (pct / 100));
          const sales = Math.round(incV * ticket);
          const contrib = Math.round(sales * (margin / 100));
          return {
            name: `${pct.toFixed(2)}% Relative Uplift`,
            "Additional Sales": sales,
            "Net Contribution": contrib,
          };
        }),
        tableColumns: [
          { key: "salon", header: "Salon in Scope" },
          { key: "visits", header: "Monthly Visits", align: "right" },
          { key: "repeatGap", header: "Repeat Gap", align: "right" },
          { key: "ticket", header: "Avg Ticket", align: "right" },
          { key: "modeledMo", header: "50% Gap Recovery / Mo", align: "right" },
        ],
        tableRows: comps.map((c) => {
          const recVisits =
            c.repeatRateDeltaPts < -2
              ? Math.round(
                  (Math.abs(c.repeatRateDeltaPts) *
                    0.5 *
                    c.current.completedPaidVisits) /
                    100
                )
              : 5;
          return {
            salon: c.salon.name,
            visits: c.current.completedPaidVisits.toLocaleString(),
            repeatGap: formatSignedPts(c.repeatRateDeltaPts),
            ticket: `$${c.current.averageTicket.toFixed(2)}`,
            modeledMo: formatCurrency(recVisits * c.current.averageTicket),
          };
        }),
        sourceFreshness: sources["SRC-WAREHOUSE-DAILY"],
        lastAnalysisTimestamp: nowStamp,
        anomaly: null,
        interpretation:
          "Scenario estimates assume non-discounted rebooking recovery so contribution margins are preserved; heavy discounting would reduce net contribution.",
        likelyDrivers: [
          "High flow-through margin on recovered service visits when utilizing existing idle stylist hours.",
        ],
        recommendedActions: [
          {
            id: "ACT-FI-1",
            title: "Log Formal Retention Intervention With Matched Holdout Tracking",
            rationale:
              "Allows COO and Regional Manager to validate actual incremental visits against holdout studios.",
            expectedImpactDirection: `Validate ${formatCurrency(monthlyRecoveryContribution)}/mo modeled contribution`,
            priority: "P1 - High",
            responsiblePersona: persona.name,
            requiredHumanApproval: "Record intervention start date & owner in Revenue Opportunities",
            affectedSalonIds: scopedSalonIds,
          },
        ],
        caveats: [
          "All figures above are illustrative scenario calculations, not forecasts or guaranteed outcomes.",
          "Improved analytics alone do not generate revenue—managers must execute actions and validate against holdouts.",
        ],
        followUpSuggestions: [
          "What should I do to improve repeat visits?",
          "Which salons should I prioritize this week?",
          "Which salons had the biggest decline in repeat visits in the last 30 days?",
        ],
        calculationDetails: {
          kpiIds: ["kpi.total_revenue@v3.1", "kpi.contribution_margin@v3.0"],
          formulaSummary:
            "Incremental Visits × Scoped Average Ticket × Scoped Contribution Margin %.",
          validationChecks: ["Derived directly from scoped October invoice aggregates"],
          executionSource: "Deterministic Engine (Fallback Narrative)",
          tokensUsed: 0,
          estimatedCostUsd: 0,
          latencyMs: 0,
          isSimulatedTokenEstimate: true,
        },
      },
    };
  }

  if (topicKey === "repeat_actions") {
    const rankedByRepeat = [...comps].sort(
      (a, b) => a.repeatRateDeltaPts - b.repeatRateDeltaPts
    );
    const worstRep = rankedByRepeat[0];
    const avgRebook = Number(
      (
        comps.reduce((s, c) => s + c.current.rebookingRate, 0) /
        Math.max(1, comps.length)
      ).toFixed(1)
    );
    const baseRebook = Number(
      (
        comps.reduce((s, c) => s + c.baseline3MoAvg.rebookingRate, 0) /
        Math.max(1, comps.length)
      ).toFixed(1)
    );
    return {
      focusedSalonIds: scopedSalonIds,
      response: {
        id: `RESP-${Date.now()}`,
        question,
        title: `Action Plan: Restoring Repeat-Visit Retention — ${scopeLabel}`,
        summary: `Across ${scopeLabel}, repeat-visit rate stands at ${formatPct(agg.avgRepeatRate)} (${formatSignedPts(agg.repeatDeltaPts)} vs ${formatPct(agg.baselineRepeatRate)} baseline) as checkout rebooking slipped from ${formatPct(baseRebook)} to ${formatPct(avgRebook)}. Execute a 3-part non-discounted playbook—mandatory chairside tablet rebooking, 45-day overdue color guest outreach, and automated 48h cancellation SMS reschedule—starting with ${worstRep.salon.name} (${formatPct(worstRep.current.repeatVisitRate)}).`,
        executiveStyle: isExec,
        timeRange: "Next 30-Day Retention Sprint (Grounded in Oct Baseline)",
        businessScope: scopeLabel,
        scopedSalonIds,
        topicKey,
        kpis: [
          {
            id: "ra1",
            label: "Current Scoped Repeat %",
            currentValue: formatPct(agg.avgRepeatRate),
            baselineLabel: "3-Mo Baseline",
            baselineValue: formatPct(agg.baselineRepeatRate),
            varianceLabel: formatSignedPts(agg.repeatDeltaPts),
            varianceDirection: "negative",
            metricId: "repeat_visit_rate",
          },
          {
            id: "ra2",
            label: "Checkout Rebooking %",
            currentValue: formatPct(avgRebook),
            baselineLabel: "Target Benchmark",
            baselineValue: formatPct(baseRebook),
            varianceLabel: formatSignedPts(avgRebook - baseRebook),
            varianceDirection: "negative",
            metricId: "rebooking_rate",
          },
          {
            id: "ra3",
            label: "Priority #1 Studio",
            currentValue: formatPct(worstRep.current.repeatVisitRate),
            baselineLabel: worstRep.salon.name.split(" ")[0],
            baselineValue: formatPct(worstRep.baseline3MoAvg.repeatVisitRate),
            varianceLabel: formatSignedPts(worstRep.repeatRateDeltaPts),
            varianceDirection: "negative",
            metricId: "repeat_visit_rate",
          },
          {
            id: "ra4",
            label: "Pilot Precedent Lift",
            currentValue: "+3.8 pts",
            baselineLabel: "Matched Holdout",
            baselineValue: "Back Bay & Edina",
            varianceLabel: "Zero promo dilution",
            varianceDirection: "positive",
            metricId: "repeat_visit_rate",
          },
        ],
        chartType: "bar",
        chartTitle: "Checkout Rebooking % vs 3-Month Target Across Scoped Salons",
        chartSubtitle: "Closing the checkout rebooking gap is the #1 lever for 45-day return visits",
        chartData: rankedByRepeat.map((r) => ({
          name: r.salon.name.split(" ").slice(0, 2).join(" "),
          "Current Rebook %": r.current.rebookingRate,
          "Target Baseline %": r.baseline3MoAvg.rebookingRate,
        })),
        tableColumns: [
          { key: "salon", header: "Salon in Scope" },
          { key: "repeat", header: "Repeat %", align: "right" },
          { key: "rebook", header: "Rebook %", align: "right" },
          { key: "cancel", header: "Cancel %", align: "right" },
          { key: "action", header: "Primary Assigned Playbook" },
        ],
        tableRows: rankedByRepeat.map((r) => ({
          salon: r.salon.name,
          repeat: formatPct(r.current.repeatVisitRate),
          rebook: formatPct(r.current.rebookingRate),
          cancel: formatPct(r.current.cancellationRatePct),
          action:
            r.current.cancellationRatePct > 12
              ? "Chairside tablet rebook + 48h SMS waitlist backfill"
              : "Chairside tablet rebook + 45-day color cohort outreach",
        })),
        sourceFreshness: sources["SRC-WAREHOUSE-DAILY"],
        lastAnalysisTimestamp: nowStamp,
        anomaly: null,
        interpretation:
          "Preserving full service pricing while fixing chairside rebooking workflow protects your 35%+ contribution margin, unlike discount-driven win-back blasts.",
        likelyDrivers: [
          "Express front-desk payment bypassed rebooking prompts.",
          "Evening Thu/Fri color maintenance capacity bottleneck.",
        ],
        recommendedActions: [
          {
            id: "ACT-RA-1",
            title: "Enable Mandatory Stylist Tablet Rebooking Prompt Before Invoice Close",
            rationale:
              "Directly targets the 14–15 pt checkout rebooking drop in scoped salons.",
            expectedImpactDirection: "+8 to +12 pts rebooking conversion in 30 days",
            priority: "P1 - High",
            responsiblePersona: persona.name,
            requiredHumanApproval: "Salon Manager daily huddle & tablet toggle approval",
            affectedSalonIds: scopedSalonIds,
          },
          {
            id: "ACT-RA-2",
            title: "Trigger Non-Discounted 45-Day Overdue Color & Cut Priority Invites",
            rationale:
              "Recovers guests whose visit interval stretched to 49–53 days without eroding margin.",
            expectedImpactDirection: "+60 to +95 incremental visits/month",
            priority: "P1 - High",
            responsiblePersona: `${persona.name} & CRM Retention Lead`,
            requiredHumanApproval: "Approve opted-in guest cohort list",
            affectedSalonIds: scopedSalonIds,
          },
          {
            id: "ACT-RA-3",
            title: "Log Intervention With Matched Regional Holdout Salon",
            rationale:
              "Enables COO verification of net incremental sales vs seasonal baseline.",
            expectedImpactDirection: "Auditable ROI in Business Value tracker",
            priority: "P2 - Medium",
            responsiblePersona: persona.name,
            requiredHumanApproval: "Record intervention in Opportunities view",
            affectedSalonIds: scopedSalonIds,
          },
        ],
        caveats: [
          "Requires salon manager coaching compliance and 28-day holdout window to confirm realized lift.",
        ],
        followUpSuggestions: [
          "Show the estimated financial impact of these opportunities.",
          "Show only the worst two.",
          "Which salons have the highest unused stylist capacity?",
        ],
        calculationDetails: {
          kpiIds: ["kpi.repeat_visit_rate@v2.4", "kpi.rebooking_rate@v2.2"],
          formulaSummary:
            "Scoped salon rebooking gap vs 3-month baseline paired with validated pilot conversion benchmarks.",
          validationChecks: ["Preserved conversational salon scope"],
          executionSource: "Deterministic Engine (Fallback Narrative)",
          tokensUsed: 0,
          estimatedCostUsd: 0,
          latencyMs: 0,
          isSimulatedTokenEstimate: true,
        },
      },
    };
  }

  // Default operational handler covering revenue_risk, weekly_priorities, month_change
  return {
    focusedSalonIds: rankedRisk.slice(0, 3).map((r) => r.salon.id),
    response: {
      id: `RESP-${Date.now()}`,
      question,
      title:
        topicKey === "weekly_priorities"
          ? "Prioritized Weekly Salon Action Plan"
          : topicKey === "month_change"
            ? "Month-over-Month Performance Bridge (Oct vs Sep 2026)"
            : "Salons at Risk of Missing Monthly Revenue Targets",
      summary: `Within ${scopeLabel}, ${worstTarget.salon.name} shows the largest monthly target shortfall (${formatCurrency(worstTarget.targetVarianceDollars)} vs ${formatCurrency(worstTarget.salon.monthlyRevenueTarget)} target), driven by ${formatSignedPts(worstTarget.repeatRateDeltaPts)} repeat-visit erosion and ${worstTarget.unusedHoursCurrent} unused stylist hours. Prioritizing chairside rebooking in your top 3 flagged salons and rebalancing Monday–Tuesday rosters addresses the highest near-term revenue-at-risk.`,
      executiveStyle: isExec,
      timeRange: "Last 30 Days vs Monthly Target & Prior Close",
      businessScope: scopeLabel,
      scopedSalonIds,
      topicKey,
      kpis: [
        {
          id: "wp1",
          label: "Scoped Net Revenue",
          currentValue: formatCurrency(agg.totalRevenue),
          baselineLabel: "Prior Month",
          baselineValue: formatCurrency(agg.priorRevenue),
          varianceLabel: formatSignedPct(agg.revGrowthMoMPct),
          varianceDirection: agg.revGrowthMoMPct >= 0 ? "positive" : "negative",
          metricId: "total_revenue",
        },
        {
          id: "wp2",
          label: "Largest Target Gap",
          currentValue: formatCurrency(worstTarget.targetVarianceDollars),
          baselineLabel: worstTarget.salon.name.split(" ")[0],
          baselineValue: formatCurrency(worstTarget.salon.monthlyRevenueTarget),
          varianceLabel: "Priority #1 Studio",
          varianceDirection: "negative",
          metricId: "total_revenue",
        },
        {
          id: "wp3",
          label: "Scoped Repeat Rate",
          currentValue: formatPct(agg.avgRepeatRate),
          baselineLabel: "3-Mo Baseline",
          baselineValue: formatPct(agg.baselineRepeatRate),
          varianceLabel: formatSignedPts(agg.repeatDeltaPts),
          varianceDirection: "negative",
          metricId: "repeat_visit_rate",
        },
        {
          id: "wp4",
          label: "Unused Stylist Capacity",
          currentValue: `${agg.unusedHours.toLocaleString()} hrs`,
          baselineLabel: "Utilization",
          baselineValue: formatPct(agg.utilizationPct),
          varianceLabel: formatSignedPts(agg.utilizationDeltaPts),
          varianceDirection: "negative",
          metricId: "staff_utilization",
        },
      ],
      chartType: topicKey === "month_change" ? "line" : "bar",
      chartTitle:
        topicKey === "month_change"
          ? "6-Month Net Revenue & Repeat-Visit Trajectory"
          : "Monthly Revenue Variance vs Salon Target ($)",
      chartSubtitle: "Ranked by target gap and operational intervention urgency",
      chartData:
        topicKey === "month_change"
          ? series6m.map((m) => ({
              name: m.monthLabel,
              "Net Revenue ($k)": Math.round(m.totalRevenue / 1000),
              "Repeat Rate %": m.repeatVisitRate,
              "Utilization %": m.staffUtilizationPct,
            }))
          : rankedRisk.map((r) => ({
              name: r.salon.name.split(" ").slice(0, 2).join(" "),
              "Actual Revenue": r.current.totalRevenue,
              "Monthly Target": r.salon.monthlyRevenueTarget,
            })),
      tableColumns: [
        { key: "salon", header: "Salon" },
        { key: "actual", header: "Oct Revenue", align: "right" },
        { key: "target", header: "Target", align: "right" },
        { key: "gap", header: "Target Gap", align: "right" },
        { key: "repeat", header: "Repeat %", align: "right" },
        { key: "util", header: "Utilization %", align: "right" },
      ],
      tableRows: rankedRisk.map((r) => ({
        salon: r.salon.name,
        actual: formatCurrency(r.current.totalRevenue),
        target: formatCurrency(r.salon.monthlyRevenueTarget),
        gap: formatCurrency(r.targetVarianceDollars),
        repeat: formatPct(r.current.repeatVisitRate),
        util: formatPct(r.current.staffUtilizationPct),
      })),
      sourceFreshness: sources["SRC-WAREHOUSE-DAILY"],
      lastAnalysisTimestamp: nowStamp,
      anomaly: {
        detected: true,
        metricName: "Salon Revenue vs Target",
        affectedEntity: worstTarget.salon.name,
        actualValue: formatCurrency(worstTarget.current.totalRevenue),
        historicalBaseline: formatCurrency(
          worstTarget.salon.monthlyRevenueTarget
        ),
        absoluteDeviation: formatCurrency(worstTarget.targetVarianceDollars),
        percentageDeviation: formatSignedPct(
          (worstTarget.targetVarianceDollars /
            worstTarget.salon.monthlyRevenueTarget) *
            100
        ),
        severity: "High",
        evidenceQuality: "High (Certified Daily Batch)",
      },
      interpretation:
        "Target shortfalls closely track studios with combined checkout rebooking drops and elevated 48-hour cancellations rather than average ticket erosion.",
      likelyDrivers: [
        "Lower repeat guest volume in Bellevue, Capitol Hill, and Pearl District.",
        "Unfilled cancellation slots within 48 hours of appointment start.",
        "Idle Monday–Wednesday morning roster capacity.",
      ],
      recommendedActions: [
        {
          id: "ACT-WP-1",
          title: "Deploy Chairside Rebooking Coaching at Bellevue & Capitol Hill",
          rationale:
            "Directly addresses the #1 driver of target shortfall without margin dilution.",
          expectedImpactDirection: "+4.5 pts repeat rate over 30 days",
          priority: "P1 - High",
          responsiblePersona: "Regional Operations Manager",
          requiredHumanApproval: "Salon Manager daily huddle commitment",
          affectedSalonIds: ["SLN-PNW-01", "SLN-PNW-02"],
        },
        {
          id: "ACT-WP-2",
          title: "Activate SMS Waitlist Backfill for Capitol Hill Cancellations",
          rationale:
            "Recaptures late cancellations currently exceeding 15%.",
          expectedImpactDirection: "+$3,800/mo recovered service revenue",
          priority: "P1 - High",
          responsiblePersona: "Salon Manager (Capitol Hill Atelier)",
          requiredHumanApproval: "Approve automated waitlist SMS window",
          affectedSalonIds: ["SLN-PNW-02"],
        },
        {
          id: "ACT-WP-3",
          title: "Rebalance 10% of Mon–Tue Morning Roster Hours to Peak Weekends",
          rationale:
            "Improves RevPAH and accommodates waitlisted returning color clients.",
          expectedImpactDirection: "+5.5 pts stylist utilization",
          priority: "P2 - Medium",
          responsiblePersona: "Regional Manager",
          requiredHumanApproval: "Stylist bi-weekly schedule sign-off",
          affectedSalonIds: scopedSalonIds,
        },
      ],
      caveats: [
        "Monthly targets reflect board-approved FY26 regional budgets.",
      ],
      followUpSuggestions: [
        "Why are three salons losing repeat customers?",
        "Show the estimated financial impact of these opportunities.",
        "Which salons have the highest unused stylist capacity?",
      ],
      calculationDetails: {
        kpiIds: [
          "kpi.total_revenue@v3.1",
          "kpi.repeat_visit_rate@v2.4",
          "kpi.staff_utilization@v2.0",
        ],
        formulaSummary:
          "Actual 30-day closed revenue minus monthly salon target with multi-metric driver correlation.",
        validationChecks: ["Daily warehouse close verified"],
        executionSource: "Deterministic Engine (Fallback Narrative)",
        tokensUsed: 0,
        estimatedCostUsd: 0,
        latencyMs: 0,
        isSimulatedTokenEstimate: true,
      },
    },
  };
}

export function extractFreshnessMetadata(src: SourceSystemStatus): {
  dataDate: string;
  dataTime: string;
  dataThroughTimestamp: string;
  sourceName: string;
  sourceId: string;
  status: "Fresh" | "Stale" | "Delayed";
  completenessPct: number;
} {
  // src.dataThroughTimestamp format is "YYYY-MM-DD HH:MM UTC"
  const parts = src.dataThroughTimestamp.split(" ");
  const dataDate = parts[0] ?? "2026-10-24";
  const dataTime = parts.slice(1).join(" ") || "10:15 UTC";
  return {
    dataDate,
    dataTime,
    dataThroughTimestamp: src.dataThroughTimestamp,
    sourceName: src.name,
    sourceId: src.id,
    status: src.status,
    completenessPct: src.completenessPct,
  };
}

export function prepareZenneClarificationTurn(params: {
  question: string;
  personaId: PersonaId;
  analysisMode: "fast" | "deep";
  agentProductName?: "AI Business Advisor" | "AI Retention Manager";
  uploadedDoc?: ZenneUploadedDoc;
  context: ConversationContextState;
  policy: GovernancePolicy;
  agentEnabled: boolean;
  todayTokensUsed: number;
  monthSpendUsd: number;
  userQueriesLastHour: number;
  demoTimeOffsetHours: number;
  posSyncRefreshed: boolean;
}):
  | { shouldBypassClarification: true }
  | {
      shouldBypassClarification: false;
      clarification: ZenneClarificationPrompt;
    } {
  const activeAgentProduct = params.agentProductName ?? "AI Business Advisor";
  const prePolicy = evaluateQueryPolicy({
    question: params.question,
    personaId: params.personaId,
    analysisMode: params.analysisMode,
    policy: params.policy,
    agentEnabled: params.agentEnabled,
    agentProductName: activeAgentProduct,
    todayTokensUsed: params.todayTokensUsed,
    monthSpendUsd: params.monthSpendUsd,
    userQueriesLastHour: params.userQueriesLastHour,
  });

  if (!prePolicy.allowed) {
    return { shouldBypassClarification: true };
  }

  const { topicKey } = resolveIntent(
    params.question,
    params.personaId,
    params.context,
    {
      agentProductName: activeAgentProduct,
      toolMode: "deep-research",
      uploadedDoc: params.uploadedDoc,
    }
  );

  if (topicKey === "unsupported") {
    return { shouldBypassClarification: true };
  }

  // Direct short follow-ups on an existing context (like "Show only the worst two") can execute immediately
  const qLower = params.question.toLowerCase().trim();
  if (
    params.context.turnCount > 0 &&
    /^(show only the worst|why did that happen|what should i do next)/.test(qLower)
  ) {
    return { shouldBypassClarification: true };
  }

  const sources = getSourceSystems(
    params.demoTimeOffsetHours,
    params.posSyncRefreshed
  );
  const persona = PERSONAS[params.personaId];
  const isExec = params.personaId === "meera";
  const scopeText = isExec
    ? "all 20 salons across 4 regions"
    : `your ${persona.allowedSalonIds.length} authorized ${persona.assignedRegion} salons`;

  let primarySource = sources["SRC-WAREHOUSE-DAILY"];
  if (
    topicKey === "unused_capacity" ||
    topicKey === "coo_capacity_loss" ||
    topicKey === "repeat_drivers"
  ) {
    primarySource = sources["SRC-BOOKING-STREAM"];
  } else if (topicKey === "retail_decline") {
    primarySource = sources["SRC-POS-RETAIL"];
  }
  const freshMeta = extractFreshnessMetadata(primarySource);

  const agentLead =
    activeAgentProduct === "AI Retention Manager"
      ? `Running AI Retention Manager deep research across ${scopeText}${
          params.uploadedDoc ? ` (including "${params.uploadedDoc.name}")` : ""
        }.`
      : `I can run deep research across ${scopeText}${
          params.uploadedDoc ? ` (cross-checking "${params.uploadedDoc.name}")` : ""
        }.`;

  let introText = `${agentLead} To tailor the insights and recommendations accurately, please confirm your preferred focus:`;
  let followUpQuestions: string[] = [];
  let quickReplies: string[] = [];

  if (
    topicKey === "repeat_visits" ||
    topicKey === "repeat_drivers" ||
    topicKey === "repeat_actions"
  ) {
    introText = `${agentLead} Before I compile the guest retention findings and action plan, could you clarify:`;
    followUpQuestions = [
      `1. Should I compare all authorized studios against the 3-month baseline, or isolate only the worst 2 declining studios?`,
      `2. Would you like me to focus on root-cause checkout rebooking & cancellation funnel drivers, or quantify the 30-day revenue recovery impact?`,
    ];
    quickReplies = [
      "Compare all studios vs 3-month baseline + rebooking recovery plan",
      "Isolate worst 2 studios + checkout & cancellation funnel drivers",
      "Quantify 30-day revenue recovery impact + prioritized P1 actions",
    ];
  } else if (
    topicKey === "unused_capacity" ||
    topicKey === "coo_capacity_loss"
  ) {
    introText = `${agentLead} Which stylist roster utilization angle should I prioritize?`;
    followUpQuestions = [
      `1. Do you want a Mon–Sun time-block heatmap of idle chair hours, or a studio-by-studio utilization ranking?`,
      `2. Should recommendations emphasize evening/weekend roster reallocation or waitlist backfill actions?`,
    ];
    quickReplies = [
      "Mon–Sun time-block utilization heatmap + shift reallocation actions",
      "Studio utilization ranking + waitlist backfill & RevPAH lift",
      "Isolate worst 2 underutilized studios + weekly staffing plan",
    ];
  } else if (
    topicKey === "coo_profitability" ||
    topicKey === "coo_monthly_perf" ||
    topicKey === "coo_exec_actions"
  ) {
    introText = `${agentLead} Please specify how you want this executive analysis structured:`;
    followUpQuestions = [
      `1. Should I evaluate contribution margin compression and promotional discount leakage across all 4 regions, or drill into studio-level outliers?`,
      `2. Would you like recommendations framed around 90-day margin guardrails or validated holdout intervention ROI?`,
    ];
    quickReplies = [
      "Compare all 4 regions on margin compression + 90-day discount guardrails",
      "Highlight high-revenue studios with margin leakage + executive actions",
      "Include matched-holdout ROI evidence & sensitivity model",
    ];
  } else if (topicKey === "retail_decline") {
    introText = `${agentLead} Reviewing retail product attachment and take-home revenue—please confirm:`;
    followUpQuestions = [
      `1. Should I benchmark current retail attachment % against the 3-month baseline and verify POS terminal sync freshness?`,
      `2. Would you like chairside stylist recommendation scripts and coaching priorities included?`,
    ];
    quickReplies = [
      "Benchmark vs 3-month baseline + verify POS sync freshness & coaching plan",
      "Isolate worst 2 retail attachment studios + recovery actions",
      "Quantify monthly retail revenue opportunity across studios",
    ];
  } else if (
    topicKey === "coo_interventions" ||
    topicKey === "financial_impact"
  ) {
    introText = `${agentLead} Evaluating commercial uplift and intervention ROI—which evidence view do you prefer?`;
    followUpQuestions = [
      `1. Should I pair completed matched-holdout trial results with the 20-salon sensitivity curve (0.25%–1.00% uplift)?`,
      `2. Do you want net monthly contribution figures after discount and training costs?`,
    ];
    quickReplies = [
      "Matched-holdout ROI results + 20-salon net contribution sensitivity",
      "30-day studio recovery dollar impact + P1 rollout priorities",
    ];
  } else {
    followUpQuestions = [
      `1. Should I benchmark performance over the Last 30 Days vs 3-Month Baseline, or examine the 6-Month trajectory?`,
      `2. Would you like prioritized P1/P2 operational recommendations by studio director?`,
    ];
    quickReplies = [
      "Last 30 Days vs 3-Month Baseline + P1/P2 studio recommendations",
      "6-Month revenue & retention trajectory + target gap breakdown",
      "Isolate worst 2 studios + immediate weekly priorities",
    ];
  }

  return {
    shouldBypassClarification: false,
    clarification: {
      id: `ZENNE-CLAR-${Date.now()}`,
      originalQuestion: params.question,
      topicKey,
      introText,
      followUpQuestions,
      quickReplies,
      uploadedDoc: params.uploadedDoc,
      dataFreshness: {
        dataDate: freshMeta.dataDate,
        dataTime: freshMeta.dataTime,
        sourceName: freshMeta.sourceName,
        status: freshMeta.status,
      },
    },
  };
}

export function buildWidgetFromResponse(params: {
  id?: string;
  widgetName: string;
  ownerPersona: PersonaId;
  roleLabel: string;
  originalQuestion: string;
  clarificationFocus?: string;
  response: AIResponseContract;
  scheduledTime: string;
  cadence: "Daily" | "Weekly";
  scheduleEnabled?: boolean;
  lastRefreshedAt?: string;
}): SavedDashboardWidget {
  const fresh = extractFreshnessMetadata(params.response.sourceFreshness);
  const nowDisplay =
    params.lastRefreshedAt ??
    new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const scheduleEnabled = params.scheduleEnabled ?? true;

  return {
    id:
      params.id ??
      `WDG-${Date.now()}-${Math.floor(Math.random() * 90 + 10)}`,
    widgetName: params.widgetName,
    ownerPersona: params.ownerPersona,
    roleLabel: params.roleLabel,
    originalQuestion: params.originalQuestion,
    clarificationFocus: params.clarificationFocus,
    topicKey: params.response.topicKey,
    scopedSalonIds: params.response.scopedSalonIds,
    scopeLabel: params.response.businessScope,
    chartType:
      params.response.chartType === "table-only"
        ? "bar"
        : params.response.chartType,
    kpis: params.response.kpis.slice(0, 4),
    summary: params.response.summary,
    interpretation: params.response.interpretation,
    recommendations: params.response.recommendedActions.slice(0, 3),
    scheduledTime: params.scheduledTime,
    cadence: params.cadence,
    scheduleEnabled,
    lastRefreshedAt: nowDisplay,
    nextScheduledLabel: scheduleEnabled
      ? `${params.cadence} at ${params.scheduledTime} Local`
      : "Manual Refresh Only",
    lastRunStatus:
      fresh.status === "Stale" ? "Stale Source Warning" : "Refreshed",
    dataFreshness: fresh,
  };
}

export function createInitialDashboardWidgets(
  dataVersion = 1,
  demoTimeOffsetHours = 0,
  posSyncRefreshed = false
): SavedDashboardWidget[] {
  const sources = getSourceSystems(demoTimeOffsetHours, posSyncRefreshed);
  const nowStamp = "2026-10-24 08:00 UTC";
  const pnwIds = PERSONAS.arjun.allowedSalonIds;
  const allIds = SALONS.map((s) => s.id);

  const pnwRepeat = buildDeterministicResponse({
    question:
      "Which salons had the biggest decline in repeat visits in the last 30 days?",
    topicKey: "repeat_visits",
    personaId: "arjun",
    scopedSalonIds: pnwIds,
    allAuthorizedSalonIds: pnwIds,
    analysisMode: "deep",
    dataVersion,
    sources,
    nowStamp,
  }).response;

  const pnwCapacity = buildDeterministicResponse({
    question: "Which salons have the highest unused stylist capacity?",
    topicKey: "unused_capacity",
    personaId: "arjun",
    scopedSalonIds: pnwIds,
    allAuthorizedSalonIds: pnwIds,
    analysisMode: "deep",
    dataVersion,
    sources,
    nowStamp,
  }).response;

  const cooMargin = buildDeterministicResponse({
    question: "Where should I focus to improve profitability this quarter?",
    topicKey: "coo_profitability",
    personaId: "meera",
    scopedSalonIds: allIds,
    allAuthorizedSalonIds: allIds,
    analysisMode: "deep",
    dataVersion,
    sources,
    nowStamp,
  }).response;

  const cooRoi = buildDeterministicResponse({
    question: "Which retention intervention generated incremental sales?",
    topicKey: "coo_interventions",
    personaId: "meera",
    scopedSalonIds: allIds,
    allAuthorizedSalonIds: allIds,
    analysisMode: "deep",
    dataVersion,
    sources,
    nowStamp,
  }).response;

  return [
    buildWidgetFromResponse({
      id: "WDG-PNW-REPEAT-01",
      widgetName: "PNW Repeat-Visit & Rebooking Watchlist",
      ownerPersona: "arjun",
      roleLabel: "Regional Manager",
      originalQuestion:
        "Which salons had the biggest decline in repeat visits in the last 30 days?",
      clarificationFocus:
        "Compare all studios vs 3-month baseline + rebooking recovery plan",
      response: pnwRepeat,
      scheduledTime: "08:00",
      cadence: "Daily",
      lastRefreshedAt: "2026-10-24 08:00 UTC",
    }),
    buildWidgetFromResponse({
      id: "WDG-PNW-STAFF-02",
      widgetName: "PNW Stylist Chair Capacity & Idle Hours",
      ownerPersona: "arjun",
      roleLabel: "Regional Manager",
      originalQuestion:
        "Which salons have the highest unused stylist capacity?",
      clarificationFocus:
        "Mon–Sun time-block utilization heatmap + shift reallocation actions",
      response: pnwCapacity,
      scheduledTime: "07:30",
      cadence: "Daily",
      lastRefreshedAt: "2026-10-24 07:30 UTC",
    }),
    buildWidgetFromResponse({
      id: "WDG-COO-MARGIN-01",
      widgetName: "Executive Multi-Region Margin & Discount Guardrail",
      ownerPersona: "meera",
      roleLabel: "Chief Operating Officer",
      originalQuestion:
        "Where should I focus to improve profitability this quarter?",
      clarificationFocus:
        "Compare all 4 regions on margin compression + 90-day discount guardrails",
      response: cooMargin,
      scheduledTime: "07:00",
      cadence: "Daily",
      lastRefreshedAt: "2026-10-24 07:00 UTC",
    }),
    buildWidgetFromResponse({
      id: "WDG-COO-ROI-02",
      widgetName: "Holdout-Validated Retention ROI & Sensitivity",
      ownerPersona: "meera",
      roleLabel: "Chief Operating Officer",
      originalQuestion:
        "Which retention intervention generated incremental sales?",
      clarificationFocus:
        "Matched-holdout ROI results + 20-salon net contribution sensitivity",
      response: cooRoi,
      scheduledTime: "08:30",
      cadence: "Weekly",
      lastRefreshedAt: "2026-10-24 08:30 UTC",
    }),
  ];
}

export function refreshSavedDashboardWidget(
  widget: SavedDashboardWidget,
  dataVersion: number,
  demoTimeOffsetHours: number,
  posSyncRefreshed: boolean
): SavedDashboardWidget {
  const sources = getSourceSystems(demoTimeOffsetHours, posSyncRefreshed);
  const nowStamp =
    new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const persona = PERSONAS[widget.ownerPersona];
  const rebuilt = buildDeterministicResponse({
    question: widget.originalQuestion,
    topicKey: widget.topicKey,
    personaId: widget.ownerPersona,
    scopedSalonIds: widget.scopedSalonIds,
    allAuthorizedSalonIds: persona.allowedSalonIds,
    analysisMode: "deep",
    dataVersion,
    sources,
    nowStamp,
  }).response;

  const fresh = extractFreshnessMetadata(rebuilt.sourceFreshness);
  return {
    ...widget,
    kpis: rebuilt.kpis.slice(0, 4),
    summary: rebuilt.summary,
    interpretation: widget.clarificationFocus
      ? `Tailored to focus (${widget.clarificationFocus}): ${rebuilt.interpretation}`
      : rebuilt.interpretation,
    recommendations: rebuilt.recommendedActions.slice(0, 3),
    lastRefreshedAt: nowStamp,
    nextScheduledLabel: widget.scheduleEnabled
      ? `${widget.cadence} at ${widget.scheduledTime} Local`
      : "Manual Refresh Only",
    lastRunStatus:
      fresh.status === "Stale" ? "Stale Source Warning" : "Refreshed",
    dataFreshness: fresh,
  };
}

