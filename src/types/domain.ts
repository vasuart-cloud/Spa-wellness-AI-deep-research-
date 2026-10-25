export type PersonaId = "arjun" | "meera" | "neha";

export type RegionName =
  | "Pacific Northwest"
  | "Southwest"
  | "Midwest"
  | "Northeast";

export type NavSection =
  | "dashboard"
  | "cockpit"
  | "staff"
  | "settings"
  | "overview"
  | "advisor"
  | "saved-insights"
  | "dashboards"
  | "opportunities"
  | "reports"
  | "alerts"
  | "governance"
  | "control-tower"
  | "audit";

export type ChatbotMode = "business-advisor" | "data-qa" | "retention-coach";

export type LoginType =
  | "Enterprise SSO"
  | "Operations Portal"
  | "Executive Suite"
  | "Governance Console"
  | "Staff POS Terminal";

export type LoginRoleKey =
  | "regional_manager"
  | "chief_operating_officer"
  | "governance_admin"
  | "front_desk_staff";

export interface UserAuthSession {
  isAuthenticated: boolean;
  loginType: LoginType;
  roleKey: LoginRoleKey;
  roleLabel: string;
  departmentScope: string;
  mappedPersonaId: PersonaId;
  canAccessChatbot: boolean;
  allowedChatbotModes: ChatbotMode[];
  rbacDenialReason?: string;
  signedInAt: string;
}

export interface PersonaProfile {
  id: PersonaId;
  name: string;
  roleTitle: string;
  shortLabel: string;
  assignedRegion: RegionName | "All Regions";
  allowedSalonIds: string[];
  allowedNav: NavSection[];
  canConfigureGovernance: boolean;
  canViewAllRegions: boolean;
  canExportAudit: boolean;
  goals: string[];
}

export interface SalonMetadata {
  id: string;
  name: string;
  city: string;
  region: RegionName;
  managerName: string;
  chairs: number;
  monthlyRevenueTarget: number;
  deliberateFlags: string[];
}

export interface MonthlySalonMetric {
  salonId: string;
  salonName: string;
  region: RegionName;
  monthKey: string; // e.g. "2026-10"
  monthLabel: string; // e.g. "Oct 2026"
  completedPaidVisits: number;
  newGuests: number;
  returningGuests: number;
  repeatVisitRate: number; // % of visits from returning guests
  rebookingRate: number; // % rebooked at checkout
  repeatVisitIntervalDays: number;
  averageTicket: number;
  serviceRevenue: number;
  retailRevenue: number;
  membershipRevenue: number;
  totalRevenue: number;
  discountAmount: number;
  discountRatePct: number;
  cancellations: number;
  cancellationRatePct: number;
  noShows: number;
  noShowRatePct: number;
  availableStylistHours: number;
  utilizedStylistHours: number;
  staffUtilizationPct: number;
  retailAttachmentPct: number;
  contributionMarginPct: number;
  estimatedContributionDollars: number;
  revenuePerAvailableHour: number;
}

export interface DailySalonMetric {
  salonId: string;
  salonName: string;
  region: RegionName;
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  completedPaidVisits: number;
  returningGuests: number;
  repeatVisitRate: number;
  rebookingRate: number;
  serviceRevenue: number;
  retailRevenue: number;
  totalRevenue: number;
  discountAmount: number;
  cancellations: number;
  cancellationRatePct: number;
  noShows: number;
  availableStylistHours: number;
  utilizedStylistHours: number;
  staffUtilizationPct: number;
  retailAttachmentPct: number;
  estimatedContributionDollars: number;
}

export interface SourceSystemStatus {
  id: string;
  name: string;
  cadenceType: "Daily Batch Warehouse" | "Operational Event Stream" | "POS Retail Ledger Sync";
  updateScheduleLabel: string;
  dataThroughTimestamp: string;
  ageHours: number;
  slaHours: number;
  status: "Fresh" | "Stale" | "Delayed";
  completenessPct: number;
  notes: string;
}

export interface MetricDefinition {
  id: string;
  version: string;
  name: string;
  formula: string;
  unit: "currency" | "percent" | "number" | "days";
  sourceSystemId: string;
  cadenceNote: string;
  businessMeaning: string;
}

export type VisualizationType =
  | "bar"
  | "line"
  | "stacked-bar"
  | "heatmap"
  | "funnel"
  | "table-only";

