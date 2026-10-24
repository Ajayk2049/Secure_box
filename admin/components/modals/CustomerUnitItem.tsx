"use client";

import React, { useState } from "react";
import {
  Package,
  Cpu,
  KeyRound,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  Check,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { LockerRequestItem, LockerRequestStatus } from "../dashboard/RequestsTable";
import { rotateDeviceKey } from "@/lib/api";

interface CustomerUnitItemProps {
  order: LockerRequestItem;
  idx: number;
  customerName: string;
  onClose: () => void;
  onSimulateDevice: (item: LockerRequestItem, deviceId: string, deviceKey?: string) => void;
  onOpenPrepare: (item: LockerRequestItem) => void;
  onOpenDispatch: (item: LockerRequestItem) => void;
  onOpenDeliver: (item: LockerRequestItem) => void;
  onOpenReject: (item: LockerRequestItem) => void;
  onShowKey?: (customerName: string, deviceId: string, deviceKey: string) => void;
  getStatusBadge: (status: LockerRequestStatus) => React.ReactNode;
}

export function CustomerUnitItem({
  order,
  idx,
  customerName,
  onClose,
  onSimulateDevice,
  onOpenPrepare,
  onOpenDispatch,
  onOpenDeliver,
  onOpenReject,
  onShowKey,
  getStatusBadge,
}: CustomerUnitItemProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [confirmingRotate, setConfirmingRotate] = useState(false);

  const assignedId = order.assignedDeviceIds?.[0] || null;
  const devInfo = order.assignedDevicesInfo?.find((d) => d.deviceId === assignedId);
  const devKey = devInfo?.deviceKey;
  const normStatus = order.status === "approved" ? "preparing" : order.status;

  const copyToClipboard = (key: string, deviceId: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(deviceId);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleRotateKey = async (deviceId: string) => {
    try {
      setIsRotating(true);
      setConfirmingRotate(false);
      const res = await rotateDeviceKey(deviceId);
      if (res.deviceKey && onShowKey) {
        onShowKey(customerName, deviceId, res.deviceKey);
      }
    } catch (err: any) {
      alert(err?.message || "Failed to rotate device key");
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <div className="p-4 bg-white dark:bg-[#0B0F19] border-2 border-slate-200 dark:border-slate-800 hover:border-[#00F5A0]/50 transition-colors">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-mono font-black text-xs flex items-center justify-center border border-slate-300 dark:border-slate-700">
            #{idx + 1}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                Order Unit {idx + 1} ({order.units} {order.units === 1 ? "Unit" : "Units"})
              </span>
              {getStatusBadge(order.status)}
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Ordered on {new Date(order.createdAt).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        {/* Hardware Unit Tag & Key */}
        <div className="flex items-center gap-2">
          {assignedId ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="h-7 px-2.5 inline-flex items-center justify-center font-mono text-xs font-black bg-[#00F5A0]/20 text-black dark:text-[#00F5A0] border border-[#00F5A0]/60">
                {assignedId}
              </span>
              {devInfo?.online ? (
                <span className="h-7 px-2 inline-flex items-center gap-1 font-mono text-[10px] font-black uppercase bg-[#00F5A0] text-black">
                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                  ONLINE
                </span>
              ) : (
                <span className="h-7 px-2 inline-flex items-center gap-1 font-mono text-[10px] font-black uppercase bg-amber-500/15 text-amber-600 border border-amber-500/40">
                  OFFLINE
                </span>
              )}

              {/* Rotate Key Action */}
              {confirmingRotate ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={isRotating}
                    onClick={() => handleRotateKey(assignedId)}
                    className="h-7 px-2 inline-flex items-center gap-1 font-mono text-[10px] font-black uppercase bg-amber-500 hover:bg-amber-400 text-black border border-amber-600 cursor-pointer transition-colors"
                    title="Confirm rotation: old key is permanently invalidated"
                  >
                    {isRotating ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <AlertTriangle className="w-3 h-3" />
                    )}
                    <span>CONFIRM</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingRotate(false)}
                    className="h-7 px-1.5 inline-flex items-center font-mono text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingRotate(true)}
                  title="Rotate hardware provisioning key (Show-Once)"
                  className="h-7 px-2 inline-flex items-center justify-center gap-1 font-mono text-xs bg-slate-100 hover:bg-amber-400 hover:text-black dark:bg-slate-800 dark:hover:bg-amber-400 dark:hover:text-black text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span className="text-[10px] font-bold">ROTATE KEY</span>
                </button>
              )}

              {devKey && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(devKey, assignedId)}
                  title="Copy secret device key"
                  className="h-7 px-2 inline-flex items-center justify-center gap-1 font-mono text-xs bg-slate-100 hover:bg-[#00F5A0] hover:text-black dark:bg-slate-800 dark:hover:bg-[#00F5A0] dark:hover:text-black text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  {copiedKey === assignedId ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-[10px] font-bold">COPIED</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-3 h-3" />
                      <span className="text-[10px] font-bold">KEY</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <span className="text-xs font-mono text-slate-400 italic">Unassigned Unit</span>
          )}
        </div>
      </div>

      {/* Actions Row */}
      <div className="pt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500 font-mono">
          {order.notes && (
            <p><span className="font-bold text-slate-700 dark:text-slate-300">Notes:</span> {order.notes}</p>
          )}
          {order.verificationNotes && (
            <p className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ {order.verificationNotes}</p>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {assignedId && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSimulateDevice(order, assignedId, devKey || undefined);
              }}
              className="h-8 px-3 inline-flex items-center justify-center gap-1.5 font-mono text-xs font-black uppercase tracking-wider bg-slate-900 dark:bg-black text-[#00F5A0] hover:bg-[#00F5A0] hover:text-black border border-[#00F5A0]/60 transition-colors cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Simulate {assignedId}</span>
            </button>
          )}

          {normStatus === "pending" && (
            <>
              <button
                type="button"
                onClick={() => { onClose(); onOpenPrepare(order); }}
                className="h-8 px-3 inline-flex items-center justify-center gap-1.5 font-mono text-xs font-black uppercase tracking-wider bg-[#00F5A0] hover:bg-[#00DE90] text-black border border-[#00F5A0] transition-colors cursor-pointer"
              >
                <span>➔ Accept & Prepare</span>
              </button>
              <button
                type="button"
                onClick={() => { onClose(); onOpenReject(order); }}
                className="h-8 px-2.5 inline-flex items-center justify-center gap-1 font-mono text-xs font-black uppercase tracking-wider bg-rose-500/15 hover:bg-rose-500 hover:text-white text-rose-600 border border-rose-500/40 transition-colors cursor-pointer"
              >
                <span>Reject</span>
              </button>
            </>
          )}

          {normStatus === "preparing" && (
            <button
              type="button"
              onClick={() => { onClose(); onOpenDispatch(order); }}
              className="h-8 px-3 inline-flex items-center justify-center gap-1.5 font-mono text-xs font-black uppercase tracking-wider bg-[#00F5A0] hover:bg-[#00DE90] text-black border border-[#00F5A0] transition-colors cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>➔ Dispatch</span>
            </button>
          )}

          {normStatus === "dispatched" && (
            <button
              type="button"
              onClick={() => { onClose(); onOpenDeliver(order); }}
              className="h-8 px-3 inline-flex items-center justify-center gap-1.5 font-mono text-xs font-black uppercase tracking-wider bg-[#00F5A0] hover:bg-[#00DE90] text-black border border-[#00F5A0] transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>➔ Mark Delivered</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
