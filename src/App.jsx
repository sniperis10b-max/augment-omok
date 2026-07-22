import { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import {
  Skull, FlaskConical, ArrowLeftRight, Layers, Move, ShieldCheck, Ban, ShieldAlert,
  Minimize2, Trophy, Repeat2, Snowflake, Biohazard, Bomb, Undo2, History, Shuffle,
  Unlock, KeyRound, SeparatorHorizontal, Sprout, ShieldOff, Sparkles, Target, Dices,
  HandMetal, ShieldPlus, CircleDot, VolumeX, Bot, Users, ChevronLeft, Copy, Check, Wifi,
  BookOpen, ChevronRight, Settings, Sun, Moon, Volume2, Eye, MessageCircle, Send, RotateCcw,
} from 'lucide-react';
import { BOARD_SIZE, otherPlayer } from './gameLogic.js';
import { gameReducer, createInitialState, isBlocked, BLACK, WHITE, WILD, FREE_ACTION } from './gameReducer.js';
import { getCardById, CARDS } from './cards.js';
import { decideAIAction, pickDraftCard, chooseBestCell, computeAITarget, DIFFICULTIES } from './ai.js';
import {
  createRoom, joinRoom, subscribeRoom, pushGameState, leaveRoom, isFirebaseConfigured,
  sendChatMessage, subscribeChat,
} from './network.js';
import { loadSettings, saveSettings } from './settings.js';
import { sounds, setSoundEnabled } from './sound.js';
import { loadRecords, saveRecord, deleteRecord } from './records.js';

const ICONS = {
  Skull, FlaskConical, ArrowLeftRight, Layers, Move, ShieldCheck, Ban, ShieldAlert,
  Minimize2, Trophy, Repeat2, Snowflake, Biohazard, Bomb, Undo2, History, Shuffle,
  Unlock, KeyRound, SeparatorHorizontal, Sprout, ShieldOff, Sparkles, Target, Dices,
  HandMetal, ShieldPlus, CircleDot, VolumeX,
};

function CardIcon({ name, size = 18 }) {
  const Icon = ICONS[name];
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={1.8} />;
}

const PLAYER_LABEL = { [BLACK]: '흑', [WHITE]: '백' };

const TUTORIAL_PAGES = [
  {
    title: '기본 목표',
    body: [
      '15x15 판의 교차점에 번갈아 돌을 놓아요.',
      '가로, 세로, 대각선 중 어느 방향으로든 내 돌 5개를 먼저 연결하면 승리해요.',
      '흑(선공)이 먼저 시작해요.',
    ],
  },
  {
    title: '렌주 금수 규칙 (흑만 해당)',
    body: [
      '선공인 흑에게는 유리함을 상쇄하기 위한 제약이 있어요.',
      '3-3(열린 삼 두 개를 동시에 만드는 수), 4-4(사 두 개를 동시에 만드는 수), 육목(6개 이상 연속)은 흑이 둘 수 없어요.',
      '백은 이런 제약이 전혀 없어요.',
      '"3-3 해제", "4-4 허용" 카드로 이 규칙을 일시적으로 없앨 수도 있어요.',
    ],
  },
  {
    title: '카드 드래프트',
    body: [
      '게임 시작 전, 3장의 카드 중 1장을 고르는 걸 흑과 백이 번갈아 진행해요.',
      '1인당 카드 개수는 설정에서 바꿀 수 있어요 (기본 3장, 원하는 장수로 직접 지정 가능).',
      '내 차례가 아닐 때도 상대가 고르는 3장의 보기가 그대로 보이고, 상대가 고르면 어떤 카드를 선택했는지 잠깐 알려줘요.',
      '카드 목록에 마우스를 올리면(모바일은 손가락으로 눌러보면) 효과 설명이 떠요.',
    ],
  },
  {
    title: '카드 사용법',
    body: [
      '카드는 손패에서 클릭하면 발동돼요. 1회용이라 쓰고 나면 사라져요.',
      '일부 카드는 대상(돌이나 칸)을 선택해야 해요 — 카드를 누른 뒤 판 위를 클릭하세요.',
      '파괴·오염·돌 이동처럼 "내 쪽 준비 동작"에 가까운 카드는 턴을 넘기지 않고, 이어서 돌을 놓거나 다른 카드를 더 쓸 수 있어요.',
      '연금술·위치 교환·관통 같은 카드는 상대 판에 직접 개입하는 확실한 "수"라서 턴이 넘어가요.',
      '"도발" 카드로 만든 강제 착수 영역은 해당 플레이어 차례일 때 판 위에 주황색으로 표시돼요.',
      '카드를 쓰면 화면 중앙에 잠깐 그 카드가 떠서 무슨 카드를 썼는지 서로 알 수 있어요.',
    ],
  },
  {
    title: '대국 모드와 AI 난이도',
    body: [
      '2인이서 대국: 한 화면에서 번갈아 플레이해요.',
      'AI와 대국: 내가 할 색을 고르고, 쉬움·보통·어려움·지옥·불가능 5단계 중 난이도를 골라요. 지옥/불가능은 상대 응수까지 미리 내다보고 두는 강한 AI예요.',
      '친구와 플레이(온라인): 방을 만들면 6자리 코드가 생겨요. 친구가 그 코드로 참가하면 실시간으로 대국할 수 있어요.',
    ],
  },
  {
    title: '온라인 기능',
    body: [
      '이미 대국이 진행 중인 방에 코드를 입력하면 관전자로 참가돼요 (돌을 놓을 순 없지만 다 볼 수 있어요).',
      '원래 쓰던 기기로 같은 코드를 다시 입력하면(새로고침, 연결 끊김 등) 관전자가 아니라 내 색 그대로 재접속돼요.',
      '온라인 대국 중에는 화면 하단에 채팅창이 있어서 상대와 메시지를 주고받을 수 있어요.',
    ],
  },
  {
    title: '설정',
    body: [
      '시작 화면 오른쪽 위 톱니바퀴 아이콘에서 화면 테마(밝게/어둡게), 효과음 on/off, 한 수당 제한 시간, 1인당 카드 개수를 한 번에 설정할 수 있어요.',
      '시간제한을 켜두면 대국 화면에 남은 시간이 표시되고, 다 되면 돌을 놓지 못한 채로 턴만 상대에게 넘어가요.',
      '게임 화면 오른쪽 위에서도 테마와 효과음은 바로 켜고 끌 수 있어요.',
    ],
  },
  {
    title: '기보 다시보기',
    body: [
      '대국이 끝나면 자동으로 기보(경기 기록)가 저장돼요.',
      '시작 화면의 "기보 보기"에서 지난 대국 목록을 보고, 슬라이더로 한 수씩 다시 재생해볼 수 있어요.',
    ],
  },
];

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, null, createInitialState);
  const [online, setOnline] = useState(null); // null | { code, localColor, role: 'host'|'guest'|'spectator' }
  const [settings, setSettingsState] = useState(() => loadSettings());
  const pendingLocalRef = useRef(false);
  const gameStartedRef = useRef(false);
  const recordSavedRef = useRef(false);
  const prevRef = useRef({ stoneCount: 0, handTotal: 0, phase: 'setup', message: '' });
  const prevLastUsedRef = useRef({ [BLACK]: null, [WHITE]: null });
  const [cardOverlay, setCardOverlay] = useState(null);

  // 카드가 사용될 때마다(어느 쪽이든) 화면 중앙에 잠깐 띄워줘요
  useEffect(() => {
    if (!state.lastUsedCard) return;
    const prev = prevLastUsedRef.current;
    for (const p of [BLACK, WHITE]) {
      const cur = state.lastUsedCard[p];
      if (cur && cur !== prev[p]) {
        const card = getCardById(cur);
        if (card) setCardOverlay({ player: p, card, key: Date.now() });
      }
    }
    prevLastUsedRef.current = { ...state.lastUsedCard };
  }, [state.lastUsedCard]);

  useEffect(() => {
    if (!cardOverlay) return undefined;
    const t = setTimeout(() => setCardOverlay(null), 1000);
    return () => clearTimeout(t);
  }, [cardOverlay]);

  const updateSettings = useCallback((patch) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  // 테마 적용
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // 사운드 on/off 반영
  useEffect(() => {
    setSoundEnabled(settings.soundEnabled);
  }, [settings.soundEnabled]);

  // 버튼을 누를 때마다 짧은 탁 소리를 내요
  useEffect(() => {
    const handler = (e) => {
      const btn = e.target.closest('button');
      if (btn && !btn.disabled) sounds.click();
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  const localDispatch = useCallback((action) => {
    pendingLocalRef.current = true;
    dispatch(action);
  }, []);

  // 내가 직접 만든 변화만 온라인 방에 그대로 반영해요 (상대에게서 받은 변화는 되돌려보내지 않음)
  useEffect(() => {
    if (!online || online.role === 'spectator') return;
    if (pendingLocalRef.current) {
      pendingLocalRef.current = false;
      pushGameState(online.code, state).catch(() => {});
    }
  }, [state, online]);

  // 방 상태 구독: 상대의 변화를 받아오고, 호스트는 상대가 들어오면 게임을 시작해요
  useEffect(() => {
    if (!online) return undefined;
    const unsub = subscribeRoom(online.code, (room) => {
      if (room.state) {
        dispatch({ type: 'SET_STATE', state: room.state });
      }
      if (online.role === 'host' && room.status === 'active' && !gameStartedRef.current) {
        gameStartedRef.current = true;
        pendingLocalRef.current = true;
        dispatch({
          type: 'START_GAME',
          aiPlayer: null,
          difficulty: 'normal',
          timeLimitSec: online.timeLimitSec || 0,
          cardsPerPlayer: online.cardsPerPlayer || 3,
        });
      }
    });
    return unsub;
  }, [online]);

  useAIDriver(state, dispatch, online);

  // 효과음: 돌 놓기 / 카드 사용 / 승패 / 시간초과를 대략적으로 감지해서 재생
  useEffect(() => {
    const stoneCount = state.board ? state.board.flat().filter((v) => v !== 0).length : 0;
    const handTotal = state.draft ? state.draft.hands[BLACK].length + state.draft.hands[WHITE].length : 0;
    const prev = prevRef.current;

    if (state.phase === 'play' && prev.phase === 'play' && stoneCount > prev.stoneCount) {
      sounds.place();
    } else if (state.phase === 'play' && prev.phase === 'play' && handTotal !== prev.handTotal) {
      sounds.card();
    } else if (state.phase === 'draft' && prev.phase === 'draft' && handTotal > prev.handTotal) {
      sounds.card();
    }

    if (state.message && state.message !== prev.message && state.message.includes('시간 초과')) {
      sounds.timeout();
    }

    if (state.phase === 'over' && prev.phase !== 'over') {
      if (state.winner === null) {
        sounds.timeout();
      } else {
        const myColor = online ? online.localColor : state.aiPlayer ? otherPlayer(state.aiPlayer) : null;
        if (myColor && state.winner !== myColor) sounds.lose();
        else sounds.win();
      }
    }

    prevRef.current = { stoneCount, handTotal, phase: state.phase, message: state.message };
  }, [state, online]);

  // 대국이 끝나면 기보를 한 번만 저장
  useEffect(() => {
    if (state.phase === 'over' && !recordSavedRef.current) {
      recordSavedRef.current = true;
      let modeLabel = '2인 대국';
      if (state.aiPlayer) modeLabel = `AI 대전 (${DIFFICULTIES[state.aiDifficulty]?.label ?? '보통'})`;
      if (online) modeLabel = '온라인 대전';
      saveRecord({
        date: new Date().toISOString(),
        winner: state.winner,
        mode: modeLabel,
        moves: state.history,
      });
    } else if (state.phase !== 'over') {
      recordSavedRef.current = false;
    }
  }, [state.phase, state.winner, state.aiPlayer, state.aiDifficulty, state.history, online]);

  function handleReset() {
    if (online) {
      if (online.role !== 'spectator') leaveRoom(online.code);
      gameStartedRef.current = false;
      setOnline(null);
    }
    dispatch({ type: 'RESET_GAME' });
  }

  let screen;
  if (state.phase === 'setup') {
    screen = <SetupScreen dispatch={dispatch} online={online} setOnline={setOnline} settings={settings} updateSettings={updateSettings} />;
  } else if (state.phase === 'draft') {
    screen = <DraftScreen state={state} dispatch={online && online.role !== 'spectator' ? localDispatch : dispatch} online={online} />;
  } else {
    screen = (
      <GameScreen
        state={state}
        dispatch={online && online.role !== 'spectator' ? localDispatch : dispatch}
        online={online}
        onReset={handleReset}
        settings={settings}
        updateSettings={updateSettings}
      />
    );
  }

  return (
    <>
      {screen}
      {cardOverlay && (
        <div className="card-use-overlay">
          <div className="card-use-overlay-inner" key={cardOverlay.key}>
            <div className="card-use-overlay-icon"><CardIcon name={cardOverlay.card.icon} size={40} /></div>
            <div className="card-use-overlay-name">{cardOverlay.card.name}</div>
            <div className="card-use-overlay-player">{PLAYER_LABEL[cardOverlay.player]} 사용</div>
          </div>
        </div>
      )}
    </>
  );
}

// AI가 자기 턴일 때 스스로 드래프트를 고르고, 카드를 쓰거나 돌을 놓게 만드는 훅
function useAIDriver(state, dispatch, online) {
  useEffect(() => {
    if (online) return undefined; // 온라인 대전에는 AI가 끼어들지 않아요
    if (!state.aiPlayer) return undefined;

    if (state.phase === 'draft') {
      const currentDrafter = state.draft.order[state.draft.currentIndex];
      if (currentDrafter === state.aiPlayer && state.draft.options.length > 0) {
        const t = setTimeout(() => {
          const cardId = pickDraftCard(state.draft.options);
          dispatch({ type: 'DRAFT_PICK', cardId });
        }, 500);
        return () => clearTimeout(t);
      }
      return undefined;
    }

    if (state.phase === 'play' && state.turn === state.aiPlayer) {
      const t = setTimeout(() => {
        const blockedFn = (x, y) => isBlocked(state, x, y);

        if (state.activeCard) {
          const target = computeAITarget(state.activeCard.id, state.board, state.aiPlayer);
          if (target) {
            dispatch({ type: 'SELECT_CELL', x: target.x, y: target.y });
          } else {
            dispatch({ type: 'CANCEL_CARD' });
          }
          return;
        }

        const hand = state.draft.hands[state.aiPlayer];
        const decision = decideAIAction(state, state.aiPlayer, hand, blockedFn, state.aiDifficulty);

        if (decision) {
          dispatch({ type: 'ACTIVATE_CARD', cardId: decision.cardId });
          return;
        }

        const best = chooseBestCell(state.board, state.aiPlayer, blockedFn, state.ruleFlags, state.aiDifficulty);
        if (best) dispatch({ type: 'SELECT_CELL', x: best.x, y: best.y });
      }, 650);
      return () => clearTimeout(t);
    }

    return undefined;
  }, [state, dispatch, online]);
}

function SetupScreen({ dispatch, online, setOnline, settings, updateSettings }) {
  const [step, setStep] = useState('mode');
  const [modeChoice, setModeChoice] = useState(null); // 'local' | 'ai' | 'online'
  const [humanColor, setHumanColor] = useState(BLACK);
  const [customSeconds, setCustomSeconds] = useState('30');
  const [customCards, setCustomCards] = useState('3');
  const [joinCode, setJoinCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tutorialPage, setTutorialPage] = useState(0);
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);

  async function handleCreateRoom(hostColor) {
    setBusy(true);
    setErrorMsg('');
    try {
      const code = await createRoom(hostColor);
      setOnline({
        code,
        localColor: hostColor,
        role: 'host',
        timeLimitSec: settings.timeLimitSec,
        cardsPerPlayer: settings.cardsPerPlayer,
      });
      setStep('online-waiting');
    } catch {
      setErrorMsg('방을 만들지 못했어요. Firebase 설정을 확인해주세요 (README 참고).');
      setStep('online-error');
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinRoom() {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setErrorMsg('6자리 코드를 입력해주세요.');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await joinRoom(code);
      if (!res.ok) {
        setErrorMsg('존재하지 않는 코드예요.');
        setBusy(false);
        return;
      }
      if (res.rejoin) {
        setOnline({ code, localColor: res.localColor, role: 'guest', rejoined: true });
        setStep('online-waiting');
        setBusy(false);
        return;
      }
      if (res.asSpectator) {
        setOnline({ code, localColor: null, role: 'spectator' });
        setBusy(false);
        return;
      }
      const guestColor = res.hostColor === BLACK ? WHITE : BLACK;
      setOnline({ code, localColor: guestColor, role: 'guest' });
      setStep('online-waiting');
    } catch {
      setErrorMsg('참가하지 못했어요. Firebase 설정을 확인해주세요 (README 참고).');
      setStep('online-error');
    } finally {
      setBusy(false);
    }
  }

  function copyCode(code) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function goStartLocal() {
    dispatch({
      type: 'START_GAME',
      aiPlayer: null,
      timeLimitSec: settings.timeLimitSec,
      cardsPerPlayer: settings.cardsPerPlayer,
    });
  }

  if (step === 'mode') {
    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
          <div className="top-toggles">
            <button className="icon-toggle-btn" onClick={() => setStep('settings')} title="설정">
              <Settings size={16} />
            </button>
          </div>
        </header>
        <p className="subtitle">대국 방식을 선택하세요</p>

        <div className="setup-options">
          <button className="setup-card" onClick={() => { setModeChoice('local'); goStartLocal(); }}>
            <Users size={26} strokeWidth={1.6} />
            <div className="setup-card-title">2인이서 대국</div>
            <div className="setup-card-desc">한 화면에서 번갈아 플레이해요.</div>
          </button>

          <button className="setup-card" onClick={() => { setModeChoice('ai'); setStep('color'); }}>
            <Bot size={26} strokeWidth={1.6} />
            <div className="setup-card-title">AI와 대국</div>
            <div className="setup-card-desc">내가 할 색과 AI 난이도를 정해요.</div>
          </button>

          <button className="setup-card" onClick={() => { setModeChoice('online'); setStep('online-menu'); }}>
            <Wifi size={26} strokeWidth={1.6} />
            <div className="setup-card-title">친구와 플레이 (온라인)</div>
            <div className="setup-card-desc">방을 만들거나, 받은 코드로 참가·관전해요.</div>
          </button>
        </div>

        <div className="setup-links-row">
          <button className="setup-tutorial-link" onClick={() => setStep('tutorial')}>
            <BookOpen size={16} /> 튜토리얼 보기
          </button>
          <button className="setup-tutorial-link" onClick={() => setStep('cardlist')}>
            <Layers size={16} /> 카드 목록 보기
          </button>
          <button className="setup-tutorial-link" onClick={() => { setRecords(loadRecords()); setStep('records'); }}>
            <History size={16} /> 기보 보기
          </button>
        </div>
      </div>
    );
  }

  if (step === 'settings') {
    const applyCustomSeconds = () => {
      const v = Math.max(1, parseInt(customSeconds, 10) || 0);
      updateSettings({ timeLimitSec: v });
    };
    const applyCustomCards = () => {
      const v = Math.min(20, Math.max(1, parseInt(customCards, 10) || 3));
      updateSettings({ cardsPerPlayer: v });
    };

    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
        </header>
        <p className="subtitle">설정</p>

        <button className="setup-back" onClick={() => setStep('mode')}>
          <ChevronLeft size={16} /> 뒤로
        </button>

        <div className="tutorial-card">
          <div className="tutorial-title">화면 테마</div>
          <div className="setup-options" style={{ gridTemplateColumns: '1fr 1fr', display: 'grid' }}>
            <button
              className="card-option"
              style={{ borderColor: settings.theme === 'light' ? 'var(--accent)' : undefined }}
              onClick={() => updateSettings({ theme: 'light' })}
            >
              <Sun size={18} />
              <div className="card-name">밝게</div>
            </button>
            <button
              className="card-option"
              style={{ borderColor: settings.theme === 'dark' ? 'var(--accent)' : undefined }}
              onClick={() => updateSettings({ theme: 'dark' })}
            >
              <Moon size={18} />
              <div className="card-name">어둡게</div>
            </button>
          </div>
        </div>

        <div className="tutorial-card">
          <div className="tutorial-title">효과음</div>
          <div className="setup-options" style={{ gridTemplateColumns: '1fr 1fr', display: 'grid' }}>
            <button
              className="card-option"
              style={{ borderColor: settings.soundEnabled ? 'var(--accent)' : undefined }}
              onClick={() => updateSettings({ soundEnabled: true })}
            >
              <Volume2 size={18} />
              <div className="card-name">켜기</div>
            </button>
            <button
              className="card-option"
              style={{ borderColor: !settings.soundEnabled ? 'var(--accent)' : undefined }}
              onClick={() => updateSettings({ soundEnabled: false })}
            >
              <VolumeX size={18} />
              <div className="card-name">끄기</div>
            </button>
          </div>
        </div>

        <div className="tutorial-card">
          <div className="tutorial-title">한 수당 제한 시간</div>
          <div className="draft-options" style={{ marginBottom: 12 }}>
            {[0, 15, 30, 60].map((sec) => (
              <button
                key={sec}
                className="card-option"
                style={{ borderColor: settings.timeLimitSec === sec ? 'var(--accent)' : undefined }}
                onClick={() => updateSettings({ timeLimitSec: sec })}
              >
                <div className="card-name">{sec === 0 ? '제한 없음' : `${sec}초`}</div>
              </button>
            ))}
          </div>
          <div className="join-form">
            <input
              className="join-input"
              style={{ letterSpacing: 0, fontSize: 16 }}
              value={customSeconds}
              onChange={(e) => setCustomSeconds(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
              placeholder="직접 입력(초)"
            />
            <button className="reset-btn" onClick={applyCustomSeconds}>이 값으로</button>
          </div>
          <p className="setup-card-desc">현재: {settings.timeLimitSec === 0 ? '제한 없음' : `${settings.timeLimitSec}초`}</p>
        </div>

        <div className="tutorial-card">
          <div className="tutorial-title">1인당 카드 개수</div>
          <div className="draft-options" style={{ marginBottom: 12 }}>
            {[1, 3, 5].map((n) => (
              <button
                key={n}
                className="card-option"
                style={{ borderColor: settings.cardsPerPlayer === n ? 'var(--accent)' : undefined }}
                onClick={() => updateSettings({ cardsPerPlayer: n })}
              >
                <div className="card-name">{n}장</div>
              </button>
            ))}
          </div>
          <div className="join-form">
            <input
              className="join-input"
              style={{ letterSpacing: 0, fontSize: 16 }}
              value={customCards}
              onChange={(e) => setCustomCards(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
              placeholder="직접 입력(장)"
            />
            <button className="reset-btn" onClick={applyCustomCards}>이 값으로</button>
          </div>
          <p className="setup-card-desc">현재: {settings.cardsPerPlayer}장 (드래프트 총 {settings.cardsPerPlayer * 2}라운드)</p>
        </div>
      </div>
    );
  }

  if (step === 'tutorial') {
    const page = TUTORIAL_PAGES[tutorialPage];
    const isFirst = tutorialPage === 0;
    const isLast = tutorialPage === TUTORIAL_PAGES.length - 1;

    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
        </header>
        <p className="subtitle">튜토리얼 · {tutorialPage + 1} / {TUTORIAL_PAGES.length}</p>

        <button className="setup-back" onClick={() => { setStep('mode'); setTutorialPage(0); }}>
          <ChevronLeft size={16} /> 설정으로 돌아가기
        </button>

        <div className="tutorial-card">
          <div className="tutorial-title">{page.title}</div>
          <ul className="tutorial-body">
            {page.body.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>

        <div className="tutorial-nav">
          <button className="reset-btn" disabled={isFirst} onClick={() => setTutorialPage((p) => Math.max(0, p - 1))}>
            <ChevronLeft size={14} /> 이전
          </button>
          <div className="tutorial-dots">
            {TUTORIAL_PAGES.map((_, i) => (
              <span key={i} className={`tutorial-dot ${i === tutorialPage ? 'tutorial-dot-active' : ''}`} />
            ))}
          </div>
          {isLast ? (
            <button className="reset-btn" onClick={() => { setStep('mode'); setTutorialPage(0); }}>완료</button>
          ) : (
            <button className="reset-btn" onClick={() => setTutorialPage((p) => Math.min(TUTORIAL_PAGES.length - 1, p + 1))}>
              다음 <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === 'cardlist') {
    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
        </header>
        <p className="subtitle">카드 목록 · 전체 {CARDS.length}종</p>

        <button className="setup-back" onClick={() => setStep('mode')}>
          <ChevronLeft size={16} /> 설정으로 돌아가기
        </button>

        <div className="cardlist-grid">
          {CARDS.map((card) => {
            const isFree = FREE_ACTION.has(card.id);
            return (
              <div key={card.id} className="cardlist-item">
                <div className="cardlist-item-icon"><CardIcon name={card.icon} size={20} /></div>
                <div className="cardlist-item-body">
                  <div className="cardlist-item-head">
                    <span className="cardlist-item-name">{card.name}</span>
                    <span className={`cardlist-badge ${isFree ? 'cardlist-badge-free' : 'cardlist-badge-turn'}`}>
                      {isFree ? '턴 유지' : '턴 소모'}
                    </span>
                  </div>
                  <div className="cardlist-item-desc">{card.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (step === 'records') {
    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
        </header>
        <p className="subtitle">기보 목록 · {records.length}개</p>

        <button className="setup-back" onClick={() => setStep('mode')}>
          <ChevronLeft size={16} /> 설정으로 돌아가기
        </button>

        {records.length === 0 && <p className="setup-card-desc">저장된 기보가 없어요. 대국을 끝내면 자동으로 저장돼요.</p>}

        <div className="records-list">
          {records.map((r) => (
            <button
              key={r.id}
              className="record-item"
              onClick={() => { setSelectedRecord(r); setStep('replay'); }}
            >
              <div>
                <div className="record-item-result">
                  {r.winner === null ? '무승부' : `${PLAYER_LABEL[r.winner]} 승리`} · {r.mode}
                </div>
                <div className="record-item-date">{new Date(r.date).toLocaleString()} · {r.moves.length}수</div>
              </div>
              <button
                className="icon-toggle-btn"
                onClick={(e) => { e.stopPropagation(); deleteRecord(r.id); setRecords(loadRecords()); }}
                title="삭제"
              >
                ✕
              </button>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'replay' && selectedRecord) {
    return <ReplayScreen record={selectedRecord} onBack={() => setStep('records')} />;
  }

  if (step === 'color') {
    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
        </header>
        <p className="subtitle">어느 색으로 플레이할까요?</p>

        <button className="setup-back" onClick={() => setStep('mode')}>
          <ChevronLeft size={16} /> 뒤로
        </button>

        <div className="setup-options">
          <button className="setup-card" onClick={() => { setHumanColor(BLACK); setStep('difficulty'); }}>
            <span className="setup-color-dot setup-color-black" />
            <div className="setup-card-title">흑(선공)으로 플레이</div>
            <div className="setup-card-desc">AI가 백(후공)을 맡아요.</div>
          </button>

          <button className="setup-card" onClick={() => { setHumanColor(WHITE); setStep('difficulty'); }}>
            <span className="setup-color-dot setup-color-white" />
            <div className="setup-card-title">백(후공)으로 플레이</div>
            <div className="setup-card-desc">AI가 흑(선공)을 맡아요.</div>
          </button>
        </div>
      </div>
    );
  }

  if (step === 'difficulty') {
    const aiPlayer = humanColor === BLACK ? WHITE : BLACK;
    const desc = {
      easy: '상대 위협을 종종 놓치고, 수를 더 무작위로 둬요.',
      normal: '위협은 대체로 잘 막고, 적당히 카드를 섞어 써요.',
      hard: '위협을 거의 놓치지 않고, 카드도 적극적으로 활용해요.',
      hell: '두 수 앞까지 내다보며 상대의 응수를 계산해요.',
      impossible: '더 넓고 깊게 내다봐요. 이기기 매우 어려워요.',
    };
    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
        </header>
        <p className="subtitle">AI 난이도를 선택하세요</p>

        <button className="setup-back" onClick={() => setStep('color')}>
          <ChevronLeft size={16} /> 뒤로
        </button>

        <div className="setup-options">
          {Object.entries(DIFFICULTIES).map(([key, cfg]) => (
            <button
              key={key}
              className="setup-card"
              onClick={() => dispatch({
                type: 'START_GAME',
                aiPlayer,
                difficulty: key,
                timeLimitSec: settings.timeLimitSec,
                cardsPerPlayer: settings.cardsPerPlayer,
              })}
            >
              <div className="setup-card-title">{cfg.label}</div>
              <div className="setup-card-desc">{desc[key]}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'online-menu') {
    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
        </header>
        <p className="subtitle">친구와 온라인으로 플레이해요</p>

        <button className="setup-back" onClick={() => setStep('mode')}>
          <ChevronLeft size={16} /> 뒤로
        </button>

        {!isFirebaseConfigured() && (
          <p className="setup-warning">
            온라인 기능을 쓰려면 firebaseConfig.js 설정이 필요해요. README의 "온라인 대전 설정하기"를 참고하세요.
          </p>
        )}

        <div className="setup-options">
          <button className="setup-card" onClick={() => setStep('online-host-color')}>
            <div className="setup-card-title">방 만들기</div>
            <div className="setup-card-desc">6자리 코드가 생성돼요. 친구에게 알려주세요.</div>
          </button>

          <button className="setup-card" onClick={() => setStep('online-join')}>
            <div className="setup-card-title">코드로 참가하기</div>
            <div className="setup-card-desc">
              친구에게 받은 6자리 코드를 입력해요. 진행 중인 방이면 관전자로 들어가고,
              원래 쓰던 기기로 같은 코드를 다시 입력하면 내 색으로 재접속돼요.
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (step === 'online-host-color') {
    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
        </header>
        <p className="subtitle">어느 색으로 플레이할까요?</p>

        <button className="setup-back" onClick={() => setStep('online-menu')}>
          <ChevronLeft size={16} /> 뒤로
        </button>

        <div className="setup-options">
          <button className="setup-card" disabled={busy} onClick={() => handleCreateRoom(BLACK)}>
            <span className="setup-color-dot setup-color-black" />
            <div className="setup-card-title">흑(선공)으로 방 만들기</div>
          </button>
          <button className="setup-card" disabled={busy} onClick={() => handleCreateRoom(WHITE)}>
            <span className="setup-color-dot setup-color-white" />
            <div className="setup-card-title">백(후공)으로 방 만들기</div>
          </button>
        </div>
      </div>
    );
  }

  if (step === 'online-join') {
    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
        </header>
        <p className="subtitle">받은 6자리 코드를 입력하세요</p>

        <button className="setup-back" onClick={() => setStep('online-menu')}>
          <ChevronLeft size={16} /> 뒤로
        </button>

        <div className="join-form">
          <input
            className="join-input"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="ABC123"
            maxLength={6}
            autoFocus
          />
          <button className="reset-btn" disabled={busy} onClick={handleJoinRoom}>
            참가하기
          </button>
        </div>
        {errorMsg && <p className="setup-warning">{errorMsg}</p>}
      </div>
    );
  }

  if (step === 'online-waiting') {
    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
        </header>
        <p className="subtitle">
          {online?.rejoined
            ? '재접속했어요. 곧 이어서 진행돼요'
            : online?.role === 'host'
              ? '친구가 들어오길 기다리는 중이에요'
              : '호스트가 게임을 시작하길 기다리는 중이에요'}
        </p>

        {online?.role === 'host' && (
          <div className="room-code-box">
            <div className="room-code">{online.code}</div>
            <button className="reset-btn" onClick={() => copyCode(online.code)}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? '복사됨' : '코드 복사'}
            </button>
          </div>
        )}

        <div className="ai-thinking">
          <Wifi size={20} strokeWidth={1.6} />
          <span>연결 대기 중...</span>
        </div>
      </div>
    );
  }

  // step === 'online-error'
  return (
    <div className="page">
      <header className="header">
        <h1>증강 오목</h1>
      </header>
      <p className="subtitle">문제가 발생했어요</p>
      <p className="setup-warning">{errorMsg}</p>
      <button className="setup-back" onClick={() => setStep('online-menu')}>
        <ChevronLeft size={16} /> 다시 시도
      </button>
    </div>
  );
}

function ReplayScreen({ record, onBack }) {
  const [index, setIndex] = useState(record.moves.length - 1);
  const board = record.moves[index] || record.moves[record.moves.length - 1];
  const size = BOARD_SIZE;
  const gapPct = 100 / (size - 1);

  return (
    <div className="page">
      <header className="header">
        <h1>증강 오목</h1>
      </header>
      <p className="subtitle">
        기보 다시보기 · {record.winner === null ? '무승부' : `${PLAYER_LABEL[record.winner]} 승리`} · {record.mode}
      </p>

      <button className="setup-back" onClick={onBack}>
        <ChevronLeft size={16} /> 목록으로
      </button>

      <div className="replay-board-wrap">
        <div className="board-scroll">
          <div className="board">
            <div className="grid-area">
              <svg className="grid-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
                {Array.from({ length: size }).map((_, i) => (
                  <line key={`v-${i}`} x1={i * gapPct} y1={0} x2={i * gapPct} y2={100} />
                ))}
                {Array.from({ length: size }).map((_, i) => (
                  <line key={`h-${i}`} x1={0} y1={i * gapPct} x2={100} y2={i * gapPct} />
                ))}
              </svg>
              {Array.from({ length: size }).map((_, y) =>
                Array.from({ length: size }).map((_, x) => {
                  const value = board[y][x];
                  return (
                    <div
                      key={`${x}-${y}`}
                      className="cell"
                      style={{
                        left: `${x * gapPct}%`,
                        top: `${y * gapPct}%`,
                        width: `${gapPct}%`,
                        height: `${gapPct}%`,
                      }}
                    >
                      {value !== 0 && (
                        <span className={`stone ${value === WILD ? 'stone-wild' : value === 1 ? 'stone-black' : 'stone-white'}`} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="replay-controls">
        <button className="icon-toggle-btn" onClick={() => setIndex(0)} title="처음으로">
          <RotateCcw size={16} />
        </button>
        <button className="reset-btn" disabled={index <= 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
          <ChevronLeft size={14} /> 이전 수
        </button>
        <input
          type="range"
          className="replay-slider"
          min={0}
          max={record.moves.length - 1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
        />
        <button
          className="reset-btn"
          disabled={index >= record.moves.length - 1}
          onClick={() => setIndex((i) => Math.min(record.moves.length - 1, i + 1))}
        >
          다음 수 <ChevronRight size={14} />
        </button>
        <span className="replay-count">{index + 1} / {record.moves.length}</span>
      </div>
    </div>
  );
}

function DraftScreen({ state, dispatch, online }) {
  const { draft, aiPlayer } = state;
  const currentPlayer = draft.order[draft.currentIndex];
  const roundNumber = draft.currentIndex + 1;
  const totalRounds = draft.order.length;
  const isAITurn = currentPlayer === aiPlayer;
  const isOnlineWaiting = online && currentPlayer !== online.localColor;
  const waiting = isAITurn || isOnlineWaiting;

  const [pickBanner, setPickBanner] = useState(null);
  const lastPickKeyRef = useRef(null);

  useEffect(() => {
    if (!draft.lastPick) return;
    const key = `${draft.lastPick.round}-${draft.lastPick.cardId}`;
    if (lastPickKeyRef.current === key) return;
    lastPickKeyRef.current = key;

    const card = getCardById(draft.lastPick.cardId);
    setPickBanner({ player: draft.lastPick.player, card });
    const t = setTimeout(() => setPickBanner(null), 1200);
    return () => clearTimeout(t);
  }, [draft.lastPick]);

  return (
    <div className="page">
      <header className="header">
        <h1>증강 오목</h1>
        <p className="subtitle">카드 드래프트 · {roundNumber} / {totalRounds}라운드</p>
      </header>

      <div className="draft-status">
        <span className={`turn-badge turn-badge-pulse ${currentPlayer === BLACK ? 'turn-black' : 'turn-white'}`}>
          {PLAYER_LABEL[currentPlayer]}
        </span>
        <span>
          {isAITurn ? 'AI가 카드를 고르는 중이에요...' : isOnlineWaiting ? '상대가 카드를 고르는 중이에요...' : '카드를 하나 선택하세요.'}
        </span>
      </div>

      {pickBanner && (
        <div className="pick-banner">
          <CardIcon name={pickBanner.card.icon} size={18} />
          {PLAYER_LABEL[pickBanner.player]}이(가) <b>{pickBanner.card.name}</b>을(를) 선택했어요
        </div>
      )}

      <div className="draft-options" key={roundNumber}>
        {draft.options.map((cardId, i) => {
          const card = getCardById(cardId);
          return (
            <button
              key={cardId}
              className={`card-option ${waiting ? 'card-option-readonly' : ''}`}
              style={{ animationDelay: `${i * 60}ms` }}
              disabled={waiting}
              onClick={() => dispatch({ type: 'DRAFT_PICK', cardId })}
            >
              <div className="card-icon"><CardIcon name={card.icon} size={22} /></div>
              <div className="card-name">{card.name}</div>
              <div className="card-desc">{card.desc}</div>
            </button>
          );
        })}
      </div>

      <HandsPreview hands={draft.hands} />
    </div>
  );
}

function HandsPreview({ hands }) {
  return (
    <div className="hands-preview">
      {[BLACK, WHITE].map((p) => (
        <div key={p} className="hand-preview-col">
          <div className="hand-preview-title">{PLAYER_LABEL[p]}이 뽑은 카드</div>
          <div className="hand-preview-list">
            {hands[p].length === 0 && <span className="hand-empty">아직 없음</span>}
            {hands[p].map((id, i) => (
              <div key={i} className="hand-chip-wrap">
                <span className="hand-chip">
                  <CardIcon name={getCardById(id).icon} size={14} />
                  {getCardById(id).name}
                </span>
                <div className="card-tooltip">
                  <div className="card-tooltip-title">{getCardById(id).name}</div>
                  <div className="card-tooltip-desc">{getCardById(id).desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TurnTimer({ state, dispatch, online }) {
  const [remaining, setRemaining] = useState(null);
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
  }, [state.turnDeadline]);

  useEffect(() => {
    if (!state.timeLimitSec || !state.turnDeadline || state.phase !== 'play') {
      setRemaining(null);
      return undefined;
    }

    const tick = () => {
      const left = Math.max(0, Math.ceil((state.turnDeadline - Date.now()) / 1000));
      setRemaining(left);
      const iAmResponsible = online ? online.localColor === state.turn : state.aiPlayer !== state.turn;
      if (left <= 0 && iAmResponsible && !firedRef.current) {
        firedRef.current = true;
        dispatch({ type: 'TIME_UP' });
      }
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [state.turnDeadline, state.timeLimitSec, state.phase, state.turn, state.aiPlayer, online, dispatch]);

  if (!state.timeLimitSec || remaining === null) return null;

  return (
    <div className={`turn-timer ${remaining <= 5 ? 'turn-timer-urgent' : ''}`}>
      {PLAYER_LABEL[state.turn]}의 남은 시간: {remaining}초
    </div>
  );
}

function ChatPanel({ online }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (!online) return undefined;
    setMessages([]);
    const unsub = subscribeChat(online.code, (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    return unsub;
  }, [online?.code]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  if (!online) return null;

  const myLabel = online.role === 'spectator' ? '관전자' : PLAYER_LABEL[online.localColor];

  function send(t) {
    const trimmed = t.trim();
    if (!trimmed) return;
    sendChatMessage(online.code, myLabel, trimmed).catch(() => {});
    setText('');
  }

  return (
    <div className="chat-panel">
      <div className="chat-title"><MessageCircle size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />채팅</div>
      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && <span className="chat-empty">아직 메시지가 없어요.</span>}
        {messages.map((m) => (
          <div key={m.id} className={`chat-message ${m.sender === myLabel ? 'chat-message-mine' : ''}`}>
            <span className="chat-sender">{m.sender}</span>{m.text}
          </div>
        ))}
      </div>
      <div className="chat-quick-row">
        {['👍', '🎉', '😅', '🔥', '😭'].map((e) => (
          <button key={e} className="chat-quick-btn" onClick={() => send(e)}>{e}</button>
        ))}
      </div>
      <div className="chat-input-row">
        <input
          className="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(text); }}
          placeholder="메시지 입력..."
          maxLength={200}
        />
        <button className="icon-toggle-btn" onClick={() => send(text)} title="보내기">
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

function GameScreen({ state, dispatch, online, onReset, settings, updateSettings }) {
  const gameOver = state.phase === 'over';
  const isAITurn = state.aiPlayer && state.turn === state.aiPlayer && !gameOver;
  const isSpectator = online && online.role === 'spectator';
  const isOnlineWaiting = online && !isSpectator && state.turn !== online.localColor && !gameOver;

  let modeLabel = '2인 대국';
  if (state.aiPlayer) modeLabel = `AI 대전 · AI는 ${PLAYER_LABEL[state.aiPlayer]} · 난이도 ${DIFFICULTIES[state.aiDifficulty]?.label ?? '보통'}`;
  if (online) {
    modeLabel = isSpectator
      ? `온라인 대전 · 방 ${online.code} · 관전 중`
      : `온라인 대전 · 방 ${online.code} · 나는 ${PLAYER_LABEL[online.localColor]}`;
  }

  return (
    <div className="page">
      <header className="header">
        <h1>증강 오목</h1>
        <div className="top-toggles">
          <button className="icon-toggle-btn" onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })} title="효과음">
            {settings.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            className="icon-toggle-btn"
            onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
            title="테마"
          >
            {settings.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>
      <p className="subtitle">
        {modeLabel}{isSpectator && <span className="spectator-badge"><Eye size={11} style={{ verticalAlign: 'middle' }} /> 관전</span>} · 렌주 금수(3-3, 4-4, 육목)는 흑에게만 적용돼요
      </p>

      <div className="status-row">
        <span key={state.message} className={`status-text ${gameOver ? 'status-win' : ''}`}>
          {isAITurn ? 'AI가 생각하는 중...' : isOnlineWaiting ? '상대의 차례를 기다리는 중...' : state.message}
        </span>
        <button className="reset-btn" onClick={onReset}>
          {isSpectator ? '나가기' : '다시 시작'}
        </button>
      </div>

      <TurnTimer state={state} dispatch={dispatch} online={online} />

      <div className="board-scroll">
        <Board state={state} dispatch={dispatch} online={online} />
      </div>

      <div className="hands-row">
        {[BLACK, WHITE].map((p) => (
          <HandPanel key={p} player={p} state={state} dispatch={dispatch} disabled={gameOver} online={online} />
        ))}
      </div>

      {online && <ChatPanel online={online} />}
    </div>
  );
}

function HandPanel({ player, state, dispatch, disabled, online }) {
  const hand = state.draft.hands[player];
  const isAISide = state.aiPlayer === player;
  const isSpectator = online && online.role === 'spectator';
  const isRemoteSide = online && !isSpectator && online.localColor !== player;
  const isCurrentTurn = state.turn === player && !disabled && !isAISide && !isRemoteSide && !isSpectator;
  const activeId = state.activeCard?.id;
  const silenced = state.silencedTurns[player] > 0;

  return (
    <div className={`hand-panel ${isCurrentTurn ? 'hand-panel-active' : ''}`}>
      <div className="hand-panel-title">
        {PLAYER_LABEL[player]}의 카드{isAISide ? ' (AI)' : ''}{isRemoteSide ? ' (상대)' : ''}{silenced ? ' · 침묵 중' : ''}
      </div>
      <div className="hand-panel-cards">
        {hand.length === 0 && <span className="hand-empty">사용 가능한 카드 없음</span>}
        {hand.map((id, i) => {
          const card = getCardById(id);
          const usable = isCurrentTurn && !state.activeCard && !silenced;
          return (
            <div key={i} className="hand-card-wrap">
              <button
                className={`hand-card ${activeId === id ? 'hand-card-active' : ''}`}
                disabled={!usable}
                onClick={() => dispatch({ type: 'ACTIVATE_CARD', cardId: id })}
              >
                <CardIcon name={card.icon} size={16} />
                {card.name}
              </button>
              <div className="card-tooltip">
                <div className="card-tooltip-title">{card.name}</div>
                <div className="card-tooltip-desc">{card.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
      {isCurrentTurn && state.activeCard && (
        <button className="cancel-card-btn" onClick={() => dispatch({ type: 'CANCEL_CARD' })}>
          카드 취소
        </button>
      )}
    </div>
  );
}

function Board({ state, dispatch, online }) {
  const size = BOARD_SIZE;
  const gapPct = 100 / (size - 1);
  const gameOver = state.phase === 'over';
  const isAITurn = state.aiPlayer && state.turn === state.aiPlayer && !gameOver;
  const isSpectator = online && online.role === 'spectator';
  const isOnlineWaiting = online && (isSpectator || state.turn !== online.localColor) && !gameOver;
  const forcedZone = state.forcedZone && state.forcedZone.player === state.turn ? state.forcedZone : null;

  return (
    <div className="board">
      <div className="grid-area">
        <svg className="grid-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          {Array.from({ length: size }).map((_, i) => (
            <line key={`v-${i}`} x1={i * gapPct} y1={0} x2={i * gapPct} y2={100} />
          ))}
          {Array.from({ length: size }).map((_, i) => (
            <line key={`h-${i}`} x1={0} y1={i * gapPct} x2={100} y2={i * gapPct} />
          ))}
        </svg>

        {Array.from({ length: size }).map((_, y) =>
          Array.from({ length: size }).map((_, x) => {
            const value = state.board[y][x];
            const blocked = isBlocked(state, x, y);
            const protectedStone = !!state.protectedStones[`${x},${y}`];
            const disabled = gameOver || isAITurn || isOnlineWaiting;
            const inForcedZone = forcedZone && x >= forcedZone.x0 && x <= forcedZone.x1 && y >= forcedZone.y0 && y <= forcedZone.y1;

            return (
              <button
                key={`${x}-${y}`}
                className={`cell ${blocked ? 'cell-blocked' : ''} ${inForcedZone ? 'cell-forced' : ''}`}
                style={{
                  left: `${x * gapPct}%`,
                  top: `${y * gapPct}%`,
                  width: `${gapPct}%`,
                  height: `${gapPct}%`,
                }}
                disabled={disabled}
                onClick={() => dispatch({ type: 'SELECT_CELL', x, y })}
                aria-label={`${x + 1}, ${y + 1} 교차점`}
              >
                {value !== 0 && (
                  <span
                    className={`stone ${
                      value === WILD ? 'stone-wild' : value === 1 ? 'stone-black' : 'stone-white'
                    } ${protectedStone ? 'stone-protected' : ''}`}
                  />
                )}
                {blocked && value === 0 && <span className="blocked-mark" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
