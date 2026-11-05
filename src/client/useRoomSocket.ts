import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, ServerMessage, Session, TableState } from '../shared/types';

export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'offline' | 'unauthorized';

interface SocketOptions {
  onAuthFailure: (message: string) => void;
  onError: (message: string) => void;
}

interface SocketApi {
  state: TableState | null;
  status: ConnectionStatus;
  send: (message: ClientMessage) => boolean;
}

export function useRoomSocket(session: Session | null, options: SocketOptions): SocketApi {
  const [state, setState] = useState<TableState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const socketRef = useRef<WebSocket | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!session) {
      setState(null);
      setStatus('idle');
      return;
    }

    let disposed = false;
    let retryCount = 0;
    let retryTimer: number | undefined;
    let pingTimer: number | undefined;
    let socket: WebSocket | null = null;
    let fatal = false;

    setState(null);
    setStatus('connecting');

    const connect = () => {
      if (disposed || fatal) return;
      setStatus((current) => (current === 'online' ? current : 'connecting'));

      const url = new URL('/ws', window.location.href);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.searchParams.set('room', session.roomCode);
      url.searchParams.set('token', session.token);

      const current = new WebSocket(url.toString());
      socket = current;
      socketRef.current = current;

      current.onopen = () => {
        if (disposed) {
          current.close(1000, 'disposed');
          return;
        }
        retryCount = 0;
        setStatus('online');
      };

      current.onmessage = (event) => {
        if (disposed) return;
        let message: ServerMessage;
        try {
          message = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          return;
        }
        if (message.type === 'state') {
          setState(message.state);
          setStatus('online');
        } else if (message.type === 'error') {
          optionsRef.current.onError(message.message);
        }
      };

      current.onclose = (event) => {
        if (disposed) return;
        if (socketRef.current === current) socketRef.current = null;
        socket = null;

        if (event.code === 4001 || event.code === 4003 || event.code === 4004) {
          fatal = true;
          setStatus('unauthorized');
          const message =
            event.code === 4004
              ? '房间已经结束'
              : event.code === 4001
                ? '你已经离开了牌桌'
                : '座位凭证已失效，请重新加入房间';
          optionsRef.current.onAuthFailure(message);
          return;
        }

        setStatus('offline');
        retryCount += 1;
        const delay = Math.min(800 * 2 ** Math.min(retryCount - 1, 4), 10_000);
        retryTimer = window.setTimeout(connect, delay);
      };

      current.onerror = () => {
        // The close handler schedules the retry.
      };
    };

    connect();

    pingTimer = window.setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' } satisfies ClientMessage));
      }
    }, 25_000);

    const handleOnline = () => {
      if (socket?.readyState === WebSocket.OPEN) return;
      if (retryTimer) window.clearTimeout(retryTimer);
      retryCount = 0;
      connect();
    };

    const handleOffline = () => {
      if (socket?.readyState === WebSocket.OPEN) socket.close();
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (pingTimer) window.clearInterval(pingTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (socket) {
        socket.onclose = null;
        socket.close(1000, 'leaving page');
      }
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [session]);

  const send = useCallback((message: ClientMessage): boolean => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      optionsRef.current.onError('连接尚未恢复，请稍后再试');
      return false;
    }
    try {
      socket.send(JSON.stringify(message));
      return true;
    } catch {
      optionsRef.current.onError('发送失败，请检查网络连接');
      return false;
    }
  }, []);

  return { state, status, send };
}
