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
  currentUser,
  onOrderComplete,
  onCancel,
}: OrderViewProps) {
  const [houseNo, setHouseNo] = useState("");
  const [streetAddress, setStreetAddress] = useState(currentUser?.address || "");
  const [landmark, setLandmark] = useState("");
  const [pincode, setPincode] = useState(currentUser?.pincode || "");
  const [units, setUnits] = useState<number>(1);
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

    if (!houseNo.trim()) {
      setErrorMessage("Please enter your house or flat number");
      return;
    }

    if (!streetAddress.trim()) {
      setErrorMessage("Please enter your street or area address");
      return;
    }

    const cleanPin = pincode.replace(/\D/g, "");
    if (!cleanPin || cleanPin.length !== 6) {
      setErrorMessage("Please enter a valid 6-digit PIN code");
      return;
    }

    // Build the complete doorstep delivery address (identical to mobile app format)
    const fullAddress = [
      houseNo.trim(),
      streetAddress.trim(),
      landmark.trim() ? `Landmark: ${landmark.trim()}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    setLoading(true);
    try {
      const res = await userFetch("/auth/order", {
        method: "POST",
        body: JSON.stringify({
          address: fullAddress,
          pincode: cleanPin,
          units: units || 1,
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
        address: data.user?.address || fullAddress,
        pincode: data.user?.pincode || cleanPin,
        units: data.user?.units || units,
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
        <div className="absolute top-2 left-4 right-4 z-40 bg-rose-50 border border-rose-600/30 text-rose-800 p-2 text-xs flex items-start gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-snug">{errorMessage}</span>
        </div>
      )}

      {infoMessage && (
        <div className="absolute top-2 left-4 right-4 z-40 bg-emerald-50 border border-emerald-600/30 text-emerald-800 p-2 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="truncate">{infoMessage}</span>
        </div>
      )}

      <OrderWizard
        recipientName={currentUser?.name || "Customer"}
        recipientPhone={currentUser?.phone}
        houseNo={houseNo}
        onHouseNoChange={setHouseNo}
        streetAddress={streetAddress}
        onStreetAddressChange={setStreetAddress}
        landmark={landmark}
        onLandmarkChange={setLandmark}
        pincode={pincode}
        onPincodeChange={setPincode}
        units={units}
        onUnitsChange={setUnits}
        loading={loading}
        onSubmit={handleOrderSubmit}
        onCancel={onCancel}
        onGpsError={(err) => setErrorMessage(err)}
      />
    </div>
  );
}
