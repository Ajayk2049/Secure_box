"use client";

import React from "react";
import {
  X,
  Package,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
} from "lucide-react";
import { LockerRequestItem, LockerRequestStatus } from "../dashboard/RequestsTable";
import { CustomerUnitItem } from "./CustomerUnitItem";

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
  if (!customer) return null;

  const getStatusBadge = (status: LockerRequestStatus) => {
    const norm = status === "approved" ? "preparing" : status;
    const badgeMap: Record<string, { icon: any; text: string; cls: string }> = {
      pending: { icon: Clock, text: "PENDING", cls: "bg-[#00F5A0]/20 text-black dark:text-[#00F5A0] border-[#00F5A0]/60" },
      preparing: { icon: Package, text: "PREPARING", cls: "bg-[#00F5A0]/25 text-black dark:text-[#00F5A0] border-[#00F5A0]/70" },
      dispatched: { icon: Truck, text: "DISPATCHED", cls: "bg-[#00F5A0]/30 text-black dark:text-[#00F5A0] border-[#00F5A0]/80" },
      delivered: { icon: CheckCircle2, text: "DELIVERED", cls: "bg-[#00F5A0] text-black border-[#00F5A0]" },
      rejected: { icon: XCircle, text: "REJECTED", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/40" },
    };
    const b = badgeMap[norm];
    if (!b) return null;
    const Icon = b.icon;
    return (
      <span className={`h-6 px-2.5 inline-flex items-center gap-1 font-mono text-[11px] font-black uppercase border ${b.cls}`}>
        <Icon className="w-3 h-3 stroke-[2.5]" /> {b.text}
      </span>
    );
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
                <span className="text-[10px] text-slate-400 uppercase font-bold block">DELIVERY DESTINATION</span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{customer.address}</p>
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
              {customer.orders.map((order, idx) => (
                <CustomerUnitItem
                  key={order._id}
                  order={order}
                  idx={idx}
                  customerName={customer.name}
                  onClose={onClose}
                  onSimulateDevice={onSimulateDevice}
                  onOpenPrepare={onOpenPrepare}
                  onOpenDispatch={onOpenDispatch}
                  onOpenDeliver={onOpenDeliver}
                  onOpenReject={onOpenReject}
                  onShowKey={onShowKey}
                  getStatusBadge={getStatusBadge}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-[#0D141F] border-t-2 border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-xs font-mono text-slate-500">Press ESC or click close to dismiss</span>
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
