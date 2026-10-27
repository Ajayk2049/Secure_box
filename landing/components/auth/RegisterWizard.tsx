import React, { useState } from "react";
import {
  User,
  Phone,
  Mail,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import { ShippingLabelHeader } from "./ShippingLabelHeader";
import { CompanyFooter } from "./CompanyFooter";
import { getApiUrl } from "@/lib/api";

interface RegisterWizardProps {
  step: number;
  onSetStep: (step: number) => void;
  name: string;
  onNameChange: (val: string) => void;
  email: string;
  onEmailChange: (val: string) => void;
  phone: string;
  onPhoneChange: (val: string) => void;
  otp: string;
  onOtpChange: (val: string) => void;
  password: string;
  onPasswordChange: (val: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (val: string) => void;
  inviteCode: string;
  onInviteCodeChange: (val: string) => void;
  otpCooldown: number;
  loading: boolean;
  onSendOtp: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onSwitchToLogin: (prefill?: string) => void;
}

export function RegisterWizard({
  step,
  onSetStep,
  name,
  onNameChange,
  email,
  onEmailChange,
  phone,
  onPhoneChange,
  otp,
  onOtpChange,
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  inviteCode,
  onInviteCodeChange,
  otpCooldown,
  loading,
  onSendOtp,
  onSubmit,
  onSwitchToLogin,
}: RegisterWizardProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [emailFormatError, setEmailFormatError] = useState<string | null>(null);
  const [phoneExists, setPhoneExists] = useState(false);

  const validateEmailFormat = (val: string): boolean => {
    const clean = val.trim();
    if (!clean) {
      setEmailFormatError(null);
      return true;
    }
    const isValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(clean);
    if (!isValid) {
      setEmailFormatError("Please enter a valid email address (e.g. name@example.com)");
      return false;
    }
    setEmailFormatError(null);
    return true;
  };

  const checkEmailAvailability = async (emailVal: string): Promise<boolean> => {
    const clean = emailVal.trim().toLowerCase();
    if (!clean) {
      setEmailExists(false);
      setEmailFormatError(null);
      return false;
    }
    if (!validateEmailFormat(clean)) {
      setEmailExists(false);
      return false;
    }
    try {
      const res = await fetch(`${getApiUrl()}/auth/check-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean }),
      });
      const data = await res.json();
      const exists = Boolean(data.exists);
      setEmailExists(exists);
      return exists;
    } catch {
      setEmailExists(false);
      return false;
    }
  };

  const checkPhoneAvailability = async (phoneVal: string): Promise<boolean> => {
    const clean = phoneVal.replace(/\D/g, "");
    if (clean.length !== 10) {
      setPhoneExists(false);
      return false;
    }
    try {
      const res = await fetch(`${getApiUrl()}/auth/check-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: clean }),
      });
      const data = await res.json();
      const exists = Boolean(data.exists);
      setPhoneExists(exists);
      return exists;
    } catch {
      setPhoneExists(false);
      return false;
    }
  };

  const stepTitles: Record<number, { title: string; sub: string }> = {
    1: { title: "Step 1: Recipient", sub: "Enter your contact details" },
    2: { title: "Step 2: Verification", sub: "Verify Indian mobile number" },
    3: { title: "Step 3: Security", sub: "Create password & optional invite code" },
  };

  return (
    <div className="bg-[#FAF9F5] border-2 border-[#3D2310]/35 p-4 sm:p-5 text-[#3D2310] w-[94%] md:w-[90%] h-[94%] flex flex-col justify-between mx-auto my-auto overflow-hidden no-scrollbar shadow-none">
      <ShippingLabelHeader
        title={stepTitles[step]?.title || "Create Account"}
        subtitle={stepTitles[step]?.sub || "Step-wise configuration"}
      />

      {/* Auth Tab Switcher */}
      <div className="flex border border-[#3D2310]/30 bg-zinc-100 font-mono text-[10px] uppercase font-black tracking-wider mt-1 mb-2">
        <button
          type="button"
          onClick={() => onSwitchToLogin()}
          className="flex-1 py-1 text-[#3D2310] hover:bg-zinc-200 cursor-pointer text-center transition-colors"
        >
          Sign In
        </button>
        <button
          type="button"
          className="flex-1 py-1 bg-[#3D2310] text-[#FAF9F5] cursor-default text-center"
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col space-y-2.5 pt-1.5">
        {/* Step 1: Name & Optional Email */}
        {step === 1 && (
          <div className="space-y-3 text-left">
            <div className="space-y-1">
              <label className="font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  required
                  disabled={loading}
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-white border-2 border-[#3D2310]/30 pl-9 pr-3 py-2 text-xs text-[#3D2310] placeholder-zinc-400 focus:outline-none focus:border-[#3D2310] font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider">
                Email Address (Optional)
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={loading}
                  value={email}
                  onChange={(e) => {
                    const val = e.target.value;
                    onEmailChange(val);
                    if (emailExists) setEmailExists(false);
                    if (emailFormatError) {
                      if (!val.trim() || /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val.trim())) {
                        setEmailFormatError(null);
                      }
                    }
                  }}
                  onBlur={() => {
                    if (email.trim()) {
                      if (validateEmailFormat(email)) {
                        checkEmailAvailability(email);
                      }
                    } else {
                      setEmailFormatError(null);
                      setEmailExists(false);
                    }
                  }}
                  placeholder="name@example.com"
                  className={`w-full bg-white border-2 ${
                    emailFormatError ? "border-rose-500" : "border-[#3D2310]/30"
                  } pl-9 pr-3 py-2 text-xs text-[#3D2310] placeholder-zinc-400 focus:outline-none focus:border-[#3D2310] font-mono`}
                />
              </div>
              {emailFormatError && (
                <div className="bg-rose-50 border border-rose-300 p-2 text-left space-y-1 mt-1.5">
                  <p className="text-[11px] text-rose-800 font-sans font-medium leading-tight">
                    {emailFormatError}
                  </p>
                </div>
              )}
              {emailExists && (
                <div className="bg-amber-50 border border-amber-300 p-2 text-left space-y-1 mt-1.5">
                  <p className="text-[11px] text-amber-900 font-sans font-medium leading-tight">
                    An account with this email already exists.
                  </p>
                  <button
                    type="button"
                    onClick={() => onSwitchToLogin(email)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#3D2310] text-[#FAF9F5] text-[10px] font-mono font-bold uppercase hover:bg-[#2B1810] cursor-pointer"
                  >
                    <span>Sign In Instead</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Phone & OTP */}
        {step === 2 && (
          <div className="space-y-3 text-left">
            <div className="space-y-1">
              <label className="font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider">
                10-Digit Mobile Number
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="tel"
                    maxLength={10}
                    required
                    disabled={loading}
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      onPhoneChange(val);
                      if (val.length === 10) {
                        checkPhoneAvailability(val);
                      } else if (phoneExists) {
                        setPhoneExists(false);
                      }
                    }}
                    placeholder="9876543210"
                    className="w-full bg-white border-2 border-[#3D2310]/30 pl-9 pr-3 py-2 text-xs text-[#3D2310] placeholder-zinc-400 focus:outline-none focus:border-[#3D2310] font-mono"
                  />
                </div>
                <button
                  type="button"
                  disabled={loading || otpCooldown > 0 || phone.length !== 10 || phoneExists}
                  onClick={async () => {
                    if (phoneExists) return;
                    const exists = await checkPhoneAvailability(phone);
                    if (exists) return;
                    onSendOtp();
                  }}
                  className="px-3 py-2 bg-[#3D2310] text-[#FAF9F5] hover:bg-[#2B1810] text-[10px] font-mono font-bold uppercase shrink-0 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {otpCooldown > 0 ? `${otpCooldown}s` : "Get OTP"}
                </button>
              </div>
              {phoneExists && (
                <div className="bg-amber-50 border border-amber-300 p-2 text-left space-y-1 mt-1.5">
                  <p className="text-[11px] text-amber-900 font-sans font-medium leading-tight">
                    An account with this mobile number already exists.
                  </p>
                  <button
                    type="button"
                    onClick={() => onSwitchToLogin(phone)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#3D2310] text-[#FAF9F5] text-[10px] font-mono font-bold uppercase hover:bg-[#2B1810] cursor-pointer"
                  >
                    <span>Sign In Instead</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider">
                SMS Verification Code
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  maxLength={6}
                  required
                  disabled={loading}
                  value={otp}
                  onChange={(e) => onOtpChange(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  className="w-full bg-white border-2 border-[#3D2310]/30 pl-9 pr-3 py-2 text-xs text-[#3D2310] placeholder-zinc-400 focus:outline-none focus:border-[#3D2310] font-mono tracking-widest"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Password & Optional Join Code */}
        {step === 3 && (
          <div className="space-y-2.5 text-left">
            <div className="space-y-1">
              <label className="font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider">
                Create Master Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className={`w-full bg-white border-2 border-[#3D2310]/30 pl-9 pr-10 py-2 text-xs text-[#3D2310] placeholder-zinc-400 focus:outline-none focus:border-[#3D2310] font-mono ${
                    showPassword ? "tracking-normal font-sans" : "tracking-widest"
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

            <div className="space-y-1">
              <label className="font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider">
                Confirm Master Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  disabled={loading}
                  value={confirmPassword}
                  onChange={(e) => onConfirmPasswordChange(e.target.value)}
                  placeholder="Re-enter password"
                  className={`w-full bg-white border-2 border-[#3D2310]/30 pl-9 pr-10 py-2 text-xs text-[#3D2310] placeholder-zinc-400 focus:outline-none focus:border-[#3D2310] font-mono ${
                    showConfirmPassword ? "tracking-normal font-sans" : "tracking-widest"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[#3D2310] transition-colors p-1 flex items-center justify-center cursor-pointer"
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1 pt-0.5">
              <label className="font-mono text-[9px] font-black uppercase text-amber-800 tracking-wider">
                Join Code (Optional - For Co-Owners)
              </label>
              <input
                type="text"
                disabled={loading}
                value={inviteCode}
                onChange={(e) => onInviteCodeChange(e.target.value.toUpperCase())}
                placeholder="e.g. SBX-79A2"
                className="w-full bg-white border-2 border-amber-600/30 px-3 py-1.5 text-xs text-[#3D2310] placeholder-zinc-400 focus:outline-none focus:border-amber-600 font-mono tracking-widest uppercase"
              />
              <span className="text-[10px] text-zinc-500 font-mono block">
                Have a code from a family member? Enter it to share their locker.
              </span>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="pt-2 flex items-center justify-between gap-2">
          {step > 1 ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => onSetStep(step - 1)}
              className="px-3 py-2 bg-transparent border-2 border-[#3D2310]/30 text-[#3D2310] hover:bg-zinc-100 text-xs font-mono font-bold uppercase flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : <div />}

          {step < 3 ? (
            <button
              type="button"
              disabled={
                loading ||
                (step === 1 && (!name.trim() || emailExists || Boolean(emailFormatError) || (email.trim().length > 0 && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())))) ||
                (step === 2 && (!phone || phone.length !== 10 || !otp || phoneExists))
              }
              onClick={() => {
                if (step === 1) {
                  if (!name.trim() || emailExists) return;
                  if (email.trim().length > 0 && !validateEmailFormat(email)) return;
                }
                if (step === 2 && (!phone || phone.length !== 10 || !otp || phoneExists)) return;
                onSetStep(step + 1);
              }}
              className="px-4 py-2 bg-[#3D2310] hover:bg-[#2B1810] text-[#FAF9F5] text-xs font-mono font-bold uppercase flex items-center gap-1 ml-auto cursor-pointer disabled:opacity-50"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading || !password || password !== confirmPassword}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-mono font-black uppercase flex items-center gap-1.5 ml-auto shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          )}
        </div>
        {/* Switch to Login - Right below navigation buttons */}
        <div className="pt-2 text-center">
          <p className="text-xs text-zinc-600">
            Already registered?{" "}
            <button
              type="button"
              onClick={() => onSwitchToLogin()}
              className="font-black text-[#3D2310] underline underline-offset-2 hover:text-[#2B1810] ml-1 cursor-pointer"
            >
              Sign In to existing account
            </button>
          </p>
        </div>
      </form>

      {/* Company & Project Information at the very bottom */}
      <CompanyFooter />
    </div>
  );
}
