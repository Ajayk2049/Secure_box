let refreshPromise: Promise<boolean> | null = null;

async function refreshAdminSession(apiUrl: string): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    if (typeof window === "undefined") return false;

    try {
      // Browser automatically sends httpOnly admin_refresh_token cookie via credentials: "include"
      const refreshRes = await fetch(`${apiUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (refreshRes.ok) {
        return true;
      }

      // If refresh token is expired or revoked in database, clear user display cache
      localStorage.removeItem("admin_user");
      return false;
    } catch (err) {
      console.error("Session refresh network error:", err);
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function getApiUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!envUrl) {
    throw new Error("[Configuration Error] NEXT_PUBLIC_API_URL must be defined in environment configuration (.env)");
  }

  if (typeof window !== "undefined") {
    try {
      const parsed = new URL(envUrl);
      const currentHost = window.location.hostname;
      if (
        (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
        currentHost !== "localhost" &&
        currentHost !== "127.0.0.1"
      ) {
        const portPart = parsed.port ? `:${parsed.port}` : "";
        return `${window.location.protocol}//${currentHost}${portPart}${parsed.pathname}`;
      }
    } catch {
      // If unparseable URL, return raw envUrl
    }
  }

  return envUrl;
}

export function getBackendBaseUrl(): string {
  return getApiUrl().replace(/\/api\/?$/, "");
}

export async function adminFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const apiUrl = getApiUrl();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: "include", // Strictly transmit httpOnly session cookies across ports
  };

  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith("http") ? endpoint : `${apiUrl}${cleanEndpoint}`;
  let response = await fetch(url, fetchOptions);

  // If 401 Unauthorized, attempt to rotate refresh token seamlessly and retry once
  if (response.status === 401 && typeof window !== "undefined" && !endpoint.includes("/auth/refresh")) {
    const refreshed = await refreshAdminSession(apiUrl);
    if (refreshed) {
      response = await fetch(url, fetchOptions);
    }
  }

  return response;
}

export async function rotateDeviceKey(
  deviceId: string
): Promise<{ success: boolean; deviceKey: string; message: string; deviceId: string }> {
  const res = await adminFetch(`/admin/devices/${encodeURIComponent(deviceId)}/rotate-key`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to rotate device key");
  }
  return data;
}
