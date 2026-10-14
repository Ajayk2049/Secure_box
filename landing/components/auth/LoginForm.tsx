import React, { useState } from "react";
import { User, KeyRound, Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { ShippingLabelHeader } from "./ShippingLabelHeader";
import { CompanyFooter } from "./CompanyFooter";

interface LoginFormProps {
  identifier: string;
  onIdentifierChange: (val: string) => void;
  password: string;
  onPasswordChange: (val: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onSwitchToRegister: () => void;
  onForgotPassword?: () => void;
}

export function LoginForm({
  identifier,
  onIdentifierChange,
  onPasswordChange,
  password,
  loading,
  onSubmit,
  onSwitchToRegister,
  onForgotPassword,
}: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="bg-[#FAF9F5] border-2 border-[#3D2310]/35 p-4 sm:p-5 text-[#3D2310] w-[94%] md:w-[90%] h-[94%] flex flex-col justify-between mx-auto my-auto overflow-hidden no-scrollbar shadow-none">
      <ShippingLabelHeader
        title="Owner Login"
        subtitle="Manage your Secure Box & deliveries"
      />

      {/* Auth Tab Switcher */}
      <div className="flex border border-[#3D2310]/30 bg-zinc-100 font-mono text-[10px] uppercase font-black tracking-wider mt-1 mb-2">
        <button
          type="button"
          className="flex-1 py-1 bg-[#3D2310] text-[#FAF9F5] cursor-default text-center"
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="flex-1 py-1 text-[#3D2310] hover:bg-zinc-200 cursor-pointer text-center transition-colors"
        >
          Sign Up
        </button>
      </div>

      {/* Form starts 6-8px directly below tabs */}
      <form onSubmit={onSubmit} className="flex flex-col space-y-2.5 pt-1.5">
        {/* Identifier */}
        <div className="space-y-1 text-left">
          <label className="font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider">
            Mobile Number or Email
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              required
              disabled={loading}
              value={identifier}
              onChange={(e) => onIdentifierChange(e.target.value)}
              placeholder="e.g. 9876543210 or name@domain.com"
              className="w-full bg-white border-2 border-[#3D2310]/30 pl-9 pr-3 py-2 text-xs text-[#3D2310] placeholder-zinc-400 focus:outline-none focus:border-[#3D2310] focus:ring-1 focus:ring-[#3D2310] font-mono"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1 text-left">
          <div className="flex items-center justify-between">
            <label className="font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider">
              Security Password
            </label>
            {onForgotPassword && (
              <button
                type="button"
                onClick={onForgotPassword}
                className="font-mono text-[9px] font-bold text-[#3D2310] hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            )}
          </div>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type={showPassword ? "text" : "password"}
              required
              disabled={loading}
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="••••••••"
              className={`w-full bg-white border-2 border-[#3D2310]/30 pl-9 pr-10 py-2 text-xs text-[#3D2310] placeholder-zinc-400 focus:outline-none focus:border-[#3D2310] focus:ring-1 focus:ring-[#3D2310] font-mono ${showPassword ? "tracking-normal font-sans" : "tracking-widest"
                }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[#3D2310] transition-colors p-1 flex items-center justify-center cursor-pointer"
              title={showPassword ? "Hide password" : "Show password"}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Action button */}
        <div className="pt-1.5">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#3D2310] hover:bg-[#2B1810] text-[#FAF9F5] text-xs font-mono font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <span>Sign In to Locker</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </>
            )}
          </button>
        </div>

        {/* Switch to Register - Right below the button */}
        <div className="pt-2 text-center">
          <p className="text-xs text-zinc-600">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="font-black text-[#3D2310] underline underline-offset-2 hover:text-[#2B1810] ml-1 cursor-pointer"
            >
              Sign Up / Create Account
            </button>
          </p>
        </div>
      </form>

      {/* Company & Project Information at the very bottom */}
      <CompanyFooter />
    </div>
  );
}
