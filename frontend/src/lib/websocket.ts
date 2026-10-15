'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const getWsBaseUrl = () => {
  if (typeof window === 'undefined') return 'ws://127.0.0.1:8000';
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname || '127.0.0.1';
  return `${protocol}//${host}:8000`;
};

export function useShipmentWebSocket(shipmentId: string | number, onMessage?: (data: any) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (!shipmentId) return;
    const wsUrl = `${getWsBaseUrl()}/ws/shipments/${shipmentId}`;
    
    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          if (onMessageRef.current) onMessageRef.current(data);
        } catch {
          // Non-json ping/pong message
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        // Retry connection after 3 seconds with auto-reconnect if still active
        setTimeout(() => {
          if (wsRef.current === socket) {
            connect();
          }
        }, 3000);
      };

      socket.onerror = () => {
        socket.close();
      };
    } catch {
      setIsConnected(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { isConnected, lastMessage };
}

export function useDashboardWebSocket(onMessage?: (data: any) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    const wsUrl = `${getWsBaseUrl()}/ws/dashboard`;
    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => setIsConnected(true);
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessageRef.current) onMessageRef.current(data);
        } catch {}
      };
      socket.onclose = () => {
        setIsConnected(false);
        setTimeout(() => {
          if (wsRef.current === socket) {
            connect();
          }
        }, 3000);
      };
      socket.onerror = () => socket.close();
    } catch {
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { isConnected };
}
