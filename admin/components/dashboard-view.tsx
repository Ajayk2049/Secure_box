"use client";

import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { RequestsTable, LockerRequestItem, LockerRequestStatus } from "./dashboard/RequestsTable";
import { SlotRequestsTable } from "./dashboard/SlotRequestsTable";
import { DashboardHeader } from "./dashboard/DashboardHeader";
import { DashboardModals } from "./dashboard/DashboardModals";
import { useDashboardState } from "@/hooks/useDashboardState";

export type { LockerRequestStatus, LockerRequestItem };

interface DashboardViewProps {
  adminUser?: any;
  onLogout?: () => void;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
}

export function DashboardView({
  adminUser,
  onLogout,
  theme = "light",
  onToggleTheme,
}: DashboardViewProps) {
  const {
    requests,
    slotRequests,
    mainTab,
    setMainTab,
    pendingSubFilter,
    setPendingSubFilter,
    searchQuery,
    setSearchQuery,
    isLoading,
    isPricingModalOpen,
    setIsPricingModalOpen,
    slotPricing,
    prepareModalData,
    setPrepareModalData,
    assignDeviceIdInput,
    setAssignDeviceIdInput,
    prepareNotesInput,
    setPrepareNotesInput,
    provisionedKeyModalData,
    setProvisionedKeyModalData,
    dispatchModalData,
    setDispatchModalData,
    dispatchNotesInput,
    setDispatchNotesInput,
    deliverModalData,
    setDeliverModalData,
    callVerificationInput,
    setCallVerificationInput,
    rejectModalData,
    setRejectModalData,
    rejectionReasonInput,
    setRejectionReasonInput,
    simulatorModalData,
    setSimulatorModalData,
    actionSuccess,
    actionError,
    loadRequests,
    handleSavePricing,
    handleApproveSlotRequest,
    handleRejectSlotRequest,
    handleRevokeSlotRequest,
    generateRandomBoxId,
    handleConfirmPrepare,
    handleConfirmDispatch,
    handleConfirmDelivered,
    handleConfirmReject,
    filterCounts,
    filteredRequests,
  } = useDashboardState({ onLogout });

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <DashboardHeader
        adminUser={adminUser}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onLogout={onLogout}
        onRefresh={() => loadRequests(false)}
        isLoading={isLoading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        mainTab={mainTab}
        onMainTabChange={setMainTab}
        pendingSubFilter={pendingSubFilter}
        onPendingSubFilterChange={setPendingSubFilter}
        filterCounts={filterCounts}
        onOpenPricing={() => setIsPricingModalOpen(true)}
      />

      <main className="flex-1 w-full px-6 sm:px-8 lg:px-10 pt-2 pb-12 flex flex-col gap-6">
        {mainTab === "slot-upgrades" ? (
          <SlotRequestsTable
            requests={slotRequests}
            isLoading={isLoading}
            onApprove={handleApproveSlotRequest}
            onReject={handleRejectSlotRequest}
            onRevoke={handleRevokeSlotRequest}
          />
        ) : (
          <RequestsTable
            requests={filteredRequests}
            isLoading={isLoading}
            onOpenPrepare={(req) => {
              const usedIds = new Set(requests.flatMap((r) => r.assignedDeviceIds || []));
              let nextSuggestedId = generateRandomBoxId();
              while (usedIds.has(nextSuggestedId)) {
                nextSuggestedId = generateRandomBoxId();
              }
              setPrepareModalData({
                requestId: req._id,
                customerName: req.name,
                units: req.units,
                suggestedDeviceId: nextSuggestedId,
              });
              setAssignDeviceIdInput(nextSuggestedId);
              setPrepareNotesInput("");
            }}
            onOpenDispatch={(req) => {
              setDispatchModalData({
                requestId: req._id,
                customerName: req.name,
                deviceId: req.assignedDeviceIds?.[0] || "BOX_001",
              });
              setDispatchNotesInput("");
            }}
            onOpenDeliver={(req) => {
              setDeliverModalData({
                requestId: req._id,
                customerName: req.name,
                phone: req.phone,
                deviceId: req.assignedDeviceIds?.[0] || "BOX_001",
              });
            }}
            onOpenReject={(req) => {
              setRejectModalData({
                requestId: req._id,
                customerName: req.name,
              });
              setRejectionReasonInput("");
            }}
            onSimulateDevice={(req, deviceId, deviceKey) => {
              setSimulatorModalData({
                deviceId,
                customerName: req.name,
                deviceKey,
              });
            }}
            onShowKey={(customerName, deviceId, deviceKey) => {
              setProvisionedKeyModalData({
                customerName,
                deviceId,
                deviceKey,
              });
            }}
          />
        )}
      </main>

      {/* Standalone Modals */}
      <DashboardModals
        pricingModalOpen={isPricingModalOpen}
        pricingData={slotPricing}
        onClosePricing={() => setIsPricingModalOpen(false)}
        onSavePricing={handleSavePricing}
        prepareModalData={prepareModalData}
        assignDeviceIdInput={assignDeviceIdInput}
        onAssignDeviceIdChange={setAssignDeviceIdInput}
        onRandomizeId={() => setAssignDeviceIdInput(generateRandomBoxId())}
        prepareNotesInput={prepareNotesInput}
        onPrepareNotesChange={setPrepareNotesInput}
        onClosePrepare={() => setPrepareModalData(null)}
        onConfirmPrepare={handleConfirmPrepare}
        provisionedKeyModalData={provisionedKeyModalData}
        onCloseProvisionedKey={() => setProvisionedKeyModalData(null)}
        dispatchModalData={dispatchModalData}
        dispatchNotesInput={dispatchNotesInput}
        onDispatchNotesChange={setDispatchNotesInput}
        onCloseDispatch={() => setDispatchModalData(null)}
        onConfirmDispatch={handleConfirmDispatch}
        deliverModalData={deliverModalData}
        callVerificationInput={callVerificationInput}
        onCallVerificationChange={setCallVerificationInput}
        onCloseDeliver={() => setDeliverModalData(null)}
        onConfirmDeliver={handleConfirmDelivered}
        rejectModalData={rejectModalData}
        rejectionReasonInput={rejectionReasonInput}
        onRejectionReasonChange={setRejectionReasonInput}
        onCloseReject={() => setRejectModalData(null)}
        onConfirmReject={handleConfirmReject}
        simulatorModalData={simulatorModalData}
        onCloseSimulator={() => setSimulatorModalData(null)}
      />

      {/* Notifications */}
      {actionSuccess && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-none bg-slate-900 text-white dark:bg-[#080D14] dark:text-slate-100 text-sm font-bold shadow-none flex items-center gap-3 border-2 border-[#00F5A0]">
          <CheckCircle2 className="w-5 h-5 text-[#00F5A0] shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-none bg-rose-600 text-white text-sm font-bold shadow-none flex items-center gap-3 border-2 border-rose-400">
          <AlertCircle className="w-5 h-5 text-white shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
    </div>
  );
}
