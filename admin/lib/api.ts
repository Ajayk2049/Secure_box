let refreshPromise: Promise<string | null> | null = null;

async function getRefreshedToken(apiUrl: string): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    if (typeof window === "undefined") return null;
    const refreshToken = localStorage.getItem("admin_refresh_token");
    if (!refreshToken) return null;

    try {
      const refreshRes = await fetch(`${apiUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        if (refreshData.token) {
          localStorage.setItem("admin_token", refreshData.token);
          if (refreshData.refreshToken) {
            localStorage.setItem("admin_refresh_token", refreshData.refreshToken);
          }
          return refreshData.token as string;
        }
      }

      // If refresh token is expired or revoked in database, clear session
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_refresh_token");
      localStorage.removeItem("admin_user");
      return null;
    } catch (err) {
      console.error("Token rotation network error:", err);
      return null;
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
  let token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith("http") ? endpoint : `${apiUrl}${cleanEndpoint}`;
  let response = await fetch(url, { ...options, headers });

  // If 401 Unauthorized, attempt to rotate refresh token seamlessly and retry once
  if (response.status === 401 && typeof window !== "undefined" && !endpoint.includes("/auth/refresh")) {
    const newToken = await getRefreshedToken(apiUrl);
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      response = await fetch(url, { ...options, headers });
    }
  }

  return response;
}
