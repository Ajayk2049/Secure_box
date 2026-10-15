"use client";

import React, { useState, useMemo } from "react";
import {
  Clock,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Cpu,
  KeyRound,
  ExternalLink,
} from "lucide-react";
import { CustomerUnitsModal, ClubbedCustomer } from "../modals/CustomerUnitsModal";

export type LockerRequestStatus =
  | "pending"
  | "preparing"
  | "dispatched"
  | "delivered"
  | "approved"
  | "rejected";

export interface LockerRequestItem {
  _id: string;
  userId?: {
    _id: string;
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    pincode?: string;
    units?: number;
    orderStatus?: string;
  };
  name: string;
  phone: string;
  email?: string;
  address: string;
  pincode: string;
  units: number;
  status: LockerRequestStatus;
  assignedDeviceIds: string[];
  assignedDevicesInfo?: Array<{
    deviceId: string;
    deviceKey?: string | null;
    online: boolean;
    lastHeartbeat?: string | Date;
    doorState?: string;
  }>;
  isDeviceOnline?: boolean;
  lastHeartbeat?: string | Date;
  rejectionReason?: string;
  notes?: string;
  verificationNotes?: string;
  createdAt: string;
  reviewedAt?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
}

interface RequestsTableProps {
  requests: LockerRequestItem[];
  isLoading: boolean;
  onOpenPrepare: (item: LockerRequestItem) => void;
  onOpenDispatch: (item: LockerRequestItem) => void;
  onOpenDeliver: (item: LockerRequestItem) => void;
  onOpenReject: (item: LockerRequestItem) => void;
  onSimulateDevice: (item: LockerRequestItem, deviceId: string, deviceKey?: string) => void;
  onShowKey?: (customerName: string, deviceId: string, deviceKey: string) => void;
}

