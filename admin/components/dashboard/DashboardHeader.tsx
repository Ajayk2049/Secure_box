import React from "react";
import { Box, Search, RefreshCw, Sun, Moon, LogOut, Cpu, Tag } from "lucide-react";
import { getBackendBaseUrl } from "@/lib/api";

export type MainDashboardTab = "live" | "pending" | "slot-upgrades" | "all";
export type PendingSubFilter = "all" | "pending" | "preparing" | "dispatched";

interface DashboardHeaderProps {
  adminUser?: any;
  theme: "light" | "dark";
  onToggleTheme?: () => void;
  onLogout?: () => void;
  onRefresh: () => void;
  onOpenPricing: () => void;
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  mainTab: MainDashboardTab;
  onMainTabChange: (tab: MainDashboardTab) => void;
  pendingSubFilter: PendingSubFilter;
  onPendingSubFilterChange: (stage: PendingSubFilter) => void;
  filterCounts: {
    live: number;
    pending: number;
    slotUpgrades: number;
    all: number;
    pendingBreakdown: {
      pending: number;
      preparing: number;
      dispatched: number;
    };
  };
}

export function DashboardHeader({
  adminUser,
  theme,
  onToggleTheme,
  onLogout,
  onRefresh,
  onOpenPricing,
  isLoading,
  searchQuery,
  onSearchChange,
  mainTab,
  onMainTabChange,
  pendingSubFilter,
  onPendingSubFilterChange,
  filterCounts,
}: DashboardHeaderProps) {
  const simulatorDirectUrl = `${getBackendBaseUrl()}/simulator?deviceId=BOX_001&key=SIMULATOR_TEST_KEY`;

  return (
    <>
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-white dark:bg-[#080D14] border-b border-slate-200 dark:border-slate-800 w-full">
        <div className="w-full px-6 sm:px-8 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-none bg-[#00F5A0] text-black flex items-center justify-center font-black shrink-0">
              <Box className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-black text-lg text-slate-900 dark:text-slate-100 tracking-tight">
                Secure Box
              </span>
              <span className="h-7 px-2.5 inline-flex items-center text-xs uppercase font-black tracking-widest rounded-none bg-[#00F5A0]/20 dark:bg-[#00F5A0]/15 text-black dark:text-[#00F5A0] border border-[#00F5A0]/60 dark:border-[#00F5A0]/40 font-mono">
                Orders Console
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenPricing}
              title="Declare & update slot prices"
              className="h-10 px-3 rounded-none font-mono text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:text-black hover:bg-[#00F5A0] border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer flex items-center gap-1.5 bg-white dark:bg-[#080D14]"
            >
              <Tag className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Pricing</span>
            </button>

            <a
              href={simulatorDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Launch Hardware Simulator Console"
              className="h-10 px-3 rounded-none font-mono text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:text-black hover:bg-[#00F5A0] border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer flex items-center gap-1.5 bg-white dark:bg-[#080D14]"
            >
              <Cpu className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">HW Simulator</span>
            </a>

            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh order pipeline"
              className="w-10 h-10 rounded-none text-slate-600 dark:text-slate-400 hover:text-black hover:bg-[#00F5A0] border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer flex items-center justify-center bg-white dark:bg-[#080D14]"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-black dark:text-[#00F5A0]" : ""}`} />
            </button>

            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
                className="w-10 h-10 rounded-none text-slate-600 dark:text-slate-400 hover:text-black hover:bg-[#00F5A0] border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer flex items-center justify-center bg-white dark:bg-[#080D14]"
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4 text-[#00F5A0]" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-700" />
                )}
              </button>
            )}

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

            <div className="text-right hidden sm:block font-mono px-1">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {adminUser?.email || "Platform Admin"}
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Log out of Admin Portal"
              className="w-10 h-10 rounded-none text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-800 hover:border-rose-500/40 transition-colors cursor-pointer flex items-center justify-center bg-white dark:bg-[#080D14]"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Subheader Title, Filters & Search */}
      <div className="w-full px-6 sm:px-8 lg:px-10 pt-6 pb-2 flex flex-col gap-5">
        {/* Title & Total Count */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
              <span>Locker Delivery Orders</span>
              <span className="h-7 px-3 inline-flex items-center text-xs font-mono font-black rounded-none bg-[#00F5A0]/20 dark:bg-[#00F5A0]/15 text-black dark:text-[#00F5A0] border border-[#00F5A0]/60 dark:border-[#00F5A0]/40">
                {filterCounts.all} {filterCounts.all === 1 ? "ORDER" : "ORDERS"}
              </span>
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Track locker requests, assign lockers, and manage deliveries
            </p>
          </div>
        </div>

        {/* 3 Main Tabs & Stage Filter Toolbar */}
        <div className="w-full bg-white dark:bg-[#0D141F] p-2.5 rounded-none border border-slate-200 dark:border-slate-800 shadow-none flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Tabs + Dropdown Container */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* The 3 Main Tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: "live", label: "Live Devices", count: filterCounts.live },
                { id: "pending", label: "Pending Orders", count: filterCounts.pending },
                { id: "slot-upgrades", label: "Slot Upgrades", count: filterCounts.slotUpgrades },
                { id: "all", label: "All Orders", count: filterCounts.all },
              ].map((tab) => {
                const active = mainTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onMainTabChange(tab.id as MainDashboardTab)}
                    className={`h-10 px-4 rounded-none text-xs font-black uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-2 whitespace-nowrap border ${
                      active
                        ? "bg-[#00F5A0] text-black border-[#00F5A0]"
                        : "bg-slate-50 dark:bg-[#080D14] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#00F5A0]/60 hover:text-black dark:hover:text-[#00F5A0]"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`h-5 min-w-[20px] px-1.5 inline-flex items-center justify-center text-[10px] rounded-none font-mono font-black ${
                        active
                          ? "bg-black/20 text-black"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Pending Orders Sub-Filter Dropdown */}
            {mainTab === "pending" && (
              <div className="flex items-center gap-2 pl-1 border-l-2 border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-mono font-bold uppercase text-slate-400 hidden sm:inline">
                  Stage:
                </span>
                <select
                  value={pendingSubFilter}
                  onChange={(e) => onPendingSubFilterChange(e.target.value as PendingSubFilter)}
                  className="h-10 px-3 pr-8 rounded-none bg-slate-50 dark:bg-[#080D14] border border-slate-200 dark:border-slate-800 text-xs font-black uppercase text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#00F5A0] cursor-pointer font-mono"
                >
                  <option value="all">All Pending Orders ({filterCounts.pending})</option>
                  <option value="pending">Pending Acceptance ({filterCounts.pendingBreakdown.pending})</option>
                  <option value="preparing">Preparing Locker ({filterCounts.pendingBreakdown.preparing})</option>
                  <option value="dispatched">Out for Delivery ({filterCounts.pendingBreakdown.dispatched})</option>
                </select>
              </div>
            )}
          </div>

          {/* Search Input - Universal Height h-10 */}
          <div className="relative w-full sm:w-80 md:w-96 shrink-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search customer, phone, PIN, device..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-none bg-slate-50 dark:bg-[#080D14] border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#00F5A0] focus:ring-1 focus:ring-[#00F5A0]"
            />
          </div>
        </div>
      </div>
    </>
  );
}
