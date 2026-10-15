"use client";

import { useState, useEffect, useRef } from "react";

interface UseForgotPasswordProps {
  onSwitchToLogin: () => void;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
  onResetComplete?: (message: string, phone: string) => void;
}

export function useForgotPassword({
  onSwitchToLogin,
  onSuccess,
  onError,
  onResetComplete,
}: UseForgotPasswordProps) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  const startCooldown = (seconds: number) => {
    setOtpCooldown(seconds);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setOtpCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length !== 10) {
      onError("Please enter a valid 10-digit Indian mobile number");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, type: "reset" }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.cooldownRemaining) {
          startCooldown(data.cooldownRemaining);
        }
        throw new Error(data.error || "Failed to send OTP");
      }

      setOtpSent(true);
      startCooldown(60);
      onSuccess(data.message || "OTP sent to your mobile number");
    } catch (err: any) {
      onError(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length !== 10) {
      onError("Please enter a valid 10-digit mobile number");
      return;
    }

    if (!otpSent || otp.trim().length < 4) {
      onError("Please enter the OTP sent to your phone");
      return;
    }

    if (newPassword.length < 6 || newPassword.length > 12) {
      onError("New password must be between 6 and 12 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      onError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          otp: otp.trim(),
          newPassword: newPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password");
      }

      if (onResetComplete) {
        onResetComplete(data.message || "Password reset successfully! Please sign in.", cleanPhone);
      } else {
        onSuccess(data.message || "Password reset successfully! Please sign in.");
        onSwitchToLogin();
      }
    } catch (err: any) {
      onError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    phone.replace(/\D/g, "").length === 10 &&
    otpSent &&
    otp.trim().length >= 4 &&
    newPassword.length >= 6 &&
    newPassword.length <= 12 &&
    newPassword === confirmPassword;

  return {
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
  };
}
