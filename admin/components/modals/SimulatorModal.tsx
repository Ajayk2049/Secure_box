import React from "react";
import { Cpu, X, ExternalLink } from "lucide-react";
import { getBackendBaseUrl } from "@/lib/api";

interface SimulatorModalProps {
  data: {
    deviceId: string;
    customerName: string;
    deviceKey?: string;
  };
  onClose: () => void;
}

export function SimulatorModal({ data, onClose }: SimulatorModalProps) {
  const backendBase = getBackendBaseUrl();

  const adminToken =
    typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : "";

  const simulatorUrl =
    `${backendBase}/simulator?deviceId=${encodeURIComponent(data.deviceId)}` +
    `&key=${encodeURIComponent(data.deviceKey || "SIMULATOR_TEST_KEY")}` +
    (adminToken ? `&adminToken=${encodeURIComponent(adminToken)}` : "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-6xl h-[90vh] bg-white dark:bg-[#090D16] rounded-none border-2 border-slate-300 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-[#0D141F] border-b-2 border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-none bg-[#00F5A0]/20 dark:bg-[#00F5A0]/15 text-black dark:text-[#00F5A0] border border-[#00F5A0]/60 dark:border-[#00F5A0]/40 flex items-center justify-center font-bold shrink-0">
              <Cpu className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight uppercase">
                  Hardware Simulator
                </h3>
                <span className="h-6 px-2.5 inline-flex items-center text-xs font-mono font-black tracking-wider uppercase bg-[#00F5A0] text-black border border-[#00F5A0]">
                  {data.deviceId}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Simulating device assigned to:{" "}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {data.customerName}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.open(simulatorUrl, "_blank")}
              title="Pop out in separate browser tab"
              className="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:text-black hover:bg-[#00F5A0] border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer bg-white dark:bg-[#080D14]"
            >
              <ExternalLink className="w-3.5 h-3.5 stroke-[2]" />
              <span className="hidden sm:inline">Pop Out Window</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Close Simulator"
              className="h-9 w-9 inline-flex items-center justify-center text-slate-400 hover:text-rose-500 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer bg-white dark:bg-[#080D14]"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Embedded Simulator Viewport */}
        <div className="flex-1 w-full h-full bg-[#090D16] relative overflow-hidden">
          <iframe
            src={simulatorUrl}
            title={`ESP32 Hardware Simulator - ${data.deviceId}`}
            className="w-full h-full border-0 absolute inset-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
          />
        </div>
      </div>
    </div>
  );
}
