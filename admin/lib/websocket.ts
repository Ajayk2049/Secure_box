import { getBackendBaseUrl } from "./api";

type MessageHandler = (data: any) => void;

class AdminWebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Set<MessageHandler> = new Set();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;

  public connect(): void {
    if (typeof window === "undefined") return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (this.isConnecting) return;

    const token = localStorage.getItem("admin_token");
    if (!token) return;

    this.isConnecting = true;
    try {
      const baseUrl = getBackendBaseUrl();
      const wsUrl = baseUrl.replace(/^http/, "ws") + `/ws?token=${encodeURIComponent(token)}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        console.log("[ADMIN-WS] Connected to backend real-time stream");
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "PONG") return;
          this.listeners.forEach((handler) => {
            try {
              handler(data);
            } catch (err) {
              console.error("[ADMIN-WS] Handler error:", err);
            }
          });
        } catch {
          // Non-JSON frame
        }
      };

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        this.ws = null;
        if (event.code === 4401) {
          console.warn("[ADMIN-WS] Connection rejected: Token expired or invalid");
          return;
        }
        // Auto-reconnect after 3 seconds
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
        try {
          this.ws?.close();
        } catch {}
      };
    } catch (err) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  public subscribe(handler: MessageHandler): () => void {
    this.listeners.add(handler);
    this.connect();
    return () => {
      this.listeners.delete(handler);
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.isConnecting = false;
  }
}

export const adminWs = new AdminWebSocketClient();
