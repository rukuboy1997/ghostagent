import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { getApiUrl } from "@/lib/api";

const RECONNECT_DELAY_MS = 8000;

export function useNotifications() {
  const { getToken, isSignedIn } = useAuth();
  const [permission, setPermission] = useState(() =>
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [connected, setConnected] = useState(false);
  const [lastSignal, setLastSignal] = useState(null);
  const esRef = useRef(null);
  const reconnectTimer = useRef(null);
  const activeRef = useRef(false);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "denied";
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const showDesktopNotification = useCallback((payload, currentPermission) => {
    if (currentPermission !== "granted") return;
    const dirEmoji = payload.decision === "BUY" ? "📈" : "📉";
    const decimals = payload.symbol?.includes("JPY") ? 3 : payload.symbol?.includes("XAU") || payload.symbol?.includes("BTC") ? 2 : 5;
    try {
      const n = new Notification(`${dirEmoji} GhostAgent: ${payload.decision} ${payload.symbol}`, {
        body: [
          `Confidence: ${payload.confidence}%  |  Confluence: ${payload.confluenceScore}/8`,
          `Entry: ${Number(payload.entryPrice || 0).toFixed(decimals)}`,
          `TP: ${Number(payload.takeProfit || 0).toFixed(decimals)}  |  SL: ${Number(payload.stopLoss || 0).toFixed(decimals)}`,
          payload.session ? `Session: ${payload.session}` : "",
        ].filter(Boolean).join("\n"),
        icon: "/favicon.ico",
        tag: `ga-signal-${payload.symbol}-${Date.now()}`,
        requireInteraction: true,
      });
      n.onclick = () => { window.focus(); n.close(); };
      setTimeout(() => n.close(), 20000);
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;

    activeRef.current = true;

    async function connect() {
      if (!activeRef.current) return;
      try {
        // Step 1: exchange Clerk JWT for short-lived SSE nonce
        const jwt = await getToken();
        if (!jwt || !activeRef.current) return;

        const tokenRes = await fetch(getApiUrl("/api/notifications/token"), {
          method: "POST",
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (!tokenRes.ok || !activeRef.current) return;
        const { token } = await tokenRes.json();
        if (!token || !activeRef.current) return;

        // Step 2: open SSE stream with the nonce
        const streamUrl = `${getApiUrl("/api/notifications/stream")}?token=${encodeURIComponent(token)}`;
        const es = new EventSource(streamUrl);
        esRef.current = es;

        es.onopen = () => { if (activeRef.current) setConnected(true); };

        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === "signal") {
              setLastSignal(data);
              // Read permission fresh from Notification API at time of event
              const perm = typeof Notification !== "undefined" ? Notification.permission : "default";
              setPermission(perm);
              showDesktopNotification(data, perm);
            }
          } catch (_) {}
        };

        es.onerror = () => {
          es.close();
          if (activeRef.current) {
            setConnected(false);
            reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
          }
        };
      } catch (_) {
        if (activeRef.current) {
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      }
    }

    connect();

    return () => {
      activeRef.current = false;
      clearTimeout(reconnectTimer.current);
      esRef.current?.close();
      setConnected(false);
    };
  }, [isSignedIn, getToken, showDesktopNotification]);

  return { permission, connected, lastSignal, requestPermission };
}
