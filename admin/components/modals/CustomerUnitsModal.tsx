"use client";

import React, { useState } from "react";
import {
  X,
  Package,
  MapPin,
  Phone,
  Mail,
  Cpu,
  KeyRound,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  Copy,
  Check,
} from "lucide-react";
import { LockerRequestItem, LockerRequestStatus } from "../dashboard/RequestsTable";

export interface ClubbedCustomer {
  customerId: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  pincode: string;
  totalUnits: number;
  overallStatus: LockerRequestStatus;
  assignedDeviceIds: string[];
  assignedDevicesInfo: Array<{
    deviceId: string;
    deviceKey?: string | null;
    online: boolean;
    lastHeartbeat?: string | Date;
    doorState?: string;
  }>;
  isDeviceOnline: boolean;
  orders: LockerRequestItem[];
  createdAt: string;
}

interface CustomerUnitsModalProps {
  customer: ClubbedCustomer | null;
  onClose: () => void;
  onOpenPrepare: (item: LockerRequestItem) => void;
  onOpenDispatch: (item: LockerRequestItem) => void;
  onOpenDeliver: (item: LockerRequestItem) => void;
  onOpenReject: (item: LockerRequestItem) => void;
  onSimulateDevice: (item: LockerRequestItem, deviceId: string, deviceKey?: string) => void;
  onShowKey?: (customerName: string, deviceId: string, deviceKey: string) => void;
}

