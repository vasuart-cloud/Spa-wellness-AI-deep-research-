import React, { useState } from "react";
import {
  ArrowRight,
  Compass,
  Database,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { buildUserAuthSession, useAppState } from "../context/AppStateContext";
import { LoginRoleKey, LoginType } from "../types/domain";

const LOGIN_TYPES: Array<{
  id: LoginType;
  label: string;
  hint: string;
}> = [
  {
    id: "Enterprise SSO",
    label: "Enterprise SSO",
    hint: "SAML 2.0 corporate identity",
  },
  {
    id: "Operations Portal",
    label: "Operations Portal",
    hint: "Regional field operations",
  },
  {
    id: "Executive Suite",
    label: "Executive Suite",
    hint: "COO multi-region leadership",
  },
  {
    id: "Governance Console",
    label: "Governance Console",
    hint: "Customer Admin AI governance",
  },
  {
    id: "Staff POS Terminal",
    label: "Staff POS Terminal",
    hint: "Shared studio reception (RBAC restricted)",
  },
];

const ROLE_OPTIONS: Array<{
  key: LoginRoleKey;
  title: string;
  department: string;
  description: string;
  recommendedLogin: LoginType;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: "regional_manager",
    title: "Regional Manager",
    department: "Pacific Northwest · 5 Authorized Salons",
    description:
      "Access Dashboard, Cockpit (Guest Appointments Calendar, Live/Previous Chat & Voice Transcripts Console + AI Assist), Staff, and Settings, plus Zenne in the bottom-right.",
    recommendedLogin: "Operations Portal",
    icon: UserCheck,
  },
  {
    key: "chief_operating_officer",
    title: "Chief Operating Officer (COO)",
    department: "All 4 Regions · 20 Authorized Salons",
    description:
      "Executive parity across Dashboard, Cockpit, Staff, and Settings. Consult Zenne on multi-region profitability, margin compression, and holdout ROI, then schedule Dashboard widgets.",
    recommendedLogin: "Executive Suite",
    icon: TrendingUp,
  },
  {
    key: "governance_admin",
    title: "Customer Admin",
    department: "Tenant-Wide AI Governance · 20 Salons",
    description:
      "Click the Settings icon in the left panel to govern AI Agents and Zenne (AI Business Advisor) policies, budgets, emergency pause controls, safety checks, and audit logs.",
    recommendedLogin: "Governance Console",
    icon: ShieldCheck,
  },
  {
    key: "front_desk_staff",
    title: "Studio Front-Desk Staff",
    department: "Single Reception Desk · POS Only",
    description:
      "Point-of-sale guest reception role without Zenne BI entitlement. Sign in to verify RBAC enforcement blocking unauthorized chatbot queries.",
    recommendedLogin: "Staff POS Terminal",
    icon: Lock,
  },
];

