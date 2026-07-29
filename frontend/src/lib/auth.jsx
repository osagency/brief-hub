import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [realUser, setRealUser] = useState(() => {
    const raw = localStorage.getItem("os_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [viewAsUser, setViewAsUser] = useState(() => {
    const raw = localStorage.getItem("os_view_as_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("os_token", data.token);
      localStorage.setItem("os_user", JSON.stringify(data.user));
      localStorage.removeItem("os_view_as_id");
      localStorage.removeItem("os_view_as_user");
      setRealUser(data.user);
      setViewAsUser(null);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("os_token");
    localStorage.removeItem("os_user");
    localStorage.removeItem("os_view_as_id");
    localStorage.removeItem("os_view_as_user");
    setRealUser(null);
    setViewAsUser(null);
    window.location.href = "/login";
  };

  const setViewAs = useCallback((user) => {
    if (!user) {
      localStorage.removeItem("os_view_as_id");
      localStorage.removeItem("os_view_as_user");
      setViewAsUser(null);
    } else {
      localStorage.setItem("os_view_as_id", user.id);
      localStorage.setItem("os_view_as_user", JSON.stringify(user));
      setViewAsUser(user);
    }
  }, []);

  const user = viewAsUser || realUser;
  const isImpersonating = !!viewAsUser;

  return (
    <AuthCtx.Provider value={{
      user,
      realUser,
      viewAsUser,
      isImpersonating,
      setViewAs,
      login,
      logout,
      loading,
      isManager: !isImpersonating && !!realUser?.is_admin,
      canImpersonate: !!realUser?.is_admin,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
