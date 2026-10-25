/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { AppStateProvider, useAppState } from "./context/AppStateContext";
import { OnboardingModal } from "./components/OnboardingModal";
import { WorkspaceShell } from "./components/layout/WorkspaceShell";
import { CockpitView } from "./components/views/CockpitView";
import { CustomerAdminSettingsView } from "./components/views/CustomerAdminSettingsView";
import { DashboardView } from "./components/views/DashboardView";
import { StaffView } from "./components/views/StaffView";

const WorkspaceRouter: React.FC = () => {
  const { activeNav } = useAppState();

  const renderActiveSection = () => {
    switch (activeNav) {
      case "dashboard":
      case "overview":
      case "dashboards":
      case "saved-insights":
      case "advisor":
        return <DashboardView />;
      case "cockpit":
      case "opportunities":
      case "alerts":
      case "reports":
        return <CockpitView />;
      case "staff":
        return <StaffView />;
      case "settings":
      case "governance":
      case "control-tower":
      case "audit":
        return <CustomerAdminSettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <>
      <OnboardingModal />
      <WorkspaceShell>{renderActiveSection()}</WorkspaceShell>
    </>
  );
};

export default function App() {
  return (
    <AppStateProvider>
      <WorkspaceRouter />
    </AppStateProvider>
  );
}
