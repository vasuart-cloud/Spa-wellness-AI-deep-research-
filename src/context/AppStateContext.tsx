import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AgentIdentityRecord,
  AIAssistSuggestion,
  AIResponseContract,
  AlertRule,
  AuditEvent,
  ChatbotMode,
  CockpitSubTab,
  ControlTowerEvent,
  ConversationContextState,
  CustomDashboard,
  CustomerInteraction,
  DashboardTile,
  GovernancePolicy,
  GuestAppointment,
  GuidedDemoStep,
  InterventionRecord,
  LoginRoleKey,
  LoginType,
  NavSection,
  OpportunityStatus,
  OutboxMessage,
  PersonaId,
  RegionName,
  RevenueOpportunity,
  SafetyTestResult,
  SavedDashboardWidget,
  SavedInsight,
  ScheduleConfig,
  TriggeredAlert,
  UserAuthSession,
  ZenneAgentSelection,
  ZenneClarificationPrompt,
  ZenneThreadEntry,
  ZenneToolMode,
  ZenneUploadedDoc,
} from "../types/domain";
import {
  buildWidgetFromResponse,
  createInitialDashboardWidgets,
  executeAdvisorQuery,
  prepareZenneClarificationTurn,
  refreshSavedDashboardWidget,
} from "../services/agentService";
import {
  buildInitialOpportunities,
  evaluateAlertRulesAgainstData,
  INITIAL_ALERT_RULES,
  INITIAL_INTERVENTIONS,
} from "../services/alertOpportunityService";
import {
  buildDeterministicAiAssist,
  createInitialAppointments,
  createInitialInteractions,
  formatTime12h,
  requestCockpitAiAssist,
} from "../services/cockpitService";
import { queryCacheService } from "../services/cacheService";
import {
  createInitialDashboards,
  createInitialSavedInsights,
  recalculateSavedInsightSnapshot,
} from "../services/dashboardScheduleService";
import { createSimulatedShareDelivery } from "../services/exportShareService";
import {
  DEFAULT_GOVERNANCE_POLICY,
  generateInitialControlTowerEvents,
  INITIAL_AGENT_IDENTITIES,
  runGovernanceSafetySuite,
} from "../services/policyService";
import {
  ensureSyntheticDatasetReady,
  PERSONAS,
  regenerateDummyDataset,
  SALONS,
} from "../services/syntheticDataService";

export function buildUserAuthSession(
  loginType: LoginType,
  roleKey: LoginRoleKey
): UserAuthSession {
  const signedInAt =
    new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

  if (roleKey === "front_desk_staff") {
    return {
      isAuthenticated: true,
      loginType,
      roleKey,
      roleLabel: "Studio Front-Desk Staff",
      departmentScope: "Single Studio Reception · POS Checkout Only",
      mappedPersonaId: "arjun",
      canAccessChatbot: false,
      allowedChatbotModes: [],
      rbacDenialReason:
        "RBAC Policy: The 'Studio Front-Desk Staff' role does not hold the 'bi.chatbot.advisor' entitlement. Zenne (AI Business Advisor) requires Regional Manager, Chief Operating Officer, or Customer Admin credentials.",
      signedInAt,
    };
  }

  const posTerminalRestricted = loginType === "Staff POS Terminal";

  if (roleKey === "chief_operating_officer") {
    return {
      isAuthenticated: true,
      loginType,
      roleKey,
      roleLabel: "Chief Operating Officer (COO)",
      departmentScope: "All 4 Regions · 20 Authorized Salons",
      mappedPersonaId: "meera",
      canAccessChatbot: !posTerminalRestricted,
      allowedChatbotModes: posTerminalRestricted
        ? []
        : ["business-advisor", "data-qa", "retention-coach"],
      rbacDenialReason: posTerminalRestricted
        ? "RBAC Policy: 'Staff POS Terminal' sessions restrict executive Zenne Chatbot access on shared salon floor terminals. Switch login type to Enterprise SSO or Executive Suite."
        : undefined,
      signedInAt,
    };
  }

  if (roleKey === "governance_admin") {
    return {
      isAuthenticated: true,
      loginType,
      roleKey,
      roleLabel: "Customer Admin",
      departmentScope: "Tenant-Wide AI Governance & Settings · 20 Salons",
      mappedPersonaId: "neha",
      canAccessChatbot: !posTerminalRestricted,
      allowedChatbotModes: posTerminalRestricted
        ? []
        : ["business-advisor", "data-qa", "retention-coach"],
      rbacDenialReason: posTerminalRestricted
        ? "RBAC Policy: 'Staff POS Terminal' sessions block Customer Admin Settings and Zenne access. Authenticate via Governance Console or Enterprise SSO."
        : undefined,
      signedInAt,
    };
  }

  return {
    isAuthenticated: true,
    loginType,
    roleKey: "regional_manager",
    roleLabel: "Regional Manager",
    departmentScope: "Pacific Northwest · 5 Authorized Salons",
    mappedPersonaId: "arjun",
    canAccessChatbot: !posTerminalRestricted,
    allowedChatbotModes: posTerminalRestricted
      ? []
      : ["business-advisor", "data-qa", "retention-coach"],
    rbacDenialReason: posTerminalRestricted
      ? "RBAC Policy: 'Staff POS Terminal' sessions are restricted to point-of-sale checkout and block Zenne Chatbot access. Sign in via Operations Portal or Enterprise SSO."
      : undefined,
    signedInAt,
  };
}

export const GUIDED_DEMO_STEPS: GuidedDemoStep[] = [
  {
    stepNumber: 1,
    title: "Regional Operations Identifies Falling Repeat Visits",
    persona: "arjun",
    targetNav: "advisor",
    visionPillar: "TRUST",
    originBadge: "Zenoti-Inspired Core",
    description:
      "Regional Operations Manager queries the 5 Pacific Northwest salons in AI Business Advisor mode to isolate where 30-day repeat visits declined.",
    actionButtonLabel: "Run Repeat-Visit Query",
  },
  {
    stepNumber: 2,
    title: "AI Business Advisor Explains Operational Evidence",
    persona: "arjun",
    targetNav: "advisor",
    visionPillar: "ADOPT",
    originBadge: "Zenoti-Inspired Core",
    description:
      "Maintaining conversational context, the Regional Operations Manager asks 'Why did that happen?' to inspect the checkout rebooking & cancellation funnel.",
    actionButtonLabel: "Ask 'Why Did That Happen?'",
  },
  {
    stepNumber: 3,
    title: "Save a Certified Refreshable Insight",
    persona: "arjun",
    targetNav: "saved-insights",
    visionPillar: "REPEAT",
    originBadge: "Proposed Enhancement",
    description:
      "Store the natural-language query, certified KPI version tags, and authorized salon scope as a reusable insight.",
    actionButtonLabel: "Save & Inspect Insight",
  },
  {
    stepNumber: 4,
    title: "Pin Tile & Schedule Weekly Analysis",
    persona: "arjun",
    targetNav: "dashboards",
    visionPillar: "REPEAT",
    originBadge: "Proposed Enhancement",
    description:
      "Pin the insight to the regional custom dashboard with a Monday 08:00 AM schedule and test 'Run Due Jobs'.",
    actionButtonLabel: "Simulate Scheduled Refresh",
  },
  {
    stepNumber: 5,
    title: "Proactive Alert Highlights Unusual Trend",
    persona: "arjun",
    targetNav: "alerts",
    visionPillar: "TRUST",
    originBadge: "Proposed Enhancement",
    description:
      "Configured threshold rules flag repeat-visit contraction while holding unverified recommendations on stale POS feeds.",
    actionButtonLabel: "Inspect Triggered Alert",
  },
  {
    stepNumber: 6,
    title: "Record an Approved Management Action",
    persona: "arjun",
    targetNav: "opportunities",
    visionPillar: "ADOPT",
    originBadge: "Proposed Enhancement",
    description:
      "Regional Operations approves chairside rebooking coaching across Bellevue, Capitol Hill, and Pearl District and logs the intervention.",
    actionButtonLabel: "Approve & Log Intervention",
  },
  {
    stepNumber: 7,
    title: "Chief Operating Officer Reviews Financial Outcome",
    persona: "meera",
    targetNav: "opportunities",
    visionPillar: "PROVE",
    originBadge: "Proposed Enhancement",
    description:
      "Executive leadership inspects completed holdout-validated interventions and the 20-salon illustrative sensitivity model ($35,910 at 0.5% uplift).",
    actionButtonLabel: "Open Executive Value Verification",
  },
  {
    stepNumber: 8,
    title: "Governance Admin Audits Safety & Tenant AI Cost",
    persona: "neha",
    targetNav: "control-tower",
    visionPillar: "PROVE",
    originBadge: "Proposed Enhancement",
    description:
      "Tenant Governance Admin monitors AI Business Advisor, Retention Manager, and Dispute Manager spend, runs safety tests, and enforces budgets.",
    actionButtonLabel: "Run Safety & Budget Check",
  },
];

const STORAGE_KEY = "insightflow_wellness_zenne_v5";

interface PersistedSlice {
  savedInsights: SavedInsight[];
  dashboards: CustomDashboard[];
  dashboardWidgets: SavedDashboardWidget[];
  policy: GovernancePolicy;
  previousApprovedPolicy: GovernancePolicy;
  alertRules: AlertRule[];
  interventions: InterventionRecord[];
  opportunities: RevenueOpportunity[];
  appointments: GuestAppointment[];
  interactions: CustomerInteraction[];
  outbox: OutboxMessage[];
  auditLog: AuditEvent[];
  savedQuestions: string[];
  presenterHintsEnabled: boolean;
  dataVersion: number;
  demoTimeOffsetHours: number;
  posSyncRefreshed: boolean;
  agents: AgentIdentityRecord[];
  controlTowerEvents: ControlTowerEvent[];
  alertStatusMap: Record<string, TriggeredAlert["status"]>;
  alertAssigneeMap: Record<string, string>;
  manualSimulatedAlerts: TriggeredAlert[];
}

const INITIAL_CONTEXT_BY_PERSONA: Record<PersonaId, ConversationContextState> = {
  arjun: {
    lastTopicKey: null,
    focusedSalonIds: [],
    lastTimeRange: "Last 30 Days",
    turnCount: 0,
  },
  meera: {
    lastTopicKey: null,
    focusedSalonIds: [],
    lastTimeRange: "Last 30 Days",
    turnCount: 0,
  },
  neha: {
    lastTopicKey: null,
    focusedSalonIds: [],
    lastTimeRange: "Last 30 Days",
    turnCount: 0,
  },
};

const INITIAL_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: "AUD-1001",
    timestamp: "2026-10-24 06:00:12 UTC",
    actorPersona: "arjun",
    actorName: "Regional Manager",
    category: "SCHEDULE_RUN",
    summary:
      "Scheduled refresh completed at 08:00 for Dashboard widget 'PNW Repeat-Visit & Rebooking Watchlist'",
    scopeLabel: "Pacific Northwest · 5 Salons",
    outcome: "Allowed",
    metadata: "Certified KPI reuse · 120 tokens",
  },
  {
    id: "AUD-1002",
    timestamp: "2026-10-24 06:05:44 UTC",
    actorPersona: "meera",
    actorName: "Chief Operating Officer",
    category: "QUERY_EXECUTED",
    summary:
      "Executed Zenne deep research on organization-wide contribution margin & discount compression",
    scopeLabel: "All 20 Salons · 4 Regions",
    outcome: "Allowed",
    metadata: "Deep Analysis · 2,480 tokens",
  },
  {
    id: "AUD-1003",
    timestamp: "2026-10-24 06:18:09 UTC",
    actorPersona: "arjun",
    actorName: "Regional Manager",
    category: "ACCESS_BLOCKED",
    summary:
      "Blocked cross-region query in Zenne referencing Scottsdale Kierland Retreat (Southwest)",
    scopeLabel: "Unauthorized Scope Attempt",
    outcome: "Blocked",
    metadata: "Rule: UNAUTHORIZED_SALON_SCOPE",
  },
  {
    id: "AUD-1004",
    timestamp: "2026-10-24 06:30:00 UTC",
    actorPersona: "neha",
    actorName: "Customer Admin",
    category: "POLICY_UPDATED",
    summary:
      "Certified AI Agents & Zenne Business Advisor policy POL-2026.10-CERTIFIED ($450/mo cap, 120k daily tokens)",
    scopeLabel: "Tenant-Wide Governance",
    outcome: "Allowed",
    metadata: "Hard Stop enabled · Clarifying Research On",
  },
];

function scrubTextForRegionalScope(
  text: string,
  allowedSalonIds: string[]
): string {
  const allowedSet = new Set(allowedSalonIds);
  let cleaned = text;
  for (const salon of SALONS) {
    if (!allowedSet.has(salon.id)) {
      const escapedFull = salon.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      cleaned = cleaned.replace(
        new RegExp(`\\s*(?:and|&|,)\\s*${escapedFull}(?:\\s*\\([A-Z]+\\))?`, "gi"),
        ""
      );
      cleaned = cleaned.replace(
        new RegExp(`${escapedFull}(?:\\s*\\([A-Z]+\\))?\\s*(?:and|&|,)\\s*`, "gi"),
        ""
      );
      cleaned = cleaned.replace(new RegExp(escapedFull, "gi"), "peer studio");
      const shortPrefix = salon.name.split(" ").slice(0, 2).join(" ");
      const escapedShort = shortPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      cleaned = cleaned.replace(
        new RegExp(`\\s*(?:and|&|,)\\s*${escapedShort}(?:\\s*\\([A-Z]+\\))?`, "gi"),
        ""
      );
    }
  }
  // Scrub city-only references to unauthorized studios (e.g. Plano, Oak Brook, Short Hills, Austin)
  cleaned = cleaned
    .replace(/,\s*Plano,\s*Oak Brook,\s*and\s*Short Hills/gi, "")
    .replace(/\s*&\s*SW Regional Lead/gi, "");
  return cleaned;
}

export interface AppStateContextValue {
  showOnboarding: boolean;
  setShowOnboarding: (v: boolean) => void;
  authSession: UserAuthSession;
  loginWithRole: (
    loginType: LoginType,
    roleKey: LoginRoleKey,
    targetNav?: NavSection
  ) => Promise<void>;
  activePersona: PersonaId;
  switchPersona: (persona: PersonaId, targetNav?: NavSection) => void;
  activeNav: NavSection;
  setActiveNav: (nav: NavSection) => void;
  cockpitSubTab: CockpitSubTab;
  setCockpitSubTab: (t: CockpitSubTab) => void;
  settingsSubTab: "agents" | "control-tower" | "freshness" | "audit";
  setSettingsSubTab: (
    t: "agents" | "control-tower" | "freshness" | "audit"
  ) => void;
  opportunitiesSubTab: "pipeline" | "business-value";
  setOpportunitiesSubTab: (t: "pipeline" | "business-value") => void;
  presenterHintsEnabled: boolean;
  setPresenterHintsEnabled: (v: boolean) => void;

  // Guided demo & scenarios
  guidedDemoActive: boolean;
  setGuidedDemoActive: (v: boolean) => void;
  guidedDemoStep: number;
  setGuidedDemoStep: (step: number) => void;
  executeGuidedStepAction: (stepNumber: number) => Promise<void>;
  activeScenarioId: number | null;
  launchDemoScenario: (scenarioId: number) => Promise<void>;
  clearScenarioBanner: () => void;

  // Data freshness, dummy dataset safeguard & demo clock
  dataVersion: number;
  demoTimeOffsetHours: number;
  posSyncRefreshed: boolean;
  dummyDatasetSummary: {
    salonCount: number;
    monthlyRows: number;
    dailyRows: number;
    dataVersion: number;
  };
  ensureOrReloadDummyData: () => void;
  advanceDemoTime: (hours: number) => void;
  refreshPosRetailSource: () => void;
  triggerDataVersionRefresh: () => void;

  // Zenne Chatbot (Purple Theme, Bottom-Right) & AI Business Advisor state
  zenneOpen: boolean;
  setZenneOpen: (open: boolean) => void;
  zenneExpanded: boolean;
  setZenneExpanded: (expanded: boolean) => void;
  zenneThread: ZenneThreadEntry[];
  pendingClarification: ZenneClarificationPrompt | null;
  openZenneWithPrompt: (initialQuestion?: string) => Promise<void>;
  sendZenneMessage: (
    messageText: string,
    opts?: { skipClarification?: boolean; overridePersona?: PersonaId }
  ) => Promise<void>;
  clearZenneConversation: () => void;
  zenneAgent: ZenneAgentSelection;
  setZenneAgent: (agent: ZenneAgentSelection) => void;
  zenneToolMode: ZenneToolMode;
  setZenneToolMode: (mode: ZenneToolMode) => void;
  zenneAttachedDoc: ZenneUploadedDoc | null;
  setZenneAttachedDoc: (doc: ZenneUploadedDoc | null) => void;

