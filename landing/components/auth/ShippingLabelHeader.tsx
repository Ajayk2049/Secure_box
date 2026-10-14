import React from "react";
import { QrCode, ShieldCheck } from "lucide-react";

interface ShippingLabelHeaderProps {
  title: string;
  subtitle?: string;
}

export function ShippingLabelHeader({ title, subtitle }: ShippingLabelHeaderProps) {
  return (
    <div className="border-b-2 border-dashed border-[#3D2310]/35 pb-2.5 mb-2.5 select-none">
      {/* 1. Top Waybill Meta Bar */}
      <div className="flex items-center justify-between font-mono text-[9px] text-[#3D2310]/85 uppercase tracking-wider pb-1.5 border-b border-[#3D2310]/20">
        <span className="font-extrabold flex items-center gap-1.5">
          <span className="tracking-tighter">⬆⬆</span>
          <span>SECURE BOX AIR EXPRESS</span>
        </span>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[8.5px] font-bold text-zinc-500">ZONE:</span>
          <span className="bg-[#3D2310] text-[#FAF9F5] px-1.5 py-0.5 font-black text-[8.5px] tracking-wider">
            BLR / 560
          </span>
        </div>
      </div>

      {/* 2. Parcel Routing & Waybill Details Grid (Above Title) */}
      <div className="py-2 px-1 border-b border-dashed border-[#3D2310]/20 flex items-center justify-between gap-2 font-mono">
        {/* Left Column: Tracking & Route Details */}
        <div className="flex flex-col gap-0.5 text-left">
          <div className="flex items-center gap-2">
            <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold">WAYBILL:</span>
            <span className="text-[10.5px] font-black text-[#3D2310] tracking-wider">
              TRK-8924-SBX-01
            </span>
          </div>
          <div className="text-[9px] font-bold text-[#3D2310]/90">
            SERVICE: <span className="font-normal text-zinc-600">PRIORITY • RESIDENTIAL VAULT</span>
          </div>
          <div className="text-[8.5px] text-zinc-500 flex items-center gap-2 pt-0.5">
            <span>HUB: <strong className="text-[#3D2310]">BLR-4A</strong></span>
            <span>•</span>
            <span>WT: <strong className="text-[#3D2310]">1.4 KG</strong></span>
            <span>•</span>
            <span>LOCK: <strong className="text-emerald-700">READY</strong></span>
          </div>
        </div>

        {/* Right Column: Rubber Stamp & Mini QR Matrix */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex flex-col items-center justify-center border-2 border-[#8A3B14]/70 text-[#8A3B14] px-2 py-1 rotate-[-2deg] rounded-[2px] opacity-85 shadow-xs">
            <span className="text-[7.5px] font-black tracking-widest leading-none uppercase">VERIFIED</span>
            <span className="text-[6.5px] font-bold tracking-tight leading-tight flex items-center gap-0.5">
              <ShieldCheck className="w-2.5 h-2.5" /> RECIPIENT
            </span>
          </div>
          <div className="w-8 h-8 bg-white border border-[#3D2310]/30 p-0.5 flex items-center justify-center shrink-0">
            <QrCode className="w-full h-full text-[#3D2310]/80 stroke-[1.8]" />
          </div>
        </div>
      </div>

      {/* 3. Owner Login Header (Below Waybill Details) */}
      <div className="pt-2 flex items-center justify-between gap-2">
        <div className="text-left">
          <h2 className="text-sm sm:text-base font-black tracking-tight text-[#3D2310] uppercase leading-tight font-merriweather">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[10px] text-zinc-600 font-medium font-sans">
              {subtitle}
            </p>
          )}
        </div>

        {/* High-density Authentic Barcode */}
        <div className="flex flex-col items-end shrink-0">
          <div className="flex items-center h-4.5 w-32 gap-[1px] overflow-hidden opacity-90">
            {[2, 1, 3, 1, 2, 1, 3, 2, 1, 3, 1, 2, 1, 3, 2, 1, 2, 1, 2, 3, 1, 3, 1, 2, 1, 3, 2, 1, 3, 2].map((w, idx) => (
              <div
                key={idx}
                className="bg-[#2B1810] h-full"
                style={{ width: `${w * 1.05}px` }}
              />
            ))}
          </div>
          <span className="font-mono text-[7px] tracking-wider text-[#3D2310]/70 font-bold uppercase mt-0.5">
            *SBX-BLR-560-AUTH*
          </span>
        </div>
      </div>
    </div>
  );
}