export function CustomerUnitsModal({
  customer,
  onClose,
  onOpenPrepare,
  onOpenDispatch,
  onOpenDeliver,
  onOpenReject,
  onSimulateDevice,
  onShowKey,
}: CustomerUnitsModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!customer) return null;

  const copyToClipboard = (key: string, deviceId: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(deviceId);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const getStatusBadge = (status: LockerRequestStatus) => {
    const norm = status === "approved" ? "preparing" : status;
    switch (norm) {
      case "pending":
        return (
          <span className="h-6 px-2.5 inline-flex items-center gap-1 font-mono text-[11px] font-black uppercase bg-[#00F5A0]/20 text-black dark:text-[#00F5A0] border border-[#00F5A0]/60">
            <Clock className="w-3 h-3 stroke-[2.5]" /> PENDING
          </span>
        );
      case "preparing":
        return (
          <span className="h-6 px-2.5 inline-flex items-center gap-1 font-mono text-[11px] font-black uppercase bg-[#00F5A0]/25 text-black dark:text-[#00F5A0] border border-[#00F5A0]/70">
            <Package className="w-3 h-3 stroke-[2.5]" /> PREPARING
          </span>
        );
      case "dispatched":
        return (
          <span className="h-6 px-2.5 inline-flex items-center gap-1 font-mono text-[11px] font-black uppercase bg-[#00F5A0]/30 text-black dark:text-[#00F5A0] border border-[#00F5A0]/80">
            <Truck className="w-3 h-3 stroke-[2.5]" /> DISPATCHED
          </span>
        );
      case "delivered":
        return (
          <span className="h-6 px-2.5 inline-flex items-center gap-1 font-mono text-[11px] font-black uppercase bg-[#00F5A0] text-black border border-[#00F5A0]">
            <CheckCircle2 className="w-3 h-3 stroke-[3]" /> DELIVERED
          </span>
        );
      case "rejected":
        return (
          <span className="h-6 px-2.5 inline-flex items-center gap-1 font-mono text-[11px] font-black uppercase bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/40">
            <XCircle className="w-3 h-3 stroke-[2.5]" /> REJECTED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-4xl max-h-[92vh] bg-white dark:bg-[#090D16] rounded-none border-2 border-slate-300 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-[#0D141F] border-b-2 border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-slate-900 text-[#00F5A0] dark:bg-black border border-[#00F5A0]/60 flex items-center justify-center font-black font-mono text-base shrink-0">
              {customer.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight uppercase">
                  {customer.name}
                </h3>
                <span className="h-6 px-2.5 inline-flex items-center text-xs font-mono font-black tracking-wider uppercase bg-[#00F5A0] text-black border border-[#00F5A0]">
                  {customer.totalUnits} {customer.totalUnits === 1 ? "UNIT" : "UNITS TOTAL"}
                </span>
                {getStatusBadge(customer.overallStatus)}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                  <Phone className="w-3 h-3 text-[#00F5A0]" /> +91 {customer.phone}
                </span>
                {customer.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" /> {customer.email}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-black hover:bg-[#00F5A0] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {/* Customer Destination Card */}
          <div className="p-4 bg-slate-50 dark:bg-[#0D141F] border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-[#00F5A0] shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  DELIVERY DESTINATION
                </span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {customer.address}
                </p>
                <p className="text-xs text-slate-500 font-mono">PIN: {customer.pincode}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <span className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-xs font-bold border border-slate-300 dark:border-slate-700">
                {customer.orders.length} {customer.orders.length === 1 ? "ORDER" : "ORDERS PLACED"}
              </span>
              <span className="px-3 py-1 bg-[#00F5A0]/20 text-black dark:text-[#00F5A0] font-mono text-xs font-black border border-[#00F5A0]/60">
                {customer.assignedDeviceIds.length} {customer.assignedDeviceIds.length === 1 ? "DEVICE LINKED" : "DEVICES LINKED"}
              </span>
            </div>
          </div>

          {/* Orders & Assigned Units Breakdown */}
          <div className="space-y-4">
            <h4 className="text-xs font-black font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Ordered Units & Hardware Devices ({customer.orders.length})
            </h4>

            <div className="space-y-3">
              {customer.orders.map((order, idx) => {
                const assignedId = order.assignedDeviceIds?.[0] || null;
                const devInfo = order.assignedDevicesInfo?.find((d) => d.deviceId === assignedId);
                const devKey = devInfo?.deviceKey;
                const normStatus = order.status === "approved" ? "preparing" : order.status;

                return (
                  <div
                    key={order._id}
                    className="p-4 bg-white dark:bg-[#0B0F19] border-2 border-slate-200 dark:border-slate-800 hover:border-[#00F5A0]/50 transition-colors"
                  >
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
                          <div className="flex items-center gap-1.5">
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
                          <span className="text-xs font-mono text-slate-400 italic">
                            Unassigned Unit
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions Row for this Specific Unit */}
                    <div className="pt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-slate-500 font-mono">
                        {order.notes && (
                          <p>
                            <span className="font-bold text-slate-700 dark:text-slate-300">Notes:</span> {order.notes}
                          </p>
                        )}
                        {order.verificationNotes && (
                          <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            ✓ {order.verificationNotes}
                          </p>
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
                              onClick={() => {
                                onClose();
                                onOpenPrepare(order);
                              }}
                              className="h-8 px-3 inline-flex items-center justify-center gap-1.5 font-mono text-xs font-black uppercase tracking-wider bg-[#00F5A0] hover:bg-[#00DE90] text-black border border-[#00F5A0] transition-colors cursor-pointer"
                            >
                              <span>➔ Accept & Prepare</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenReject(order);
                              }}
                              className="h-8 px-2.5 inline-flex items-center justify-center gap-1 font-mono text-xs font-black uppercase tracking-wider bg-rose-500/15 hover:bg-rose-500 hover:text-white text-rose-600 border border-rose-500/40 transition-colors cursor-pointer"
                            >
                              <span>Reject</span>
                            </button>
                          </>
                        )}

                        {normStatus === "preparing" && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenDispatch(order);
                            }}
                            className="h-8 px-3 inline-flex items-center justify-center gap-1.5 font-mono text-xs font-black uppercase tracking-wider bg-[#00F5A0] hover:bg-[#00DE90] text-black border border-[#00F5A0] transition-colors cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>➔ Dispatch</span>
                          </button>
                        )}

                        {normStatus === "dispatched" && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenDeliver(order);
                            }}
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
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-[#0D141F] border-t-2 border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-xs font-mono text-slate-500">
            Press ESC or click close to dismiss
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 font-mono text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