  chatbotMode: ChatbotMode;
  setChatbotMode: (m: ChatbotMode) => void;
  analysisMode: "fast" | "deep";
  setAnalysisMode: (m: "fast" | "deep") => void;
  advisorLoading: boolean;
  currentMessages: AIResponseContract[];
  conversationContext: ConversationContextState;
  savedQuestions: string[];
  saveQuestionPrompt: (q: string) => void;
  policyWarningBanner: string | null;
  pendingHighCostQuestion: string | null;
  confirmHighCostQuery: () => Promise<void>;
  cancelHighCostQuery: () => void;
  askAdvisor: (
    question: string,
    opts?: { forceRefresh?: boolean; overridePersona?: PersonaId }
  ) => Promise<AIResponseContract | null>;
  markResponseFeedback: (
    responseId: string,
    feedback: "useful" | "not_useful"
  ) => void;
  clearConversation: () => void;

  // Zenne Saved Dashboard Widgets & Time Scheduler
  dashboardWidgets: SavedDashboardWidget[];
  saveZenneConversationToDashboard: (params: {
    response: AIResponseContract;
    originalQuestion: string;
    clarificationFocus?: string;
    widgetName: string;
    scheduledTime: string;
    cadence: "Daily" | "Weekly";
  }) => SavedDashboardWidget;
  updateDashboardWidgetSchedule: (
    widgetId: string,
    scheduledTime: string,
    cadence: "Daily" | "Weekly",
    scheduleEnabled: boolean
  ) => void;
  removeDashboardWidget: (widgetId: string) => void;
  refreshDashboardWidgetNow: (widgetId: string) => void;
  runScheduledWidgetRefreshes: () => void;

  // Saved insights & custom dashboards
  savedInsights: SavedInsight[];
  saveResponseAsInsight: (
    response: AIResponseContract,
    cadence?: "Daily" | "Weekly" | "Monthly"
  ) => SavedInsight;
  updateInsightSchedule: (
    insightId: string,
    schedule: ScheduleConfig | null
  ) => void;
  runSavedInsightNow: (insightId: string) => void;
  runAllDueScheduledJobs: () => void;

  dashboards: CustomDashboard[];
  createDashboard: (name: string, description: string) => CustomDashboard;
  renameDashboard: (dashboardId: string, newName: string) => void;
  pinInsightToDashboard: (
    insightId: string,
    dashboardId?: string
  ) => void;
  removeTileFromDashboard: (dashboardId: string, tileId: string) => void;
  resizeDashboardTile: (
    dashboardId: string,
    tileId: string,
    size: DashboardTile["size"]
  ) => void;
  reorderDashboardTile: (
    dashboardId: string,
    tileId: string,
    direction: "up" | "down"
  ) => void;
  updateDashboardTileSalonFilter: (
    dashboardId: string,
    tileId: string,
    salonFilter: string
  ) => void;
  refreshSingleTile: (dashboardId: string, tileId: string) => void;
  refreshAllDashboardTiles: (dashboardId: string) => void;

  // Opportunities, interventions & alerts
  opportunities: RevenueOpportunity[];
  updateOpportunityStatus: (id: string, status: OpportunityStatus) => void;
  interventions: InterventionRecord[];
  recordIntervention: (
    input: Omit<InterventionRecord, "id">
  ) => InterventionRecord;

  alertRules: AlertRule[];
  addAlertRule: (rule: Omit<AlertRule, "id">) => AlertRule;
  toggleAlertRule: (ruleId: string) => void;
  triggeredAlerts: TriggeredAlert[];
  simulateAlertTrigger: (ruleOrId: string | AlertRule) => void;
  updateAlertActionState: (
    alertId: string,
    status: TriggeredAlert["status"],
    assignedTo?: string
  ) => void;

  // Cockpit Guest Appointments Calendar & Customer Interaction Console + AI Assist
  appointments: GuestAppointment[];
  interactions: CustomerInteraction[];
  aiAssistLoading: boolean;
  rescheduleAppointment: (params: {
    appointmentId: string;
    newDate: string;
    newStartTime: string;
    newStylistName: string;
    reason: string;
    waiveFee?: boolean;
  }) => void;
  cancelAppointment: (params: {
    appointmentId: string;
    reason: string;
    waiveCancellationFee: boolean;
  }) => void;
  sendConsoleManagerReply: (interactionId: string, replyText: string) => void;
  simulateIncomingCustomerTurn: (interactionId: string) => void;
  askCockpitAiAssist: (params: {
    interactionId?: string;
    customQuestion: string;
  }) => Promise<AIAssistSuggestion>;

  // Governance, Control Tower, Audit & Sharing
  policy: GovernancePolicy;
  updatePolicy: (patch: Partial<GovernancePolicy>, summaryNote: string) => void;
  restorePreviousApprovedPolicy: () => void;
  agents: AgentIdentityRecord[];
  toggleAgentEnabled: (agentId: string) => void;
  controlTowerEvents: ControlTowerEvent[];
  safetyResults: SafetyTestResult[];
  executeSafetyTestSuite: () => void;
  outbox: OutboxMessage[];
  verifyExportChannelAllowed: (
    channel: "PDF" | "CSV",
    reportLabel: string
  ) => boolean;
  sendSimulatedShare: (params: {
    channel: "Email" | "WhatsApp" | "SMS";
    recipient: string;
    subject: string;
    bodyPreview: string;
    reportType: string;
  }) => { ok: boolean; error?: string; message?: OutboxMessage };
  auditLog: AuditEvent[];
  appendAuditEvent: (
    category: AuditEvent["category"],
    summary: string,
    outcome?: AuditEvent["outcome"],
    metadata?: string
  ) => void;
  resetPrototypeState: () => void;

