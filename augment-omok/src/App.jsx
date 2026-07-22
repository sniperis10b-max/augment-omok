import { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import {
  Skull, FlaskConical, ArrowLeftRight, Layers, Move, ShieldCheck, Ban, ShieldAlert,
  Minimize2, Trophy, Repeat2, Snowflake, Biohazard, Bomb, Undo2, History, Shuffle,
  Unlock, KeyRound, SeparatorHorizontal, Sprout, ShieldOff, Sparkles, Target, Dices,
  HandMetal, ShieldPlus, CircleDot, VolumeX, Bot, Users, ChevronLeft, Copy, Check, Wifi, BookOpen, ChevronRight,
} from 'lucide-react';
import { BOARD_SIZE } from './gameLogic.js';
import { gameReducer, createInitialState, isBlocked, BLACK, WHITE, WILD, FREE_ACTION } from './gameReducer.js';
import { getCardById, CARDS } from './cards.js';
import { decideAIAction, pickDraftCard, chooseBestCell, computeAITarget, DIFFICULTIES } from './ai.js';
import { createRoom, joinRoom, subscribeRoom, pushGameState, leaveRoom, isFirebaseConfigured } from './network.js';

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
      '게임 시작 전, 3장의 카드 중 1장을 고르는 걸 흑과 백이 번갈아 3번씩, 총 6라운드 진행해요.',
      '그 결과 각자 3장의 카드를 손에 쥔 채로 대국을 시작해요.',
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
    ],
  },
  {
    title: '시간제한 (선택)',
    body: [
      '대국 시작 전에 한 수당 제한 시간을 정할 수 있어요 (없음/15초/30초/60초/직접 입력).',
      '시간이 다 되면 돌을 놓지 못한 채로 턴만 상대에게 넘어가요.',
    ],
  },
  {
    title: '대국 모드',
    body: [
      '2인이서 대국: 한 화면에서 번갈아 플레이해요.',
      'AI와 대국: 내가 할 색과 AI 난이도(쉬움/보통/어려움)를 골라요.',
      '친구와 플레이(온라인): 방을 만들면 6자리 코드가 생겨요. 친구가 그 코드로 참가하면 실시간으로 대국할 수 있어요.',
    ],
  },
];

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, null, createInitialState);
  const [online, setOnline] = useState(null); // null | { code, localColor, role: 'host'|'guest' }
  const pendingLocalRef = useRef(false);
  const gameStartedRef = useRef(false);

  const localDispatch = useCallback((action) => {
    pendingLocalRef.current = true;
    dispatch(action);
  }, []);

  // 내가 직접 만든 변화만 온라인 방에 그대로 반영해요 (상대에게서 받은 변화는 되돌려보내지 않음)
  useEffect(() => {
    if (!online) return;
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
        dispatch({ type: 'START_GAME', aiPlayer: null, difficulty: 'normal', timeLimitSec: online.timeLimitSec || 0 });
      }
    });
    return unsub;
  }, [online]);

  useAIDriver(state, dispatch, online);

  function handleReset() {
    if (online) {
      leaveRoom(online.code);
      gameStartedRef.current = false;
      setOnline(null);
    }
    dispatch({ type: 'RESET_GAME' });
  }

  if (state.phase === 'setup') {
    return <SetupScreen dispatch={dispatch} online={online} setOnline={setOnline} />;
  }

  if (state.phase === 'draft') {
    return <DraftScreen state={state} dispatch={online ? localDispatch : dispatch} online={online} />;
  }

  return (
    <GameScreen
      state={state}
      dispatch={online ? localDispatch : dispatch}
      online={online}
      onReset={handleReset}
    />
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

function SetupScreen({ dispatch, online, setOnline }) {
  const [step, setStep] = useState('mode'); // 'mode' | 'timelimit' | 'color' | 'difficulty' | 'online-menu' | 'online-host-color' | 'online-waiting' | 'online-join' | 'online-error'
  const [modeChoice, setModeChoice] = useState(null); // 'local' | 'ai' | 'online'
  const [humanColor, setHumanColor] = useState(BLACK);
  const [timeLimitSec, setTimeLimitSec] = useState(0);
  const [customSeconds, setCustomSeconds] = useState('30');
  const [joinCode, setJoinCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tutorialPage, setTutorialPage] = useState(0);

  async function handleCreateRoom(hostColor) {
    setBusy(true);
    setErrorMsg('');
    try {
      const code = await createRoom(hostColor);
      setOnline({ code, localColor: hostColor, role: 'host', timeLimitSec });
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
        setErrorMsg(res.reason === 'not-found' ? '존재하지 않는 코드예요.' : '이미 꽉 찬 방이에요.');
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

  if (step === 'mode') {
    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
          <p className="subtitle">대국 방식을 선택하세요</p>
        </header>

        <div className="setup-options">
          <button className="setup-card" onClick={() => { setModeChoice('local'); setStep('timelimit'); }}>
            <Users size={26} strokeWidth={1.6} />
            <div className="setup-card-title">2인이서 대국</div>
            <div className="setup-card-desc">한 화면에서 번갈아 플레이해요.</div>
          </button>

          <button className="setup-card" onClick={() => { setModeChoice('ai'); setStep('timelimit'); }}>
            <Bot size={26} strokeWidth={1.6} />
            <div className="setup-card-title">AI와 대국</div>
            <div className="setup-card-desc">내가 할 색과 AI 난이도를 정해요.</div>
          </button>

          <button className="setup-card" onClick={() => { setModeChoice('online'); setStep('timelimit'); }}>
            <Wifi size={26} strokeWidth={1.6} />
            <div className="setup-card-title">친구와 플레이 (온라인)</div>
            <div className="setup-card-desc">방을 만들거나, 받은 코드로 참가해요.</div>
          </button>
        </div>

        <div className="setup-links-row">
          <button className="setup-tutorial-link" onClick={() => setStep('tutorial')}>
            <BookOpen size={16} /> 튜토리얼 보기
          </button>
          <button className="setup-tutorial-link" onClick={() => setStep('cardlist')}>
            <Layers size={16} /> 카드 목록 보기
          </button>
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
          <p className="subtitle">튜토리얼 · {tutorialPage + 1} / {TUTORIAL_PAGES.length}</p>
        </header>

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
          <button
            className="reset-btn"
            disabled={isFirst}
            onClick={() => setTutorialPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft size={14} /> 이전
          </button>
          <div className="tutorial-dots">
            {TUTORIAL_PAGES.map((_, i) => (
              <span key={i} className={`tutorial-dot ${i === tutorialPage ? 'tutorial-dot-active' : ''}`} />
            ))}
          </div>
          {isLast ? (
            <button className="reset-btn" onClick={() => { setStep('mode'); setTutorialPage(0); }}>
              완료
            </button>
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
          <p className="subtitle">카드 목록 · 전체 {CARDS.length}종</p>
        </header>

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

  if (step === 'timelimit') {
    function goNext() {
      if (modeChoice === 'local') {
        dispatch({ type: 'START_GAME', aiPlayer: null, timeLimitSec });
      } else if (modeChoice === 'ai') {
        setStep('color');
      } else {
        setStep('online-menu');
      }
    }

    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
          <p className="subtitle">한 수당 제한 시간을 정하세요</p>
        </header>

        <button className="setup-back" onClick={() => setStep('mode')}>
          <ChevronLeft size={16} /> 뒤로
        </button>

        <div className="draft-options" style={{ marginBottom: 16 }}>
          {[0, 15, 30, 60].map((sec) => (
            <button
              key={sec}
              className="card-option"
              style={{ borderColor: timeLimitSec === sec ? '#c2760a' : undefined }}
              onClick={() => setTimeLimitSec(sec)}
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
          <button
            className="reset-btn"
            onClick={() => setTimeLimitSec(Math.max(1, parseInt(customSeconds, 10) || 0))}
          >
            이 값으로
          </button>
        </div>

        <p className="setup-card-desc" style={{ marginBottom: 16 }}>
          현재 선택: {timeLimitSec === 0 ? '제한 없음' : `${timeLimitSec}초`}
        </p>

        <button className="setup-card" onClick={goNext}>
          <div className="setup-card-title">다음</div>
        </button>
      </div>
    );
  }

  if (step === 'color') {
    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
          <p className="subtitle">어느 색으로 플레이할까요?</p>
        </header>

        <button className="setup-back" onClick={() => setStep('timelimit')}>
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
    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
          <p className="subtitle">AI 난이도를 선택하세요</p>
        </header>

        <button className="setup-back" onClick={() => setStep('color')}>
          <ChevronLeft size={16} /> 뒤로
        </button>

        <div className="setup-options">
          {Object.entries(DIFFICULTIES).map(([key, cfg]) => (
            <button
              key={key}
              className="setup-card"
              onClick={() => dispatch({ type: 'START_GAME', aiPlayer, difficulty: key, timeLimitSec })}
            >
              <div className="setup-card-title">{cfg.label}</div>
              <div className="setup-card-desc">
                {key === 'easy' && '상대 위협을 종종 놓치고, 수를 더 무작위로 둬요.'}
                {key === 'normal' && '위협은 대체로 잘 막고, 적당히 카드를 섞어 써요.'}
                {key === 'hard' && '위협을 거의 놓치지 않고, 카드도 적극적으로 활용해요.'}
              </div>
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
          <p className="subtitle">친구와 온라인으로 플레이해요</p>
        </header>

        <button className="setup-back" onClick={() => setStep('timelimit')}>
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
            <div className="setup-card-desc">친구에게 받은 6자리 코드를 입력해요.</div>
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
          <p className="subtitle">어느 색으로 플레이할까요?</p>
        </header>

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
          <p className="subtitle">받은 6자리 코드를 입력하세요</p>
        </header>

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
          <p className="subtitle">
            {online?.role === 'host' ? '친구가 들어오길 기다리는 중이에요' : '호스트가 게임을 시작하길 기다리는 중이에요'}
          </p>
        </header>

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
        <p className="subtitle">문제가 발생했어요</p>
      </header>
      <p className="setup-warning">{errorMsg}</p>
      <button className="setup-back" onClick={() => setStep('online-menu')}>
        <ChevronLeft size={16} /> 다시 시도
      </button>
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

      {waiting ? (
        <div className="ai-thinking">
          <Bot size={20} strokeWidth={1.6} />
          <span>기다리는 중...</span>
        </div>
      ) : (
        <div className="draft-options" key={roundNumber}>
          {draft.options.map((cardId, i) => {
            const card = getCardById(cardId);
            return (
              <button
                key={cardId}
                className="card-option"
                style={{ animationDelay: `${i * 60}ms` }}
                onClick={() => dispatch({ type: 'DRAFT_PICK', cardId })}
              >
                <div className="card-icon"><CardIcon name={card.icon} size={22} /></div>
                <div className="card-name">{card.name}</div>
                <div className="card-desc">{card.desc}</div>
              </button>
            );
          })}
        </div>
      )}

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

function GameScreen({ state, dispatch, online, onReset }) {
  const gameOver = state.phase === 'over';
  const isAITurn = state.aiPlayer && state.turn === state.aiPlayer && !gameOver;
  const isOnlineWaiting = online && state.turn !== online.localColor && !gameOver;

  let modeLabel = '2인 대국';
  if (state.aiPlayer) modeLabel = `AI 대전 · AI는 ${PLAYER_LABEL[state.aiPlayer]} · 난이도 ${DIFFICULTIES[state.aiDifficulty]?.label ?? '보통'}`;
  if (online) modeLabel = `온라인 대전 · 방 ${online.code} · 나는 ${PLAYER_LABEL[online.localColor]}`;

  return (
    <div className="page">
      <header className="header">
        <h1>증강 오목</h1>
        <p className="subtitle">{modeLabel} · 렌주 금수(3-3, 4-4, 육목)는 흑에게만 적용돼요</p>
      </header>

      <div className="status-row">
        <span key={state.message} className={`status-text ${gameOver ? 'status-win' : ''}`}>
          {isAITurn ? 'AI가 생각하는 중...' : isOnlineWaiting ? '상대의 차례를 기다리는 중...' : state.message}
        </span>
        <button className="reset-btn" onClick={onReset}>
          다시 시작
        </button>
      </div>

      <TurnTimer state={state} dispatch={dispatch} online={online} />

      <Board state={state} dispatch={dispatch} online={online} />

      <div className="hands-row">
        {[BLACK, WHITE].map((p) => (
          <HandPanel key={p} player={p} state={state} dispatch={dispatch} disabled={gameOver} online={online} />
        ))}
      </div>
    </div>
  );
}

function HandPanel({ player, state, dispatch, disabled, online }) {
  const hand = state.draft.hands[player];
  const isAISide = state.aiPlayer === player;
  const isRemoteSide = online && online.localColor !== player;
  const isCurrentTurn = state.turn === player && !disabled && !isAISide && !isRemoteSide;
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
  const isOnlineWaiting = online && state.turn !== online.localColor && !gameOver;

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

            return (
              <button
                key={`${x}-${y}`}
                className={`cell ${blocked ? 'cell-blocked' : ''}`}
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
