"use client";

import React, { useState } from "react";
import {
  Home,
  MapPin,
  Compass,
  Plus,
  Minus,
  Check,
  Loader2,
  X,
  User,
  Info,
  CheckCircle2,
} from "lucide-react";
import { ShippingLabelHeader } from "./ShippingLabelHeader";
import { getCurrentBrowserAddress } from "@/lib/location";

interface OrderWizardProps {
  recipientName?: string;
  recipientPhone?: string;
  houseNo: string;
  onHouseNoChange: (val: string) => void;
  streetAddress: string;
  onStreetAddressChange: (val: string) => void;
  landmark: string;
  onLandmarkChange: (val: string) => void;
  pincode: string;
  onPincodeChange: (val: string) => void;
  units: number;
  onUnitsChange: (val: number) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onGpsError?: (msg: string) => void;
}

export function OrderWizard({
  recipientName = "Customer",
  recipientPhone,
  houseNo,
  onHouseNoChange,
  streetAddress,
  onStreetAddressChange,
  landmark,
  onLandmarkChange,
  pincode,
  onPincodeChange,
  units,
  onUnitsChange,
  loading,
  onSubmit,
  onCancel,
  onGpsError,
}: OrderWizardProps) {
  const [isLocating, setIsLocating] = useState(false);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);

  const cleanPin = pincode.replace(/\D/g, "");
  const isNonBangalorePin = cleanPin.length === 6 && !cleanPin.startsWith("560");

  const handleAutoLocate = async () => {
    setIsLocating(true);
    setGpsNotice(null);

    const result = await getCurrentBrowserAddress();
    setIsLocating(false);

    if (result.error) {
      if (onGpsError) {
        onGpsError(result.error);
      }
      return;
    }

    if (result.streetAddress) {
      onStreetAddressChange(result.streetAddress);
    }
    if (result.pincode) {
      onPincodeChange(result.pincode);
    }

    setGpsNotice(result.notice || "Street & Area detected! Please enter your house/flat number.");
  };

  const isFormValid =
    Boolean(houseNo.trim()) &&
    Boolean(streetAddress.trim()) &&
    cleanPin.length === 6;

  return (
    <div className="bg-[#FAF9F5] border-2 border-[#3D2310]/35 p-3.5 sm:p-5 text-[#3D2310] w-[94%] md:w-[90%] h-[94%] flex flex-col justify-between mx-auto my-auto overflow-hidden no-scrollbar shadow-none font-sans">
      {/* Shipping Header */}
      <div className="relative shrink-0">
        <ShippingLabelHeader
          title="Order Secure Box"
          subtitle="Doorstep installation address"
        />
        <button
          type="button"
          onClick={onCancel}
          title="Back to Account"
          className="absolute right-0 top-0 p-1 text-[#3D2310]/60 hover:text-[#3D2310] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Recipient Badge */}
      <div className="my-1.5 px-2.5 py-1.5 bg-white border border-[#3D2310]/20 flex items-center gap-2 text-xs font-mono shrink-0">
        <User className="w-3.5 h-3.5 text-[#3D2310]/70 shrink-0" />
        <span className="font-bold text-[#3D2310] truncate">{recipientName}</span>
        {recipientPhone && (
          <>
            <span className="text-zinc-400">•</span>
            <span className="text-zinc-600 truncate font-semibold">+91 {recipientPhone}</span>
          </>
        )}
      </div>

      {/* Form Fields: Scrollable Body with Unified Field Heights */}
      <form
        onSubmit={onSubmit}
        className="flex-1 flex flex-col justify-between min-h-0 overflow-y-auto no-scrollbar space-y-2.5 py-0.5 pr-0.5"
      >
        <div className="space-y-2.5">
          {/* 1. House / Flat No (Mandatory) */}
          <div className="space-y-1 text-left">
            <label className="font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider block">
              House / Flat / Villa No <span className="text-amber-700">*</span>
            </label>
            <div className="relative">
              <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                required
                disabled={loading}
                value={houseNo}
                onChange={(e) => onHouseNoChange(e.target.value)}
                placeholder="Flat / Villa / House No, Apartment Name"
                className="w-full h-[46px] bg-white border-2 border-[#3D2310]/30 pl-9 pr-3 text-[13px] text-[#3D2310] placeholder:text-[13px] placeholder:text-zinc-400 focus:outline-none focus:border-[#3D2310] font-sans flex items-center"
              />
            </div>
          </div>

          {/* 2. Street & Area Address (Mandatory, with embedded 𖦏 GPS) */}
          <div className="space-y-1 text-left">
            <label className="font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider block">
              Street & Area Address <span className="text-amber-700">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                required
                disabled={loading}
                value={streetAddress}
                onChange={(e) => onStreetAddressChange(e.target.value)}
                placeholder="Street name, main, cross, locality / area"
                className="w-full h-[46px] bg-white border-2 border-[#3D2310]/30 pl-9 pr-14 text-[13px] text-[#3D2310] placeholder:text-[13px] placeholder:text-zinc-400 focus:outline-none focus:border-[#3D2310] font-sans flex items-center"
              />
              <button
                type="button"
                disabled={loading || isLocating}
                onClick={handleAutoLocate}
                title="Auto-fill with GPS"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center px-2 py-0.5 rounded text-[#3D2310] hover:text-[#1F1208] hover:bg-amber-100/60 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isLocating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-800" />
                ) : (
                  <span className="text-base leading-none select-none">𖦏</span>
                )}
                <span className="text-[8px] font-mono font-black uppercase tracking-tight leading-none mt-0.5 text-[#3D2310]/80">
                  {isLocating ? "..." : "GPS"}
                </span>
              </button>
            </div>

            {/* GPS Detection Feedback */}
            {gpsNotice && (
              <div className="p-1.5 bg-emerald-50 border border-emerald-600/30 text-[10px] font-mono text-emerald-800 flex items-center gap-1.5 leading-tight">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{gpsNotice}</span>
              </div>
            )}
          </div>

          {/* 3. Landmark (Optional) */}
          <div className="space-y-1 text-left">
            <label className="font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider block">
              Landmark (Optional)
            </label>
            <div className="relative">
              <Compass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                disabled={loading}
                value={landmark}
                onChange={(e) => onLandmarkChange(e.target.value)}
                placeholder="e.g. Near Metro Station, Behind Park"
                className="w-full h-[46px] bg-white border-2 border-[#3D2310]/30 pl-9 pr-3 text-[13px] text-[#3D2310] placeholder:text-[13px] placeholder:text-zinc-400 focus:outline-none focus:border-[#3D2310] font-sans flex items-center"
              />
            </div>
          </div>

          {/* 4. PIN Code & Units Row */}
          <div className="grid grid-cols-5 gap-2 text-left">
            {/* PIN Code */}
            <div className="col-span-3 space-y-1">
              <label className="font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider block">
                PIN Code <span className="text-amber-700">*</span>
              </label>
              <input
                type="text"
                maxLength={6}
                required
                disabled={loading}
                value={pincode}
                onChange={(e) => onPincodeChange(e.target.value.replace(/\D/g, ""))}
                placeholder="560001"
                className="w-full h-[46px] bg-white border-2 border-[#3D2310]/30 px-3 text-[13px] text-[#3D2310] placeholder:text-[13px] placeholder:text-zinc-400 focus:outline-none focus:border-[#3D2310] font-mono font-bold tracking-wider flex items-center"
              />
            </div>

            {/* Units Selector */}
            <div className="col-span-2 space-y-1">
              <label className="font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider block">
                Units
              </label>
              <div className="flex items-center justify-between bg-white border-2 border-[#3D2310]/30 px-2.5 h-[46px]">
                <button
                  type="button"
                  disabled={units <= 1 || loading}
                  onClick={() => onUnitsChange(Math.max(1, units - 1))}
                  className="w-7 h-7 flex items-center justify-center text-[#3D2310] hover:bg-zinc-100 cursor-pointer disabled:opacity-30 rounded"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono font-black text-sm text-[#3D2310]">{units}</span>
                <button
                  type="button"
                  disabled={units >= 5 || loading}
                  onClick={() => onUnitsChange(Math.min(5, units + 1))}
                  className="w-7 h-7 flex items-center justify-center text-[#3D2310] hover:bg-zinc-100 cursor-pointer disabled:opacity-30 rounded"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Bangalore Non-Delivery Warning Card (Permits submission) */}
          {isNonBangalorePin && (
            <div className="p-2 bg-amber-50 border border-amber-600/30 text-[11px] text-[#8C4A00] flex items-start gap-1.5 text-left font-sans">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="leading-snug">
                We are currently delivering in Bangalore only. You can still submit your request and our team will notify you as soon as service expands to your area.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#3D2310]/15 shrink-0">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-3.5 py-2 bg-transparent border-2 border-[#3D2310]/30 text-zinc-600 hover:bg-zinc-100 text-xs font-mono font-bold uppercase cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="px-4 py-2 bg-[#3D2310] hover:bg-[#261508] text-[#FAF9F5] text-xs font-mono font-black uppercase flex items-center gap-1.5 ml-auto shadow-sm cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Placing Order...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Confirm Order</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
