"use client";

import React, { useState, useEffect } from "react";
import { DashboardView } from "@/components/dashboard-view";
import { LoginView } from "@/components/login-view";
import { Server, Loader2 } from "lucide-react";

export default function AdminHome() {
  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("admin_theme") as "light" | "dark" | null;
      if (savedTheme === "dark" || savedTheme === "light") {
        setTheme(savedTheme);
        document.documentElement.classList.toggle("dark", savedTheme === "dark");
        document.documentElement.setAttribute("data-theme", savedTheme);
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const initial = prefersDark ? "dark" : "light";
        setTheme(initial);
        document.documentElement.classList.toggle("dark", initial === "dark");
        document.documentElement.setAttribute("data-theme", initial);
      }
    } catch (e) {
      console.error("Theme initialization error:", e);
    }
  }, []);

  // Sync theme changes to document and localStorage
  const handleToggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    document.documentElement.setAttribute("data-theme", nextTheme);
    try {
      localStorage.setItem("admin_theme", nextTheme);
    } catch (e) {
      console.error("Failed to save theme preference:", e);
    }
  };

  useEffect(() => {
    try {
      const token = localStorage.getItem("admin_token");
      const userStr = localStorage.getItem("admin_user");

      if (token && userStr) {
        const user = JSON.parse(userStr);
        if (user.role === "admin") {
          setAdminUser(user);
        } else {
          localStorage.removeItem("admin_token");
          localStorage.removeItem("admin_refresh_token");
          localStorage.removeItem("admin_user");
        }
      }
    } catch (e) {
      console.error("Failed to parse stored admin session:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoginSuccess = (user: any, token: string) => {
    setAdminUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_refresh_token");
    localStorage.removeItem("admin_user");
    setAdminUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-slate-50 dark:bg-[#080B12] flex flex-col items-center justify-center gap-3 text-slate-900 dark:text-slate-100 font-sans transition-colors">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center animate-pulse">
          <Server className="w-5 h-5" />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
          <span>Loading console...</span>
        </div>
      </div>
    );
  }

  if (!adminUser) {
    return (
      <div className={theme} data-theme={theme}>
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />
      </div>
    );
  }

  return (
    <div className={theme} data-theme={theme}>
      <DashboardView
        adminUser={adminUser}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    </div>
  );
}