export interface KPICardItem {
  id: string;
  label: string;
  currentValue: string;
  baselineLabel: string;
  baselineValue: string;
  varianceLabel: string;
  varianceDirection: "positive" | "negative" | "neutral";
  metricId: string;
}

export interface AnomalyFlag {
  detected: boolean;
  metricName: string;
  affectedEntity: string;
  actualValue: string;
  historicalBaseline: string;
  absoluteDeviation: string;
  percentageDeviation: string;
  severity: "High" | "Moderate" | "Low";
  evidenceQuality: "High (Certified Daily Batch)" | "Moderate (Partial Window)" | "Cautious (Stale POS Source)";
}

export interface RecommendedActionItem {
  id: string;
  title: string;
  rationale: string;
  expectedImpactDirection: string;
  priority: "P1 - High" | "P2 - Medium" | "P3 - Standard";
  responsiblePersona: string;
  requiredHumanApproval: string;
  affectedSalonIds: string[];
}

export interface HeatmapCell {
  day: string;
  slot: string;
  utilizationPct: number;
  unusedHours: number;
}

export interface FunnelStage {
  stage: string;
  guests: number;
  conversionPct: number;
  benchmarkPct: number;
}

export interface AIResponseContract {
  id: string;
  question: string;
  title: string;
  summary: string;
  executiveStyle: boolean;
  timeRange: string;
  businessScope: string;
  scopedSalonIds: string[];
  topicKey:
    | "repeat_visits"
    | "repeat_drivers"
    | "revenue_6m"
    | "unused_capacity"
    | "retail_decline"
    | "revenue_risk"
    | "weekly_priorities"
    | "repeat_actions"
    | "month_change"
    | "financial_impact"
    | "coo_monthly_perf"
    | "coo_profitability"
    | "coo_capacity_loss"
    | "coo_interventions"
    | "coo_confidence"
    | "coo_exec_actions"
    | "ambiguous"
    | "unsupported"
    | "access_denied"
    | "policy_blocked";
  kpis: KPICardItem[];
  chartType: VisualizationType;
  chartTitle: string;
  chartSubtitle: string;
  chartData: Array<Record<string, string | number>>;
  secondaryChartData?: Array<Record<string, string | number>>;
  heatmapData?: HeatmapCell[];
  funnelData?: FunnelStage[];
  tableColumns: Array<{
    key: string;
    header: string;
    align?: "left" | "right";
  }>;
  tableRows: Array<Record<string, string | number>>;
  sourceFreshness: SourceSystemStatus;
  lastAnalysisTimestamp: string;
  anomaly: AnomalyFlag | null;
  interpretation: string;
  likelyDrivers: string[];
  recommendedActions: RecommendedActionItem[];
  caveats: string[];
  followUpSuggestions: string[];
  calculationDetails: {
    kpiIds: string[];
    formulaSummary: string;
    validationChecks: string[];
    executionSource:
      | "Certified Cache Reused"
      | "Deterministic Engine + Gemini 3.8 Flash"
      | "Deterministic Engine (Fallback Narrative)"
      | "Governance Policy Gate";
    cacheStatusBanner?: string;
    tokensUsed: number;
    estimatedCostUsd: number;
    latencyMs: number;
    isSimulatedTokenEstimate: boolean;
  };
  chatbotMode?: ChatbotMode;
  userFeedback?: "useful" | "not_useful" | null;
}

export interface ChatConversationTurn {
  id: string;
  timestamp: string;
  chatbotMode: ChatbotMode;
  roleLabel: string;
  loginType: LoginType;
  question: string;
  response: AIResponseContract;
}

export interface ConversationContextState {
  lastTopicKey: AIResponseContract["topicKey"] | null;
  focusedSalonIds: string[];
  lastTimeRange: string;
  turnCount: number;
}

export type ZenneAgentSelection =
  | "ai-business-advisor"
  | "ai-retention-manager";

export type ZenneToolMode = "deep-research" | "ask" | "search";

export interface ZenneUploadedDoc {
  name: string;
  sizeLabel: string;
  rowOrLineCount?: number;
  excerpt: string;
  uploadedAt: string;
}

export interface ZenneClarificationPrompt {
  id: string;
  originalQuestion: string;
  topicKey: AIResponseContract["topicKey"];
  introText: string;
  followUpQuestions: string[];
  quickReplies: string[];
  uploadedDoc?: ZenneUploadedDoc;
  dataFreshness: {
    dataDate: string;
    dataTime: string;
    sourceName: string;
    status: "Fresh" | "Stale" | "Delayed";
  };
}

