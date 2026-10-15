"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { OrderWizard } from "./OrderWizard";
import { StoredUserData } from "./DeliveryManifest";
import { userFetch } from "@/lib/api";

interface OrderViewProps {
  apiUrl: string;
  currentUser: StoredUserData | null;
  onOrderComplete: (updatedUser: StoredUserData) => void;
  onCancel: () => void;
}

export function OrderView({
  apiUrl,
  currentUser,
  onOrderComplete,
  onCancel,
}: OrderViewProps) {
  const [orderStep, setOrderStep] = useState<number>(1);
  const [orderAddress, setOrderAddress] = useState(currentUser?.address || "");
  const [orderPincode, setOrderPincode] = useState(currentUser?.pincode || "");
  const [orderUnits, setOrderUnits] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const clearMessages = () => {
    setErrorMessage(null);
    setInfoMessage(null);
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!orderAddress.trim()) {
      setErrorMessage("Please enter your doorstep installation address");
      return;
    }
    const cleanPin = orderPincode.replace(/\D/g, "");
    if (!cleanPin || cleanPin.length !== 6 || !cleanPin.startsWith("56")) {
      setErrorMessage("PIN code must be a 6-digit Bengaluru PIN code (starting with 56)");
      return;
    }

    setLoading(true);
    try {
      const res = await userFetch("/auth/order", {
        method: "POST",
        body: JSON.stringify({
          address: orderAddress.trim(),
          pincode: cleanPin,
          units: orderUnits || 1,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("Your session expired. Please sign in again to place your order.");
        }
        throw new Error(data.error || "Failed to place order");
      }

      const updatedUser: StoredUserData = {
        id: data.user?.id || currentUser?.id,
        name: data.user?.name || currentUser?.name || "Customer",
        phone: data.user?.phone || currentUser?.phone,
        email: data.user?.email || currentUser?.email,
        address: data.user?.address || orderAddress,
        pincode: data.user?.pincode || cleanPin,
        units: data.user?.units || orderUnits,
        orderStatus: data.user?.orderStatus || "pending",
        assignedDevices: data.user?.assignedDevices || currentUser?.assignedDevices || [],
      };

      localStorage.setItem("smartbox_user_data", JSON.stringify(updatedUser));
      onOrderComplete(updatedUser);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full h-full font-sans p-1 sm:p-2 relative">
      {errorMessage && (
        <div className="absolute top-2 left-4 right-4 z-40 bg-rose-50 border border-rose-600/30 text-rose-800 p-2 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="truncate">{errorMessage}</span>
        </div>
      )}

      {infoMessage && (
        <div className="absolute top-2 left-4 right-4 z-40 bg-emerald-50 border border-emerald-600/30 text-emerald-800 p-2 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="truncate">{infoMessage}</span>
        </div>
      )}

      <OrderWizard
        step={orderStep}
        onSetStep={setOrderStep}
        address={orderAddress}
        onAddressChange={setOrderAddress}
        pincode={orderPincode}
        onPincodeChange={setOrderPincode}
        units={orderUnits}
        onUnitsChange={setOrderUnits}
        loading={loading}
        onSubmit={handleOrderSubmit}
        onCancel={onCancel}
      />
    </div>
  );
}