export const OnboardingModal: React.FC = () => {
  const {
    showOnboarding,
    setShowOnboarding,
    authSession,
    loginWithRole,
    dummyDatasetSummary,
    ensureOrReloadDummyData,
    setGuidedDemoActive,
    setGuidedDemoStep,
    executeGuidedStepAction,
  } = useAppState();

  const [selectedLoginType, setSelectedLoginType] = useState<LoginType>(
    authSession.loginType
  );
  const [selectedRoleKey, setSelectedRoleKey] = useState<LoginRoleKey>(
    authSession.roleKey
  );
  const [submitting, setSubmitting] = useState(false);

  if (!showOnboarding) return null;

  const previewSession = buildUserAuthSession(
    selectedLoginType,
    selectedRoleKey
  );

  const handleLoginSubmit = async () => {
    setSubmitting(true);
    try {
      await loginWithRole(selectedLoginType, selectedRoleKey, "dashboard");
    } finally {
      setSubmitting(false);
    }
  };

  const startGuidedTour = async () => {
    setShowOnboarding(false);
    setGuidedDemoActive(true);
    setGuidedDemoStep(1);
    await executeGuidedStepAction(1);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full overflow-hidden shadow-xl my-auto">
        {/* Top Hero Band */}
        <div className="bg-slate-900 text-white px-6 sm:px-8 py-7 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-purple-300 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Elevate Salon &amp; Wellness Platform</span>
            <span aria-hidden="true">·</span>
            <span>Role-Based Access Control (RBAC)</span>
            <span aria-hidden="true">·</span>
            <span>Zenne Intelligence &amp; Cockpit Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">
            Wellness Intelligence Platform Sign-In
          </h1>
          <p className="text-slate-300 text-sm max-w-2xl">
            Sign in as Regional Manager, Chief Operating Officer (COO), or
            Customer Admin to access Dashboard, Cockpit, Staff, Settings, and
            Zenne in the bottom-right corner.
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Step 1: Select Login Type */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-900">
                01. Select Authentication Channel
              </label>
              <span className="text-xs text-slate-500">
                Device &amp; portal context governs RBAC session security
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {LOGIN_TYPES.map((lt) => {
                const active = selectedLoginType === lt.id;
                return (
                  <button
                    key={lt.id}
                    type="button"
                    onClick={() => setSelectedLoginType(lt.id)}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      active
                        ? "border-purple-700 bg-purple-50/60 text-slate-900"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="text-xs font-semibold whitespace-nowrap truncate">
                      {lt.label}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                      {lt.hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Select Organizational Role */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-900">
                02. Select Platform Role
              </label>
              <span className="text-xs text-slate-500">
                Determines authorized salons, Zenne chatbot entitlement, and
                Settings governance
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ROLE_OPTIONS.map((role) => {
                const Icon = role.icon;
                const active = selectedRoleKey === role.key;
                return (
                  <button
                    key={role.key}
                    type="button"
                    onClick={() => {
                      setSelectedRoleKey(role.key);
                      if (
                        role.key !== "front_desk_staff" &&
                        selectedLoginType === "Staff POS Terminal"
                      ) {
                        setSelectedLoginType(role.recommendedLogin);
                      }
                    }}
                    className={`text-left p-4 rounded-xl border transition-colors flex flex-col justify-between gap-2 ${
                      active
                        ? "border-purple-700 bg-purple-50/40"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-purple-800">
                          {role.department}
                        </span>
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            active ? "text-purple-700" : "text-slate-400"
                          }`}
                        />
                      </div>
                      <div className="text-sm font-semibold text-slate-900">
                        {role.title}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {role.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RBAC Entitlement & Certified Dataset Summary */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-slate-900">
                  Selected Session:
                </span>
                <span className="text-slate-700">
                  {previewSession.loginType}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-slate-800">
                  {previewSession.roleLabel}
                </span>
                <span aria-hidden="true">·</span>
                <span
                  className={`font-semibold ${
                    previewSession.canAccessChatbot
                      ? "text-emerald-700"
                      : "text-red-700"
                  }`}
                >
                  {previewSession.canAccessChatbot
                    ? "Zenne Chatbot Authorized"
                    : "Zenne Restricted by RBAC"}
                </span>
              </div>
              <div className="text-xs text-slate-600">
                {previewSession.canAccessChatbot ? (
                  <>
                    Scope: {previewSession.departmentScope} · Certified wellness
                    dataset ready (
                    <span className="font-mono tabular-nums">
                      {dummyDatasetSummary.salonCount}
                    </span>{" "}
                    salons,{" "}
                    <span className="font-mono tabular-nums">
                      {dummyDatasetSummary.monthlyRows}
                    </span>{" "}
                    monthly &amp;{" "}
                    <span className="font-mono tabular-nums">
                      {dummyDatasetSummary.dailyRows}
                    </span>{" "}
                    daily records · v{dummyDatasetSummary.dataVersion}).
                  </>
                ) : (
                  previewSession.rbacDenialReason
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={ensureOrReloadDummyData}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white hover:bg-slate-100 text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Database className="w-3.5 h-3.5 text-purple-700" />
              <RefreshCw className="w-3 h-3" />
              Reload Synthetic Data
            </button>
          </div>

          {/* Primary Sign-In & Guided Walkthrough Actions */}
          <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={startGuidedTour}
              className="px-4 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <Compass className="w-4 h-4 text-purple-700" />
              Explore Guided Walkthrough (8 Steps)
            </button>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowOnboarding(false)}
                className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleLoginSubmit}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 disabled:opacity-50 rounded-lg inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                <span>
                  {submitting
                    ? "Signing In..."
                    : `Sign In to Wellness Platform`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
