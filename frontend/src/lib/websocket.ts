'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export function useShipmentWebSocket(shipmentId: string | number, onMessage?: (data: any) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!shipmentId) return;
    const wsUrl = `ws://127.0.0.1:8000/ws/shipments/${shipmentId}`;
    
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
          if (onMessage) onMessage(data);
        } catch {
          // Non-json ping/pong message
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        // Retry connection after 3 seconds
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
  }, [shipmentId, onMessage]);

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

  const connect = useCallback(() => {
    const wsUrl = `ws://127.0.0.1:8000/ws/dashboard`;
    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => setIsConnected(true);
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessage) onMessage(data);
        } catch {}
      };
      socket.onclose = () => {
        setIsConnected(false);
        setTimeout(() => connect(), 3000);
      };
      socket.onerror = () => socket.close();
    } catch {
      setIsConnected(false);
    }
  }, [onMessage]);

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
