import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  LayoutDashboard,
  Menu,
  Play,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { GUIDED_DEMO_STEPS, useAppState } from "../../context/AppStateContext";
import { PERSONAS } from "../../services/syntheticDataService";
import { NavSection } from "../../types/domain";
import { ZenneChatbot } from "../zenne/ZenneChatbot";

const LEFT_MENU_ITEMS: Array<{
  id: "dashboard" | "cockpit" | "staff" | "settings";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "cockpit", label: "Cockpit", icon: Compass },
  { id: "staff", label: "Staff", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

const DEMO_SCENARIOS = [
  { id: 1, label: "Scenario 1: Regional Manager Finds Repeat-Visit Drop" },
  { id: 2, label: "Scenario 2: Regional Manager Inspects Proactive Alert" },
  { id: 3, label: "Scenario 3: COO Reviews Multi-Region Profitability" },
  { id: 4, label: "Scenario 4: Customer Admin Governs AI Agents & Budgets" },
  { id: 5, label: "Scenario 5: COO Verifies Holdout ROI" },
];

export const WorkspaceShell: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    authSession,
    loginWithRole,
    activePersona,
    activeNav,
    setActiveNav,
    setShowOnboarding,
    guidedDemoActive,
    setGuidedDemoActive,
    guidedDemoStep,
    setGuidedDemoStep,
    executeGuidedStepAction,
    activeScenarioId,
    launchDemoScenario,
    clearScenarioBanner,
    triggeredAlerts,
    policy,
    toast,
  } = useAppState();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const persona = PERSONAS[activePersona];
  const activeAlertCount = triggeredAlerts.filter(
    (a) => a.status === "Active"
  ).length;

  const normalizedNav: "dashboard" | "cockpit" | "staff" | "settings" =
    activeNav === "cockpit" ||
    activeNav === "opportunities" ||
    activeNav === "alerts" ||
    activeNav === "reports"
      ? "cockpit"
      : activeNav === "staff"
        ? "staff"
        : activeNav === "settings" ||
            activeNav === "governance" ||
            activeNav === "control-tower" ||
            activeNav === "audit"
          ? "settings"
          : "dashboard";

  const currentGuidedStepObj =
    GUIDED_DEMO_STEPS.find((s) => s.stepNumber === guidedDemoStep) ??
    GUIDED_DEMO_STEPS[0];

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Left Navigation Panel: Strictly Dashboard, Cockpit, Staff, Settings */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 border-r border-slate-200 bg-white">
        <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200">
          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            className="text-base font-bold tracking-tight text-slate-900 font-display whitespace-nowrap inline-flex items-center gap-2 hover:text-purple-800 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-purple-700" />
            <span>Elevate Wellness</span>
          </button>
        </div>

        <div className="px-5 py-3.5 border-b border-slate-100 text-xs text-slate-600 space-y-0.5">
          <div className="font-semibold text-slate-900">
            {authSession.roleLabel}
          </div>
          <div>
            {persona.assignedRegion} ·{" "}
            <span className="font-mono tabular-nums">
              {persona.allowedSalonIds.length}
            </span>{" "}
            Salons
          </div>
        </div>

        <nav
          aria-label="Wellness Platform Navigation"
          className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"
        >
          {LEFT_MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = normalizedNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id as NavSection)}
                className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span className="inline-flex items-center gap-3 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-purple-300" : "text-slate-500"
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === "cockpit" && activeAlertCount > 0 ? (
                  <span
                    className={`font-mono tabular-nums text-xs ${
                      isActive
                        ? "text-amber-300"
                        : "text-amber-700 font-semibold"
                    }`}
                  >
                    {activeAlertCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-2.5 text-xs text-slate-700">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-900">Zenne Advisor</span>
            <span
              className={`font-mono font-semibold ${
                policy.advisorPaused ? "text-red-700" : "text-purple-800"
              }`}
            >
              {policy.advisorPaused ? "Paused" : "Ready"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Use the purple <strong>Zenne</strong> icon in the bottom-right
            corner for deep research &amp; scheduled widgets.
          </p>
          <button
            type="button"
            onClick={() => setGuidedDemoActive(!guidedDemoActive)}
            className="w-full px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md bg-white hover:bg-slate-100 text-slate-800 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Compass className="w-3.5 h-3.5 text-purple-700" />
            {guidedDemoActive ? "Hide Walkthrough" : "8-Step Guided Demo"}
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-full">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200">
              <span className="font-bold text-sm font-display">
                Elevate Wellness
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {LEFT_MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveNav(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                      normalizedNav === item.id
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
          <div
            className="flex-1 bg-slate-950/40"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean 3-Zone Top Bar Contract */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-8 sticky top-0 z-30">
          {/* Zone 1: Single-line Brand / Mobile Menu */}
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              Elevate Salon &amp; Wellness Platform
            </span>
          </div>

          {/* Zone 2: 4 Concise Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600">
            {LEFT_MENU_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
                className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 ${
                  normalizedNav === item.id
                    ? "text-slate-900 font-semibold underline underline-offset-4 decoration-purple-700"
                    : ""
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 Primary Action Button */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setShowOnboarding(true)}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Sign In / Switch Role
            </button>
          </div>
        </header>

        {/* Workspace Role Switcher & Demo Scenarios Bar (Below Header) */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
              Active Role:
            </span>
            <div className="inline-flex flex-wrap items-center gap-1 p-0.5 bg-slate-200/80 rounded-lg">
              {(
                [
                  {
                    roleKey: "regional_manager" as const,
                    loginType: "Operations Portal" as const,
                    label: "Regional Manager",
                  },
                  {
                    roleKey: "chief_operating_officer" as const,
                    loginType: "Executive Suite" as const,
                    label: "COO",
                  },
                  {
                    roleKey: "governance_admin" as const,
                    loginType: "Governance Console" as const,
                    label: "Customer Admin",
                  },
                  {
                    roleKey: "front_desk_staff" as const,
                    loginType: "Staff POS Terminal" as const,
                    label: "Front-Desk Staff",
                  },
                ]
              ).map((opt) => {
                const selected = authSession.roleKey === opt.roleKey;
                return (
                  <button
                    key={opt.roleKey}
                    type="button"
                    onClick={() =>
                      loginWithRole(opt.loginType, opt.roleKey, normalizedNav)
                    }
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      selected
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-700 hover:text-slate-900"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <span className="hidden xl:inline text-xs text-slate-600">
              · {authSession.loginType} ·{" "}
              <span className="font-semibold text-slate-800">
                {authSession.canAccessChatbot
                  ? `${persona.assignedRegion} (${persona.allowedSalonIds.length} salons)`
                  : "Zenne Restricted (RBAC)"}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="scenario-select"
              className="text-xs font-medium text-slate-700 whitespace-nowrap"
            >
              Scenarios:
            </label>
            <select
              id="scenario-select"
              value={activeScenarioId ?? ""}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val >= 1 && val <= 5) {
                  launchDemoScenario(val);
                } else {
                  clearScenarioBanner();
                }
              }}
              className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md text-slate-900 font-medium focus:outline-none focus:border-purple-700"
            >
              <option value="">Select Demo Scenario (1–5)...</option>
              {DEMO_SCENARIOS.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Guided 8-Step Walkthrough Strip */}
        {guidedDemoActive && (
          <div className="bg-slate-900 text-white px-4 sm:px-6 py-3 border-b border-slate-800">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-purple-300">
                  <span className="font-mono font-semibold tabular-nums">
                    Guided Step {guidedDemoStep} / 8
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Pillar: {currentGuidedStepObj.visionPillar}</span>
                </div>
                <div className="text-xs sm:text-sm font-semibold">
                  {currentGuidedStepObj.title}:{" "}
                  <span className="font-normal text-slate-200">
                    {currentGuidedStepObj.description}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={guidedDemoStep <= 1}
                  onClick={() => {
                    const prev = Math.max(1, guidedDemoStep - 1);
                    setGuidedDemoStep(prev);
                    executeGuidedStepAction(prev);
                  }}
                  className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-md inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  type="button"
                  onClick={() => executeGuidedStepAction(guidedDemoStep)}
                  className="px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Play className="w-3 h-3" />
                  {currentGuidedStepObj.actionButtonLabel}
                </button>
                <button
                  type="button"
                  disabled={guidedDemoStep >= 8}
                  onClick={() => {
                    const next = Math.min(8, guidedDemoStep + 1);
                    setGuidedDemoStep(next);
                    executeGuidedStepAction(next);
                  }}
                  className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-md inline-flex items-center gap-1 whitespace-nowrap"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setGuidedDemoActive(false)}
                  className="p-1.5 text-slate-400 hover:text-white"
                  title="Close Guided Walkthrough"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification (Positioned top-right so bottom-right Zenne icon is unobstructed) */}
        {toast && (
          <div className="fixed top-16 right-6 z-50 max-w-md">
            <div
              className={`px-4 py-3 rounded-lg border shadow-lg text-xs font-medium flex items-center justify-between gap-3 ${
                toast.tone === "red"
                  ? "bg-red-950 text-white border-red-800"
                  : toast.tone === "amber"
                    ? "bg-amber-950 text-white border-amber-800"
                    : "bg-slate-900 text-white border-slate-700"
              }`}
            >
              <span>{toast.text}</span>
            </div>
          </div>
        )}

        {/* Active Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Floating Bottom-Right Purple Chatbot "Zenne" */}
      <ZenneChatbot />
    </div>
  );
};