export type ZenneThreadEntry =
  | {
      id: string;
      kind: "user";
      timestamp: string;
      text: string;
      isClarificationReply?: boolean;
      agentSelection?: ZenneAgentSelection;
      toolMode?: ZenneToolMode;
      uploadedDoc?: ZenneUploadedDoc;
    }
  | {
      id: string;
      kind: "clarification";
      timestamp: string;
      clarification: ZenneClarificationPrompt;
      answeredWith?: string;
      agentSelection?: ZenneAgentSelection;
    }
  | {
      id: string;
      kind: "answer";
      timestamp: string;
      originalQuestion: string;
      clarificationFocus?: string;
      agentSelection?: ZenneAgentSelection;
      toolMode?: ZenneToolMode;
      uploadedDoc?: ZenneUploadedDoc;
      response: AIResponseContract;
    };

export interface SavedDashboardWidget {
  id: string;
  widgetName: string;
  ownerPersona: PersonaId;
  roleLabel: string;
  originalQuestion: string;
  clarificationFocus?: string;
  topicKey: AIResponseContract["topicKey"];
  scopedSalonIds: string[];
  scopeLabel: string;
  chartType: VisualizationType;
  kpis: KPICardItem[];
  summary: string;
  interpretation: string;
  recommendations: RecommendedActionItem[];
  scheduledTime: string; // HH:MM (24h local time, e.g. "08:00")
  cadence: "Daily" | "Weekly";
  scheduleEnabled: boolean;
  lastRefreshedAt: string;
  nextScheduledLabel: string;
  lastRunStatus:
    | "Refreshed"
    | "Scheduled"
    | "Paused by Admin"
    | "Stale Source Warning";
  dataFreshness: {
    dataDate: string;
    dataTime: string;
    dataThroughTimestamp: string;
    sourceName: string;
    sourceId: string;
    status: "Fresh" | "Stale" | "Delayed";
    completenessPct: number;
  };
}

export interface SavedInsight {
  id: string;
  title: string;
  question: string;
  topicKey: AIResponseContract["topicKey"];
  kpiIdsAndVersions: string[];
  authorizedSalonIds: string[];
  scopeLabel: string;
  regionFilter: RegionName | "All Regions";
  relativeDateRange: "Last 30 Days" | "Last 6 Months" | "Month-to-Date" | "Quarter-to-Date";
  chartType: VisualizationType;
  ownerPersona: PersonaId;
  ownerName: string;
  createdAt: string;
  lastRefreshedAt: string;
  freshnessRequirementHours: number;
  recommendedRefreshFrequency: "Daily" | "Weekly" | "Monthly";
  schedule: ScheduleConfig | null;
  cachedSnapshot: {
    headlineMetric: string;
    trendLabel: string;
    trendDirection: "positive" | "negative" | "neutral";
    isStaleWarning: boolean;
  };
}

export interface ScheduleConfig {
  enabled: boolean;
  cadence: "Daily" | "Weekly" | "Monthly" | "Custom";
  dayOfWeek?: string;
  timeLocal: string; // e.g. "08:00"
  timezone: string; // e.g. "America/Los_Angeles"
  nextRunAt: string;
  lastRunAt: string | null;
  lastRunStatus: "Succeeded" | "Pending" | "Paused by Governance" | "Stale Source Warning";
}

export interface DashboardTile {
  id: string;
  savedInsightId: string;
  size: "compact" | "wide" | "full";
  order: number;
  salonFilter: string | "all";
}

export interface CustomDashboard {
  id: string;
  name: string;
  description: string;
  ownerPersona: PersonaId;
  sharedWithOrg: boolean;
  createdAt: string;
  updatedAt: string;
  tiles: DashboardTile[];
}

export type OpportunityStatus =
  | "New"
  | "Under Review"
  | "Action Approved"
  | "In Progress"
  | "Completed"
  | "Dismissed";

export interface RevenueOpportunity {
  id: string;
  category:
    | "Declining Repeat Visits"
    | "Underutilized Stylist Capacity"
    | "Elevated Cancellations"
    | "Declining Retail Attachment"
    | "Unusual Discount Levels"
    | "Margin Compression"
    | "Revenue Variance by Salon";
  title: string;
  affectedSalonIds: string[];
  affectedSalonNames: string[];
  region: RegionName | "Multiple Regions";
  currentMetricLabel: string;
  expectedBaselineLabel: string;
  monthlyImpactDollars: number;
  annualizedImpactDollars: number;
  sourceSystemId: string;
  freshnessStatus: "Fresh" | "Stale";
  severity: "Critical" | "High" | "Moderate";
  supportingEvidence: string;
  recommendedAction: string;
  assignedOwner: string;
  status: OpportunityStatus;
  updatedAt: string;
}

