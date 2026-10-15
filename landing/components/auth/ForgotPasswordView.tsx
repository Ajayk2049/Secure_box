"use client";

import React from "react";
import { Phone, KeyRound, Lock, Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { ShippingLabelHeader } from "./ShippingLabelHeader";
import { CompanyFooter } from "./CompanyFooter";
import { useForgotPassword } from "./useForgotPassword";

interface ForgotPasswordViewProps {
  onSwitchToLogin: () => void;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
  onResetComplete?: (message: string, phone: string) => void;
}

export function ForgotPasswordView(props: ForgotPasswordViewProps) {
  const { onSwitchToLogin } = props;
  const {
    phone,
    setPhone,
    otp,
    setOtp,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    otpSent,
    otpCooldown,
    loading,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    handleSendOtp,
    handleResetPassword,
    isFormValid,
  } = useForgotPassword(props);

  return (
    <div className="bg-[#FAF9F5] border-2 border-[#3D2310]/35 p-4 sm:p-5 text-[#3D2310] w-[94%] md:w-[90%] h-[94%] flex flex-col justify-between mx-auto my-auto overflow-hidden no-scrollbar shadow-none">
      <ShippingLabelHeader
        title="Password Recovery"
        subtitle="Verify mobile ownership via SMS OTP"
      />

      {/* Top Banner Indicator */}
      <div className="flex items-center justify-between border border-[#3D2310]/30 bg-zinc-100 px-3 py-1.5 font-mono text-[9.5px] uppercase font-bold text-zinc-600 mt-1 mb-2">
        <span>SECURITY CLEARANCE</span>
        <span className="text-[#3D2310] font-black">PHASE 2 AUTH</span>
      </div>

      <form onSubmit={handleResetPassword} className="flex flex-col space-y-2 pt-1">
        {/* 1. Mobile Number & Send OTP Button */}
        <div className="space-y-1 text-left">
          <label className="font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider">
            Registered Mobile Number
          </label>
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="tel"
                required
                maxLength={10}
                disabled={loading || otpCooldown > 0}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="10-digit mobile number"
                className="w-full bg-white border-2 border-[#3D2310]/30 pl-9 pr-3 py-1.5 text-xs text-[#3D2310] placeholder-zinc-400 focus:outline-none focus:border-[#3D2310] font-mono tracking-wider"
              />
            </div>
            <button
              type="button"
              disabled={loading || phone.replace(/\D/g, "").length !== 10 || otpCooldown > 0}
              onClick={handleSendOtp}
              className="px-3 py-1.5 bg-[#3D2310] hover:bg-[#2B1810] text-[#FAF9F5] text-[10px] font-mono font-black uppercase tracking-wider disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
            >
              {otpCooldown > 0 ? `Resend (${otpCooldown}s)` : otpSent ? "Resend OTP" : "Send OTP"}
            </button>
          </div>
        </div>

        {/* 2. OTP Input: Strictly Disabled until user clicks Send OTP */}
        <div className="space-y-1 text-left">
          <div className="flex items-center justify-between">
            <label className="font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider">
              Verification Code (OTP)
            </label>
            {!otpSent && (
              <span className="font-mono text-[8px] text-zinc-400 uppercase">
                (Click Send OTP to unlock)
              </span>
            )}
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              required
              maxLength={6}
              disabled={!otpSent || loading}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder={otpSent ? "Enter 6-digit OTP" : "Disabled • Send OTP first"}
              className={`w-full border-2 pl-9 pr-3 py-1.5 text-xs text-[#3D2310] font-mono tracking-widest focus:outline-none transition-colors ${
                !otpSent
                  ? "bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed placeholder-zinc-400"
                  : "bg-white border-[#3D2310]/30 placeholder-zinc-400 focus:border-[#3D2310]"
              }`}
            />
          </div>
        </div>

        {/* 3. New Password & Confirm Password: Strictly Disabled until OTP is entered */}
        <div className="space-y-1 text-left">
          <div className="flex items-center justify-between">
            <label className="font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider">
              New Password (6-12 Characters)
            </label>
            {(!otpSent || otp.trim().length < 4) && (
              <span className="font-mono text-[8px] text-zinc-400 uppercase">
                (Enter OTP to unlock)
              </span>
            )}
          </div>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type={showPassword ? "text" : "password"}
              required
              maxLength={12}
              disabled={!otpSent || otp.trim().length < 4 || loading}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={otp.trim().length >= 4 ? "6 to 12 characters" : "Disabled • Enter OTP first"}
              className={`w-full border-2 pl-9 pr-10 py-1.5 text-xs text-[#3D2310] font-mono focus:outline-none transition-colors ${
                !otpSent || otp.trim().length < 4
                  ? "bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed placeholder-zinc-400"
                  : "bg-white border-[#3D2310]/30 placeholder-zinc-400 focus:border-[#3D2310]"
              } ${showPassword ? "tracking-normal font-sans" : "tracking-widest"}`}
            />
            {otpSent && otp.trim().length >= 4 && (
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[#3D2310] transition-colors p-1 flex items-center justify-center cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* 4. Confirm Password */}
        <div className="space-y-1 text-left">
          <label className="font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider">
            Confirm New Password
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type={showConfirmPassword ? "text" : "password"}
              required
              maxLength={12}
              disabled={!otpSent || otp.trim().length < 4 || loading}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={otp.trim().length >= 4 ? "Re-enter new password" : "Disabled • Enter OTP first"}
              className={`w-full border-2 pl-9 pr-10 py-1.5 text-xs text-[#3D2310] font-mono focus:outline-none transition-colors ${
                !otpSent || otp.trim().length < 4
                  ? "bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed placeholder-zinc-400"
                  : "bg-white border-[#3D2310]/30 placeholder-zinc-400 focus:border-[#3D2310]"
              } ${showConfirmPassword ? "tracking-normal font-sans" : "tracking-widest"}`}
            />
            {otpSent && otp.trim().length >= 4 && (
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[#3D2310] transition-colors p-1 flex items-center justify-center cursor-pointer"
                title={showConfirmPassword ? "Hide password" : "Show password"}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Action button */}
        <div className="pt-1">
          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="w-full py-2 bg-[#3D2310] hover:bg-[#2B1810] text-[#FAF9F5] text-xs font-mono font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Updating Vault Password...</span>
              </>
            ) : (
              <>
                <span>Reset Password</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
              </>
            )}
          </button>
        </div>

        {/* Back to Login */}
        <div className="pt-1.5 text-center">
          <p className="text-xs text-zinc-600">
            Remember your credentials?{" "}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-black text-[#3D2310] underline underline-offset-2 hover:text-[#2B1810] ml-1 cursor-pointer"
            >
              Sign In
            </button>
          </p>
        </div>
      </form>

      {/* Shared Company Footer */}
      <CompanyFooter />
    </div>
  );
}
