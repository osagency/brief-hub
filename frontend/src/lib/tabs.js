import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "./api";
import { useAuth } from "./auth";

export const TAB_OWNER_EMAIL = "yusuf@osagency.in";

export const TAB_LABELS = {
  inbox: "Smart Inbox", notifications: "Notifications", jobs: "All Jobs", board: "Board",
  calendar: "Content Calendar", approvals: "Approvals", time: "Time Tracker", leads: "Lead Generation",
  clients: "Clients", kpi: "KPI & Performance", leaves: "Leaves", hr: "HR & Culture",
  sop: "SOP Library", ai: "AI Assistant", vibes: "Team Vibes",
};

const TabsCtx = createContext({ hidden: new Set(), ready: false, reload: () => {} });

export function TabsProvider({ children }) {
  const { user } = useAuth();
  const [hidden, setHidden] = useState(new Set());
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    if (!user) { setReady(true); return; }
    try {
      const { data } = await api.get("/settings/tabs/me");
      setHidden(new Set(data.hidden));
    } catch (e) {
      console.warn("Tab visibility load failed:", e?.message);
    }
    setReady(true);
  }, [user]);

  useEffect(() => { setReady(false); reload(); }, [user?.id, reload]);

  return React.createElement(TabsCtx.Provider, { value: { hidden, ready, reload } }, children);
}

export const useTabs = () => useContext(TabsCtx);

export const useIsTabOwner = () => {
  const { realUser, isImpersonating } = useAuth();
  return !isImpersonating && (realUser?.email || "").toLowerCase() === TAB_OWNER_EMAIL;
};
