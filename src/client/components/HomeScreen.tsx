import { useState, type FormEvent } from 'react';
import type { Session } from '../../shared/types';
import { createRoom, joinRoom } from '../api';
import { loadNickname, saveNickname } from '../session';
import { cx } from '../utils';
import type { ToastTone } from '../types';
import { Brand } from './Brand';
import { Icon } from './Icons';
import { PlayingCard } from './PlayingCard';

interface HomeScreenProps {
  onEnter: (session: Session) => void;
  notify: (message: string, tone?: ToastTone) => void;
}

type Mode = 'create' | 'join';

function linkedRoomCode(): string {
  const code = new URLSearchParams(window.location.search).get('room') ?? '';
  return code.trim().toUpperCase().slice(0, 5);
}

const DEMO_GENERAL = {
  id: 'demo-general',
  deck: 'general' as const,
  name: '诸葛亮',
  category: 'general' as const,
  kingdom: '蜀' as const,
  hp: 3,
};

const DEMO_SHA = {
  id: 'demo-sha',
  deck: 'normal' as const,
  name: '杀',
  category: 'basic' as const,
  suit: 'spade' as const,
  rank: '7',
};

const DEMO_SHAN = {
  id: 'demo-shan',
  deck: 'normal' as const,
  name: '闪',
  category: 'basic' as const,
  suit: 'heart' as const,
  rank: 'Q',
};

const FEATURES = [
  {
    icon: 'cards' as const,
    title: '双牌堆',
    text: '武将牌与普通牌各自成堆，随时洗乱、倒扣。',
  },
  {
    icon: 'move' as const,
    title: '任意搬运',
    text: '任何区域的牌，都可以拖到任何区域，不判规则。',
  },
  {
    icon: 'eye' as const,
    title: '手牌保密',
    text: '只有本人能看见自己的手牌，其余区域公开。',
  },
  {
    icon: 'wifi' as const,
    title: '即时同桌',
    text: '断线可回到原座位，所有操作实时同步。',
  },
];

