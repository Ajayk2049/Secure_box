"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { LockerRequestItem } from "../components/dashboard/RequestsTable";
import { SlotRequestItem } from "../components/dashboard/SlotRequestsTable";
import { MainDashboardTab, PendingSubFilter } from "../components/dashboard/DashboardHeader";
import { SlotPricingData } from "../components/modals/PricingModal";
import { adminFetch } from "@/lib/api";

interface UseDashboardStateProps {
  onLogout?: () => void;
}

export function useDashboardState({ onLogout }: UseDashboardStateProps = {}) {
  const [requests, setRequests] = useState<LockerRequestItem[]>([]);
  const [slotRequests, setSlotRequests] = useState<SlotRequestItem[]>([]);
  const [mainTab, setMainTab] = useState<MainDashboardTab>("live");
  const [pendingSubFilter, setPendingSubFilter] = useState<PendingSubFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Pricing Modal state
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [slotPricing, setSlotPricing] = useState<SlotPricingData>({
    monthlyPrice: 149,
    yearlyPrice: 999,
    currency: "INR",
  });

  // Modal states & inputs
  const [prepareModalData, setPrepareModalData] = useState<{
    requestId: string;
    customerName: string;
    units: number;
    suggestedDeviceId: string;
  } | null>(null);
  const [assignDeviceIdInput, setAssignDeviceIdInput] = useState("");
  const [prepareNotesInput, setPrepareNotesInput] = useState("");

  const [provisionedKeyModalData, setProvisionedKeyModalData] = useState<{
    customerName: string;
    deviceId: string;
    deviceKey: string;
  } | null>(null);

  const [dispatchModalData, setDispatchModalData] = useState<{
    requestId: string;
    customerName: string;
    deviceId: string;
  } | null>(null);
  const [dispatchNotesInput, setDispatchNotesInput] = useState("");

  const [deliverModalData, setDeliverModalData] = useState<{
    requestId: string;
    customerName: string;
    phone: string;
    deviceId: string;
  } | null>(null);
  const [callVerificationInput, setCallVerificationInput] = useState(
    "Verified with customer over phone: Locker delivered, mounted at door, powered ON, and live."
  );

  const [rejectModalData, setRejectModalData] = useState<{
    requestId: string;
    customerName: string;
  } | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");

  const [simulatorModalData, setSimulatorModalData] = useState<{
    deviceId: string;
    customerName: string;
    deviceKey?: string;
  } | null>(null);

  // Feedback notifications
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setActionError(msg);
      setTimeout(() => setActionError(null), 4000);
    } else {
      setActionSuccess(msg);
      setTimeout(() => setActionSuccess(null), 3500);
    }
  };

  const loadRequests = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      const token = localStorage.getItem("admin_token");
      if (!token) {
        if (!silent) setIsLoading(false);
        return;
      }

      try {
        const res = await adminFetch("/admin/requests");
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("admin_token");
          localStorage.removeItem("admin_refresh_token");
          localStorage.removeItem("admin_user");
          if (onLogout) onLogout();
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setRequests(data.requests || []);
        }

        const slotRes = await adminFetch("/admin/slot-requests");
        if (slotRes.ok) {
          const slotData = await slotRes.json();
          setSlotRequests(slotData.requests || []);
        }

        const priceRes = await adminFetch("/admin/pricing/slots");
        if (priceRes.ok) {
          const pData = await priceRes.json();
          setSlotPricing({
            monthlyPrice: pData.monthlyPrice,
            yearlyPrice: pData.yearlyPrice,
            currency: pData.currency || "INR",
          });
        }
      } catch (err: any) {
        if (!silent) {
          console.error("Error loading admin data:", err);
          showNotification(err.message || "Could not sync latest requests", true);
        } else {
          console.debug("Background sync paused (network/host unreachable):", err?.message || err);
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [onLogout]
  );

  useEffect(() => {
    loadRequests(false);
    const interval = setInterval(() => {
      loadRequests(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [loadRequests]);

  const handleSavePricing = async (monthly: number, yearly: number) => {
    const res = await adminFetch("/admin/pricing/slots", {
      method: "PATCH",
      body: JSON.stringify({ monthlyPrice: monthly, yearlyPrice: yearly }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to update pricing");

    setSlotPricing({
      monthlyPrice: monthly,
      yearlyPrice: yearly,
      currency: "INR",
    });
    showNotification("Slot pricing declared and updated for all users!");
  };

  const handleApproveSlotRequest = async (item: SlotRequestItem) => {
    try {
      const res = await adminFetch(`/admin/slot-requests/${item._id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ adminNotes: "Approved via Admin Dashboard after phone confirmation" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve slot upgrade");

      showNotification(`All 3 extra slots unlocked for ${item.customerName} on ${item.deviceStringId}! (5 slots capacity live)`);
      await loadRequests(true);
    } catch (err: any) {
      showNotification(err.message || "Failed to approve slot upgrade", true);
    }
  };

  const handleRejectSlotRequest = async (item: SlotRequestItem) => {
    try {
      const res = await adminFetch(`/admin/slot-requests/${item._id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ adminNotes: "Declined by operator" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject slot request");

      showNotification(`Slot upgrade request for ${item.customerName} declined.`);
      await loadRequests(true);
    } catch (err: any) {
      showNotification(err.message || "Failed to reject slot request", true);
    }
  };

  const handleRevokeSlotRequest = async (item: SlotRequestItem) => {
    const ok = window.confirm(
      `Are you sure you want to revoke extra slots for ${item.customerName} on locker ${item.deviceStringId}? This will reset the locker capacity back to 2 slots only.`
    );
    if (!ok) return;

    try {
      const res = await adminFetch(`/admin/slot-requests/${item._id}/revoke`, {
        method: "PATCH",
        body: JSON.stringify({ adminNotes: "Revoked back to 2 slots by operator" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke slots");

      showNotification(`Locker ${item.deviceStringId} reset to 2 base slots successfully.`);
      await loadRequests(true);
    } catch (err: any) {
      showNotification(err.message || "Failed to revoke slots", true);
    }
  };

  const generateRandomBoxId = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `BOX_${code}`;
  };

  const handleConfirmPrepare = async () => {
    if (!prepareModalData) return;
    const deviceId = assignDeviceIdInput.trim().toUpperCase() || prepareModalData.suggestedDeviceId;
    if (!deviceId) {
      showNotification("Please provide a Device ID", true);
      return;
    }

    try {
      const res = await adminFetch(`/admin/requests/${prepareModalData.requestId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "preparing",
          deviceId,
          notes: prepareNotesInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to accept request");

      showNotification(`Order accepted! Locker ${deviceId} is now in PREPARATION.`);
      const createdKey = data.device?.deviceKey;
      const customerName = prepareModalData.customerName;
      setPrepareModalData(null);
      await loadRequests();

      if (createdKey) {
        setProvisionedKeyModalData({
          customerName,
          deviceId,
          deviceKey: createdKey,
        });
      }
    } catch (err: any) {
      showNotification(err.message || "Failed to accept request", true);
    }
  };

  const handleConfirmDispatch = async () => {
    if (!dispatchModalData) return;

    try {
      const res = await adminFetch(`/admin/requests/${dispatchModalData.requestId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "dispatched",
          notes: dispatchNotesInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch order");

      showNotification(`Locker ${dispatchModalData.deviceId} marked as DISPATCHED.`);
      setDispatchModalData(null);
      await loadRequests();
    } catch (err: any) {
      showNotification(err.message || "Failed to dispatch order", true);
    }
  };

  const handleConfirmDelivered = async () => {
    if (!deliverModalData) return;

    try {
      const res = await adminFetch(`/admin/requests/${deliverModalData.requestId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "delivered",
          verificationNotes: callVerificationInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to confirm delivery");

      showNotification(`Locker ${deliverModalData.deviceId} verified live & marked as DELIVERED!`);
      setDeliverModalData(null);
      await loadRequests();
    } catch (err: any) {
      showNotification(err.message || "Failed to confirm delivery", true);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalData) return;

    try {
      const res = await adminFetch(`/admin/requests/${rejectModalData.requestId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "rejected",
          rejectionReason: rejectionReasonInput.trim() || "Declined by operator",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject request");

      showNotification(`Order for ${rejectModalData.customerName} has been rejected.`);
      setRejectModalData(null);
      await loadRequests();
    } catch (err: any) {
      showNotification(err.message || "Failed to reject request", true);
    }
  };

  const filterCounts = useMemo(() => {
    let pendingCount = 0;
    let preparingCount = 0;
    let dispatchedCount = 0;
    let deliveredCount = 0;

    requests.forEach((r) => {
      const s = r.status === "approved" ? "preparing" : r.status;
      if (s === "pending") pendingCount++;
      else if (s === "preparing") preparingCount++;
      else if (s === "dispatched") dispatchedCount++;
      else if (s === "delivered") deliveredCount++;
    });

    const pendingSlotUpgrades = slotRequests.filter((s) => s.status === "pending").length;

    return {
      live: deliveredCount,
      pending: pendingCount + preparingCount + dispatchedCount,
      slotUpgrades: pendingSlotUpgrades,
      all: requests.length,
      pendingBreakdown: {
        pending: pendingCount,
        preparing: preparingCount,
        dispatched: dispatchedCount,
      },
    };
  }, [requests, slotRequests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const normStatus = r.status === "approved" ? "preparing" : r.status;

      if (mainTab === "live") {
        if (normStatus !== "delivered") return false;
      } else if (mainTab === "pending") {
        const isPipeline = normStatus === "pending" || normStatus === "preparing" || normStatus === "dispatched";
        if (!isPipeline) return false;
        if (pendingSubFilter !== "all" && normStatus !== pendingSubFilter) return false;
      }

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const name = (r.name || "").toLowerCase();
      const phone = (r.phone || "").toLowerCase();
      const email = (r.email || "").toLowerCase();
      const address = (r.address || "").toLowerCase();
      const pincode = (r.pincode || "").toLowerCase();
      const devices = (r.assignedDeviceIds || []).join(" ").toLowerCase();

      return (
        name.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        address.includes(q) ||
        pincode.includes(q) ||
        devices.includes(q)
      );
    });
  }, [requests, mainTab, pendingSubFilter, searchQuery]);

  return {
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
  };
}