export interface AlertRule {
  id: string;
  name: string;
  metricKey:
    | "repeat_visit_rate"
    | "cancellation_rate"
    | "staff_utilization"
    | "total_revenue_change"
    | "retail_attachment"
    | "discount_rate";
  metricLabel: string;
  condition: "Falls by more than" | "Exceeds" | "Falls below" | "Increases by more than";
  thresholdPct: number;
  comparisonBaseline: "Previous 4-week baseline" | "Organization peer average" | "Monthly target";
  scopeRegion: RegionName | "All Regions";
  selectedSalonIds: string[];
  channel: "Email" | "WhatsApp" | "SMS";
  recipientRole: "Regional Manager" | "COO" | "Salon Director";
  frequency: "Once daily" | "Weekly digest";
  minFreshnessHours: number;
  enabled: boolean;
  createdBy: string;
}

export interface TriggeredAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  metricLabel: string;
  affectedSalons: string[];
  region: RegionName | "Multiple Regions";
  observedValue: string;
  thresholdLabel: string;
  severity: "High" | "Moderate";
  triggeredAt: string;
  sourceFreshnessStatus: "Fresh" | "Stale";
  staleVerificationBanner?: string;
  evidenceSummary: string;
  recommendedAction: string;
  assignedTo: string;
  status: "Active" | "Snoozed" | "Action Assigned" | "Resolved";
}

export interface InterventionRecord {
  id: string;
  title: string;
  opportunityId?: string;
  problemStatement: string;
  insightDelivered: string;
  actionTaken: string;
  affectedSalonIds: string[];
  affectedSalonNames: string[];
  region: RegionName;
  owner: string;
  startDate: string;
  status: "Planned" | "Active Holdout Trial" | "Completed & Validated";
  comparisonApproach: "Matched Regional Holdout Salons" | "Pre/Post 4-Week Baseline";
  beforeMetricLabel: string;
  afterMetricLabel: string;
  holdoutGroupDeltaLabel: string;
  incrementalVisitsMonthly: number;
  incrementalSalesMonthly: number;
  contributionMarginPct: number;
  interventionDiscountAndTrainingCost: number;
  estimatedNetContributionMonthly: number;
  managerHoursSavedWeekly: number;
  confidenceNote: string;
}

export interface OutboxMessage {
  id: string;
  timestamp: string;
  senderPersona: PersonaId;
  channel: "Email" | "WhatsApp" | "SMS";
  recipient: string;
  subject: string;
  bodyPreview: string;
  secureLinkUrl: string;
  linkExpiresAt: string;
  reportType: string;
  deliveryBanner: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorPersona: PersonaId;
  actorName: string;
  category:
    | "QUERY_EXECUTED"
    | "INSIGHT_SAVED"
    | "SCHEDULE_RUN"
    | "REPORT_EXPORTED"
    | "SHARE_SIMULATED"
    | "POLICY_UPDATED"
    | "ALERT_TRIGGERED"
    | "ACTION_APPROVED"
    | "ACCESS_BLOCKED";
  summary: string;
  scopeLabel: string;
  outcome: "Allowed" | "Blocked" | "Warning";
  metadata: string;
}

export interface GovernancePolicy {
  versionLabel: string;
  updatedAt: string;
  updatedBy: string;
  // Emergency controls
  advisorPaused: boolean;
  schedulingEnabled: boolean;
  alertDeliveryEnabled: boolean;
  sharingEnabled: boolean;
  // Cost & model controls
  dailyTenantTokenBudget: number;
  monthlyAiSpendBudgetUsd: number;
  userHourlyQueryLimit: number;
  allowDeepAnalysis: boolean;
  requireClarifyingFollowUp?: boolean;
  requireApprovalForHighCost: boolean;
  budgetExhaustionMode: "Hard Stop" | "Warning Only";
  maxQueryWindowMonths: 6 | 12;
  cachePolicy: "Strict Scoped Reuse" | "Bypass Cache";
  allowedExportChannels: Array<"Email" | "WhatsApp" | "SMS" | "PDF" | "CSV">;
  approvedRecipients: string[];
}

