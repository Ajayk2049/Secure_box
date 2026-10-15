"use client";

import React, { useState, useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { LoginForm } from "./auth/LoginForm";
import { RegisterWizard } from "./auth/RegisterWizard";
import { ForgotPasswordView } from "./auth/ForgotPasswordView";
import { OrderView } from "./auth/OrderView";
import { DeliveryManifest, StoredUserData } from "./auth/DeliveryManifest";
import { userFetch, clearStoredUserSession } from "@/lib/api";

interface ProfileProps {
  mode?: "register" | "login";
}

export function Profile({ mode }: ProfileProps = {}) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<StoredUserData | null>(null);
  const [isRegister, setIsRegister] = useState(mode === "register");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);

  useEffect(() => {
    if (mode === "register") {
      setIsRegister(true);
      setIsForgotPassword(false);
      setStep(1);
      clearMessages();
    } else if (mode === "login") {
      setIsRegister(false);
      setIsForgotPassword(false);
      clearMessages();
    }
  }, [mode]);

  // Step-wise registration (1 to 3)
  const [step, setStep] = useState<number>(1);
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regOtp, setRegOtp] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regInviteCode, setRegInviteCode] = useState("");

  // OTP cooldown
  const [otpCooldown, setOtpCooldown] = useState<number>(0);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Login form fields
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

  const clearMessages = () => {
    setErrorMessage(null);
    setInfoMessage(null);
  };

  useEffect(() => {
    let isMounted = true;
    try {
      const loggedIn = localStorage.getItem("smartbox_logged_in") === "true";
      const rawUser = localStorage.getItem("smartbox_user_data");
      const token = localStorage.getItem("smartbox_token");
      const refreshToken = localStorage.getItem("smartbox_refresh_token");

      if (loggedIn) {
        if (rawUser) {
          setCurrentUser(JSON.parse(rawUser));
        } else {
          const simpleName = localStorage.getItem("smartbox_user") || "Customer";
          setCurrentUser({ name: simpleName });
        }
        setIsLoggedIn(true);

        if (token || refreshToken) {
          userFetch("/auth/me")
            .then(async (res) => {
              if (!isMounted) return;
              if (res.status === 401 || res.status === 403) {
                clearStoredUserSession();
                setIsLoggedIn(false);
                setCurrentUser(null);
                return;
              }
              if (res.ok) {
                const data = await res.json();
                if (data?.user) {
                  const refreshed: StoredUserData = {
                    id: data.user.id,
                    name: data.user.name,
                    phone: data.user.phone,
                    email: data.user.email,
                    address: data.user.address,
                    pincode: data.user.pincode,
                    units: data.user.units,
                    orderStatus: data.user.orderStatus,
                    assignedDevices: data.user.assignedDevices || [],
                  };
                  setCurrentUser(refreshed);
                  localStorage.setItem("smartbox_user_data", JSON.stringify(refreshed));
                }
              }
            })
            .catch(() => {});
        } else {
          clearStoredUserSession();
          setIsLoggedIn(false);
          setCurrentUser(null);
        }
      }
    } catch (e) {
      console.error("Failed to restore session", e);
    }

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  const startCooldown = (seconds = 10) => {
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

  // Send OTP handler
  const handleSendOtp = async () => {
    clearMessages();
    const cleanPhone = regPhone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length !== 10) {
      setErrorMessage("Please enter a valid 10-digit Indian mobile number");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.cooldownRemaining) {
          startCooldown(data.cooldownRemaining);
        }
        if (data.exists) {
          setErrorMessage(data.error || "Account already exists. Please log in.");
          setIsRegister(false);
          setLoginIdentifier(cleanPhone);
          return;
        }
        throw new Error(data.error || "Failed to send OTP");
      }
      setInfoMessage("Verification code sent to your mobile number");
      startCooldown(10);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  // Register form submit (Free account creation)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!regPhone || regPhone.length !== 10) {
      setErrorMessage("Please enter a valid 10-digit mobile number");
      return;
    }
    if (!regOtp || regOtp.length !== 6) {
      setErrorMessage("Please enter the 6-digit OTP");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/auth/register-with-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: regPhone,
          otp: regOtp,
          password: regPassword,
          name: regName || undefined,
          email: regEmail || undefined,
          joinCode: regInviteCode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");

      const userObj: StoredUserData = {
        id: data.user?.id,
        name: data.user?.name || regName || "Customer",
        phone: data.user?.phone || regPhone,
        email: data.user?.email || regEmail,
        address: data.user?.address,
        pincode: data.user?.pincode,
        units: data.user?.units,
        orderStatus: data.user?.orderStatus,
        assignedDevices: data.user?.assignedDevices || [],
      };

      localStorage.setItem("smartbox_logged_in", "true");
      localStorage.setItem("smartbox_user", userObj.name || "Customer");
      localStorage.setItem("smartbox_user_data", JSON.stringify(userObj));
      if (data.token) localStorage.setItem("smartbox_token", data.token);
      if (data.refreshToken) localStorage.setItem("smartbox_refresh_token", data.refreshToken);

      setCurrentUser(userObj);
      setIsLoggedIn(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  // Login form submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setErrorMessage("Please enter your mobile/email and password");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: loginIdentifier.trim(),
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Incorrect credentials");

      const userObj: StoredUserData = {
        id: data.user?.id,
        name: data.user?.name || "Customer",
        phone: data.user?.phone,
        email: data.user?.email,
        address: data.user?.address,
        pincode: data.user?.pincode,
        units: data.user?.units,
        orderStatus: data.user?.orderStatus,
        assignedDevices: data.user?.assignedDevices || [],
      };

      localStorage.setItem("smartbox_logged_in", "true");
      localStorage.setItem("smartbox_user", userObj.name || "Customer");
      localStorage.setItem("smartbox_user_data", JSON.stringify(userObj));
      if (data.token) localStorage.setItem("smartbox_token", data.token);
      if (data.refreshToken) localStorage.setItem("smartbox_refresh_token", data.refreshToken);

      setCurrentUser(userObj);
      setIsLoggedIn(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    const refreshToken = localStorage.getItem("smartbox_refresh_token");
    if (refreshToken) {
      userFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
    clearStoredUserSession();
    setIsLoggedIn(false);
    setIsOrdering(false);
    setIsForgotPassword(false);
    setCurrentUser(null);
    setStep(1);
    setLoginIdentifier("");
    setLoginPassword("");
    setRegName("");
    setRegEmail("");
    setRegPhone("");
    setRegOtp("");
    setRegPassword("");
    setRegConfirmPassword("");
    setRegInviteCode("");
    clearMessages();
  };

  if (isLoggedIn) {
    if (isOrdering) {
      return (
        <OrderView
          apiUrl={apiUrl}
          currentUser={currentUser}
          onOrderComplete={(updated) => {
            setCurrentUser(updated);
            setIsOrdering(false);
          }}
          onCancel={() => {
            setIsOrdering(false);
          }}
        />
      );
    }

    return (
      <DeliveryManifest
        currentUser={currentUser}
        onLogout={handleLogout}
        onStartOrder={() => {
          setIsOrdering(true);
          clearMessages();
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full h-full font-sans p-1 sm:p-2 relative">
      {errorMessage && (
        <div className="absolute top-2 left-4 right-4 z-40 bg-rose-50 border border-rose-600/30 text-rose-800 p-2 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="truncate">{errorMessage}</span>
        </div>
      )}

      {infoMessage && (
        <div className="absolute top-2 left-4 right-4 z-40 bg-emerald-50 border border-emerald-600/30 text-emerald-800 p-2 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="truncate">{infoMessage}</span>
        </div>
      )}

      {isForgotPassword ? (
        <ForgotPasswordView
          onSwitchToLogin={() => {
            setIsForgotPassword(false);
            clearMessages();
          }}
          onSuccess={(msg) => {
            setErrorMessage(null);
            setInfoMessage(msg);
          }}
          onResetComplete={(msg, phone) => {
            setErrorMessage(null);
            setInfoMessage(msg);
            if (phone) setLoginIdentifier(phone);
            setIsForgotPassword(false);
          }}
          onError={(err) => {
            setInfoMessage(null);
            setErrorMessage(err);
          }}
        />
      ) : isRegister ? (
        <RegisterWizard
          step={step}
          onSetStep={setStep}
          name={regName}
          onNameChange={setRegName}
          email={regEmail}
          onEmailChange={setRegEmail}
          phone={regPhone}
          onPhoneChange={setRegPhone}
          otp={regOtp}
          onOtpChange={setRegOtp}
          password={regPassword}
          onPasswordChange={setRegPassword}
          confirmPassword={regConfirmPassword}
          onConfirmPasswordChange={setRegConfirmPassword}
          inviteCode={regInviteCode}
          onInviteCodeChange={setRegInviteCode}
          otpCooldown={otpCooldown}
          loading={loading}
          onSendOtp={handleSendOtp}
          onSubmit={handleRegisterSubmit}
          onSwitchToLogin={() => {
            setIsRegister(false);
            setIsForgotPassword(false);
            clearMessages();
          }}
        />
      ) : (
        <LoginForm
          identifier={loginIdentifier}
          onIdentifierChange={setLoginIdentifier}
          password={loginPassword}
          onPasswordChange={setLoginPassword}
          loading={loading}
          onSubmit={handleLoginSubmit}
          onSwitchToRegister={() => {
            setIsRegister(true);
            setIsForgotPassword(false);
            setStep(1);
            clearMessages();
          }}
          onForgotPassword={() => {
            setIsForgotPassword(true);
            clearMessages();
          }}
        />
      )}
    </div>
  );
}