  toast: { id: number; text: string; tone: "teal" | "amber" | "red" } | null;
  notify: (text: string, tone?: "teal" | "amber" | "red") => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const loaded = useMemo<Partial<PersistedSlice>>(() => {
    try {
      localStorage.removeItem("insightflow_enterprise_state_v1");
      localStorage.removeItem("insightflow_enterprise_state_v2");
      localStorage.removeItem("insightflow_enterprise_state_v3");
      localStorage.removeItem("insightflow_wellness_zenne_v4");
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);

  const [showOnboarding, setShowOnboarding] = useState<boolean>(true);
  const [authSession, setAuthSession] = useState<UserAuthSession>(() =>
    buildUserAuthSession("Operations Portal", "regional_manager")
  );
  const [activePersona, setActivePersona] = useState<PersonaId>("arjun");
  const [activeNav, setActiveNavState] = useState<NavSection>("dashboard");
  const [cockpitSubTab, setCockpitSubTab] = useState<CockpitSubTab>("calendar");
  const [settingsSubTab, setSettingsSubTab] = useState<
    "agents" | "control-tower" | "freshness" | "audit"
  >("agents");
  const [opportunitiesSubTab, setOpportunitiesSubTab] = useState<
    "pipeline" | "business-value"
  >("pipeline");
  const [presenterHintsEnabled, setPresenterHintsEnabled] = useState<boolean>(
    loaded.presenterHintsEnabled ?? false
  );

  const [guidedDemoActive, setGuidedDemoActive] = useState<boolean>(false);
  const [guidedDemoStep, setGuidedDemoStep] = useState<number>(1);
  const [activeScenarioId, setActiveScenarioId] = useState<number | null>(null);

  const [dataVersion, setDataVersion] = useState<number>(
    loaded.dataVersion ?? 1
  );
  const [demoTimeOffsetHours, setDemoTimeOffsetHours] = useState<number>(
    loaded.demoTimeOffsetHours ?? 0
  );
  const [posSyncRefreshed, setPosSyncRefreshed] = useState<boolean>(
    loaded.posSyncRefreshed ?? false
  );

  // Guarantee dummy dataset exists immediately on workspace boot
  const dummyDatasetSummary = useMemo(() => {
    const ds = ensureSyntheticDatasetReady(dataVersion);
    return {
      salonCount: SALONS.length,
      monthlyRows: ds.monthly.length,
      dailyRows: ds.daily30.length,
      dataVersion,
    };
  }, [dataVersion]);

  // Zenne Chatbot state
  const [zenneOpen, setZenneOpen] = useState<boolean>(false);
  const [zenneExpanded, setZenneExpanded] = useState<boolean>(false);
  const [zenneThreadsByPersona, setZenneThreadsByPersona] = useState<
    Record<PersonaId, ZenneThreadEntry[]>
  >({
    arjun: [],
    meera: [],
    neha: [],
  });
  const [pendingClarificationByPersona, setPendingClarificationByPersona] =
    useState<Record<PersonaId, ZenneClarificationPrompt | null>>({
      arjun: null,
      meera: null,
      neha: null,
    });

  const [chatbotMode, setChatbotMode] =
    useState<ChatbotMode>("business-advisor");
  const [analysisMode, setAnalysisMode] = useState<"fast" | "deep">("deep");
  const [zenneAgent, setZenneAgentState] =
    useState<ZenneAgentSelection>("ai-business-advisor");
  const [zenneToolMode, setZenneToolModeState] =
    useState<ZenneToolMode>("deep-research");
  const [zenneAttachedDoc, setZenneAttachedDocState] =
    useState<ZenneUploadedDoc | null>(null);
  const [advisorLoading, setAdvisorLoading] = useState<boolean>(false);
  const [messagesByPersona, setMessagesByPersona] = useState<
    Record<PersonaId, AIResponseContract[]>
  >({
    arjun: [],
    meera: [],
    neha: [],
  });
  const [contextByPersona, setContextByPersona] = useState<
    Record<PersonaId, ConversationContextState>
  >(INITIAL_CONTEXT_BY_PERSONA);

  const [savedQuestions, setSavedQuestions] = useState<string[]>(
    loaded.savedQuestions ?? [
      "Which salons had the biggest decline in repeat visits in the last 30 days?",
      "Which salons have the highest unused stylist capacity?",
      "Where should I focus to improve profitability this quarter?",
    ]
  );
  const [policyWarningBanner, setPolicyWarningBanner] = useState<string | null>(
    null
  );
  const [pendingHighCostQuestion, setPendingHighCostQuestion] = useState<
    string | null
  >(null);

  const [dashboardWidgets, setDashboardWidgets] = useState<
    SavedDashboardWidget[]
  >(
    () =>
      loaded.dashboardWidgets ??
      createInitialDashboardWidgets(
        loaded.dataVersion ?? 1,
        loaded.demoTimeOffsetHours ?? 0,
        loaded.posSyncRefreshed ?? false
      )
  );

  const [savedInsights, setSavedInsights] = useState<SavedInsight[]>(
    () =>
      loaded.savedInsights ??
      createInitialSavedInsights(
        loaded.dataVersion ?? 1,
        loaded.posSyncRefreshed ?? false
      )
  );
  const [dashboards, setDashboards] = useState<CustomDashboard[]>(
    () => loaded.dashboards ?? createInitialDashboards()
  );
  const [rawOpportunities, setRawOpportunities] = useState<
    RevenueOpportunity[]
  >(
    () =>
      loaded.opportunities ??
      buildInitialOpportunities(
        loaded.dataVersion ?? 1,
        loaded.posSyncRefreshed ?? false
      )
  );
  const [rawAppointments, setRawAppointments] = useState<GuestAppointment[]>(
    () => loaded.appointments ?? createInitialAppointments()
  );
  const [rawInteractions, setRawInteractions] = useState<CustomerInteraction[]>(
    () => loaded.interactions ?? createInitialInteractions()
  );
  const [aiAssistLoading, setAiAssistLoading] = useState<boolean>(false);
  const [interventions, setInterventions] = useState<InterventionRecord[]>(
    () => loaded.interventions ?? INITIAL_INTERVENTIONS
  );
  const [alertRules, setAlertRules] = useState<AlertRule[]>(
    () => loaded.alertRules ?? INITIAL_ALERT_RULES
  );
  const [alertStatusMap, setAlertStatusMap] = useState<
    Record<string, TriggeredAlert["status"]>
  >(() => loaded.alertStatusMap ?? {});
  const [alertAssigneeMap, setAlertAssigneeMap] = useState<
    Record<string, string>
  >(() => loaded.alertAssigneeMap ?? {});
  const [manualSimulatedAlerts, setManualSimulatedAlerts] = useState<
    TriggeredAlert[]
  >(() => loaded.manualSimulatedAlerts ?? []);

  const [policy, setPolicy] = useState<GovernancePolicy>(() => ({
    ...DEFAULT_GOVERNANCE_POLICY,
    ...(loaded.policy ?? {}),
  }));
  const [previousApprovedPolicy, setPreviousApprovedPolicy] =
    useState<GovernancePolicy>(
      () => loaded.previousApprovedPolicy ?? DEFAULT_GOVERNANCE_POLICY
    );
  const [agents, setAgents] = useState<AgentIdentityRecord[]>(
    () => loaded.agents ?? INITIAL_AGENT_IDENTITIES
  );
  const [controlTowerEvents, setControlTowerEvents] = useState<
    ControlTowerEvent[]
  >(() => loaded.controlTowerEvents ?? generateInitialControlTowerEvents());
  const [safetyResults, setSafetyResults] = useState<SafetyTestResult[]>(() =>
    runGovernanceSafetySuite({
      policy: loaded.policy ?? DEFAULT_GOVERNANCE_POLICY,
      posSyncRefreshed: loaded.posSyncRefreshed ?? false,
      dataVersion: loaded.dataVersion ?? 1,
    })
  );
  const [outbox, setOutbox] = useState<OutboxMessage[]>(
    () => loaded.outbox ?? []
  );
  const [auditLog, setAuditLog] = useState<AuditEvent[]>(
    () => loaded.auditLog ?? INITIAL_AUDIT_EVENTS
  );

  // Synchronous refs to eliminate React 18 batching race conditions on back-to-back calls
  const contextRef = useRef(contextByPersona);
  contextRef.current = contextByPersona;

  const messagesRef = useRef(messagesByPersona);
  messagesRef.current = messagesByPersona;

  const zenneThreadsRef = useRef(zenneThreadsByPersona);
  zenneThreadsRef.current = zenneThreadsByPersona;

  const pendingClarRef = useRef(pendingClarificationByPersona);
  pendingClarRef.current = pendingClarificationByPersona;

  const dashboardWidgetsRef = useRef(dashboardWidgets);
  dashboardWidgetsRef.current = dashboardWidgets;

  const savedInsightsRef = useRef(savedInsights);
  savedInsightsRef.current = savedInsights;

  const alertRulesRef = useRef(alertRules);
  alertRulesRef.current = alertRules;

  const dataVersionRef = useRef(dataVersion);
  dataVersionRef.current = dataVersion;

  const demoTimeOffsetRef = useRef(demoTimeOffsetHours);
  demoTimeOffsetRef.current = demoTimeOffsetHours;

  const posSyncRefreshedRef = useRef(posSyncRefreshed);
  posSyncRefreshedRef.current = posSyncRefreshed;

  const authSessionRef = useRef(authSession);
  authSessionRef.current = authSession;

  const chatbotModeRef = useRef(chatbotMode);
  chatbotModeRef.current = chatbotMode;

  const zenneAgentRef = useRef(zenneAgent);
  zenneAgentRef.current = zenneAgent;

  const zenneToolModeRef = useRef(zenneToolMode);
  zenneToolModeRef.current = zenneToolMode;

  const zenneAttachedDocRef = useRef(zenneAttachedDoc);
  zenneAttachedDocRef.current = zenneAttachedDoc;

  const setZenneAgent = useCallback((nextAgent: ZenneAgentSelection) => {
    zenneAgentRef.current = nextAgent;
    setZenneAgentState(nextAgent);
    const mappedChatMode: ChatbotMode =
      nextAgent === "ai-retention-manager"
        ? "retention-coach"
        : zenneToolModeRef.current === "search"
          ? "data-qa"
          : "business-advisor";
    chatbotModeRef.current = mappedChatMode;
    setChatbotMode(mappedChatMode);
  }, []);

  const setZenneToolMode = useCallback((nextMode: ZenneToolMode) => {
    zenneToolModeRef.current = nextMode;
    setZenneToolModeState(nextMode);
    setAnalysisMode(nextMode === "deep-research" ? "deep" : "fast");
    const mappedChatMode: ChatbotMode =
      zenneAgentRef.current === "ai-retention-manager"
        ? "retention-coach"
        : nextMode === "search"
          ? "data-qa"
          : "business-advisor";
    chatbotModeRef.current = mappedChatMode;
    setChatbotMode(mappedChatMode);
  }, []);

  const setZenneAttachedDoc = useCallback((doc: ZenneUploadedDoc | null) => {
    zenneAttachedDocRef.current = doc;
    setZenneAttachedDocState(doc);
  }, []);

  const lastAutoScheduledMinuteRef = useRef<string>("");

  const [toast, setToast] = useState<{
    id: number;
    text: string;
    tone: "teal" | "amber" | "red";
  } | null>(null);

  const notify = useCallback(
    (text: string, tone: "teal" | "amber" | "red" = "teal") => {
      const id = Date.now();
      setToast({ id, text, tone });
      setTimeout(() => {
        setToast((prev) => (prev?.id === id ? null : prev));
      }, 4500);
    },
    []
  );

  // Persist complete workspace state to browser localStorage
  useEffect(() => {
    try {
      const payload: PersistedSlice = {
        savedInsights,
        dashboards,
        dashboardWidgets,
        policy,
        previousApprovedPolicy,
        alertRules,
        interventions,
        opportunities: rawOpportunities,
        appointments: rawAppointments,
        interactions: rawInteractions,
        outbox,
        auditLog,
        savedQuestions,
        presenterHintsEnabled,
        dataVersion,
        demoTimeOffsetHours,
        posSyncRefreshed,
        agents,
        controlTowerEvents,
        alertStatusMap,
        alertAssigneeMap,
        manualSimulatedAlerts,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota issues in restricted browsers
    }
  }, [
    savedInsights,
    dashboards,
    dashboardWidgets,
    policy,
    previousApprovedPolicy,
    alertRules,
    interventions,
    rawOpportunities,
    rawAppointments,
    rawInteractions,
    outbox,
    auditLog,
    savedQuestions,
    presenterHintsEnabled,
    dataVersion,
    demoTimeOffsetHours,
    posSyncRefreshed,
    agents,
    controlTowerEvents,
    alertStatusMap,
    alertAssigneeMap,
    manualSimulatedAlerts,
  ]);

  const appendAuditEvent = useCallback(
    (
      category: AuditEvent["category"],
      summary: string,
      outcome: AuditEvent["outcome"] = "Allowed",
      metadata = "",
      overridePersona?: PersonaId
    ) => {
      const pId = overridePersona ?? activePersona;
      const persona = PERSONAS[pId];
      const evt: AuditEvent = {
        id: `AUD-${Date.now()}-${Math.floor(Math.random() * 90 + 10)}`,
        timestamp:
          new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
        actorPersona: pId,
        actorName: persona.name,
        category,
        summary,
        scopeLabel: `${persona.assignedRegion} (${persona.allowedSalonIds.length} salons)`,
        outcome,
        metadata,
      };
      setAuditLog((prev) => [evt, ...prev]);
    },
    [activePersona]
  );

  const setActiveNav = useCallback((nav: NavSection) => {
    if (nav === "advisor") {
      setZenneOpen(true);
      return;
    }
    if (
      nav === "overview" ||
      nav === "dashboards" ||
      nav === "saved-insights"
    ) {
      setActiveNavState("dashboard");
      return;
    }
    if (nav === "cockpit") {
      setCockpitSubTab("calendar");
      setActiveNavState("cockpit");
      return;
    }
    if (nav === "opportunities") {
      setCockpitSubTab("opportunities");
      setActiveNavState("cockpit");
      return;
    }
    if (nav === "alerts") {
      setCockpitSubTab("alerts");
      setActiveNavState("cockpit");
      return;
    }
    if (nav === "reports") {
      setCockpitSubTab("reports");
      setActiveNavState("cockpit");
      return;
    }
    if (nav === "governance") {
      setSettingsSubTab("agents");
      setActiveNavState("settings");
      return;
    }
    if (nav === "control-tower") {
      setSettingsSubTab("control-tower");
      setActiveNavState("settings");
      return;
    }
    if (nav === "audit") {
      setSettingsSubTab("audit");
      setActiveNavState("settings");
      return;
    }
    setActiveNavState(nav);
  }, []);

  const switchPersona = useCallback(
    (personaId: PersonaId, targetNav?: NavSection) => {
      const mappedRole: LoginRoleKey =
        personaId === "meera"
          ? "chief_operating_officer"
          : personaId === "neha"
            ? "governance_admin"
            : "regional_manager";
      const mappedLoginType: LoginType =
        personaId === "meera"
          ? "Executive Suite"
          : personaId === "neha"
            ? "Governance Console"
            : "Operations Portal";
      const nextSession = buildUserAuthSession(mappedLoginType, mappedRole);
      authSessionRef.current = nextSession;
      setAuthSession(nextSession);
      setActivePersona(personaId);
      setPolicyWarningBanner(null);
      if (targetNav) {
        setActiveNav(targetNav);
      } else if (
        !["dashboard", "cockpit", "staff", "settings"].includes(activeNav)
      ) {
        setActiveNavState("dashboard");
      }
    },
    [activeNav, setActiveNav]
  );

  // Derived todayTokensUsed & monthSpendUsd from ControlTowerEvents
  const todayTokensUsed = useMemo(
    () =>
      controlTowerEvents
        .filter((e) => e.date === "2026-10-24")
        .reduce((s, e) => s + e.tokensConsumed, 0),
    [controlTowerEvents]
  );

  const monthSpendUsd = useMemo(
    () =>
      Number(
        controlTowerEvents.reduce((s, e) => s + e.costUsd, 0).toFixed(2)
      ),
    [controlTowerEvents]
  );

  const executeQueryInternal = useCallback(
    async (
      question: string,
      opts?: {
        clarificationFocus?: string;
        forceRefresh?: boolean;
        highCostApproved?: boolean;
        overridePersona?: PersonaId;
        uploadedDoc?: ZenneUploadedDoc;
        toolModeOverride?: ZenneToolMode;
        agentOverride?: ZenneAgentSelection;
      }
    ): Promise<AIResponseContract | null> => {
      const targetPersona = opts?.overridePersona ?? activePersona;
      if (!opts?.overridePersona && !authSessionRef.current.canAccessChatbot) {
        appendAuditEvent(
          "ACCESS_BLOCKED",
          `RBAC blocked Zenne query under ${authSessionRef.current.loginType} · ${authSessionRef.current.roleLabel}`,
          "Blocked",
          "Missing bi.chatbot.advisor entitlement",
          targetPersona
        );
        notify(
          authSessionRef.current.rbacDenialReason ??
            "RBAC Policy blocked Zenne access for the selected login type and role.",
          "red"
        );
        return null;
      }

      // Ensure dummy dataset is populated before querying
      ensureSyntheticDatasetReady(dataVersionRef.current);

      const effectiveAgentSelection =
        opts?.agentOverride ?? zenneAgentRef.current;
      const effectiveAgentProduct: "AI Business Advisor" | "AI Retention Manager" =
        effectiveAgentSelection === "ai-retention-manager"
          ? "AI Retention Manager"
          : "AI Business Advisor";
      const effectiveToolMode =
        opts?.toolModeOverride ?? zenneToolModeRef.current;
      const effectiveAnalysisMode: "fast" | "deep" =
        effectiveToolMode === "deep-research" ? "deep" : "fast";

      const selectedAgentRecord = agents.find(
        (a) => a.productName === effectiveAgentProduct
      );
      setAdvisorLoading(true);
      setPolicyWarningBanner(null);

      const userQueriesLastHour = controlTowerEvents.filter(
        (e) =>
          e.id.startsWith("CT-LIVE-") &&
          e.user === PERSONAS[targetPersona].name &&
          !e.cacheHit &&
          e.status === "Success"
      ).length;

      try {
        const outcome = await executeAdvisorQuery({
          question,
          clarificationFocus: opts?.clarificationFocus,
          personaId: targetPersona,
          analysisMode: effectiveAnalysisMode,
          chatbotMode: chatbotModeRef.current,
          agentProductName: effectiveAgentProduct,
          toolMode: effectiveToolMode,
          uploadedDoc: opts?.uploadedDoc,
          context: contextRef.current[targetPersona],
          policy,
          agentEnabled: selectedAgentRecord?.enabled ?? true,
          todayTokensUsed,
          monthSpendUsd,
          userQueriesLastHour,
          dataVersion: dataVersionRef.current,
          demoTimeOffsetHours: demoTimeOffsetRef.current,
          posSyncRefreshed: posSyncRefreshedRef.current,
          forceRefresh: opts?.forceRefresh,
          highCostApproved: opts?.highCostApproved,
        });

        if (outcome.requiresHighCostConfirmation) {
          setPendingHighCostQuestion(question);
          setAdvisorLoading(false);
          return null;
        }

        if (outcome.policyWarningBanner) {
          setPolicyWarningBanner(outcome.policyWarningBanner);
        }

        const nextMessages = {
          ...messagesRef.current,
          [targetPersona]: [
            ...messagesRef.current[targetPersona],
            outcome.response,
          ],
        };
        messagesRef.current = nextMessages;
        setMessagesByPersona(nextMessages);

        const nextContextMap = {
          ...contextRef.current,
          [targetPersona]: outcome.nextContext,
        };
        contextRef.current = nextContextMap;
        setContextByPersona(nextContextMap);

        // Log in Control Tower & Audit Trail under the selected governed AI Agent
        const ctEvt: ControlTowerEvent = {
          id: `CT-LIVE-${Date.now()}-${Math.floor(Math.random() * 90 + 10)}`,
          date: "2026-10-24",
          timestamp:
            new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
          product: effectiveAgentProduct,
          user: PERSONAS[targetPersona].name,
          region: PERSONAS[targetPersona].assignedRegion,
          requestType:
            effectiveAgentProduct === "AI Retention Manager" &&
            effectiveAnalysisMode === "fast"
              ? "Retention Campaign"
              : effectiveAnalysisMode === "deep"
                ? "Deep Analysis"
                : "Fast Analysis",
          tokensConsumed: outcome.response.calculationDetails.tokensUsed,
          costUsd: outcome.response.calculationDetails.estimatedCostUsd,
          latencyMs: outcome.response.calculationDetails.latencyMs,
          cacheHit:
            outcome.response.calculationDetails.executionSource ===
            "Certified Cache Reused",
          status: outcome.policyBlocked ? "Blocked" : "Success",
          isLiveGeminiMetadata:
            !outcome.response.calculationDetails.isSimulatedTokenEstimate,
          detail: opts?.clarificationFocus
            ? `[${effectiveToolMode}] ${question.slice(0, 42)} · Focus: ${opts.clarificationFocus.slice(0, 32)}`
            : `[${effectiveToolMode}] ${question.slice(0, 76)}`,
        };
        setControlTowerEvents((prev) => [ctEvt, ...prev]);

        appendAuditEvent(
          outcome.policyBlocked ? "ACCESS_BLOCKED" : "QUERY_EXECUTED",
          `${outcome.policyBlocked ? `Blocked ${effectiveAgentProduct} query` : `${effectiveAgentProduct} (${effectiveToolMode}) completed`}: "${question.slice(0, 60)}"`,
          outcome.policyBlocked ? "Blocked" : "Allowed",
          `${outcome.response.calculationDetails.executionSource} · ${outcome.response.calculationDetails.tokensUsed} tokens`,
          targetPersona
        );

        return outcome.response;
      } finally {
        setAdvisorLoading(false);
      }
    },
    [
      activePersona,
      agents,
      policy,
      todayTokensUsed,
      monthSpendUsd,
      controlTowerEvents,
      appendAuditEvent,
      notify,
    ]
  );

  const sendZenneMessage = useCallback(
    async (
      messageText: string,
      opts?: { skipClarification?: boolean; overridePersona?: PersonaId }
    ) => {
      const consumedDoc = zenneAttachedDocRef.current ?? undefined;
      const trimmed =
        messageText.trim() ||
        (consumedDoc
          ? `Analyze uploaded document "${consumedDoc.name}" against our certified salon metrics.`
          : "");
      if (!trimmed) return;

      if (consumedDoc) {
        zenneAttachedDocRef.current = null;
        setZenneAttachedDocState(null);
      }

      const targetPersona = opts?.overridePersona ?? activePersona;
      setZenneOpen(true);

      if (!opts?.overridePersona && !authSessionRef.current.canAccessChatbot) {
        appendAuditEvent(
          "ACCESS_BLOCKED",
          `RBAC blocked Zenne chatbot message under ${authSessionRef.current.roleLabel}`,
          "Blocked",
          "Missing bi.chatbot.advisor entitlement",
          targetPersona
        );
        notify(
          authSessionRef.current.rbacDenialReason ??
            "RBAC Policy restricts Zenne Chatbot access for this role.",
          "red"
        );
        return;
      }

      const nowDisplay = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const currentAgentSelection = zenneAgentRef.current;
      const currentAgentProduct: "AI Business Advisor" | "AI Retention Manager" =
        currentAgentSelection === "ai-retention-manager"
          ? "AI Retention Manager"
          : "AI Business Advisor";
      const currentToolMode = zenneToolModeRef.current;

      const activeClarification = pendingClarRef.current[targetPersona];

      // Step 2 of 2: User is responding to Zenne's follow-up questions!
      if (
        activeClarification &&
        !opts?.skipClarification &&
        currentToolMode === "deep-research"
      ) {
        const carryDoc = consumedDoc ?? activeClarification.uploadedDoc;
        const userEntry: ZenneThreadEntry = {
          id: `ZT-USR-${Date.now()}`,
          kind: "user",
          timestamp: nowDisplay,
          text: trimmed,
          isClarificationReply: true,
          agentSelection: currentAgentSelection,
          toolMode: currentToolMode,
          uploadedDoc: consumedDoc,
        };

        const updatedThreadWithReply = [
          ...zenneThreadsRef.current[targetPersona].map((entry) =>
            entry.kind === "clarification" &&
            entry.clarification.id === activeClarification.id
              ? { ...entry, answeredWith: trimmed }
              : entry
          ),
          userEntry,
        ];
        const nextThreads1 = {
          ...zenneThreadsRef.current,
          [targetPersona]: updatedThreadWithReply,
        };
        zenneThreadsRef.current = nextThreads1;
        setZenneThreadsByPersona(nextThreads1);

        const clearedPending = {
          ...pendingClarRef.current,
          [targetPersona]: null,
        };
        pendingClarRef.current = clearedPending;
        setPendingClarificationByPersona(clearedPending);

        const resp = await executeQueryInternal(
          activeClarification.originalQuestion,
          {
            clarificationFocus: trimmed,
            overridePersona: targetPersona,
            uploadedDoc: carryDoc,
            toolModeOverride: currentToolMode,
            agentOverride: currentAgentSelection,
          }
        );

        if (resp) {
          const answerEntry: ZenneThreadEntry = {
            id: `ZT-ANS-${Date.now()}`,
            kind: "answer",
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            originalQuestion: activeClarification.originalQuestion,
            clarificationFocus: trimmed,
            agentSelection: currentAgentSelection,
            toolMode: currentToolMode,
            uploadedDoc: carryDoc,
            response: resp,
          };
          const nextThreads2 = {
            ...zenneThreadsRef.current,
            [targetPersona]: [
              ...zenneThreadsRef.current[targetPersona],
              answerEntry,
            ],
          };
          zenneThreadsRef.current = nextThreads2;
          setZenneThreadsByPersona(nextThreads2);
        }
        return;
      }

      // If user switched to Ask or Search while a clarification was pending, clear pending clarification cleanly
      if (activeClarification && currentToolMode !== "deep-research") {
        const clearedPending = {
          ...pendingClarRef.current,
          [targetPersona]: null,
        };
        pendingClarRef.current = clearedPending;
        setPendingClarificationByPersona(clearedPending);
      }

      // Step 1: New message submitted to Zenne
      const userEntry: ZenneThreadEntry = {
        id: `ZT-USR-${Date.now()}`,
        kind: "user",
        timestamp: nowDisplay,
        text: trimmed,
        agentSelection: currentAgentSelection,
        toolMode: currentToolMode,
        uploadedDoc: consumedDoc,
      };
      const threadAfterUser = {
        ...zenneThreadsRef.current,
        [targetPersona]: [...zenneThreadsRef.current[targetPersona], userEntry],
      };
      zenneThreadsRef.current = threadAfterUser;
      setZenneThreadsByPersona(threadAfterUser);

      const selectedAgentRecord = agents.find(
        (a) => a.productName === currentAgentProduct
      );
      const userQueriesLastHour = controlTowerEvents.filter(
        (e) =>
          e.id.startsWith("CT-LIVE-") &&
          e.user === PERSONAS[targetPersona].name &&
          !e.cacheHit &&
          e.status === "Success"
      ).length;

      const shouldAskClarification =
        currentToolMode === "deep-research" &&
        !opts?.skipClarification &&
        policy.requireClarifyingFollowUp !== false;

      if (shouldAskClarification) {
        const prep = prepareZenneClarificationTurn({
          question: trimmed,
          personaId: targetPersona,
          analysisMode: "deep",
          agentProductName: currentAgentProduct,
          uploadedDoc: consumedDoc,
          context: contextRef.current[targetPersona],
          policy,
          agentEnabled: selectedAgentRecord?.enabled ?? true,
          todayTokensUsed,
          monthSpendUsd,
          userQueriesLastHour,
          demoTimeOffsetHours: demoTimeOffsetRef.current,
          posSyncRefreshed: posSyncRefreshedRef.current,
        });

        if (!prep.shouldBypassClarification) {
          const clarEntry: ZenneThreadEntry = {
            id: `ZT-CLR-${Date.now()}`,
            kind: "clarification",
            timestamp: nowDisplay,
            clarification: prep.clarification,
            agentSelection: currentAgentSelection,
          };
          const nextThreadsClar = {
            ...zenneThreadsRef.current,
            [targetPersona]: [
              ...zenneThreadsRef.current[targetPersona],
              clarEntry,
            ],
          };
          zenneThreadsRef.current = nextThreadsClar;
          setZenneThreadsByPersona(nextThreadsClar);

          const nextPending = {
            ...pendingClarRef.current,
            [targetPersona]: prep.clarification,
          };
          pendingClarRef.current = nextPending;
          setPendingClarificationByPersona(nextPending);

          appendAuditEvent(
            "QUERY_EXECUTED",
            `Zenne (${currentAgentProduct}) initiated clarifying follow-up questions for "${trimmed.slice(0, 56)}"`,
            "Allowed",
            "Deep Research Clarifying Step 1/2",
            targetPersona
          );
          return;
        }
      }

      // Direct execution (Ask mode, Search mode, contextual follow-up, or policy/RBAC gate)
      const resp = await executeQueryInternal(trimmed, {
        overridePersona: targetPersona,
        uploadedDoc: consumedDoc,
        toolModeOverride: currentToolMode,
        agentOverride: currentAgentSelection,
      });
      if (resp) {
        const answerEntry: ZenneThreadEntry = {
          id: `ZT-ANS-${Date.now()}`,
          kind: "answer",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          originalQuestion: trimmed,
          agentSelection: currentAgentSelection,
          toolMode: currentToolMode,
          uploadedDoc: consumedDoc,
          response: resp,
        };
        const nextThreadsAns = {
          ...zenneThreadsRef.current,
          [targetPersona]: [
            ...zenneThreadsRef.current[targetPersona],
            answerEntry,
          ],
        };
        zenneThreadsRef.current = nextThreadsAns;
        setZenneThreadsByPersona(nextThreadsAns);
      }
    },
    [
      activePersona,
      agents,
      controlTowerEvents,
      policy,
      todayTokensUsed,
      monthSpendUsd,
      executeQueryInternal,
      appendAuditEvent,
      notify,
    ]
  );

  const openZenneWithPrompt = useCallback(
    async (initialQuestion?: string) => {
      setZenneOpen(true);
      if (initialQuestion && initialQuestion.trim().length > 0) {
        await sendZenneMessage(initialQuestion);
      }
    },
    [sendZenneMessage]
  );

  const askAdvisor = useCallback(
    async (
      question: string,
      opts?: { forceRefresh?: boolean; overridePersona?: PersonaId }
    ) => {
      setZenneOpen(true);
      const resp = await executeQueryInternal(question, opts);
      if (resp) {
        const targetP = opts?.overridePersona ?? activePersona;
        const nowDisplay = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        const nextThreads = {
          ...zenneThreadsRef.current,
          [targetP]: [
            ...zenneThreadsRef.current[targetP],
            {
              id: `ZT-USR-${Date.now()}-1`,
              kind: "user" as const,
              timestamp: nowDisplay,
              text: question,
            },
            {
              id: `ZT-ANS-${Date.now()}-2`,
              kind: "answer" as const,
              timestamp: nowDisplay,
              originalQuestion: question,
              response: resp,
            },
          ],
        };
        zenneThreadsRef.current = nextThreads;
        setZenneThreadsByPersona(nextThreads);
      }
      return resp;
    },
    [activePersona, executeQueryInternal]
  );

  const loginWithRole = useCallback(
    async (
      loginType: LoginType,
      roleKey: LoginRoleKey,
      targetNav: NavSection = "dashboard"
    ) => {
      ensureSyntheticDatasetReady(dataVersionRef.current);
      const nextSession = buildUserAuthSession(loginType, roleKey);
      authSessionRef.current = nextSession;
      setAuthSession(nextSession);
      setActivePersona(nextSession.mappedPersonaId);
      setPolicyWarningBanner(null);
      setGuidedDemoActive(false);
      setShowOnboarding(false);

      setActiveNav(targetNav);

      if (!nextSession.canAccessChatbot) {
        appendAuditEvent(
          "ACCESS_BLOCKED",
          `Signed in via ${loginType} as ${nextSession.roleLabel} — RBAC restricted Zenne Chatbot access`,
          "Blocked",
          "RBAC Entitlement Check: Denied",
          nextSession.mappedPersonaId
        );
        notify(
          `Signed in as ${nextSession.roleLabel}. Zenne Chatbot access is restricted by RBAC.`,
          "amber"
        );
        return;
      }

      chatbotModeRef.current = "business-advisor";
      setChatbotMode("business-advisor");

      appendAuditEvent(
        "ACTION_APPROVED",
        `Authenticated via ${loginType} as ${nextSession.roleLabel} — Wellness Workspace & Zenne enabled`,
        "Allowed",
        nextSession.departmentScope,
        nextSession.mappedPersonaId
      );

      notify(
        `Signed in as ${nextSession.roleLabel} (${nextSession.departmentScope}). Click Zenne in the bottom right anytime.`,
        "teal"
      );
    },
    [appendAuditEvent, notify, setActiveNav]
  );

  const confirmHighCostQuery = useCallback(async () => {
    if (!pendingHighCostQuestion) return;
    const q = pendingHighCostQuestion;
    setPendingHighCostQuestion(null);
    appendAuditEvent(
      "ACTION_APPROVED",
      `User confirmed high-cost Deep Research execution: "${q.slice(0, 60)}"`,
      "Allowed",
      "High-cost governance approval"
    );
    const resp = await executeQueryInternal(q, { highCostApproved: true });
    if (resp) {
      const nowDisplay = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const nextThreads = {
        ...zenneThreadsRef.current,
        [activePersona]: [
          ...zenneThreadsRef.current[activePersona],
          {
            id: `ZT-ANS-${Date.now()}`,
            kind: "answer" as const,
            timestamp: nowDisplay,
            originalQuestion: q,
            response: resp,
          },
        ],
      };
      zenneThreadsRef.current = nextThreads;
      setZenneThreadsByPersona(nextThreads);
    }
  }, [activePersona, pendingHighCostQuestion, appendAuditEvent, executeQueryInternal]);

  const cancelHighCostQuery = useCallback(() => {
    setPendingHighCostQuestion(null);
  }, []);

  const markResponseFeedback = useCallback(
    (responseId: string, feedback: "useful" | "not_useful") => {
      setMessagesByPersona((prev) => {
        const next = {
          ...prev,
          [activePersona]: prev[activePersona].map((m) =>
            m.id === responseId ? { ...m, userFeedback: feedback } : m
          ),
        };
        messagesRef.current = next;
        return next;
      });
      setZenneThreadsByPersona((prev) => {
        const next = {
          ...prev,
          [activePersona]: prev[activePersona].map((entry) =>
            entry.kind === "answer" && entry.response.id === responseId
              ? {
                  ...entry,
                  response: { ...entry.response, userFeedback: feedback },
                }
              : entry
          ),
        };
        zenneThreadsRef.current = next;
        return next;
      });
      appendAuditEvent(
        "ACTION_APPROVED",
        `Recorded analyst feedback (${feedback}) on Zenne response ${responseId}`,
        "Allowed",
        "Response Quality Telemetry"
      );
      notify(
        feedback === "useful"
          ? "Feedback recorded: Marked insight as useful."
          : "Feedback recorded: Flagged response for analyst review.",
        "teal"
      );
    },
    [activePersona, appendAuditEvent, notify]
  );

  const clearZenneConversation = useCallback(() => {
    setZenneThreadsByPersona((prev) => {
      const next = { ...prev, [activePersona]: [] };
      zenneThreadsRef.current = next;
      return next;
    });
    setPendingClarificationByPersona((prev) => {
      const next = { ...prev, [activePersona]: null };
      pendingClarRef.current = next;
      return next;
    });
    setMessagesByPersona((prev) => {
      const next = { ...prev, [activePersona]: [] };
      messagesRef.current = next;
      return next;
    });
    setContextByPersona((prev) => {
      const next = {
        ...prev,
        [activePersona]: {
          lastTopicKey: null,
          focusedSalonIds: [],
          lastTimeRange: "Last 30 Days",
          turnCount: 0,
        },
      };
      contextRef.current = next;
      return next;
    });
  }, [activePersona]);

  const clearConversation = clearZenneConversation;

  const saveQuestionPrompt = useCallback(
    (q: string) => {
      setSavedQuestions((prev) => (prev.includes(q) ? prev : [q, ...prev]));
      notify("Question added to Saved Prompts.", "teal");
    },
    [notify]
  );

  const saveResponseAsInsight = useCallback(
    (
      response: AIResponseContract,
      cadence: "Daily" | "Weekly" | "Monthly" = "Weekly"
    ): SavedInsight => {
      const persona = PERSONAS[activePersona];
      const nowStr =
        new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
      const baseInsight: SavedInsight = {
        id: `INS-${Date.now()}-${Math.floor(Math.random() * 90 + 10)}`,
        title: response.title,
        question: response.question,
        topicKey: response.topicKey,
        kpiIdsAndVersions:
          response.calculationDetails.kpiIds.length > 0
            ? response.calculationDetails.kpiIds
            : ["kpi.total_revenue@v3.1"],
        authorizedSalonIds: response.scopedSalonIds,
        scopeLabel: response.businessScope,
        regionFilter: persona.assignedRegion,
        relativeDateRange: response.timeRange.includes("6")
          ? "Last 6 Months"
          : response.timeRange.includes("Quarter")
            ? "Quarter-to-Date"
            : "Last 30 Days",
        chartType:
          response.chartType === "table-only" ? "bar" : response.chartType,
        ownerPersona: activePersona,
        ownerName: persona.name,
        createdAt: nowStr,
        lastRefreshedAt: nowStr,
        freshnessRequirementHours:
          response.topicKey === "unused_capacity" ? 4 : 24,
        recommendedRefreshFrequency: cadence,
        schedule: {
          enabled: true,
          cadence,
          dayOfWeek: "Monday",
          timeLocal: "08:00",
          timezone: "America/Los_Angeles",
          nextRunAt: `Next ${cadence} Window · 08:00 (America/Los_Angeles)`,
          lastRunAt: nowStr,
          lastRunStatus:
            response.sourceFreshness.status === "Stale"
              ? "Stale Source Warning"
              : "Succeeded",
        },
        cachedSnapshot: {
          headlineMetric: response.kpis[0]?.currentValue ?? "Certified KPI",
          trendLabel: response.kpis[0]?.varianceLabel ?? response.timeRange,
          trendDirection: response.kpis[0]?.varianceDirection ?? "neutral",
          isStaleWarning: response.sourceFreshness.status === "Stale",
        },
      };

      // Ensure snapshot matches deterministic recalculation engine
      const calibratedSnap = recalculateSavedInsightSnapshot(
        baseInsight,
        dataVersionRef.current,
        demoTimeOffsetRef.current,
        posSyncRefreshedRef.current
      );
      const newIns: SavedInsight = {
        ...baseInsight,
        cachedSnapshot: calibratedSnap,
      };

      const nextList = [newIns, ...savedInsightsRef.current];
      savedInsightsRef.current = nextList;
      setSavedInsights(nextList);

      appendAuditEvent(
        "INSIGHT_SAVED",
        `Saved reusable insight "${newIns.title}" (${cadence} cadence)`,
        "Allowed",
        newIns.kpiIdsAndVersions.join(", ")
      );
      notify(`Saved "${newIns.title}" to Certified Saved Insights.`, "teal");
      return newIns;
    },
    [activePersona, appendAuditEvent, notify]
  );

  const updateInsightSchedule = useCallback(
    (insightId: string, schedule: ScheduleConfig | null) => {
      const nextList = savedInsightsRef.current.map((ins) =>
        ins.id === insightId ? { ...ins, schedule } : ins
      );
      savedInsightsRef.current = nextList;
      setSavedInsights(nextList);

      appendAuditEvent(
        "INSIGHT_SAVED",
        `Updated schedule configuration for insight ${insightId}`,
        "Allowed",
        schedule
          ? `${schedule.cadence} @ ${schedule.timeLocal} ${schedule.timezone}`
          : "Disabled"
      );
      notify("Schedule configuration persisted.", "teal");
    },
    [appendAuditEvent, notify]
  );

  const runSavedInsightNow = useCallback(
    (insightId: string) => {
      if (!policy.schedulingEnabled) {
        const pausedList = savedInsightsRef.current.map((ins) =>
          ins.id === insightId && ins.schedule
            ? {
                ...ins,
                schedule: {
                  ...ins.schedule,
                  lastRunStatus: "Paused by Governance" as const,
                },
              }
            : ins
        );
        savedInsightsRef.current = pausedList;
        setSavedInsights(pausedList);

        appendAuditEvent(
          "SCHEDULE_RUN",
          `Blocked scheduled run for ${insightId}: Scheduling disabled by Customer Admin`,
          "Blocked",
          "Emergency Control Active"
        );
        notify(
          "Scheduled execution blocked: Customer Admin has paused scheduled jobs.",
          "red"
        );
        return;
      }

      const nowStr =
        new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
      let targetTitle = insightId;
      let targetMetric = "";

      const updatedList = savedInsightsRef.current.map((ins) => {
        if (ins.id !== insightId) return ins;
        targetTitle = ins.title;
        const freshSnap = recalculateSavedInsightSnapshot(
          ins,
          dataVersionRef.current,
          demoTimeOffsetRef.current,
          posSyncRefreshedRef.current
        );
        targetMetric = freshSnap.headlineMetric;
        return {
          ...ins,
          lastRefreshedAt: nowStr,
          cachedSnapshot: freshSnap,
          schedule: ins.schedule
            ? {
                ...ins.schedule,
                lastRunAt: nowStr,
                nextRunAt: `Next ${ins.schedule.cadence} Window · ${ins.schedule.timeLocal} (${ins.schedule.timezone})`,
                lastRunStatus: freshSnap.isStaleWarning
                  ? ("Stale Source Warning" as const)
                  : ("Succeeded" as const),
              }
            : null,
        };
      });
      savedInsightsRef.current = updatedList;
      setSavedInsights(updatedList);

      setControlTowerEvents((prev) => [
        {
          id: `CT-SCHED-${Date.now()}`,
          date: "2026-10-24",
          timestamp: nowStr.slice(0, 16) + " UTC",
          product: "AI Business Advisor",
          user: PERSONAS[activePersona].name,
          region: PERSONAS[activePersona].assignedRegion,
          requestType: "Scheduled Refresh",
          tokensConsumed: 95,
          costUsd: 0.001,
          latencyMs: 68,
          cacheHit: true,
          status: "Success",
          isLiveGeminiMetadata: false,
          detail: `Certified refresh executed for "${targetTitle}"`,
        },
        ...prev,
      ]);

      appendAuditEvent(
        "SCHEDULE_RUN",
        `Recalculated certified insight "${targetTitle}" (${targetMetric})`,
        "Allowed",
        `DataVersion v${dataVersionRef.current}`
      );
      notify(
        `Recalculated "${targetTitle}" (${targetMetric}) from live analytics layer.`,
        "teal"
      );
    },
    [policy.schedulingEnabled, activePersona, appendAuditEvent, notify]
  );

  const runAllDueScheduledJobs = useCallback(() => {
    if (!policy.schedulingEnabled) {
      const pausedList = savedInsightsRef.current.map((ins) =>
        ins.schedule?.enabled
          ? {
              ...ins,
              schedule: {
                ...ins.schedule,
                lastRunStatus: "Paused by Governance" as const,
              },
            }
          : ins
      );
      savedInsightsRef.current = pausedList;
      setSavedInsights(pausedList);

      appendAuditEvent(
        "SCHEDULE_RUN",
        "Attempted 'Run Due Jobs' while scheduling is paused in Governance",
        "Blocked",
        "Emergency Control: Scheduling Disabled"
      );
      notify(
        "Cannot run due jobs: Scheduled execution is paused in AI Governance.",
        "red"
      );
      return;
    }

    const nowStr =
      new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

    // Synchronously compute updated insights and exact executed job count!
    let executedCount = 0;
    let staleCount = 0;
    const nextInsights = savedInsightsRef.current.map((ins) => {
      if (!ins.schedule?.enabled) return ins;
      executedCount += 1;
      const snap = recalculateSavedInsightSnapshot(
        ins,
        dataVersionRef.current,
        demoTimeOffsetRef.current,
        posSyncRefreshedRef.current
      );
      if (snap.isStaleWarning) staleCount += 1;
      return {
        ...ins,
        lastRefreshedAt: nowStr,
        cachedSnapshot: snap,
        schedule: {
          ...ins.schedule,
          lastRunAt: nowStr,
          nextRunAt: `Next ${ins.schedule.cadence} Window · ${ins.schedule.timeLocal} (${ins.schedule.timezone})`,
          lastRunStatus: snap.isStaleWarning
            ? ("Stale Source Warning" as const)
            : ("Succeeded" as const),
        },
      };
    });

    savedInsightsRef.current = nextInsights;
    setSavedInsights(nextInsights);

    setControlTowerEvents((prev) => [
      {
        id: `CT-BATCH-${Date.now()}`,
        date: "2026-10-24",
        timestamp: nowStr.slice(0, 16) + " UTC",
        product: "AI Business Advisor",
        user: "Simulated Demo Scheduler",
        region: "All Regions",
        requestType: "Scheduled Refresh",
        tokensConsumed: executedCount * 95,
        costUsd: Number((executedCount * 0.001).toFixed(3)),
        latencyMs: 112,
        cacheHit: true,
        status: "Success",
        isLiveGeminiMetadata: false,
        detail: `Executed ${executedCount} scheduled insight refresh job(s) (${staleCount} stale warning)`,
      },
      ...prev,
    ]);

    appendAuditEvent(
      "SCHEDULE_RUN",
      `Executed ${executedCount} scheduled insight jobs via Demo Scheduler (${staleCount} stale warning)`,
      staleCount > 0 ? "Warning" : "Allowed",
      `Batch refresh · ${executedCount * 95} tokens · v${dataVersionRef.current}`
    );
    notify(
      staleCount > 0
        ? `Executed ${executedCount} scheduled jobs (${staleCount} flagged with Stale Source Warning).`
        : `Executed ${executedCount} scheduled insight refreshes successfully.`,
      staleCount > 0 ? "amber" : "teal"
    );
  }, [policy.schedulingEnabled, appendAuditEvent, notify]);

  const advanceDemoTime = useCallback(
    (hours: number) => {
      const nextOffset = demoTimeOffsetRef.current + hours;
      demoTimeOffsetRef.current = nextOffset;
      setDemoTimeOffsetHours(nextOffset);

      let dueCount = 0;
      const updatedInsights = savedInsightsRef.current.map((ins) => {
        const snap = recalculateSavedInsightSnapshot(
          ins,
          dataVersionRef.current,
          nextOffset,
          posSyncRefreshedRef.current
        );
        if (ins.schedule?.enabled) {
          dueCount += 1;
          return {
            ...ins,
            cachedSnapshot: snap,
            schedule: {
              ...ins.schedule,
              nextRunAt: `Due Now (Clock +${nextOffset}h)`,
              lastRunStatus: "Pending" as const,
            },
          };
        }
        return {
          ...ins,
          cachedSnapshot: snap,
        };
      });
      savedInsightsRef.current = updatedInsights;
      setSavedInsights(updatedInsights);

      const updatedWidgets = dashboardWidgetsRef.current.map((w) => {
        const refreshed = refreshSavedDashboardWidget(
          w,
          dataVersionRef.current,
          nextOffset,
          posSyncRefreshedRef.current
        );
        return {
          ...refreshed,
          lastRefreshedAt: w.lastRefreshedAt,
          nextScheduledLabel: w.scheduleEnabled
            ? `Due at ${w.scheduledTime} (Clock +${nextOffset}h)`
            : "Manual Refresh Only",
          lastRunStatus: w.scheduleEnabled
            ? ("Scheduled" as const)
            : w.lastRunStatus,
        };
      });
      dashboardWidgetsRef.current = updatedWidgets;
      setDashboardWidgets(updatedWidgets);

      setSafetyResults(
        runGovernanceSafetySuite({
          policy,
          posSyncRefreshed: posSyncRefreshedRef.current,
          dataVersion: dataVersionRef.current,
        })
      );

      appendAuditEvent(
        "SCHEDULE_RUN",
        `Advanced simulated demo clock by +${hours}h (total +${nextOffset}h); ${dueCount} scheduled jobs marked Due`,
        "Allowed",
        `Clock Offset +${nextOffset}h`
      );
      notify(
        `Advanced demo clock +${hours}h: scheduled Dashboard widgets are ready for refresh.`,
        "amber"
      );
    },
    [policy, appendAuditEvent, notify]
  );

  const refreshPosRetailSource = useCallback(() => {
    const nextV = dataVersionRef.current + 1;
    dataVersionRef.current = nextV;
    demoTimeOffsetRef.current = 0;
    posSyncRefreshedRef.current = true;

    setPosSyncRefreshed(true);
    setDataVersion(nextV);
    setDemoTimeOffsetHours(0);

    queryCacheService.invalidateStaleVersions(nextV);
    setRawOpportunities(buildInitialOpportunities(nextV, true));

    const refreshedInsights = savedInsightsRef.current.map((ins) => ({
      ...ins,
      cachedSnapshot: recalculateSavedInsightSnapshot(ins, nextV, 0, true),
      schedule:
        ins.schedule && ins.schedule.lastRunStatus === "Stale Source Warning"
          ? { ...ins.schedule, lastRunStatus: "Succeeded" as const }
          : ins.schedule,
    }));
    savedInsightsRef.current = refreshedInsights;
    setSavedInsights(refreshedInsights);

    const refreshedWidgets = dashboardWidgetsRef.current.map((w) =>
      refreshSavedDashboardWidget(w, nextV, 0, true)
    );
    dashboardWidgetsRef.current = refreshedWidgets;
    setDashboardWidgets(refreshedWidgets);

    setSafetyResults(
      runGovernanceSafetySuite({
        policy,
        posSyncRefreshed: true,
        dataVersion: nextV,
      })
    );

    appendAuditEvent(
      "SCHEDULE_RUN",
      `Completed POS Retail SKU & Discount Ledger batch sync (dv:${nextV}); cleared stale holds`,
      "Allowed",
      `Completeness 99.6% · Cache invalidated`
    );
    notify(
      "POS Retail terminal sync completed (99.6% completeness). Stale data warnings cleared and Dashboard widgets updated.",
      "teal"
    );
  }, [policy, appendAuditEvent, notify]);

  const triggerDataVersionRefresh = useCallback(() => {
    const nextV = dataVersionRef.current + 1;
    dataVersionRef.current = nextV;
    setDataVersion(nextV);

    const purged = queryCacheService.invalidateStaleVersions(nextV);
    setRawOpportunities(
      buildInitialOpportunities(nextV, posSyncRefreshedRef.current)
    );

    const recalibrated = savedInsightsRef.current.map((ins) => ({
      ...ins,
      cachedSnapshot: recalculateSavedInsightSnapshot(
        ins,
        nextV,
        demoTimeOffsetRef.current,
        posSyncRefreshedRef.current
      ),
    }));
    savedInsightsRef.current = recalibrated;
    setSavedInsights(recalibrated);

    const recalibratedWidgets = dashboardWidgetsRef.current.map((w) =>
      refreshSavedDashboardWidget(
        w,
        nextV,
        demoTimeOffsetRef.current,
        posSyncRefreshedRef.current
      )
    );
    dashboardWidgetsRef.current = recalibratedWidgets;
    setDashboardWidgets(recalibratedWidgets);

    appendAuditEvent(
      "SCHEDULE_RUN",
      `Warehouse batch incremented to DataVersion v${nextV}; invalidated ${purged} cached responses`,
      "Allowed",
      `DataVersion v${nextV}`
    );
    notify(
      `Source dataset incremented to v${nextV} (${purged} cached queries invalidated).`,
      "teal"
    );
  }, [appendAuditEvent, notify]);

  const ensureOrReloadDummyData = useCallback(() => {
    const nextV = dataVersionRef.current + 1;
    const regenerated = regenerateDummyDataset(nextV);
    dataVersionRef.current = nextV;
    setDataVersion(nextV);

    queryCacheService.invalidateStaleVersions(nextV);
    setRawOpportunities(
      buildInitialOpportunities(nextV, posSyncRefreshedRef.current)
    );

    const recalibrated = savedInsightsRef.current.map((ins) => ({
      ...ins,
      cachedSnapshot: recalculateSavedInsightSnapshot(
        ins,
        nextV,
        demoTimeOffsetRef.current,
        posSyncRefreshedRef.current
      ),
    }));
    savedInsightsRef.current = recalibrated;
    setSavedInsights(recalibrated);

    const recalibratedWidgets = dashboardWidgetsRef.current.map((w) =>
      refreshSavedDashboardWidget(
        w,
        nextV,
        demoTimeOffsetRef.current,
        posSyncRefreshedRef.current
      )
    );
    dashboardWidgetsRef.current = recalibratedWidgets;
    setDashboardWidgets(recalibratedWidgets);

    appendAuditEvent(
      "SCHEDULE_RUN",
      `Verified & regenerated synthetic dummy dataset v${nextV} (${SALONS.length} salons · ${regenerated.monthly.length} monthly & ${regenerated.daily30.length} daily rows)`,
      "Allowed",
      `Dummy Dataset Ready · v${nextV}`
    );
    notify(
      `Dummy salon dataset populated (v${nextV}: ${SALONS.length} salons, ${regenerated.monthly.length} monthly & ${regenerated.daily30.length} daily records).`,
      "teal"
    );
  }, [appendAuditEvent, notify]);

  // Zenne Saved Dashboard Widgets & Time Scheduler operations
  const saveZenneConversationToDashboard = useCallback(
    (params: {
      response: AIResponseContract;
      originalQuestion: string;
      clarificationFocus?: string;
      widgetName: string;
      scheduledTime: string;
      cadence: "Daily" | "Weekly";
    }): SavedDashboardWidget => {
      const persona = PERSONAS[activePersona];
      const nowStamp =
        new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
      const created = buildWidgetFromResponse({
        widgetName: params.widgetName.trim() || params.response.title,
        ownerPersona: activePersona,
        roleLabel: persona.name,
        originalQuestion: params.originalQuestion,
        clarificationFocus: params.clarificationFocus,
        response: params.response,
        scheduledTime: params.scheduledTime || "08:00",
        cadence: params.cadence,
        scheduleEnabled: true,
        lastRefreshedAt: nowStamp,
      });

      const nextWidgets = [created, ...dashboardWidgetsRef.current];
      dashboardWidgetsRef.current = nextWidgets;
      setDashboardWidgets(nextWidgets);

      appendAuditEvent(
        "INSIGHT_SAVED",
        `Saved Zenne conversation to Dashboard as widget "${created.widgetName}" (${created.cadence} @ ${created.scheduledTime})`,
        "Allowed",
        `Source: ${created.dataFreshness.sourceName} · ${created.dataFreshness.dataThroughTimestamp}`
      );
      notify(
        `Saved "${created.widgetName}" to Dashboard · Scheduled ${created.cadence} at ${created.scheduledTime}.`,
        "teal"
      );
      return created;
    },
    [activePersona, appendAuditEvent, notify]
  );

  const updateDashboardWidgetSchedule = useCallback(
    (
      widgetId: string,
      scheduledTime: string,
      cadence: "Daily" | "Weekly",
      scheduleEnabled: boolean
    ) => {
      let widgetTitle = widgetId;
      const nextWidgets = dashboardWidgetsRef.current.map((w) => {
        if (w.id !== widgetId) return w;
        widgetTitle = w.widgetName;
        return {
          ...w,
          scheduledTime,
          cadence,
          scheduleEnabled,
          nextScheduledLabel: scheduleEnabled
            ? `${cadence} at ${scheduledTime} Local`
            : "Manual Refresh Only",
        };
      });
      dashboardWidgetsRef.current = nextWidgets;
      setDashboardWidgets(nextWidgets);

      appendAuditEvent(
        "INSIGHT_SAVED",
        `Updated refresh schedule for widget "${widgetTitle}": ${
          scheduleEnabled ? `${cadence} @ ${scheduledTime}` : "Disabled"
        }`,
        "Allowed",
        "Dashboard Widget Schedule"
      );
      notify(
        scheduleEnabled
          ? `Scheduled "${widgetTitle}" to refresh ${cadence} at ${scheduledTime}.`
          : `Paused automatic schedule for "${widgetTitle}".`,
        "teal"
      );
    },
    [appendAuditEvent, notify]
  );

  const removeDashboardWidget = useCallback(
    (widgetId: string) => {
      const target = dashboardWidgetsRef.current.find((w) => w.id === widgetId);
      const nextWidgets = dashboardWidgetsRef.current.filter(
        (w) => w.id !== widgetId
      );
      dashboardWidgetsRef.current = nextWidgets;
      setDashboardWidgets(nextWidgets);
      appendAuditEvent(
        "INSIGHT_SAVED",
        `Removed Dashboard widget "${target?.widgetName ?? widgetId}"`,
        "Allowed",
        "Dashboard Layout Updated"
      );
      notify(`Removed widget "${target?.widgetName ?? "Widget"}" from Dashboard.`, "teal");
    },
    [appendAuditEvent, notify]
  );

  const refreshDashboardWidgetNow = useCallback(
    (widgetId: string) => {
      if (!policy.schedulingEnabled) {
        const pausedWidgets = dashboardWidgetsRef.current.map((w) =>
          w.id === widgetId
            ? { ...w, lastRunStatus: "Paused by Admin" as const }
            : w
        );
        dashboardWidgetsRef.current = pausedWidgets;
        setDashboardWidgets(pausedWidgets);
        appendAuditEvent(
          "SCHEDULE_RUN",
          `Blocked widget refresh for ${widgetId}: Widget scheduling paused by Customer Admin`,
          "Blocked",
          "Governance Policy Gate"
        );
        notify(
          "Widget refresh blocked: Customer Admin has paused scheduled refreshes in Settings.",
          "red"
        );
        return;
      }

      let targetName = widgetId;
      const nextWidgets = dashboardWidgetsRef.current.map((w) => {
        if (w.id !== widgetId) return w;
        targetName = w.widgetName;
        return refreshSavedDashboardWidget(
          w,
          dataVersionRef.current,
          demoTimeOffsetRef.current,
          posSyncRefreshedRef.current
        );
      });
      dashboardWidgetsRef.current = nextWidgets;
      setDashboardWidgets(nextWidgets);

      const nowStr =
        new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
      setControlTowerEvents((prev) => [
        {
          id: `CT-WDG-${Date.now()}`,
          date: "2026-10-24",
          timestamp: nowStr,
          product: "AI Business Advisor",
          user: PERSONAS[activePersona].name,
          region: PERSONAS[activePersona].assignedRegion,
          requestType: "Scheduled Refresh",
          tokensConsumed: 90,
          costUsd: 0.001,
          latencyMs: 64,
          cacheHit: true,
          status: "Success",
          isLiveGeminiMetadata: false,
          detail: `Refreshed Dashboard widget "${targetName}"`,
        },
        ...prev,
      ]);

      appendAuditEvent(
        "SCHEDULE_RUN",
        `Refreshed Dashboard widget "${targetName}" with latest certified warehouse snapshot`,
        "Allowed",
        `DataVersion v${dataVersionRef.current}`
      );
      notify(`Refreshed widget "${targetName}".`, "teal");
    },
    [policy.schedulingEnabled, activePersona, appendAuditEvent, notify]
  );

  const runScheduledWidgetRefreshes = useCallback(() => {
    if (!policy.schedulingEnabled) {
      const paused = dashboardWidgetsRef.current.map((w) =>
        w.scheduleEnabled
          ? { ...w, lastRunStatus: "Paused by Admin" as const }
          : w
      );
      dashboardWidgetsRef.current = paused;
      setDashboardWidgets(paused);
      appendAuditEvent(
        "SCHEDULE_RUN",
        "Blocked scheduled Dashboard widget refreshes: Paused by Customer Admin",
        "Blocked",
        "Governance Policy Gate"
      );
      notify(
        "Scheduled refresh paused by Customer Admin in Settings.",
        "red"
      );
      return;
    }

    let count = 0;
    const nextWidgets = dashboardWidgetsRef.current.map((w) => {
      if (!w.scheduleEnabled) return w;
      count += 1;
      return refreshSavedDashboardWidget(
        w,
        dataVersionRef.current,
        demoTimeOffsetRef.current,
        posSyncRefreshedRef.current
      );
    });
    dashboardWidgetsRef.current = nextWidgets;
    setDashboardWidgets(nextWidgets);

    const nowStr =
      new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
    setControlTowerEvents((prev) => [
      {
        id: `CT-WDG-BATCH-${Date.now()}`,
        date: "2026-10-24",
        timestamp: nowStr,
        product: "AI Business Advisor",
        user: "Zenne Widget Scheduler",
        region: "All Regions",
        requestType: "Scheduled Refresh",
        tokensConsumed: count * 90,
        costUsd: Number((count * 0.001).toFixed(3)),
        latencyMs: 95,
        cacheHit: true,
        status: "Success",
        isLiveGeminiMetadata: false,
        detail: `Executed scheduled time refresh across ${count} Dashboard widget(s)`,
      },
      ...prev,
    ]);

    appendAuditEvent(
      "SCHEDULE_RUN",
      `Executed scheduled refresh across ${count} Dashboard widget(s)`,
      "Allowed",
      `Batch Widget Sync · v${dataVersionRef.current}`
    );
    notify(
      `Executed scheduled refresh for ${count} Dashboard widget${count === 1 ? "" : "s"}.`,
      "teal"
    );
  }, [policy.schedulingEnabled, appendAuditEvent, notify]);

  // Automatic local system clock HH:MM watcher for scheduled Dashboard widgets
  useEffect(() => {
    const checkScheduleTick = () => {
      if (!policy.schedulingEnabled) return;
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const currentHHMM = `${hh}:${mm}`;
      const minuteKey = `${now.toDateString()}-${currentHHMM}`;
      if (lastAutoScheduledMinuteRef.current === minuteKey) return;

      const matching = dashboardWidgetsRef.current.filter(
        (w) => w.scheduleEnabled && w.scheduledTime === currentHHMM
      );
      if (matching.length > 0) {
        lastAutoScheduledMinuteRef.current = minuteKey;
        const nextWidgets = dashboardWidgetsRef.current.map((w) =>
          w.scheduleEnabled && w.scheduledTime === currentHHMM
            ? refreshSavedDashboardWidget(
                w,
                dataVersionRef.current,
                demoTimeOffsetRef.current,
                posSyncRefreshedRef.current
              )
            : w
        );
        dashboardWidgetsRef.current = nextWidgets;
        setDashboardWidgets(nextWidgets);
        notify(
          `Scheduled Refresh (${currentHHMM}): Updated ${matching.length} Dashboard widget${matching.length === 1 ? "" : "s"}.`,
          "teal"
        );
      }
    };

    const timer = window.setInterval(checkScheduleTick, 20000);
    return () => window.clearInterval(timer);
  }, [policy.schedulingEnabled, notify]);

  // Custom Dashboard operations
  const createDashboard = useCallback(
    (name: string, description: string): CustomDashboard => {
      const nowStr =
        new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
      const dash: CustomDashboard = {
        id: `DASH-${Date.now()}`,
        name,
        description,
        ownerPersona: activePersona,
        sharedWithOrg: activePersona !== "arjun",
        createdAt: nowStr,
        updatedAt: nowStr,
        tiles: [],
      };
      setDashboards((prev) => [dash, ...prev]);
      appendAuditEvent(
        "INSIGHT_SAVED",
        `Created custom dashboard "${name}"`,
        "Allowed",
        "Custom Dashboard Persistence"
      );
      notify(`Created custom dashboard "${name}".`, "teal");
      return dash;
    },
    [activePersona, appendAuditEvent, notify]
  );

  const renameDashboard = useCallback(
    (dashboardId: string, newName: string) => {
      const nowStr =
        new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
      setDashboards((prev) =>
        prev.map((d) =>
          d.id === dashboardId ? { ...d, name: newName, updatedAt: nowStr } : d
        )
      );
      appendAuditEvent(
        "INSIGHT_SAVED",
        `Renamed dashboard ${dashboardId} to "${newName}"`,
        "Allowed",
        "Dashboard Metadata Updated"
      );
      notify(`Dashboard renamed to "${newName}".`, "teal");
    },
    [appendAuditEvent, notify]
  );

  const pinInsightToDashboard = useCallback(
    (insightId: string, dashboardId?: string) => {
      const nowStr =
        new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
      setDashboards((prev) => {
        const targetDash =
          prev.find((d) => d.id === dashboardId) ??
          prev.find((d) => d.ownerPersona === activePersona) ??
          prev[0];
        if (!targetDash) return prev;

        const newTile: DashboardTile = {
          id: `TILE-${Date.now()}-${Math.floor(Math.random() * 90 + 10)}`,
          savedInsightId: insightId,
          size: "wide",
          order: targetDash.tiles.length,
          salonFilter: "all",
        };
        return prev.map((d) =>
          d.id === targetDash.id
            ? { ...d, updatedAt: nowStr, tiles: [...d.tiles, newTile] }
            : d
        );
      });
      appendAuditEvent(
        "INSIGHT_SAVED",
        `Pinned saved insight ${insightId} to Custom Dashboard`,
        "Allowed",
        "Dashboard Tile Added"
      );
      notify("Pinned insight tile to Custom Dashboard.", "teal");
    },
    [activePersona, appendAuditEvent, notify]
  );

  const removeTileFromDashboard = useCallback(
    (dashboardId: string, tileId: string) => {
      const nowStr =
        new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
      setDashboards((prev) =>
        prev.map((d) =>
          d.id === dashboardId
            ? {
                ...d,
                updatedAt: nowStr,
                tiles: d.tiles
                  .filter((t) => t.id !== tileId)
                  .map((t, i) => ({ ...t, order: i })),
              }
            : d
        )
      );
      appendAuditEvent(
        "INSIGHT_SAVED",
        `Removed tile ${tileId} from dashboard ${dashboardId}`,
        "Allowed",
        "Dashboard Layout Saved"
      );
      notify("Removed tile from dashboard.", "teal");
    },
    [appendAuditEvent, notify]
  );

  const resizeDashboardTile = useCallback(
    (dashboardId: string, tileId: string, size: DashboardTile["size"]) => {
      const nowStr =
        new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
      setDashboards((prev) =>
        prev.map((d) =>
          d.id === dashboardId
            ? {
                ...d,
                updatedAt: nowStr,
                tiles: d.tiles.map((t) =>
                  t.id === tileId ? { ...t, size } : t
                ),
              }
            : d
        )
      );
    },
    []
  );

  const reorderDashboardTile = useCallback(
    (dashboardId: string, tileId: string, direction: "up" | "down") => {
      const nowStr =
        new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
      setDashboards((prev) =>
        prev.map((d) => {
          if (d.id !== dashboardId) return d;
          const sorted = [...d.tiles].sort((a, b) => a.order - b.order);
          const idx = sorted.findIndex((t) => t.id === tileId);
          if (idx < 0) return d;
          const swapIdx = direction === "up" ? idx - 1 : idx + 1;
          if (swapIdx < 0 || swapIdx >= sorted.length) return d;
          const temp = sorted[idx];
          sorted[idx] = sorted[swapIdx];
          sorted[swapIdx] = temp;
          return {
            ...d,
            updatedAt: nowStr,
            tiles: sorted.map((t, i) => ({ ...t, order: i })),
          };
        })
      );
    },
    []
  );

  const updateDashboardTileSalonFilter = useCallback(
    (dashboardId: string, tileId: string, salonFilter: string) => {
      const nowStr =
        new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
      setDashboards((prev) =>
        prev.map((d) =>
          d.id === dashboardId
            ? {
                ...d,
                updatedAt: nowStr,
                tiles: d.tiles.map((t) =>
                  t.id === tileId ? { ...t, salonFilter } : t
                ),
              }
            : d
        )
      );
    },
    []
  );

  const refreshSingleTile = useCallback(
    (dashboardId: string, tileId: string) => {
      const dash = dashboards.find((d) => d.id === dashboardId);
      const tile = dash?.tiles.find((t) => t.id === tileId);
      if (!tile) return;
      runSavedInsightNow(tile.savedInsightId);
    },
    [dashboards, runSavedInsightNow]
  );

  const refreshAllDashboardTiles = useCallback(
    (dashboardId: string) => {
      const dash = dashboards.find((d) => d.id === dashboardId);
      if (!dash) return;
      const allowedSalons = PERSONAS[activePersona].allowedSalonIds;
      const nowStr =
        new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
      const insightIds = new Set(dash.tiles.map((t) => t.savedInsightId));
      let refreshedCount = 0;

      const updatedInsights = savedInsightsRef.current.map((ins) => {
        if (!insightIds.has(ins.id)) return ins;
        const canRefresh =
          PERSONAS[activePersona].canViewAllRegions ||
          ins.authorizedSalonIds.every((id) => allowedSalons.includes(id));
        if (!canRefresh) {
          return ins;
        }
        refreshedCount += 1;
        return {
          ...ins,
          lastRefreshedAt: nowStr,
          cachedSnapshot: recalculateSavedInsightSnapshot(
            ins,
            dataVersionRef.current,
            demoTimeOffsetRef.current,
            posSyncRefreshedRef.current
          ),
        };
      });

      savedInsightsRef.current = updatedInsights;
      setSavedInsights(updatedInsights);

      setControlTowerEvents((prev) => [
        {
          id: `CT-DASH-${Date.now()}`,
          date: "2026-10-24",
          timestamp: nowStr.slice(0, 16) + " UTC",
          product: "AI Business Advisor",
          user: PERSONAS[activePersona].name,
          region: PERSONAS[activePersona].assignedRegion,
          requestType: "Scheduled Refresh",
          tokensConsumed: refreshedCount * 85,
          costUsd: Number((refreshedCount * 0.001).toFixed(3)),
          latencyMs: 92,
          cacheHit: true,
          status: "Success",
          isLiveGeminiMetadata: false,
          detail: `Refreshed ${refreshedCount} tile(s) on dashboard "${dash.name}"`,
        },
        ...prev,
      ]);

      appendAuditEvent(
        "SCHEDULE_RUN",
        `Refreshed ${refreshedCount} authorized tiles on dashboard "${dash.name}"`,
        "Allowed",
        `Recalculated from DataVersion v${dataVersionRef.current}`
      );
      notify(
        `Recalculated ${refreshedCount} authorized dashboard tiles from live analytics engine.`,
        "teal"
      );
    },
    [dashboards, activePersona, appendAuditEvent, notify]
  );

  // Strict RBAC-scoped view of Opportunities so Regional Managers never see unauthorized salon names
  const opportunities = useMemo<RevenueOpportunity[]>(() => {
    const persona = PERSONAS[activePersona];
    if (persona.canViewAllRegions) {
      return rawOpportunities;
    }
    const allowedSet = new Set(persona.allowedSalonIds);
    const allowedNameMap = new Map(
      SALONS.filter((s) => allowedSet.has(s.id)).map((s) => [s.id, s.name])
    );

    return rawOpportunities
      .filter((o) => o.affectedSalonIds.some((id) => allowedSet.has(id)))
      .map((o) => {
        const scopedIds = o.affectedSalonIds.filter((id) => allowedSet.has(id));
        const scopedNames = scopedIds
          .map((id) => allowedNameMap.get(id))
          .filter((n): n is string => Boolean(n));
        const ratio =
          o.affectedSalonIds.length > 0
            ? scopedIds.length / o.affectedSalonIds.length
            : 1;
        const scaledMonthly = Math.round(o.monthlyImpactDollars * ratio);

        return {
          ...o,
          title:
            o.region === "Multiple Regions"
              ? `${o.category} (${scopedNames.length} ${persona.assignedRegion} Salon${scopedNames.length === 1 ? "" : "s"})`
              : o.title,
          region: persona.assignedRegion as RegionName,
          affectedSalonIds: scopedIds,
          affectedSalonNames: scopedNames,
          monthlyImpactDollars: scaledMonthly,
          annualizedImpactDollars: scaledMonthly * 12,
          supportingEvidence: scrubTextForRegionalScope(
            o.supportingEvidence,
            persona.allowedSalonIds
          ),
          assignedOwner: scrubTextForRegionalScope(
            o.assignedOwner,
            persona.allowedSalonIds
          ),
        };
      });
  }, [rawOpportunities, activePersona]);

  // Opportunities & Interventions mutations
  const updateOpportunityStatus = useCallback(
    (id: string, status: OpportunityStatus) => {
      setRawOpportunities((prev) =>
        prev.map((o) =>
          o.id === id
            ? {
                ...o,
                status,
                updatedAt:
                  new Date().toISOString().replace("T", " ").slice(0, 16) +
                  " UTC",
              }
            : o
        )
      );
      appendAuditEvent(
        "ACTION_APPROVED",
        `Updated Revenue Opportunity ${id} status to "${status}"`,
        "Allowed",
        status
      );
      notify(`Opportunity status updated to ${status}.`, "teal");
    },
    [appendAuditEvent, notify]
  );

  const recordIntervention = useCallback(
    (input: Omit<InterventionRecord, "id">): InterventionRecord => {
      const created: InterventionRecord = {
        ...input,
        id: `INT-${Date.now()}`,
      };
      setInterventions((prev) => [created, ...prev]);
      if (input.opportunityId) {
        setRawOpportunities((prev) =>
          prev.map((o) =>
            o.id === input.opportunityId ? { ...o, status: "In Progress" } : o
          )
        );
      }
      appendAuditEvent(
        "ACTION_APPROVED",
        `Recorded management intervention "${input.title}" (${input.comparisonApproach})`,
        "Allowed",
        `${input.affectedSalonNames.length} salons · Owner: ${input.owner}`
      );
      notify(
        `Management intervention "${input.title}" recorded for Business Value tracking.`,
        "teal"
      );
      return created;
    },
    [appendAuditEvent, notify]
  );

  // Alerts
  const addAlertRule = useCallback(
    (ruleInput: Omit<AlertRule, "id">): AlertRule => {
      const rule: AlertRule = {
        ...ruleInput,
        id: `RULE-${Date.now()}`,
      };
      const nextRules = [rule, ...alertRulesRef.current];
      alertRulesRef.current = nextRules;
      setAlertRules(nextRules);

      appendAuditEvent(
        "POLICY_UPDATED",
        `Created proactive alert rule "${rule.name}" (${rule.condition} ${rule.thresholdPct}%)`,
        "Allowed",
        `${rule.channel} -> ${rule.recipientRole}`
      );
      return rule;
    },
    [appendAuditEvent]
  );

  const toggleAlertRule = useCallback(
    (ruleId: string) => {
      let toggledRuleName = ruleId;
      let nextEnabled = true;
      const nextRules = alertRulesRef.current.map((r) => {
        if (r.id !== ruleId) return r;
        toggledRuleName = r.name;
        nextEnabled = !r.enabled;
        return { ...r, enabled: nextEnabled };
      });
      alertRulesRef.current = nextRules;
      setAlertRules(nextRules);

      appendAuditEvent(
        "POLICY_UPDATED",
        `${nextEnabled ? "Enabled" : "Paused"} alert rule "${toggledRuleName}"`,
        "Allowed",
        "Alert Rule Configuration"
      );
      notify(
        `Alert rule "${toggledRuleName}" ${nextEnabled ? "enabled" : "paused"}.`,
        "teal"
      );
    },
    [appendAuditEvent, notify]
  );

  const triggeredAlerts = useMemo(() => {
    const evaluated = evaluateAlertRulesAgainstData({
      rules: alertRules,
      dataVersion,
      demoTimeOffsetHours,
      posSyncRefreshed,
      existingStatuses: alertStatusMap,
      existingAssignees: alertAssigneeMap,
    });
    // Deduplicate manualSimulatedAlerts against evaluated ruleIds if already present
    const evaluatedIds = new Set(evaluated.map((e) => e.id));
    const combined = [
      ...manualSimulatedAlerts.filter((m) => !evaluatedIds.has(m.id)),
      ...evaluated,
    ];

    const persona = PERSONAS[activePersona];
    if (persona.canViewAllRegions) {
      return combined;
    }

    // Strict RBAC salon scrubbing for Regional Operations Manager
    const allowedNames = new Set(
      SALONS.filter((s) => persona.allowedSalonIds.includes(s.id)).map(
        (s) => s.name
      )
    );
    return combined
      .map((a): TriggeredAlert | null => {
        const scopedSalons = a.affectedSalons.filter((name) =>
          allowedNames.has(name)
        );
        if (scopedSalons.length === 0) return null;
        return {
          ...a,
          affectedSalons: scopedSalons,
          region: persona.assignedRegion as TriggeredAlert["region"],
          evidenceSummary: scrubTextForRegionalScope(
            a.evidenceSummary,
            persona.allowedSalonIds
          ),
        };
      })
      .filter((a): a is TriggeredAlert => a !== null);
  }, [
    alertRules,
    dataVersion,
    demoTimeOffsetHours,
    posSyncRefreshed,
    alertStatusMap,
    alertAssigneeMap,
    manualSimulatedAlerts,
    activePersona,
  ]);

  const simulateAlertTrigger = useCallback(
    (ruleOrId: string | AlertRule) => {
      const ruleId = typeof ruleOrId === "string" ? ruleOrId : ruleOrId.id;
      if (!policy.alertDeliveryEnabled) {
        appendAuditEvent(
          "ALERT_TRIGGERED",
          `Alert delivery suspended by Customer Admin for rule ${ruleId}`,
          "Blocked",
          "Emergency Control: Alert Delivery Suspended"
        );
        notify(
          "Alert delivery is currently suspended by Customer Admin in AI Governance.",
          "red"
        );
        return;
      }

      const rule =
        typeof ruleOrId === "string"
          ? alertRulesRef.current.find((r) => r.id === ruleOrId)
          : ruleOrId;
      if (!rule) return;

      const evaluated = evaluateAlertRulesAgainstData({
        rules: [{ ...rule, enabled: true }],
        dataVersion: dataVersionRef.current,
        demoTimeOffsetHours: demoTimeOffsetRef.current,
        posSyncRefreshed: posSyncRefreshedRef.current,
      });

      const regionScopedFallbackSalons = SALONS.filter(
        (s) =>
          (rule.scopeRegion === "All Regions" ||
            s.region === rule.scopeRegion) &&
          (PERSONAS[activePersona].canViewAllRegions ||
            PERSONAS[activePersona].allowedSalonIds.includes(s.id))
      )
        .slice(0, 2)
        .map((s) => s.name);

      const nowStamp =
        new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

      const simAlert: TriggeredAlert =
        evaluated[0] ?? {
          id: `ALT-SIM-${rule.id}`,
          ruleId: rule.id,
          ruleName: `${rule.name} (Manual Verification Run)`,
          metricLabel: rule.metricLabel,
          affectedSalons:
            regionScopedFallbackSalons.length > 0
              ? regionScopedFallbackSalons
              : ["Bellevue Flagship Studio"],
          region:
            rule.scopeRegion === "All Regions"
              ? PERSONAS[activePersona].canViewAllRegions
                ? "Multiple Regions"
                : "Pacific Northwest"
              : rule.scopeRegion,
          observedValue: `Verified against dataset (${rule.condition} ${rule.thresholdPct}% · No natural breach, test alert generated)`,
          thresholdLabel: `${rule.condition} ${rule.thresholdPct}% (${rule.comparisonBaseline})`,
          severity: "Moderate",
          triggeredAt: nowStamp,
          sourceFreshnessStatus: "Fresh",
          evidenceSummary: `Evaluated ${rule.selectedSalonIds.length} scoped salons against ${rule.comparisonBaseline}; test notification routed via ${rule.channel}.`,
          recommendedAction:
            "Review salon variance evidence and assign operational follow-up if threshold breaches.",
          assignedTo: rule.recipientRole,
          status: "Active",
        };

      if (evaluated.length === 0) {
        setManualSimulatedAlerts((prev) => [
          simAlert,
          ...prev.filter((p) => p.id !== simAlert.id),
        ]);
      } else {
        setAlertStatusMap((prev) => ({ ...prev, [simAlert.id]: "Active" }));
      }

      setControlTowerEvents((prev) => [
        {
          id: `CT-ALERT-${Date.now()}`,
          date: "2026-10-24",
          timestamp: nowStamp,
          product: "AI Business Advisor",
          user: PERSONAS[activePersona].name,
          region:
            rule.scopeRegion === "All Regions"
              ? "All Regions"
              : rule.scopeRegion,
          requestType: "Proactive Alert",
          tokensConsumed: 110,
          costUsd: 0.001,
          latencyMs: 84,
          cacheHit: false,
          status: "Success",
          isLiveGeminiMetadata: false,
          detail: `Evaluated alert rule "${rule.name}" (${simAlert.affectedSalons.length} salons flagged)`,
        },
        ...prev,
      ]);

      appendAuditEvent(
        "ALERT_TRIGGERED",
        `Evaluated & triggered proactive alert "${rule.name}" via ${rule.channel}`,
        simAlert.sourceFreshnessStatus === "Stale" ? "Warning" : "Allowed",
        simAlert.staleVerificationBanner ??
          `Delivered to ${rule.recipientRole} (Demo)`
      );
      notify(
        simAlert.sourceFreshnessStatus === "Stale"
          ? `Alert evaluated with Stale Source Hold: "${simAlert.staleVerificationBanner}"`
          : `Alert triggered for "${rule.name}" (${simAlert.affectedSalons.length} salon${simAlert.affectedSalons.length === 1 ? "" : "s"}).`,
        simAlert.sourceFreshnessStatus === "Stale" ? "amber" : "teal"
      );
    },
    [policy.alertDeliveryEnabled, activePersona, appendAuditEvent, notify]
  );

  const updateAlertActionState = useCallback(
    (
      alertId: string,
      status: TriggeredAlert["status"],
      assignedTo?: string
    ) => {
      setAlertStatusMap((prev) => ({ ...prev, [alertId]: status }));
      if (assignedTo) {
        setAlertAssigneeMap((prev) => ({ ...prev, [alertId]: assignedTo }));
      }
      setManualSimulatedAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? { ...a, status, assignedTo: assignedTo ?? a.assignedTo }
            : a
        )
      );
      appendAuditEvent(
        "ACTION_APPROVED",
        `Updated alert ${alertId} state to "${status}"${assignedTo ? ` (Owner: ${assignedTo})` : ""}`,
        "Allowed",
        status
      );
      notify(`Alert updated: ${status}.`, "teal");
    },
    [appendAuditEvent, notify]
  );

  // Governance & Control Tower
  const updatePolicy = useCallback(
    (patch: Partial<GovernancePolicy>, summaryNote: string) => {
      if (!PERSONAS[activePersona].canConfigureGovernance) {
        appendAuditEvent(
          "ACCESS_BLOCKED",
          "Unauthorized attempt to modify Tenant Governance Policy",
          "Blocked",
          "Requires Customer Admin role"
        );
        notify(
          "Only Tenant Governance Admin can modify tenant governance policies.",
          "red"
        );
        return;
      }

      setPolicy((prev) => {
        if (!prev.advisorPaused) {
          setPreviousApprovedPolicy(prev);
        }
        const next: GovernancePolicy = {
          ...prev,
          ...patch,
          updatedAt:
            new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
          updatedBy: PERSONAS[activePersona].name,
        };
        setSafetyResults(
          runGovernanceSafetySuite({
            policy: next,
            posSyncRefreshed: posSyncRefreshedRef.current,
            dataVersion: dataVersionRef.current,
          })
        );
        return next;
      });

      appendAuditEvent(
        "POLICY_UPDATED",
        summaryNote,
        "Allowed",
        JSON.stringify(patch)
      );
      notify(`Governance policy updated: ${summaryNote}`, "teal");
    },
    [activePersona, appendAuditEvent, notify]
  );

  const restorePreviousApprovedPolicy = useCallback(() => {
    if (!PERSONAS[activePersona].canConfigureGovernance) {
      notify("Only Tenant Governance Admin can restore policy.", "red");
      return;
    }
    const restored: GovernancePolicy = {
      ...DEFAULT_GOVERNANCE_POLICY,
      approvedRecipients: previousApprovedPolicy.approvedRecipients,
      updatedAt:
        new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
      updatedBy: PERSONAS[activePersona].name,
    };
    setPolicy(restored);
    setSafetyResults(
      runGovernanceSafetySuite({
        policy: restored,
        posSyncRefreshed: posSyncRefreshedRef.current,
        dataVersion: dataVersionRef.current,
      })
    );
    appendAuditEvent(
      "POLICY_UPDATED",
      `Restored certified policy configuration (${restored.versionLabel})`,
      "Allowed",
      "Emergency Restore"
    );
    notify("Restored certified governance configuration.", "teal");
  }, [activePersona, previousApprovedPolicy, appendAuditEvent, notify]);

  const toggleAgentEnabled = useCallback(
    (agentId: string) => {
      if (!PERSONAS[activePersona].canConfigureGovernance) {
        notify("Only Tenant Governance Admin can toggle agent status.", "red");
        return;
      }
      let agentLabel = agentId;
      let nextState = true;
      setAgents((prev) =>
        prev.map((a) => {
          if (a.id !== agentId) return a;
          agentLabel = a.productName;
          nextState = !a.enabled;
          return { ...a, enabled: nextState };
        })
      );
      appendAuditEvent(
        "POLICY_UPDATED",
        `${nextState ? "Enabled" : "Disabled"} Agent Identity: ${agentLabel}`,
        "Allowed",
        "Agent Identity Control"
      );
      notify(
        `${agentLabel} ${nextState ? "enabled" : "disabled"}.`,
        nextState ? "teal" : "amber"
      );
    },
    [activePersona, appendAuditEvent, notify]
  );

  const executeSafetyTestSuite = useCallback(() => {
    const results = runGovernanceSafetySuite({
      policy,
      posSyncRefreshed: posSyncRefreshedRef.current,
      dataVersion: dataVersionRef.current,
    });
    setSafetyResults(results);
    appendAuditEvent(
      "POLICY_UPDATED",
      `Executed 6-point Governance & Safety Evaluation Suite (${results.filter((r) => r.status === "Pass").length}/6 Pass)`,
      "Allowed",
      "Automated Verification"
    );
    notify("Completed all 6 Governance & Safety verification checks.", "teal");
  }, [policy, appendAuditEvent, notify]);

  const verifyExportChannelAllowed = useCallback(
    (channel: "PDF" | "CSV", reportLabel: string): boolean => {
      if (!policy.allowedExportChannels.includes(channel)) {
        appendAuditEvent(
          "ACCESS_BLOCKED",
          `Blocked ${channel} export of "${reportLabel}": Channel restricted by Tenant Governance Policy`,
          "Blocked",
          `Disallowed export channel: ${channel}`
        );
        notify(
          `${channel} export blocked: Customer Admin has disabled ${channel} downloads in AI Governance.`,
          "red"
        );
        return false;
      }
      return true;
    },
    [policy.allowedExportChannels, appendAuditEvent, notify]
  );

  const sendSimulatedShare = useCallback(
    (params: {
      channel: "Email" | "WhatsApp" | "SMS";
      recipient: string;
      subject: string;
      bodyPreview: string;
      reportType: string;
    }) => {
      if (!policy.sharingEnabled) {
        appendAuditEvent(
          "SHARE_SIMULATED",
          `Blocked share via ${params.channel}: Sharing disabled by Emergency Controls`,
          "Blocked",
          params.reportType
        );
        notify("Sharing is currently disabled in Emergency Controls.", "red");
        return {
          ok: false,
          error: "Sharing is currently disabled by Customer Admin.",
        };
      }

      if (!policy.allowedExportChannels.includes(params.channel)) {
        appendAuditEvent(
          "SHARE_SIMULATED",
          `Blocked share via ${params.channel}: Channel not permitted by Tenant Policy`,
          "Blocked",
          params.reportType
        );
        notify(
          `Channel ${params.channel} is currently blocked by Tenant Governance Policy.`,
          "red"
        );
        return {
          ok: false,
          error: `Channel ${params.channel} is restricted by tenant policy.`,
        };
      }

      const normalizedRecipient = params.recipient.trim().toLowerCase();
      const isApprovedRecipient = policy.approvedRecipients.some(
        (r) => r.trim().toLowerCase() === normalizedRecipient
      );
      if (!isApprovedRecipient) {
        appendAuditEvent(
          "ACCESS_BLOCKED",
          `Blocked share to unapproved external recipient: ${params.recipient}`,
          "Blocked",
          "Unapproved Recipient Domain/Address"
        );
        notify(
          `Share blocked: "${params.recipient}" is not in the Tenant Approved Recipients list.`,
          "red"
        );
        return {
          ok: false,
          error: `Recipient "${params.recipient}" is not authorized under Tenant Governance Policy.`,
        };
      }

      if (
        params.reportType.toLowerCase().includes("audit") &&
        !PERSONAS[activePersona].canExportAudit
      ) {
        appendAuditEvent(
          "ACCESS_BLOCKED",
          "Blocked unauthorized attempt to share Tenant Audit Report",
          "Blocked",
          "RBAC Export Gate"
        );
        return {
          ok: false,
          error:
            "Only Customer Admin is authorized to export or share Audit Reports.",
        };
      }

      const msg = createSimulatedShareDelivery({
        senderPersona: activePersona,
        ...params,
      });
      setOutbox((prev) => [msg, ...prev]);
      appendAuditEvent(
        "SHARE_SIMULATED",
        `Simulated ${params.channel} delivery of "${params.reportType}" to ${params.recipient}`,
        "Allowed",
        "Demo delivery — not actually sent · Expiring 24h link"
      );
      notify(
        `Demo delivery recorded in Outbox (${params.channel} to ${params.recipient} — not actually sent).`,
        "teal"
      );
      return { ok: true, message: msg };
    },
    [policy, activePersona, appendAuditEvent, notify]
  );

  // 5 Guided Demo Scenarios Launcher
  const launchDemoScenario = useCallback(
    async (scenarioId: number) => {
      setShowOnboarding(false);
      setActiveScenarioId(scenarioId);

      if (scenarioId === 1) {
        switchPersona("arjun", "dashboard");
        setAnalysisMode("deep");
        setZenneOpen(true);
        await sendZenneMessage(
          "Which salons had the biggest decline in repeat visits in the last 30 days?",
          { overridePersona: "arjun" }
        );
        notify(
          "Scenario 1 Ready: Zenne opened for Regional Manager with clarifying follow-up questions. Reply to view insights & save to Dashboard.",
          "teal"
        );
      } else if (scenarioId === 2) {
        switchPersona("arjun", "alerts");
        simulateAlertTrigger("RULE-REPEAT-01");
        notify(
          "Scenario 2 Ready: Repeat-visit contraction alert triggered in Cockpit. Inspect evidence & assign follow-up.",
          "teal"
        );
      } else if (scenarioId === 3) {
        switchPersona("meera", "dashboard");
        setAnalysisMode("deep");
        setZenneOpen(true);
        await sendZenneMessage(
          "Where should I focus to improve profitability this quarter?",
          { overridePersona: "meera" }
        );
        notify(
          "Scenario 3 Ready: Zenne opened for COO with executive clarifying follow-up questions.",
          "teal"
        );
      } else if (scenarioId === 4) {
        switchPersona("neha", "settings");
        setSettingsSubTab("agents");
        notify(
          "Scenario 4 Ready: Customer Admin Settings open. Govern AI Agents, Zenne Business Advisor, budgets, and safety checks.",
          "teal"
        );
      } else if (scenarioId === 5) {
        switchPersona("meera", "opportunities");
        setOpportunitiesSubTab("business-value");
        notify(
          "Scenario 5 Ready: COO reviewing completed holdout-validated interventions & sensitivity economics in Cockpit.",
          "teal"
        );
      }
    },
    [switchPersona, sendZenneMessage, simulateAlertTrigger, notify]
  );

  const clearScenarioBanner = useCallback(() => {
    setActiveScenarioId(null);
  }, []);

  // 8-Step Guided Demo Executor
  const executeGuidedStepAction = useCallback(
    async (stepNumber: number) => {
      setShowOnboarding(false);
      if (stepNumber === 1) {
        switchPersona("arjun", "dashboard");
        setZenneOpen(true);
        await sendZenneMessage(
          "Which salons had the biggest decline in repeat visits in the last 30 days?",
          { overridePersona: "arjun" }
        );
      } else if (stepNumber === 2) {
        switchPersona("arjun", "dashboard");
        setZenneOpen(true);
        if (pendingClarRef.current.arjun) {
          await sendZenneMessage(
            "Isolate worst 2 studios + checkout & cancellation funnel drivers",
            { overridePersona: "arjun" }
          );
        } else {
          await askAdvisor("Why are three salons losing repeat customers?", {
            overridePersona: "arjun",
          });
        }
      } else if (stepNumber === 3) {
        switchPersona("arjun", "dashboard");
        const regionalMsgs = messagesRef.current.arjun;
        if (regionalMsgs.length > 0) {
          saveZenneConversationToDashboard({
            response: regionalMsgs[regionalMsgs.length - 1],
            originalQuestion: regionalMsgs[regionalMsgs.length - 1].question,
            clarificationFocus: "Clarified deep research focus",
            widgetName: "PNW Deep Research Retention Tracker",
            scheduledTime: "08:00",
            cadence: "Daily",
          });
        } else {
          notify("Showing Regional Manager Dashboard widgets.", "teal");
        }
      } else if (stepNumber === 4) {
        switchPersona("arjun", "dashboard");
        runScheduledWidgetRefreshes();
      } else if (stepNumber === 5) {
        switchPersona("arjun", "alerts");
        simulateAlertTrigger("RULE-REPEAT-01");
      } else if (stepNumber === 6) {
        switchPersona("arjun", "opportunities");
        setOpportunitiesSubTab("pipeline");
        recordIntervention({
          title: "PNW Chairside Rebooking & 45-Day Color Outreach Sprint",
          opportunityId: "OPP-01-REPEAT",
          problemStatement:
            "Repeat-visit rate declined across Bellevue Flagship, Capitol Hill Atelier, and Pearl District Sanctuary.",
          insightDelivered:
            "Checkout rebooking dropped ~15 pts below 3-month baseline while ticket value remained intact.",
          actionTaken:
            "Enabled mandatory tablet rebooking prompt at chairside closeout + non-discounted 45-day overdue outreach.",
          affectedSalonIds: ["SLN-PNW-01", "SLN-PNW-02", "SLN-PNW-03"],
          affectedSalonNames: [SALONS[0].name, SALONS[1].name, SALONS[2].name],
          region: "Pacific Northwest",
          owner: "Regional Manager",
          startDate: "2026-10-24",
          status: "Active Holdout Trial",
          comparisonApproach: "Matched Regional Holdout Salons",
          beforeMetricLabel:
            "51.6% avg repeat-visit rate across 3 treatment studios",
          afterMetricLabel: "Target validation checkpoint at Day 28",
          holdoutGroupDeltaLabel:
            "Kirkland Waterfront Spa tracked as Pacific Northwest holdout benchmark",
          incrementalVisitsMonthly: 95,
          incrementalSalesMonthly: 9025,
          contributionMarginPct: 35.0,
          interventionDiscountAndTrainingCost: 320,
          estimatedNetContributionMonthly: 2839,
          managerHoursSavedWeekly: 4.0,
          confidenceNote:
            "Illustrative newly logged intervention: requires 28-day invoice close to confirm net holdout uplift.",
        });
      } else if (stepNumber === 7) {
        switchPersona("meera", "opportunities");
        setOpportunitiesSubTab("business-value");
        notify(
          "Switched to Chief Operating Officer · Business Value & Validated Interventions.",
          "teal"
        );
      } else if (stepNumber === 8) {
        switchPersona("neha", "settings");
        setSettingsSubTab("agents");
        executeSafetyTestSuite();
      }
    },
    [
      switchPersona,
      sendZenneMessage,
      askAdvisor,
      saveZenneConversationToDashboard,
      runScheduledWidgetRefreshes,
      simulateAlertTrigger,
      recordIntervention,
      executeSafetyTestSuite,
      notify,
    ]
  );

  // Scoped Cockpit Appointments & Customer Interactions based on signed-in role
  const appointments = useMemo(() => {
    const persona = PERSONAS[activePersona];
    if (authSession.roleKey === "front_desk_staff") {
      return rawAppointments.filter((a) => a.salonId === "SLN-PNW-01");
    }
    if (persona.canViewAllRegions) return rawAppointments;
    const allowed = new Set(persona.allowedSalonIds);
    return rawAppointments.filter((a) => allowed.has(a.salonId));
  }, [rawAppointments, activePersona, authSession.roleKey]);

  const interactions = useMemo(() => {
    const persona = PERSONAS[activePersona];
    if (authSession.roleKey === "front_desk_staff") {
      return rawInteractions.filter((i) => i.salonId === "SLN-PNW-01");
    }
    if (persona.canViewAllRegions) return rawInteractions;
    const allowed = new Set(persona.allowedSalonIds);
    return rawInteractions.filter((i) => allowed.has(i.salonId));
  }, [rawInteractions, activePersona, authSession.roleKey]);

  const rescheduleAppointment = useCallback(
    (params: {
      appointmentId: string;
      newDate: string;
      newStartTime: string;
      newStylistName: string;
      reason: string;
      waiveFee?: boolean;
    }) => {
      const targetApt = rawAppointments.find(
        (a) => a.id === params.appointmentId
      );
      if (!targetApt) return;

      const nowStamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const actionNote = `Rescheduled from ${targetApt.date} ${formatTime12h(
        targetApt.startTime
      )} to ${params.newDate} ${formatTime12h(params.newStartTime)} (${
        params.newStylistName
      })${params.waiveFee ? " · $65 fee waived" : ""} · ${params.reason}`;

      setRawAppointments((prev) =>
        prev.map((apt) =>
          apt.id === params.appointmentId
            ? {
                ...apt,
                date: params.newDate,
                startTime: params.newStartTime,
                stylistName: params.newStylistName,
                status: "Rescheduled",
                lastActionNote: actionNote,
                feeWaived: Boolean(params.waiveFee),
                updatedAt: `Updated ${nowStamp}`,
              }
            : apt
        )
      );

      if (targetApt.linkedInteractionId) {
        setRawInteractions((prev) =>
          prev.map((inter) =>
            inter.id === targetApt.linkedInteractionId
              ? {
                  ...inter,
                  sentiment: "Resolved",
                  turns: [
                    ...inter.turns,
                    {
                      id: `T-RES-${Date.now()}`,
                      speaker: "Manager",
                      speakerLabel: `${authSession.roleLabel} · Calendar Action`,
                      timestamp: nowStamp,
                      text: `Appointment ${targetApt.id} (${
                        targetApt.serviceName
                      }) rescheduled to ${params.newDate} at ${formatTime12h(
                        params.newStartTime
                      )} with ${params.newStylistName}.${
                        params.waiveFee
                          ? " The $65 late-modification fee has been waived."
                          : ""
                      } Note: ${params.reason}`,
                    },
                  ],
                }
              : inter
          )
        );
      }

      appendAuditEvent(
        "ACTION_APPROVED",
        `Rescheduled guest appointment ${targetApt.id} (${targetApt.guestName} · ${targetApt.salonName}) to ${params.newDate} ${params.newStartTime}`,
        "Allowed",
        actionNote
      );
      notify(
        `Rescheduled ${targetApt.guestName} to ${params.newDate} at ${formatTime12h(
          params.newStartTime
        )}.`,
        "teal"
      );
    },
    [rawAppointments, authSession.roleLabel, appendAuditEvent, notify]
  );

  const cancelAppointment = useCallback(
    (params: {
      appointmentId: string;
      reason: string;
      waiveCancellationFee: boolean;
    }) => {
      const targetApt = rawAppointments.find(
        (a) => a.id === params.appointmentId
      );
      if (!targetApt) return;

      const nowStamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const cancelNote = `Cancelled (${params.reason}) · ${
        params.waiveCancellationFee
          ? "$65 late-cancel fee waived"
          : "Standard policy applied"
      }`;

      setRawAppointments((prev) =>
        prev.map((apt) =>
          apt.id === params.appointmentId
            ? {
                ...apt,
                status: "Cancelled",
                lastActionNote: cancelNote,
                feeWaived: params.waiveCancellationFee,
                updatedAt: `Updated ${nowStamp}`,
              }
            : apt
        )
      );

      if (targetApt.linkedInteractionId) {
        setRawInteractions((prev) =>
          prev.map((inter) =>
            inter.id === targetApt.linkedInteractionId
              ? {
                  ...inter,
                  sentiment: "Resolved",
                  turns: [
                    ...inter.turns,
                    {
                      id: `T-CAN-${Date.now()}`,
                      speaker: "Manager",
                      speakerLabel: `${authSession.roleLabel} · Calendar Action`,
                      timestamp: nowStamp,
                      text: `Appointment ${targetApt.id} (${
                        targetApt.serviceName
                      } on ${targetApt.date} at ${formatTime12h(
                        targetApt.startTime
                      )}) has been cancelled per customer interaction (${
                        params.reason
                      }). ${
                        params.waiveCancellationFee
                          ? "Courtesy $65 cancellation fee waiver applied."
                          : ""
                      }`,
                    },
                  ],
                }
              : inter
          )
        );
      }

      appendAuditEvent(
        "ACTION_APPROVED",
        `Cancelled guest appointment ${targetApt.id} (${targetApt.guestName} · ${targetApt.salonName})`,
        "Allowed",
        cancelNote
      );
      notify(
        `Cancelled appointment for ${targetApt.guestName}${
          params.waiveCancellationFee ? " ($65 fee waived)" : ""
        }.`,
        "amber"
      );
    },
    [rawAppointments, authSession.roleLabel, appendAuditEvent, notify]
  );

  const sendConsoleManagerReply = useCallback(
    (interactionId: string, replyText: string) => {
      const trimmed = replyText.trim();
      if (!trimmed) return;
      const nowStamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      let guestName = "Guest";
      let channelLabel = "Chat";
      setRawInteractions((prev) =>
        prev.map((inter) => {
          if (inter.id !== interactionId) return inter;
          guestName = inter.guestName;
          channelLabel = inter.channel;
          return {
            ...inter,
            sentiment: "Resolved",
            turns: [
              ...inter.turns,
              {
                id: `T-MGR-${Date.now()}`,
                speaker: "Manager",
                speakerLabel: `${authSession.roleLabel} (${
                  inter.channel === "Voice" ? "Live Voice Desk" : "Live Chat"
                })`,
                timestamp: nowStamp,
                text: trimmed,
              },
            ],
          };
        })
      );

      appendAuditEvent(
        "ACTION_APPROVED",
        `Sent manager ${channelLabel.toLowerCase()} response to ${guestName} (${interactionId})`,
        "Allowed",
        trimmed.slice(0, 110)
      );
      notify(`Sent response to ${guestName}.`, "teal");
    },
    [authSession.roleLabel, appendAuditEvent, notify]
  );

  const simulateIncomingCustomerTurn = useCallback(
    (interactionId: string) => {
      const nowStamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const target = rawInteractions.find((i) => i.id === interactionId);
      if (!target) return;

      const queued = target.pendingLiveUtterances?.[0];
      const nextText =
        queued?.text ??
        "Quick follow-up question: if I have to adjust my appointment time again within 48 hours or bring a family member, how does Elevate handle VIP late-fee waivers and companion pricing?";
      const isTough = queued?.isToughQuestion ?? true;

      const updatedAssist = buildDeterministicAiAssist(nextText, {
        guestName: target.guestName,
        salonName: target.salonName,
      });

      setRawInteractions((prev) =>
        prev.map((inter) => {
          if (inter.id !== interactionId) return inter;
          const remaining = (inter.pendingLiveUtterances ?? []).slice(1);
          return {
            ...inter,
            lifecycle: "Live",
            hasToughQuestion: inter.hasToughQuestion || isTough,
            sentiment: isTough ? "Policy Question" : inter.sentiment,
            pendingLiveUtterances: remaining,
            turns: [
              ...inter.turns,
              {
                id: `T-LIVE-${Date.now()}`,
                speaker: "Guest",
                speakerLabel: `${inter.guestName} (${
                  inter.channel === "Voice" ? "Caller" : inter.membershipTier
                })`,
                timestamp: nowStamp,
                text: nextText,
                isToughQuestion: isTough,
              },
            ],
            aiAssist: {
              ...inter.aiAssist,
              ...updatedAssist,
              generatedBy: "Certified Salon Policy Engine",
              generatedAt: nowStamp,
            },
          };
        })
      );

      notify(
        `New live ${target.channel.toLowerCase()} turn from ${
          target.guestName
        } · AI Assist updated.`,
        "teal"
      );
    },
    [rawInteractions, notify]
  );

  const askCockpitAiAssist = useCallback(
    async (params: {
      interactionId?: string;
      customQuestion: string;
    }): Promise<AIAssistSuggestion> => {
      setAiAssistLoading(true);
      const target = params.interactionId
        ? rawInteractions.find((i) => i.id === params.interactionId)
        : undefined;
      const linkedApt = target?.linkedAppointmentId
        ? rawAppointments.find((a) => a.id === target.linkedAppointmentId)
        : undefined;

      const recentTranscript = target
        ? target.turns
            .slice(-4)
            .map((t) => `${t.speaker}: ${t.text}`)
            .join(" | ")
        : "";

      const result = await requestCockpitAiAssist({
        toughQuestion: params.customQuestion,
        guestName: target?.guestName,
        membershipTier: target?.membershipTier,
        salonName: target?.salonName,
        stylistName: linkedApt?.stylistName,
        channel: target?.channel,
        appointmentSummary: linkedApt
          ? `${linkedApt.serviceName} on ${linkedApt.date} at ${linkedApt.startTime} ($${linkedApt.priceUsd}) with ${linkedApt.stylistName}`
          : undefined,
        recentTranscript,
        advisorPaused: policy.advisorPaused,
      });

      if (target) {
        setRawInteractions((prev) =>
          prev.map((inter) =>
            inter.id === target.id
              ? {
                  ...inter,
                  hasToughQuestion: true,
                  aiAssist: result.suggestion,
                }
              : inter
          )
        );
      }

      const evt: ControlTowerEvent = {
        id: `CT-AST-${Date.now()}`,
        date: "2026-10-25",
        timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
        product: "AI Dispute Manager",
        user: authSession.roleLabel,
        region: PERSONAS[activePersona].assignedRegion,
        requestType: "Cockpit AI Assist",
        tokensConsumed: result.tokensUsed,
        costUsd: Number(((result.tokensUsed / 1000) * 0.0012).toFixed(5)),
        latencyMs: result.latencyMs,
        cacheHit: !result.usedGemini,
        status: policy.advisorPaused ? "Blocked" : "Success",
        isLiveGeminiMetadata: result.usedGemini,
        detail: `Cockpit AI Assist answered tough question: "${params.customQuestion.slice(
          0,
          75
        )}"`,
      };
      setControlTowerEvents((prev) => [evt, ...prev]);
      setAiAssistLoading(false);
      return result.suggestion;
    },
    [
      rawInteractions,
      rawAppointments,
      policy.advisorPaused,
      authSession.roleLabel,
      activePersona,
    ]
  );

  const resetPrototypeState = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("insightflow_enterprise_state_v2");
    localStorage.removeItem("insightflow_enterprise_state_v3");
    localStorage.removeItem("insightflow_wellness_zenne_v4");
    const freshInsights = createInitialSavedInsights(1, false);
    const freshWidgets = createInitialDashboardWidgets(1, 0, false);
    savedInsightsRef.current = freshInsights;
    dashboardWidgetsRef.current = freshWidgets;
    alertRulesRef.current = INITIAL_ALERT_RULES;
    contextRef.current = INITIAL_CONTEXT_BY_PERSONA;
    messagesRef.current = { arjun: [], meera: [], neha: [] };
    zenneThreadsRef.current = { arjun: [], meera: [], neha: [] };
    pendingClarRef.current = { arjun: null, meera: null, neha: null };
    dataVersionRef.current = 1;
    demoTimeOffsetRef.current = 0;
    posSyncRefreshedRef.current = false;
    const defaultSession = buildUserAuthSession(
      "Operations Portal",
      "regional_manager"
    );
    authSessionRef.current = defaultSession;

    ensureSyntheticDatasetReady(1);
    setAuthSession(defaultSession);
    setActivePersona("arjun");
    setActiveNavState("dashboard");
    setCockpitSubTab("calendar");
    setZenneOpen(false);
    setChatbotMode("business-advisor");
    zenneAgentRef.current = "ai-business-advisor";
    setZenneAgentState("ai-business-advisor");
    zenneToolModeRef.current = "deep-research";
    setZenneToolModeState("deep-research");
    zenneAttachedDocRef.current = null;
    setZenneAttachedDocState(null);
    setDashboardWidgets(freshWidgets);
    setSavedInsights(freshInsights);
    setDashboards(createInitialDashboards());
    setPolicy(DEFAULT_GOVERNANCE_POLICY);
    setPreviousApprovedPolicy(DEFAULT_GOVERNANCE_POLICY);
    setAgents(INITIAL_AGENT_IDENTITIES);
    setControlTowerEvents(generateInitialControlTowerEvents());
    setAlertRules(INITIAL_ALERT_RULES);
    setAlertStatusMap({});
    setAlertAssigneeMap({});
    setManualSimulatedAlerts([]);
    setInterventions(INITIAL_INTERVENTIONS);
    setRawOpportunities(buildInitialOpportunities(1, false));
    setRawAppointments(createInitialAppointments());
    setRawInteractions(createInitialInteractions());
    setOutbox([]);
    setAuditLog(INITIAL_AUDIT_EVENTS);
    setMessagesByPersona({ arjun: [], meera: [], neha: [] });
    setZenneThreadsByPersona({ arjun: [], meera: [], neha: [] });
    setPendingClarificationByPersona({ arjun: null, meera: null, neha: null });
    setContextByPersona(INITIAL_CONTEXT_BY_PERSONA);
    setPosSyncRefreshed(false);
    setDemoTimeOffsetHours(0);
    setDataVersion(1);
    setSafetyResults(
      runGovernanceSafetySuite({
        policy: DEFAULT_GOVERNANCE_POLICY,
        posSyncRefreshed: false,
        dataVersion: 1,
      })
    );
    queryCacheService.invalidateStaleVersions(999999);
    notify(
      "Reset all Wellness data, Cockpit appointments, Zenne threads, governance policies, and widgets to factory defaults.",
      "teal"
    );
  }, [notify]);

  const value: AppStateContextValue = {
    showOnboarding,
    setShowOnboarding,
    authSession,
    loginWithRole,
    activePersona,
    switchPersona,
    activeNav,
    setActiveNav,
    cockpitSubTab,
    setCockpitSubTab,
    settingsSubTab,
    setSettingsSubTab,
    opportunitiesSubTab,
    setOpportunitiesSubTab,
    presenterHintsEnabled,
    setPresenterHintsEnabled,
    guidedDemoActive,
    setGuidedDemoActive,
    guidedDemoStep,
    setGuidedDemoStep,
    executeGuidedStepAction,
    activeScenarioId,
    launchDemoScenario,
    clearScenarioBanner,
    dataVersion,
    demoTimeOffsetHours,
    posSyncRefreshed,
    dummyDatasetSummary,
    ensureOrReloadDummyData,
    advanceDemoTime,
    refreshPosRetailSource,
    triggerDataVersionRefresh,
    zenneOpen,
    setZenneOpen,
    zenneExpanded,
    setZenneExpanded,
    zenneThread: zenneThreadsByPersona[activePersona],
    pendingClarification: pendingClarificationByPersona[activePersona],
    openZenneWithPrompt,
    sendZenneMessage,
    clearZenneConversation,
    zenneAgent,
    setZenneAgent,
    zenneToolMode,
    setZenneToolMode,
    zenneAttachedDoc,
    setZenneAttachedDoc,
    chatbotMode,
    setChatbotMode,
    analysisMode,
    setAnalysisMode,
    advisorLoading,
    currentMessages: messagesByPersona[activePersona],
    conversationContext: contextByPersona[activePersona],
    savedQuestions,
    saveQuestionPrompt,
    policyWarningBanner,
    pendingHighCostQuestion,
    confirmHighCostQuery,
    cancelHighCostQuery,
    askAdvisor,
    markResponseFeedback,
    clearConversation,
    dashboardWidgets,
    saveZenneConversationToDashboard,
    updateDashboardWidgetSchedule,
    removeDashboardWidget,
    refreshDashboardWidgetNow,
    runScheduledWidgetRefreshes,
    savedInsights,
    saveResponseAsInsight,
    updateInsightSchedule,
    runSavedInsightNow,
    runAllDueScheduledJobs,
    dashboards,
    createDashboard,
    renameDashboard,
    pinInsightToDashboard,
    removeTileFromDashboard,
    resizeDashboardTile,
    reorderDashboardTile,
    updateDashboardTileSalonFilter,
    refreshSingleTile,
    refreshAllDashboardTiles,
    opportunities,
    updateOpportunityStatus,
    interventions,
    recordIntervention,
    alertRules,
    addAlertRule,
    toggleAlertRule,
    triggeredAlerts,
    simulateAlertTrigger,
    updateAlertActionState,
    appointments,
    interactions,
    aiAssistLoading,
    rescheduleAppointment,
    cancelAppointment,
    sendConsoleManagerReply,
    simulateIncomingCustomerTurn,
    askCockpitAiAssist,
    policy,
    updatePolicy,
    restorePreviousApprovedPolicy,
    agents,
    toggleAgentEnabled,
    controlTowerEvents,
    safetyResults,
    executeSafetyTestSuite,
    outbox,
    verifyExportChannelAllowed,
    sendSimulatedShare,
    auditLog,
    appendAuditEvent,
    resetPrototypeState,
    toast,
    notify,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
};

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return ctx;
}
