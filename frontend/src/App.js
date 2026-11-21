import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import Jobs from "./pages/Jobs";
import Board from "./pages/Board";
import CalendarPage from "./pages/CalendarPage";
import Approvals from "./pages/Approvals";
import TimeTracker from "./pages/TimeTracker";
import Clients from "./pages/Clients";
import Team from "./pages/Team";
import KPI from "./pages/KPI";
import SOPs from "./pages/SOPs";
import Reports from "./pages/Reports";
import AIAssistant from "./pages/AIAssistant";
import Vibes from "./pages/Vibes";
import Notifications from "./pages/Notifications";
import PromptStudio from "./pages/PromptStudio";
import MyDay from "./pages/MyDay";
import PublicApproval from "./pages/PublicApproval";
import Leaves from "./pages/Leaves";
import HRHub from "./pages/HRHub";
import Leads from "./pages/Leads";
import TabManager from "./pages/TabManager";
import { TabsProvider, useTabs, useIsTabOwner } from "./lib/tabs";
import "./App.css";

function Protected({ children, managerOnly, tab, ownerOnly }) {
  const { user } = useAuth();
  const { hidden, ready } = useTabs();
  const isOwner = useIsTabOwner();
  if (!user) return <Navigate to="/login" replace />;
  if (managerOnly && !user.is_admin) return <Navigate to="/dashboard" replace />;
  if (ownerOnly && !isOwner) return <Navigate to="/dashboard" replace />;
  if (tab && !ready) return null;
  if (tab && hidden.has(tab)) return <Navigate to="/dashboard" replace />;
  return <Layout>{children}</Layout>;
}

function DashboardOrMyDay() {
  const { user } = useAuth();
  if (!user?.is_admin) return <MyDay user={user} />;
  return <Dashboard />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/client/approval/:token" element={<PublicApproval />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Protected><DashboardOrMyDay /></Protected>} />
      <Route path="/inbox" element={<Protected tab="inbox"><Inbox /></Protected>} />
      <Route path="/jobs" element={<Protected tab="jobs"><Jobs /></Protected>} />
      <Route path="/board" element={<Protected tab="board"><Board /></Protected>} />
      <Route path="/calendar" element={<Protected tab="calendar"><CalendarPage /></Protected>} />
      <Route path="/approvals" element={<Protected tab="approvals"><Approvals /></Protected>} />
      <Route path="/time" element={<Protected tab="time"><TimeTracker /></Protected>} />
      <Route path="/clients" element={<Protected tab="clients"><Clients /></Protected>} />
      <Route path="/team" element={<Protected managerOnly><Team /></Protected>} />
      <Route path="/kpi" element={<Protected tab="kpi"><KPI /></Protected>} />
      <Route path="/sop" element={<Protected tab="sop"><SOPs /></Protected>} />
      <Route path="/reports" element={<Protected managerOnly><Reports /></Protected>} />
      <Route path="/ai" element={<Protected tab="ai"><AIAssistant /></Protected>} />
      <Route path="/vibes" element={<Protected tab="vibes"><Vibes /></Protected>} />
      <Route path="/notifications" element={<Protected tab="notifications"><Notifications /></Protected>} />
      <Route path="/prompts" element={<Protected managerOnly><PromptStudio /></Protected>} />
      <Route path="/leaves" element={<Protected tab="leaves"><Leaves /></Protected>} />
      <Route path="/hr" element={<Protected tab="hr"><HRHub /></Protected>} />
      <Route path="/leads" element={<Protected tab="leads"><Leads /></Protected>} />
      <Route path="/tab-visibility" element={<Protected ownerOnly><TabManager /></Protected>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <TabsProvider>
            <AppRoutes />
          </TabsProvider>
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
