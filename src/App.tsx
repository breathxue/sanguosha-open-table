import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from './shared/types';
import { Brand } from './client/components/Brand';
import { GameScreen } from './client/components/GameScreen';
import { HomeScreen } from './client/components/HomeScreen';
import { Icon } from './client/components/Icons';
import { LobbyScreen } from './client/components/LobbyScreen';
import { ToastStack } from './client/components/ToastStack';
import { clearSession, loadSession, saveSession } from './client/session';
import type { ToastItem, ToastTone } from './client/types';
import { useRoomSocket } from './client/useRoomSocket';
import { cx } from './client/utils';

function initialSession(): Session | null {
  const stored = loadSession();
  if (!stored) return null;
  const urlRoom = (new URLSearchParams(window.location.search).get('room') ?? '')
    .trim()
    .toUpperCase();
  if (urlRoom && urlRoom !== stored.roomCode) {
    clearSession();
    return null;
  }
  return stored;
}

function setRoomInUrl(code: string | null): void {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  window.history.replaceState(null, '', url.toString());
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => initialSession());
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);
  const timersRef = useRef<Map<number, number>>(new Map());

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) window.clearTimeout(timer);
    timersRef.current.delete(id);
  }, []);

  const notify = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = ++toastIdRef.current;
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      const timer = window.setTimeout(
        () => {
          setToasts((current) => current.filter((item) => item.id !== id));
          timersRef.current.delete(id);
        },
        tone === 'error' ? 5200 : 3400,
      );
      timersRef.current.set(id, timer);
    },
    [],
  );

  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) window.clearTimeout(timer);
      timersRef.current.clear();
    },
    [],
  );

  const handleAuthFailure = useCallback(
    (message: string) => {
      clearSession();
      setSession(null);
      notify(message, 'error');
    },
    [notify],
  );

  const { state, status, send } = useRoomSocket(session, {
    onAuthFailure: handleAuthFailure,
    onError: (message) => notify(message, 'error'),
  });

  const enterRoom = useCallback((next: Session) => {
    saveSession(next);
    setSession(next);
    setRoomInUrl(next.roomCode);
  }, []);

  const leaveRoom = useCallback(() => {
    if (status === 'online') send({ type: 'leave' });
    clearSession();
    setSession(null);
    setRoomInUrl(null);
    notify('已离开牌桌', 'success');
  }, [notify, send, status]);

  return (
    <>
      {!session ? (
        <HomeScreen onEnter={enterRoom} notify={notify} />
      ) : !state ? (
        <ConnectingScreen
          session={session}
          status={status}
          onBack={() => {
            clearSession();
            setSession(null);
            setRoomInUrl(null);
          }}
        />
      ) : state.phase === 'lobby' ? (
        <LobbyScreen
          state={state}
          status={status}
          send={send}
          onLeave={leaveRoom}
          notify={notify}
        />
      ) : (
        <GameScreen
          state={state}
          status={status}
          send={send}
          onLeave={leaveRoom}
          notify={notify}
        />
      )}
      <ToastStack items={toasts} onDismiss={dismissToast} />
    </>
  );
}

interface ConnectingScreenProps {
  session: Session;
  status: 'idle' | 'connecting' | 'online' | 'offline' | 'unauthorized';
  onBack: () => void;
}

function ConnectingScreen({ session, status, onBack }: ConnectingScreenProps) {
  const offline = status === 'offline';
  return (
    <div className="connecting-screen">
      <div className="connecting-glow" aria-hidden="true" />
      <Brand />
      <div className={cx('connecting-card', offline && 'is-offline')}>
        <span className={cx('connecting-spinner', offline && 'is-offline')}>
          {offline ? <Icon name="wifi-off" size={22} /> : <span />}
        </span>
        <h1>{offline ? '正在回到牌桌' : '正在连接牌桌'}</h1>
        <p>
          房间 <strong>{session.roomCode}</strong>
          <br />
          {offline ? '网络似乎断开了，正在自动重试…' : '正在恢复你的座位和牌局…'}
        </p>
        <div className="connecting-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <button type="button" className="ghost-button" onClick={onBack}>
          返回首页
        </button>
      </div>
      <p className="connecting-foot">如果房间已经结束，会自动返回首页。</p>
    </div>
  );
}