export function HomeScreen({ onEnter, notify }: HomeScreenProps) {
  const initialCode = linkedRoomCode();
  const [mode, setMode] = useState<Mode>(initialCode ? 'join' : 'create');
  const [nickname, setNickname] = useState(loadNickname);
  const [joinCode, setJoinCode] = useState(initialCode);
  const [createCode, setCreateCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const enter = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    const name = nickname.trim();
    if (!name) {
      setError('先给自己取一个名字');
      return;
    }
    if (mode === 'join' && joinCode.length !== 5) {
      setError('请输入 5 位房间号');
      return;
    }
    if (mode === 'create' && createCode.length > 0 && createCode.length !== 5) {
      setError('自定义房间号需要是 5 位字母或数字');
      return;
    }

    setLoading(true);
    setError('');
    saveNickname(name);
    try {
      if (mode === 'create') {
        const session = await createRoom(name, createCode || undefined);
        onEnter(session);
      } else {
        const session = await joinRoom(joinCode, name);
        if (session.created) {
          notify('这个房间还不存在，已直接用该房间号创建新牌桌', 'success');
        }
        onEnter(session);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '操作失败，请稍后再试';
      setError(message);
      notify(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-screen">
      <div className="home-glow home-glow--one" aria-hidden="true" />
      <div className="home-glow home-glow--two" aria-hidden="true" />
      <div className="home-grain" aria-hidden="true" />

      <header className="home-header">
        <Brand />
        <span className="home-header-note">
          <Icon name="scale" size={15} />
          只同步，不判规则
        </span>
      </header>

      <main className="home-main">
        <section className="hero-copy">
          <span className="eyebrow">
            <span className="eyebrow-line" />
            线上私人牌桌
          </span>
          <h1>
            把牌桌
            <br />
            搬到<span>线上</span>
          </h1>
          <p className="hero-lead">
            想玩线下三国杀，却总凑不齐人？
            <br />
            开一桌，把你们自己的规则原封不动搬上来。
          </p>
          <p className="hero-note">
            服务器只负责同步动作。怎么出牌、怎么判定、谁欠谁一张桃——都由你们说了算。
          </p>

          <div className="hero-features">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="feature-item">
                <span className="feature-icon">
                  <Icon name={feature.icon} size={17} />
                </span>
                <div>
                  <strong>{feature.title}</strong>
                  <span>{feature.text}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="home-entry" aria-label="进入牌桌">
          <div className="hero-cards" aria-hidden="true">
            <PlayingCard card={DEMO_SHAN} size="lg" className="hero-card hero-card--one" />
            <PlayingCard card={DEMO_GENERAL} size="lg" className="hero-card hero-card--two" />
            <PlayingCard card={DEMO_SHA} size="lg" className="hero-card hero-card--three" />
            <div className="hero-card-shadow" />
          </div>

          <div className="entry-card">
            <div className="entry-head">
              <span className="entry-kicker">入席</span>
              <h2>{mode === 'create' ? '开一桌新的' : '加入朋友的牌桌'}</h2>
              <p>
                {mode === 'create'
                  ? '可以自定义 5 位房间号；留空则由系统生成。创建后把房间号或链接发给朋友。'
                  : '输入 5 位房间号。如果这个房间还不存在，会直接用该号码创建牌桌。'}
              </p>
            </div>

            <div className="mode-tabs" role="tablist" aria-label="创建或加入">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'create'}
                className={cx(mode === 'create' && 'is-active')}
                onClick={() => {
                  setMode('create');
                  setError('');
                }}
              >
                创建牌桌
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'join'}
                className={cx(mode === 'join' && 'is-active')}
                onClick={() => {
                  setMode('join');
                  setError('');
                }}
              >
                加入牌桌
              </button>
            </div>

            {initialCode && mode === 'join' ? (
              <div className="invite-hint">
                <span className="invite-hint-dot" />
                你收到了房间 <strong>{initialCode}</strong> 的邀请
              </div>
            ) : null}

            <form className="entry-form" onSubmit={enter}>
              <label className="field">
                <span className="field-label">你的称呼</span>
                <input
                  type="text"
                  value={nickname}
                  onChange={(event) => {
                    setNickname(event.target.value);
                    setError('');
                  }}
                  placeholder="例如：老张"
                  maxLength={12}
                  autoComplete="nickname"
                  autoFocus={!initialCode}
                />
              </label>

              {mode === 'create' ? (
                <label className="field">
                  <span className="field-label">房间号（可选）</span>
                  <input
                    type="text"
                    className="room-code-input room-code-input--optional"
                    value={createCode}
                    onChange={(event) => {
                      setCreateCode(
                        event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, '')
                          .slice(0, 5),
                      );
                      setError('');
                    }}
                    placeholder="留空自动生成"
                    maxLength={5}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                  <span className="field-hint">自定义 5 位房间号，方便朋友直接输入；留空则随机生成。</span>
                </label>
              ) : (
                <label className="field">
                  <span className="field-label">房间号</span>
                  <input
                    type="text"
                    className="room-code-input"
                    value={joinCode}
                    onChange={(event) => {
                      setJoinCode(
                        event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, '')
                          .slice(0, 5),
                      );
                      setError('');
                    }}
                    placeholder="ABCDE"
                    maxLength={5}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    autoFocus={Boolean(initialCode)}
                  />
                  <span className="field-hint">房间不存在也没关系：会直接用这个房间号创建新牌桌。</span>
                </label>
              )}

              {error ? (
                <p className="form-error" role="alert">
                  <Icon name="alert" size={15} />
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="primary-button entry-submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="button-spinner" />
                    {mode === 'create' ? '正在铺桌…' : '正在入座…'}
                  </>
                ) : (
                  <>
                    {mode === 'create' ? '开一桌' : '入座'}
                    <Icon name="arrow-right" size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="entry-foot">
              <Icon name="spark" size={14} />
              这是一张无规则牌桌：没有裁判，也没有“不能这样出”。
            </div>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <span>三国杀 · 自由牌桌</span>
        <span className="footer-dot" />
        <span>服务器只做同步</span>
        <span className="footer-dot" />
        <span>v0.1 MVP</span>
      </footer>
    </div>
  );
}