export function RequestsTable({
  requests,
  isLoading,
  onOpenPrepare,
  onOpenDispatch,
  onOpenDeliver,
  onOpenReject,
  onSimulateDevice,
  onShowKey,
}: RequestsTableProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<ClubbedCustomer | null>(null);

  // Group / club requests by customer
  const clubbedCustomers = useMemo<ClubbedCustomer[]>(() => {
    const customerMap = new Map<string, ClubbedCustomer>();

    requests.forEach((req) => {
      const key = (req.userId?._id || req.phone || req.name).trim().toLowerCase();
      const existing = customerMap.get(key);

      if (!existing) {
        customerMap.set(key, {
          customerId: key,
          name: req.name,
          phone: req.phone,
          email: req.email || req.userId?.email,
          address: req.address,
          pincode: req.pincode,
          totalUnits: req.units || 1,
          overallStatus: req.status,
          assignedDeviceIds: [...(req.assignedDeviceIds || [])],
          assignedDevicesInfo: [...(req.assignedDevicesInfo || [])],
          isDeviceOnline: !!req.isDeviceOnline,
          orders: [req],
          createdAt: req.createdAt,
        });
      } else {
        existing.totalUnits += req.units || 1;
        existing.orders.push(req);

        (req.assignedDeviceIds || []).forEach((id) => {
          if (!existing.assignedDeviceIds.includes(id)) {
            existing.assignedDeviceIds.push(id);
          }
        });

        (req.assignedDevicesInfo || []).forEach((info) => {
          if (!existing.assignedDevicesInfo.some((d) => d.deviceId === info.deviceId)) {
            existing.assignedDevicesInfo.push(info);
          }
        });

        if (req.isDeviceOnline) existing.isDeviceOnline = true;

        const statusPriority: Record<string, number> = {
          pending: 5,
          preparing: 4,
          approved: 4,
          dispatched: 3,
          delivered: 2,
          rejected: 1,
        };
        const currentScore = statusPriority[existing.overallStatus] || 0;
        const newScore = statusPriority[req.status] || 0;
        if (newScore > currentScore) {
          existing.overallStatus = req.status;
        }

        if (new Date(req.createdAt) > new Date(existing.createdAt)) {
          existing.createdAt = req.createdAt;
        }
      }
    });

    return Array.from(customerMap.values());
  }, [requests]);

  const renderStatusBadge = (status: LockerRequestStatus) => {
    const norm = status === "approved" ? "preparing" : status;
    switch (norm) {
      case "pending":
        return (
          <span className="h-8 px-3 inline-flex items-center justify-center gap-1.5 rounded-none text-xs font-black font-mono tracking-wider uppercase whitespace-nowrap bg-[#00F5A0]/20 text-black dark:text-[#00F5A0] border border-[#00F5A0]/60">
            <Clock className="w-3.5 h-3.5 stroke-[2.5]" /> PENDING
          </span>
        );
      case "preparing":
        return (
          <span className="h-8 px-3 inline-flex items-center justify-center gap-1.5 rounded-none text-xs font-black font-mono tracking-wider uppercase whitespace-nowrap bg-[#00F5A0]/25 text-black dark:text-[#00F5A0] border border-[#00F5A0]/70">
            <Package className="w-3.5 h-3.5 stroke-[2.5]" /> PREPARING
          </span>
        );
      case "dispatched":
        return (
          <span className="h-8 px-3 inline-flex items-center justify-center gap-1.5 rounded-none text-xs font-black font-mono tracking-wider uppercase whitespace-nowrap bg-[#00F5A0]/30 text-black dark:text-[#00F5A0] border border-[#00F5A0]/80">
            <Truck className="w-4 h-4 stroke-[2.5]" /> DISPATCHED
          </span>
        );
      case "delivered":
        return (
          <span className="h-8 px-3 inline-flex items-center justify-center gap-1.5 rounded-none text-xs font-black font-mono tracking-wider uppercase whitespace-nowrap bg-[#00F5A0] text-black border border-[#00F5A0]">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" /> DELIVERED
          </span>
        );
      case "rejected":
        return (
          <span className="h-8 px-3 inline-flex items-center justify-center gap-1.5 rounded-none text-xs font-black font-mono tracking-wider uppercase whitespace-nowrap bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/40">
            <XCircle className="w-3.5 h-3.5 stroke-[2.5]" /> REJECTED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="w-full bg-white dark:bg-[#0D141F] rounded-none border-2 border-slate-200 dark:border-slate-800 shadow-none overflow-hidden">
        <div className="overflow-x-auto no-scrollbar w-full">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300 table-auto">
            <thead className="bg-slate-50 dark:bg-[#080D14] text-xs uppercase tracking-wider font-mono font-black text-slate-500 dark:text-slate-400 border-b-2 border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-5 min-w-[180px] w-[18%]">Order / Customer</th>
                <th className="py-3.5 px-4 min-w-[140px] w-[14%]">Contact</th>
                <th className="py-3.5 px-4 min-w-[200px] w-[22%]">Delivery Address</th>
                <th className="py-3.5 px-4 min-w-[80px] w-[8%] text-center">Total Units</th>
                <th className="py-3.5 px-4 min-w-[130px] w-[12%]">Status</th>
                <th className="py-3.5 px-4 min-w-[120px] w-[12%]">Assigned Units</th>
                <th className="py-3.5 px-5 min-w-[160px] w-[14%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-base text-[#00F5A0] font-mono font-bold">
                    Loading orders...
                  </td>
                </tr>
              ) : clubbedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-14 h-14 rounded-none bg-slate-100 dark:bg-[#080D14] border-2 border-slate-300 dark:border-slate-800 flex items-center justify-center text-[#00F5A0]">
                        <Package className="w-7 h-7 stroke-[2]" />
                      </div>
                      <div className="font-black text-base text-slate-900 dark:text-slate-100">
                        No orders found matching this filter
                      </div>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-md">
                        Customer order requests placed via web or app will automatically appear here.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                clubbedCustomers.map((cust) => {
                  const hasMultiple = cust.orders.length > 1;

                  return (
                    <tr
                      key={cust.customerId}
                      onClick={() => setSelectedCustomer(cust)}
                      className="hover:bg-slate-100/70 dark:hover:bg-[#080D14] transition-colors cursor-pointer group"
                    >
                      {/* Customer */}
                      <td className="py-4 px-5 align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 dark:text-slate-100 text-base group-hover:text-[#00F5A0] transition-colors">
                            {cust.name}
                          </span>
                          {hasMultiple && (
                            <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-bold border border-slate-300 dark:border-slate-700">
                              {cust.orders.length} Orders
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          {new Date(cust.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-4 px-4 align-top font-mono text-sm">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          +91 {cust.phone}
                        </div>
                        {cust.email && (
                          <div className="text-xs text-slate-400 truncate max-w-[190px] mt-0.5">
                            {cust.email}
                          </div>
                        )}
                      </td>

                      {/* Delivery Address */}
                      <td className="py-4 px-4 align-middle text-sm">
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
                          {cust.address}
                        </div>
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1 font-mono">
                          PIN: {cust.pincode}
                        </div>
                      </td>

                      {/* Total Units */}
                      <td className="py-4 px-4 align-middle text-center">
                        <span className="h-8 min-w-[42px] px-2.5 inline-flex items-center justify-center rounded-none bg-slate-100 dark:bg-[#080D14] border-2 border-slate-300 dark:border-slate-700 font-mono text-xs font-black text-slate-900 dark:text-slate-100 group-hover:border-[#00F5A0] transition-colors">
                          {cust.totalUnits} {cust.totalUnits === 1 ? "Unit" : "Units"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 align-middle">
                        {renderStatusBadge(cust.overallStatus)}
                      </td>

                      {/* Assigned Devices */}
                      <td className="py-4 px-4 align-middle">
                        {cust.assignedDeviceIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {cust.assignedDeviceIds.map((devId) => (
                              <span
                                key={devId}
                                className="h-7 px-2 inline-flex items-center justify-center font-mono text-xs font-black bg-[#00F5A0]/20 text-black dark:text-[#00F5A0] border border-[#00F5A0]/60 rounded-none whitespace-nowrap"
                              >
                                {devId}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-mono italic">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 align-middle text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomer(cust);
                          }}
                          className="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 font-mono text-xs font-black uppercase tracking-wider bg-slate-900 dark:bg-black text-[#00F5A0] hover:bg-[#00F5A0] hover:text-black border border-[#00F5A0]/60 transition-colors cursor-pointer shadow-none whitespace-nowrap"
                        >
                          <span>Manage</span>
                          <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Units & Actions Modal */}
      <CustomerUnitsModal
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        onOpenPrepare={onOpenPrepare}
        onOpenDispatch={onOpenDispatch}
        onOpenDeliver={onOpenDeliver}
        onOpenReject={onOpenReject}
        onSimulateDevice={onSimulateDevice}
        onShowKey={onShowKey}
      />
    </>
  );
}