export interface AgentIdentityRecord {
  id: string;
  productName: "AI Business Advisor" | "AI Retention Manager" | "AI Dispute Manager";
  agentCode: string;
  owner: string;
  enabled: boolean;
  tenantScope: string;
  allowedCapabilities: string[];
  modelTier: string;
}

export interface ControlTowerEvent {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string;
  product: "AI Business Advisor" | "AI Retention Manager" | "AI Dispute Manager";
  user: string;
  region: RegionName | "All Regions";
  requestType:
    | "Fast Analysis"
    | "Deep Analysis"
    | "Scheduled Refresh"
    | "Proactive Alert"
    | "Retention Campaign"
    | "Dispute Triage"
    | "Cockpit AI Assist";
  tokensConsumed: number;
  costUsd: number;
  latencyMs: number;
  cacheHit: boolean;
  status: "Success" | "Blocked" | "Policy Violation" | "Error";
  isLiveGeminiMetadata: boolean;
  detail: string;
}

export interface SafetyTestResult {
  id: string;
  name: string;
  category:
    | "Unauthorized Data Request"
    | "Stale-Data Warning"
    | "KPI Calculation Integrity"
    | "Permission Change Propagation"
    | "Cost-Limit Enforcement"
    | "Prompt Injection Defense";
  description: string;
  lastRunAt: string | null;
  status: "Pass" | "Amber" | "Fail" | "Not Run";
  observedOutput: string;
}

export interface GuidedDemoStep {
  stepNumber: number;
  title: string;
  persona: PersonaId;
  targetNav: NavSection;
  visionPillar: "TRUST" | "ADOPT" | "REPEAT" | "PROVE";
  originBadge: "Zenoti-Inspired Core" | "Proposed Enhancement";
  description: string;
  actionButtonLabel: string;
}

export type CockpitSubTab =
  | "calendar"
  | "console"
  | "studios"
  | "opportunities"
  | "alerts"
  | "reports";

export type AppointmentStatus =
  | "Confirmed"
  | "Checked In"
  | "Rescheduled"
  | "Cancelled"
  | "Completed";

export interface GuestAppointment {
  id: string;
  salonId: string;
  salonName: string;
  region: RegionName;
  guestName: string;
  guestPhone: string;
  membershipTier: "VIP Wellness" | "Signature Member" | "Standard Guest";
  serviceName: string;
  category:
    | "Hair Color & Balayage"
    | "Cut & Styling"
    | "Keratin & Smoothing"
    | "Spa & Facial"
    | "Scalp & Wellness";
  stylistName: string;
  chairLabel: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM (24h)
  durationMin: number;
  priceUsd: number;
  status: AppointmentStatus;
  linkedInteractionId?: string;
  interactionSummary?: string;
  lastActionNote?: string;
  feeWaived?: boolean;
  updatedAt: string;
}

export type InteractionChannel = "Chat" | "Voice";

export type InteractionLifecycle = "Live" | "Previous";

export interface InteractionTranscriptTurn {
  id: string;
  speaker: "Guest" | "Manager" | "System";
  speakerLabel: string;
  timestamp: string;
  text: string;
  isToughQuestion?: boolean;
}

export interface AIAssistSuggestion {
  toughQuestion: string;
  suggestedAnswer: string;
  keyPolicyPoints: string[];
  policyReference: string;
  recommendedActionType:
    | "reschedule"
    | "cancel_waive_fee"
    | "complimentary_adjustment"
    | "none";
  recommendedActionSummary: string;
  recommendedDate?: string;
  recommendedTime?: string;
  recommendedStylist?: string;
  generatedBy: "Gemini 3.8 Flash" | "Certified Salon Policy Engine";
  generatedAt: string;
}

export interface CustomerInteraction {
  id: string;
  salonId: string;
  salonName: string;
  region: RegionName;
  guestName: string;
  guestPhone: string;
  membershipTier: "VIP Wellness" | "Signature Member" | "Standard Guest";
  channel: InteractionChannel;
  lifecycle: InteractionLifecycle;
  startedAt: string;
  durationOrStatusLabel: string;
  topic: string;
  sentiment: "Escalated" | "Policy Question" | "Scheduling" | "Resolved";
  hasToughQuestion: boolean;
  linkedAppointmentId?: string;
  turns: InteractionTranscriptTurn[];
  pendingLiveUtterances?: Array<{
    text: string;
    isToughQuestion?: boolean;
  }>;
  aiAssist: AIAssistSuggestion;
}

