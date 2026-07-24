import { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import {
  Skull, FlaskConical, ArrowLeftRight, Layers, Move, ShieldCheck, Ban, ShieldAlert,
  Minimize2, Trophy, Repeat2, Snowflake, Biohazard, Bomb, Undo2, History, Shuffle,
  Unlock, KeyRound, SeparatorHorizontal, Sprout, ShieldOff, Sparkles, Target, Dices,
  HandMetal, ShieldPlus, CircleDot, VolumeX, Bot, Users, ChevronLeft, Copy, Check, Wifi,
  BookOpen, ChevronRight, Settings, Sun, Moon, Volume2, Eye, MessageCircle, Send, RotateCcw,
  UserCircle, LogOut, Mail, ShieldQuestion, UserPlus, Bell, Dice5, X as XIcon, Star,
  Zap, Tornado,
} from 'lucide-react';
import { BOARD_SIZE, otherPlayer } from './gameLogic.js';
import { gameReducer, createInitialState, isBlocked, BLACK, WHITE, WILD, FREE_ACTION } from './gameReducer.js';
import { getCardById, CARDS } from './cards.js';
import { decideAIAction, pickDraftCard, chooseBestCell, computeAITarget, DIFFICULTIES } from './ai.js';
import {
  createRoom, joinRoom, peekRoom, subscribeRoom, pushGameState, leaveRoom, isFirebaseConfigured,
  sendChatMessage, subscribeChat,
} from './network.js';
import { loadSettings, saveSettings, LATEST_UPDATE } from './settings.js';
import { sounds, setSoundEnabled } from './sound.js';
import { loadRecords, saveRecord, deleteRecord } from './records.js';
import {
  watchAuthState, signInWithGoogle, signUpWithEmail, signInWithEmail,
  resendVerificationEmail, signOutUser, mapAuthError, updateUserProfile, deleteAccount,
} from './auth.js';
import {
  upsertUserProfile, sendFriendRequestByEmail, subscribeFriendRequests, acceptFriendRequest,
  declineFriendRequest, subscribeFriends, inviteFriendToGame, subscribeInvites, clearInvite,
  quickMatch, cancelQuickMatch, setupPresence, subscribeUserStatus, recordGameResult,
  subscribeStats, deleteUserData,
} from './social.js';

const ICONS = {
  Skull, FlaskConical, ArrowLeftRight, Layers, Move, ShieldCheck, Ban, ShieldAlert,
  Minimize2, Trophy, Repeat2, Snowflake, Biohazard, Bomb, Undo2, History, Shuffle,
  Unlock, KeyRound, SeparatorHorizontal, Sprout, ShieldOff, Sparkles, Target, Dices,
  HandMetal, ShieldPlus, CircleDot, VolumeX, Star,
  Zap, RotateCcw, Eye, Copy, Tornado,
};

function CardIcon({ name, size = 18 }) {
  const Icon = ICONS[name];
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={1.8} />;
}

const PLAYER_LABEL = { [BLACK]: '흑', [WHITE]: '백' };

// 특정 계정(개발자)에게만 프로필에 뱃지를 보여주기 위한 판별 함수.
// 이메일 대소문자가 다를 수 있어서 소문자로 비교해요.
const DEV_ACCOUNT_EMAIL = 'sniperis10b@gmail.com';
function isDevAccount(user) {
  return !!user?.email && user.email.toLowerCase() === DEV_ACCOUNT_EMAIL;
}

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

const EFFECTIVE_DATE = '2026년 7월 23일';

const TERMS_SECTIONS = [
  { title: '제1조 (목적)', body: ['이 약관은 증강 오목(이하 "서비스")이 제공하는 모든 서비스의 이용조건 및 절차, 이용자와 서비스 운영자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.'] },
  {
    title: '제2조 (약관의 효력 및 변경)',
    body: [
      '① 이 약관은 서비스 화면에 게시하여 공지함으로써 효력이 발생합니다.',
      '② 이용자가 서비스에 접속하여 이용하는 것으로 본 약관에 동의한 것으로 간주합니다.',
      '③ 운영자는 필요한 경우 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지 후 적용됩니다.',
    ],
  },
  { title: '제3조 (서비스의 내용)', body: ['서비스는 카드 시스템을 결합한 온라인/오프라인 오목 게임 및 관련 부가 기능(계정, 친구, 채팅, 기보 저장 등)을 제공합니다.'] },
  {
    title: '제4조 (회원가입 및 계정)',
    body: [
      '① 이용자는 이메일 또는 구글 계정을 통해 회원가입할 수 있습니다.',
      '② 이용자는 본인의 계정 정보를 스스로 관리할 책임이 있으며, 계정 정보의 관리 소홀로 인한 불이익에 대해 운영자는 책임을 지지 않습니다.',
      '③ 타인의 계정을 도용하거나 허위 정보로 가입하는 행위는 금지됩니다.',
    ],
  },
  {
    title: '제5조 (이용자의 의무)',
    body: [
      '이용자는 다음 행위를 해서는 안 됩니다.',
      '- 타인의 개인정보를 도용하거나 부정하게 사용하는 행위',
      '- 서비스의 정상적인 운영을 방해하는 행위 (부정한 방법의 자동 플레이, 서버 공격 등)',
      '- 다른 이용자에게 욕설, 도배, 혐오 표현 등을 통해 피해를 주는 행위 (채팅 기능 포함)',
      '- 그 밖에 관련 법령에 위배되는 행위',
    ],
  },
  { title: '제6조 (서비스의 변경 및 중단)', body: ['운영자는 서비스의 전부 또는 일부를 운영상, 기술상의 필요에 따라 변경하거나 중단할 수 있으며, 이 경우 사전에 공지합니다. 다만 불가피한 경우 사후에 공지할 수 있습니다.'] },
  {
    title: '제7조 (면책조항)',
    body: [
      '① 운영자는 천재지변, 서비스 제공에 사용되는 제3자(Firebase 등)의 장애 등 운영자의 고의·과실이 없는 사유로 서비스를 제공할 수 없는 경우 책임을 지지 않습니다.',
      '② 서비스는 무료로 제공되는 개인/취미 프로젝트로, 이용자 간 온라인 대전 중 발생하는 분쟁에 대해 운영자는 개입하거나 책임지지 않습니다.',
      '③ 이용자가 게시하거나 전송한 채팅 내용, 닉네임 등에 대한 책임은 해당 이용자 본인에게 있습니다.',
    ],
  },
  { title: '제8조 (준거법 및 관할)', body: ['이 약관과 관련하여 분쟁이 발생할 경우 대한민국 법령을 준거법으로 합니다.'] },
];

const PRIVACY_SECTIONS = [
  {
    title: '1. 수집하는 개인정보 항목',
    body: [
      '필수: 이메일 주소 (이메일 가입 또는 구글 로그인 시)',
      '선택: 닉네임, 프로필 사진(URL)',
      '자동 생성 정보: 대국 기록(기보), 친구 목록, 대국 초대 내역',
      '구글 로그인 이용 시, 구글 계정에서 제공하는 이름·프로필 사진 정보',
      '서비스는 비밀번호를 직접 저장하지 않으며, 인증은 Firebase Authentication을 통해 처리됩니다.',
    ],
  },
  {
    title: '2. 개인정보의 수집 및 이용 목적',
    body: ['회원 식별 및 로그인 유지', '친구 추가·대국 초대 등 소셜 기능 제공', '온라인 대전 시 상대방에게 닉네임 표시', '대국 기록(기보) 저장 및 조회'],
  },
  { title: '3. 개인정보의 보유 및 이용 기간', body: ['이용자가 계정을 삭제하거나 탈퇴를 요청할 때까지 보유합니다.'] },
  {
    title: '4. 개인정보의 제3자 제공 및 처리 위탁',
    body: [
      '수탁업체: Google LLC (Firebase) — 위탁 업무: 로그인 인증, 데이터베이스(대국 기록, 친구 정보 등) 저장 — 보관 위치: Firebase 서버(해외 포함 가능)',
      'Firebase의 개인정보 처리에 대한 자세한 내용은 Google 개인정보처리방침(policies.google.com/privacy)에서 확인하실 수 있습니다.',
    ],
  },
  { title: '5. 온라인 대전 중 공개되는 정보', body: ['온라인 대전 및 채팅 이용 시, 상대방 또는 관전자에게 닉네임(설정한 경우) 및 대국 내용이 공개될 수 있습니다.'] },
  {
    title: '6. 이용자의 권리',
    body: ['본인의 개인정보 열람·수정 (프로필 편집 기능 이용)', '계정 및 관련 정보 삭제 요청', '개인정보 수집·이용에 대한 동의 철회'],
  },
  { title: '7. 개인정보의 안전성 확보 조치', body: ['서비스는 Firebase의 인증 및 데이터베이스 보안 기능을 이용하여 개인정보를 관리합니다. 다만 현재 개발/취미 프로젝트 단계로, 상용 서비스 수준의 보안이 완비되지 않았을 수 있음을 안내드립니다.'] },
  { title: '8. 만 14세 미만 아동의 개인정보', body: ['서비스는 만 14세 미만 아동의 회원가입을 별도로 제한하고 있지 않으나, 만 14세 미만 이용자는 법정대리인의 동의를 받아야 합니다.'] },
  { title: '9. 고지의 의무', body: ['이 개인정보처리방침은 관련 법령, 서비스 정책 변경에 따라 수정될 수 있으며, 변경 시 서비스 내 공지사항 등을 통해 안내합니다.'] },
];

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, null, createInitialState);
  const [online, setOnline] = useState(null); // null | { code, localColor, role: 'host'|'guest'|'spectator' }
  const [settings, setSettingsState] = useState(() => loadSettings());
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [user, setUser] = useState(null); // null | { uid, displayName, email, photoURL, emailVerified, isGoogle }
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
        if (card) {
          const result = cur === 'fourToWin'
            ? (state.buffs.fourToWinActive ? 'success' : 'fail')
            : cur === 'miracle'
              ? (state.miracleResult === 'success' ? 'success' : 'fail')
              : null;
          setCardOverlay({ player: p, card, key: Date.now(), result });
        }
      }
    }
    prevLastUsedRef.current = { ...state.lastUsedCard };
  }, [state.lastUsedCard]);

  useEffect(() => {
    if (!cardOverlay) return undefined;
    const duration = cardOverlay.result ? 1500 : 1000;
    const t = setTimeout(() => setCardOverlay(null), duration);
    return () => clearTimeout(t);
  }, [cardOverlay]);

  const updateSettings = useCallback((patch) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  // 처음 화면(설정/메인 메뉴)에 들어왔고, 아직 이번 업데이트 소식을 안 봤다면 팝업을 띄워요.
  useEffect(() => {
    if (state.phase === 'setup' && settings.whatsNewSeenVersion < LATEST_UPDATE.version) {
      setShowWhatsNew(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismissWhatsNew() {
    setShowWhatsNew(false);
  }

  function dismissWhatsNewForever() {
    updateSettings({ whatsNewSeenVersion: LATEST_UPDATE.version });
    setShowWhatsNew(false);
  }

  // 테마 적용
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // 사운드 on/off 반영
  useEffect(() => {
    setSoundEnabled(settings.soundEnabled);
  }, [settings.soundEnabled]);

  // 로그인 상태 구독
  useEffect(() => {
    const unsub = watchAuthState(setUser);
    return unsub;
  }, []);

  // 로그인한 사용자 정보를 검색 가능하도록 저장 (친구 찾기용)
  useEffect(() => {
    if (user && isFirebaseConfigured()) {
      upsertUserProfile(user).catch(() => {});
    }
  }, [user?.uid, user?.displayName, user?.photoURL]);

  // 로그인해있는 동안 접속 상태(온라인/오프라인)를 자동으로 관리
  useEffect(() => {
    if (!user || !isFirebaseConfigured()) return undefined;
    let unsub;
    try {
      unsub = setupPresence(user.uid);
    } catch {
      unsub = () => {};
    }
    return unsub;
  }, [user?.uid]);

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

      // 로그인해있고 "내 색"이 분명한 경우(AI 대전, 온라인 대전) 개인 전적도 기록해요
      if (user && isFirebaseConfigured()) {
        let myColor = null;
        if (online && online.role !== 'spectator') myColor = online.localColor;
        else if (state.aiPlayer) myColor = otherPlayer(state.aiPlayer);
        if (myColor) {
          const result = state.winner === null ? 'draw' : state.winner === myColor ? 'win' : 'loss';
          recordGameResult(user.uid, result).catch(() => {});
        }
      }
    } else if (state.phase !== 'over') {
      recordSavedRef.current = false;
    }
  }, [state.phase, state.winner, state.aiPlayer, state.aiDifficulty, state.history, online, user]);

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
    screen = <SetupScreen dispatch={dispatch} online={online} setOnline={setOnline} settings={settings} updateSettings={updateSettings} user={user} setUser={setUser} />;
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
        user={user}
      />
    );
  }

  return (
    <>
      {screen}
      {isDevAccount(user) && (
        <div className="dev-badge dev-badge-floating">
          <Sparkles size={11} /> 개발자
        </div>
      )}
      {showWhatsNew && (
        <div className="card-use-overlay" style={{ pointerEvents: 'auto' }}>
          <div className="whats-new-modal">
            <button className="whats-new-close" onClick={dismissWhatsNew} aria-label="닫기">
              <XIcon size={18} />
            </button>
            <div className="whats-new-title">{LATEST_UPDATE.title}</div>
            <ul className="whats-new-list">
              {LATEST_UPDATE.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <div className="whats-new-actions">
              <button className="reset-btn" onClick={dismissWhatsNewForever}>다시 보지 않기</button>
              <button className="reset-btn whats-new-confirm-btn" onClick={dismissWhatsNew}>확인</button>
            </div>
          </div>
        </div>
      )}
      {cardOverlay && (
        <div className="card-use-overlay">
          <div
            className={`card-use-overlay-inner ${
              cardOverlay.result === 'success' ? 'card-use-success' : cardOverlay.result === 'fail' ? 'card-use-fail' : ''
            }`}
            key={cardOverlay.key}
          >
            <div className="card-use-overlay-icon"><CardIcon name={cardOverlay.card.icon} size={40} /></div>
            <div className="card-use-overlay-name">{cardOverlay.card.name}</div>
            {cardOverlay.result && (
              <div className={`card-use-result ${cardOverlay.result === 'success' ? 'card-use-result-success' : 'card-use-result-fail'}`}>
                {cardOverlay.result === 'success' ? '발동 성공!' : '발동 실패...'}
              </div>
            )}
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
          const target = computeAITarget(state.activeCard.id, state.board, state.aiPlayer, blockedFn, state.protectedStones);
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

function FriendRow({ friend, busy, onInvite }) {
  const [status, setStatus] = useState({ state: 'offline' });

  useEffect(() => {
    if (!isFirebaseConfigured()) return undefined;
    const unsub = subscribeUserStatus(friend.uid, setStatus);
    return unsub;
  }, [friend.uid]);

  const isOnline = status.state === 'online';

  return (
    <div className="friend-row">
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <UserCircle size={24} />
          <span className={`presence-dot ${isOnline ? 'presence-online' : 'presence-offline'}`} />
        </span>
        {friend.displayName}
        <span className="setup-card-desc" style={{ fontSize: 11 }}>{isOnline ? '온라인' : '오프라인'}</span>
      </span>
      <button className="reset-btn" disabled={busy} onClick={onInvite}>대국 초대</button>
    </div>
  );
}

function SetupScreen({ dispatch, online, setOnline, settings, updateSettings, user, setUser }) {
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
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authNickname, setAuthNickname] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileNickname, setProfileNickname] = useState('');
  const [friendRequests, setFriendRequests] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [invites, setInvites] = useState([]);
  const [friendEmail, setFriendEmail] = useState('');
  const [friendNotice, setFriendNotice] = useState('');
  const [matchmaking, setMatchmaking] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [stats, setStats] = useState({ wins: 0, losses: 0, draws: 0 });
  const [joinPreview, setJoinPreview] = useState(null);
  const [loginNotice, setLoginNotice] = useState('');

  useEffect(() => {
    if (!user || !isFirebaseConfigured()) return undefined;
    const unsub1 = subscribeFriendRequests(user.uid, setFriendRequests);
    const unsub2 = subscribeFriends(user.uid, setFriendsList);
    const unsub3 = subscribeInvites(user.uid, setInvites);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user?.uid]);

  useEffect(() => {
    if (!user || !isFirebaseConfigured()) return undefined;
    const unsub = subscribeStats(user.uid, setStats);
    return unsub;
  }, [user?.uid]);

  async function handleCreateRoom(hostColor) {
    if (!user) { setLoginNotice('온라인 플레이는 로그인 후에 쓸 수 있어요.'); setStep('account'); return; }
    setBusy(true);
    setErrorMsg('');
    try {
      const code = await createRoom(hostColor, settings.timeLimitSec, settings.cardsPerPlayer);
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

  async function handleJoinRoom(codeArg) {
    if (!user) { setLoginNotice('온라인 플레이는 로그인 후에 쓸 수 있어요.'); setStep('account'); return; }
    const code = (codeArg || joinCode).trim().toUpperCase();
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

  async function handleSendFriendRequest() {
    if (!user) return;
    const email = friendEmail.trim();
    if (!email) return;
    setBusy(true);
    setFriendNotice('');
    try {
      const res = await sendFriendRequestByEmail(user, email);
      if (!res.ok) {
        setFriendNotice(
          res.reason === 'not-found' ? '그 이메일로 가입한 사람을 찾지 못했어요.'
          : res.reason === 'self' ? '자기 자신은 추가할 수 없어요.'
          : '이미 친구예요.'
        );
      } else {
        setFriendNotice('친구 요청을 보냈어요!');
        setFriendEmail('');
      }
    } catch {
      setFriendNotice('요청을 보내지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function handleInviteFriend(friendUid) {
    if (!user) return;
    setBusy(true);
    try {
      await inviteFriendToGame(user, friendUid, BLACK, settings.timeLimitSec, settings.cardsPerPlayer);
      setFriendNotice('초대를 보냈어요. 상대가 수락하길 기다려요.');
    } catch {
      setFriendNotice('초대를 보내지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptInvite(invite) {
    updateSettings({ timeLimitSec: invite.timeLimitSec || 0, cardsPerPlayer: invite.cardsPerPlayer || 3 });
    await clearInvite(user.uid, invite.fromUid);
    await handleJoinRoom(invite.code);
  }

  async function handleQuickMatch() {
    if (!user) { setLoginNotice('온라인 플레이는 로그인 후에 쓸 수 있어요.'); setStep('account'); return; }
    setMatchmaking(true);
    setErrorMsg('');
    try {
      const res = await quickMatch(settings.timeLimitSec, settings.cardsPerPlayer);
      if (res.role === 'host') {
        setOnline({
          code: res.code,
          localColor: res.hostColor,
          role: 'host',
          viaQuickMatch: true,
          queueKey: res.queueKey,
          timeLimitSec: settings.timeLimitSec,
          cardsPerPlayer: settings.cardsPerPlayer,
        });
        setStep('online-waiting');
      } else {
        const guestColor = res.hostColor === BLACK ? WHITE : BLACK;
        await joinRoom(res.code);
        setOnline({ code: res.code, localColor: guestColor, role: 'guest' });
        setStep('online-waiting');
      }
    } catch {
      setErrorMsg('매칭에 실패했어요. Firebase 설정을 확인해주세요 (README 참고).');
      setStep('online-error');
    } finally {
      setMatchmaking(false);
    }
  }

  if (step === 'mode') {
    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
          <div className="top-toggles">
            {user && (
              <button className="icon-toggle-btn" onClick={() => setStep('friends')} title="친구" style={{ position: 'relative' }}>
                <Users size={16} />
                {(friendRequests.length + invites.length) > 0 && <span className="notif-dot" />}
              </button>
            )}
            <button className="icon-toggle-btn" onClick={() => setStep('account')} title="계정">
              <UserCircle size={16} />
            </button>
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

          <button
            className="setup-card"
            onClick={() => {
              if (!user) { setLoginNotice('온라인 플레이는 로그인 후에 쓸 수 있어요.'); setStep('account'); return; }
              setModeChoice('online'); setStep('online-menu');
            }}
          >
            <Wifi size={26} strokeWidth={1.6} />
            <div className="setup-card-title">온라인 대국</div>
            <div className="setup-card-desc">친구와 플레이하거나, 랜덤으로 매칭돼요.</div>
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
          <button className="setup-tutorial-link" onClick={() => setStep('contact')}>
            <Mail size={16} /> 문의하기
          </button>
        </div>
      </div>
    );
  }

  if (step === 'friends') {
    if (!user) {
      return (
        <div className="page">
          <header className="header">
            <h1>증강 오목</h1>
          </header>
          <p className="subtitle">친구</p>
          <button className="setup-back" onClick={() => setStep('mode')}>
            <ChevronLeft size={16} /> 설정으로 돌아가기
          </button>
          <p className="setup-card-desc">친구 기능은 로그인 후에 쓸 수 있어요.</p>
          <button className="setup-card" onClick={() => setStep('account')} style={{ marginTop: 12 }}>
            <div className="setup-card-title">로그인하러 가기</div>
          </button>
        </div>
      );
    }

    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
        </header>
        <p className="subtitle">친구</p>

        <button className="setup-back" onClick={() => setStep('mode')}>
          <ChevronLeft size={16} /> 설정으로 돌아가기
        </button>

        {invites.length > 0 && (
          <div className="tutorial-card">
            <div className="tutorial-title"><Bell size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} />받은 대국 초대</div>
            {invites.map((inv) => (
              <div key={inv.fromUid} className="friend-row">
                <span>
                  {inv.displayName}님의 초대
                  <span className="setup-card-desc" style={{ display: 'block', fontSize: 11 }}>
                    시간제한 {inv.timeLimitSec === 0 || !inv.timeLimitSec ? '없음' : `${inv.timeLimitSec}초`} · 카드 {inv.cardsPerPlayer || 3}장
                  </span>
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="reset-btn" disabled={busy} onClick={() => handleAcceptInvite(inv)}>참가</button>
                  <button className="icon-toggle-btn" onClick={() => clearInvite(user.uid, inv.fromUid)} title="거절"><XIcon size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {friendRequests.length > 0 && (
          <div className="tutorial-card">
            <div className="tutorial-title"><UserPlus size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} />친구 요청</div>
            {friendRequests.map((req) => (
              <div key={req.fromUid} className="friend-row">
                <span>{req.displayName}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="reset-btn" disabled={busy} onClick={() => acceptFriendRequest(user.uid, req.fromUid)}>수락</button>
                  <button className="icon-toggle-btn" onClick={() => declineFriendRequest(user.uid, req.fromUid)} title="거절"><XIcon size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="tutorial-card">
          <div className="tutorial-title">이메일로 친구 추가</div>
          <div className="join-form">
            <input
              className="join-input"
              style={{ letterSpacing: 0, fontSize: 14, textTransform: 'none' }}
              value={friendEmail}
              onChange={(e) => setFriendEmail(e.target.value)}
              placeholder="친구의 이메일"
              type="email"
            />
            <button className="reset-btn" disabled={busy} onClick={handleSendFriendRequest}>요청 보내기</button>
          </div>
          {friendNotice && <p className="setup-card-desc">{friendNotice}</p>}
        </div>

        <div className="tutorial-card">
          <div className="tutorial-title">내 친구 ({friendsList.length})</div>
          {friendsList.length === 0 && <p className="setup-card-desc">아직 친구가 없어요.</p>}
          {friendsList.map((f) => (
            <FriendRow key={f.uid} friend={f} busy={busy} onInvite={() => handleInviteFriend(f.uid)} />
          ))}
        </div>
      </div>
    );
  }

  if (step === 'stats') {
    const total = stats.wins + stats.losses + stats.draws;
    const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
        </header>
        <p className="subtitle">내 전적</p>

        <button className="setup-back" onClick={() => setStep('account')}>
          <ChevronLeft size={16} /> 계정으로 돌아가기
        </button>

        <div className="tutorial-card">
          <div className="tutorial-title">전적 요약</div>
          <div className="draft-options" style={{ marginBottom: 0 }}>
            <div className="card-option" style={{ cursor: 'default' }}>
              <div className="card-name">{stats.wins}승</div>
            </div>
            <div className="card-option" style={{ cursor: 'default' }}>
              <div className="card-name">{stats.losses}패</div>
            </div>
            <div className="card-option" style={{ cursor: 'default' }}>
              <div className="card-name">{stats.draws}무</div>
            </div>
          </div>
        </div>

        <div className="tutorial-card">
          <div className="tutorial-title">승률</div>
          <p className="setup-card-desc">
            총 {total}판 중 {stats.wins}승 — 승률 {winRate}%
          </p>
        </div>

        <p className="setup-card-desc">
          AI 대전과 온라인 대전 결과만 기록돼요. 2인이서 대국은 "내 색"이 명확하지 않아서 전적에 포함되지 않아요.
        </p>
      </div>
    );
  }

  if (step === 'contact') {
    const CONTACT_EMAIL = 'uniqueleru12@naver.com';

    function handleSendContact() {
      const subject = encodeURIComponent('[증강 오목] 문의');
      const body = encodeURIComponent(contactMessage || '(내용을 입력하지 않았어요)');
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
      setContactSent(true);
    }

    function handleCopyEmail() {
      navigator.clipboard?.writeText(CONTACT_EMAIL).then(() => {
        setEmailCopied(true);
        setTimeout(() => setEmailCopied(false), 1500);
      });
    }

    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
        </header>
        <p className="subtitle">문의하기</p>

        <button className="setup-back" onClick={() => { setStep('mode'); setContactSent(false); }}>
          <ChevronLeft size={16} /> 메인으로 돌아가기
        </button>

        <div className="tutorial-card">
          <div className="tutorial-title">궁금한 점이나 버그, 건의사항을 남겨주세요</div>
          <p className="setup-card-desc" style={{ marginBottom: 10 }}>
            아래에 내용을 적고 "메일로 보내기"를 누르면, 이 기기에 설정된 메일 앱이 열리면서
            <b> {CONTACT_EMAIL}</b> 주소로 보낼 준비가 돼요. 메일 앱이 안 열리면 주소를 복사해서
            직접 보내주셔도 돼요.
          </p>
          <textarea
            className="join-input"
            style={{
              width: '100%', minHeight: 120, letterSpacing: 0, fontSize: 14,
              textTransform: 'none', resize: 'vertical', fontFamily: 'inherit',
              textAlign: 'left', fontWeight: 400, lineHeight: 1.5,
            }}
            value={contactMessage}
            onChange={(e) => setContactMessage(e.target.value)}
            placeholder="예) 특정 카드 사용 시 화면이 멈춰요, 이런 기능이 있었으면 좋겠어요 등"
          />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button className="reset-btn whats-new-confirm-btn" onClick={handleSendContact}>
              <Mail size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> 메일로 보내기
            </button>
            <button className="reset-btn" onClick={handleCopyEmail}>
              {emailCopied ? '복사됨!' : `${CONTACT_EMAIL} 복사`}
            </button>
          </div>

          {contactSent && (
            <p className="setup-card-desc" style={{ marginTop: 10 }}>
              메일 앱을 열었어요. 만약 안 열렸다면 위 주소를 복사해서 직접 메일을 보내주세요.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (step === 'terms' || step === 'privacy') {
    const sections = step === 'terms' ? TERMS_SECTIONS : PRIVACY_SECTIONS;
    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
        </header>
        <p className="subtitle">{step === 'terms' ? '이용약관' : '개인정보처리방침'}</p>

        <button className="setup-back" onClick={() => setStep('account')}>
          <ChevronLeft size={16} /> 계정으로 돌아가기
        </button>

        {sections.map((sec, i) => (
          <div key={i} className="tutorial-card">
            <div className="tutorial-title">{sec.title}</div>
            <ul className="tutorial-body">
              {sec.body.map((line, j) => (
                <li key={j}>{line}</li>
              ))}
            </ul>
          </div>
        ))}

        <p className="setup-card-desc">시행일자: {EFFECTIVE_DATE}</p>
      </div>
    );
  }

  if (step === 'account') {
    async function handleGoogleLogin() {
      setBusy(true);
      setErrorMsg('');
      try {
        await signInWithGoogle();
      } catch (e) {
        setErrorMsg(mapAuthError(e.code));
      } finally {
        setBusy(false);
      }
    }

    async function handleEmailAuth() {
      if (authMode === 'signup' && authPassword.length < 8) {
        setErrorMsg('비밀번호는 8자 이상이어야 해요.');
        return;
      }
      setBusy(true);
      setErrorMsg('');
      setAuthNotice('');
      try {
        if (authMode === 'signup') {
          await signUpWithEmail(authEmail.trim(), authPassword, authNickname.trim());
          setAuthNotice('인증 메일을 보냈어요! 메일함을 확인하고 링크를 눌러주세요.');
        } else {
          await signInWithEmail(authEmail.trim(), authPassword);
        }
      } catch (e) {
        setErrorMsg(mapAuthError(e.code));
      } finally {
        setBusy(false);
      }
    }

    async function handleResend() {
      setBusy(true);
      try {
        await resendVerificationEmail();
        setAuthNotice('인증 메일을 다시 보냈어요.');
      } catch {
        setErrorMsg('메일을 다시 보내지 못했어요.');
      } finally {
        setBusy(false);
      }
    }

    async function handleSaveProfile() {
      setBusy(true);
      setErrorMsg('');
      try {
        const updated = await updateUserProfile({
          displayName: profileNickname.trim() || null,
          photoURL: null,
        });
        setUser(updated);
        setEditingProfile(false);
      } catch {
        setErrorMsg('프로필을 저장하지 못했어요.');
      } finally {
        setBusy(false);
      }
    }

    async function handleDeleteAccount() {
      setBusy(true);
      setDeleteError('');
      try {
        await deleteAccount(deletePassword || undefined);
        await deleteUserData(user.uid, user.email);
        setShowDeleteConfirm(false);
        setStep('mode');
      } catch (e) {
        if (e.code === 'auth/requires-recent-login' && !user.isGoogle) {
          setDeleteError('비밀번호를 입력해주세요.');
        } else {
          setDeleteError(mapAuthError(e.code));
        }
      } finally {
        setBusy(false);
      }
    }

    if (user) {
      return (
        <div className="page">
          <header className="header">
            <h1>증강 오목</h1>
          </header>
          <p className="subtitle">내 계정</p>

          <button className="setup-back" onClick={() => setStep('mode')}>
            <ChevronLeft size={16} /> 설정으로 돌아가기
          </button>

          <div className="tutorial-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <UserCircle size={40} />
              <div>
                <div className="tutorial-title" style={{ marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {user.displayName || '이름 없음'}
                  {isDevAccount(user) && (
                    <span className="dev-badge">
                      <Sparkles size={11} /> 개발자
                    </span>
                  )}
                </div>
                <div className="setup-card-desc">{user.email}</div>
              </div>
            </div>

            {!user.isGoogle && !user.emailVerified && (
              <div className="setup-warning">
                이메일 인증이 아직 안 됐어요. 메일함에서 인증 링크를 눌러주세요.
                <div style={{ marginTop: 8 }}>
                  <button className="reset-btn" disabled={busy} onClick={handleResend}>인증 메일 다시 보내기</button>
                </div>
              </div>
            )}

            {!editingProfile ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="reset-btn"
                  onClick={() => {
                    setProfileNickname(user.displayName || '');
                    setEditingProfile(true);
                  }}
                >
                  프로필 편집
                </button>
                <button className="reset-btn" onClick={() => signOutUser()}>
                  <LogOut size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> 로그아웃
                </button>
                <button className="reset-btn confirm-danger-btn" onClick={() => { setDeleteError(''); setDeletePassword(''); setShowDeleteConfirm(true); }}>
                  회원 탈퇴
                </button>
              </div>
            ) : (
              <div>
                <div className="setup-card-desc" style={{ marginBottom: 6 }}>닉네임</div>
                <input
                  className="join-input"
                  style={{ letterSpacing: 0, fontSize: 14, marginBottom: 10, width: '100%', textTransform: 'none' }}
                  value={profileNickname}
                  onChange={(e) => setProfileNickname(e.target.value)}
                  placeholder="닉네임"
                />
                <p className="setup-card-desc" style={{ marginBottom: 12 }}>
                  프로필 사진은 모두 기본 아이콘으로 표시돼요.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="reset-btn" disabled={busy} onClick={handleSaveProfile}>저장</button>
                  <button className="reset-btn" onClick={() => setEditingProfile(false)}>취소</button>
                </div>
              </div>
            )}
          </div>

          <div className="setup-links-row">
            <button className="setup-tutorial-link" onClick={() => setStep('stats')}>
              <Trophy size={16} /> 내 전적 보기
            </button>
            <button className="setup-tutorial-link" onClick={() => setStep('terms')}>이용약관</button>
            <button className="setup-tutorial-link" onClick={() => setStep('privacy')}>개인정보처리방침</button>
          </div>

          {showDeleteConfirm && (
            <div className="card-use-overlay" style={{ pointerEvents: 'auto' }}>
              <div className="confirm-modal">
                <div className="confirm-modal-title">정말 탈퇴하시겠습니까?</div>
                <p className="confirm-modal-desc">
                  탈퇴하면 프로필, 친구 목록, 전적이 모두 삭제되고 되돌릴 수 없어요.
                </p>
                {!user.isGoogle && (
                  <input
                    className="join-input"
                    style={{ letterSpacing: 0, fontSize: 14, textTransform: 'none', width: '100%' }}
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="확인을 위해 비밀번호 입력"
                  />
                )}
                {deleteError && <p className="setup-warning" style={{ marginTop: 8 }}>{deleteError}</p>}
                <div className="confirm-modal-actions">
                  <button className="reset-btn" onClick={() => setShowDeleteConfirm(false)}>취소</button>
                  <button className="reset-btn confirm-danger-btn" disabled={busy} onClick={handleDeleteAccount}>탈퇴하기</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
        </header>
        <p className="subtitle">로그인 / 계정 만들기</p>

        <button className="setup-back" onClick={() => setStep('mode')}>
          <ChevronLeft size={16} /> 설정으로 돌아가기
        </button>

        {!isFirebaseConfigured() && (
          <p className="setup-warning">계정 기능을 쓰려면 firebaseConfig.js 설정이 필요해요.</p>
        )}

        {loginNotice && <p className="setup-warning">{loginNotice}</p>}

        <button className="setup-card" disabled={busy} onClick={handleGoogleLogin} style={{ marginBottom: 16 }}>
          <div className="setup-card-title">구글로 로그인</div>
          <div className="setup-card-desc">한 번 클릭으로 바로 시작해요.</div>
        </button>

        <div className="tutorial-card">
          <div className="tutorial-title">{authMode === 'signup' ? '이메일로 계정 만들기' : '이메일로 로그인'}</div>

          {authMode === 'signup' && (
            <input
              className="join-input"
              style={{ letterSpacing: 0, fontSize: 14, marginBottom: 10, width: '100%', textTransform: 'none' }}
              value={authNickname}
              onChange={(e) => setAuthNickname(e.target.value)}
              placeholder="닉네임"
            />
          )}
          <input
            className="join-input"
            style={{ letterSpacing: 0, fontSize: 14, marginBottom: 10, width: '100%', textTransform: 'none' }}
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            placeholder="이메일"
            type="email"
          />
          <input
            className="join-input"
            style={{ letterSpacing: 0, fontSize: 14, marginBottom: 12, width: '100%', textTransform: 'none' }}
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            placeholder="비밀번호 (8자 이상)"
            type="password"
          />
          <button className="reset-btn" disabled={busy} onClick={handleEmailAuth} style={{ width: '100%', marginBottom: 10 }}>
            {authMode === 'signup' ? '가입하고 인증메일 받기' : '로그인'}
          </button>
          <button
            className="setup-tutorial-link"
            onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setErrorMsg(''); setAuthNotice(''); }}
          >
            {authMode === 'signup' ? '이미 계정이 있어요' : '계정이 없어요, 새로 만들게요'}
          </button>
        </div>

        {authNotice && <p className="setup-warning" style={{ color: 'var(--accent)' }}>{authNotice}</p>}
        {errorMsg && <p className="setup-warning">{errorMsg}</p>}

        <div className="setup-links-row">
          <button className="setup-tutorial-link" onClick={() => setStep('terms')}>이용약관</button>
          <button className="setup-tutorial-link" onClick={() => setStep('privacy')}>개인정보처리방침</button>
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
    if (!user) {
      return (
        <div className="page">
          <header className="header">
            <h1>증강 오목</h1>
          </header>
          <p className="subtitle">온라인 대국 방식을 선택하세요</p>
          <button className="setup-back" onClick={() => setStep('mode')}>
            <ChevronLeft size={16} /> 뒤로
          </button>
          <p className="setup-card-desc">온라인 플레이는 로그인 후에 쓸 수 있어요.</p>
          <button className="setup-card" onClick={() => setStep('account')} style={{ marginTop: 12 }}>
            <div className="setup-card-title">로그인하러 가기</div>
          </button>
        </div>
      );
    }
    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
        </header>
        <p className="subtitle">온라인 대국 방식을 선택하세요</p>

        <button className="setup-back" onClick={() => setStep('mode')}>
          <ChevronLeft size={16} /> 뒤로
        </button>

        {!isFirebaseConfigured() && (
          <p className="setup-warning">
            온라인 기능을 쓰려면 firebaseConfig.js 설정이 필요해요. README의 "온라인 대전 설정하기"를 참고하세요.
          </p>
        )}

        <div className="setup-options">
          <button
            className="setup-card"
            onClick={() => {
              if (!user) { setLoginNotice('온라인 플레이는 로그인 후에 쓸 수 있어요.'); setStep('account'); return; }
              setStep('online-friend-menu');
            }}
          >
            <Users size={22} strokeWidth={1.6} />
            <div className="setup-card-title">친구와 플레이</div>
            <div className="setup-card-desc">방을 만들거나, 받은 코드로 참가·관전해요.</div>
          </button>

          <button className="setup-card" disabled={matchmaking} onClick={handleQuickMatch}>
            <Dice5 size={22} strokeWidth={1.6} />
            <div className="setup-card-title">{matchmaking ? '상대를 찾는 중...' : '랜덤 매칭'}</div>
            <div className="setup-card-desc">아무나와 바로 매칭돼요. 코드 없이 즉시 시작해요.</div>
          </button>
        </div>
      </div>
    );
  }

  if (step === 'online-friend-menu') {
    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
        </header>
        <p className="subtitle">친구와 온라인으로 플레이해요</p>

        <button className="setup-back" onClick={() => setStep('online-menu')}>
          <ChevronLeft size={16} /> 뒤로
        </button>

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

        <button className="setup-back" onClick={() => setStep('online-friend-menu')}>
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

  async function handleLookupCode() {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setErrorMsg('6자리 코드를 입력해주세요.');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await peekRoom(code);
      if (!res.ok) {
        setErrorMsg('존재하지 않는 코드예요.');
        setBusy(false);
        return;
      }
      setJoinPreview({ code, ...res });
    } catch {
      setErrorMsg('조회하지 못했어요. Firebase 설정을 확인해주세요 (README 참고).');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'online-join') {
    return (
      <div className="page">
        <header className="header">
          <h1>증강 오목</h1>
        </header>
        <p className="subtitle">받은 6자리 코드를 입력하세요</p>

        <button className="setup-back" onClick={() => { setJoinPreview(null); setStep('online-friend-menu'); }}>
          <ChevronLeft size={16} /> 뒤로
        </button>

        {!joinPreview ? (
          <div className="join-form">
            <input
              className="join-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              maxLength={6}
              autoFocus
            />
            <button className="reset-btn" disabled={busy} onClick={handleLookupCode}>
              확인
            </button>
          </div>
        ) : (
          <div className="tutorial-card">
            <div className="tutorial-title">이 방으로 참가할까요?</div>
            <ul className="tutorial-body">
              <li>방장 색: {PLAYER_LABEL[joinPreview.hostColor]} (나는 {PLAYER_LABEL[otherPlayer(joinPreview.hostColor)]}이 돼요)</li>
              <li>한 수당 제한 시간: {joinPreview.timeLimitSec === 0 ? '없음' : `${joinPreview.timeLimitSec}초`}</li>
              <li>1인당 카드 개수: {joinPreview.cardsPerPlayer}장</li>
              {joinPreview.status !== 'waiting' && <li>이미 대국이 진행 중인 방이라, 참가하면 관전자로 들어가요.</li>}
            </ul>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="reset-btn" onClick={() => setJoinPreview(null)}>취소</button>
              <button className="reset-btn" disabled={busy} onClick={() => handleJoinRoom(joinPreview.code)}>참가하기</button>
            </div>
          </div>
        )}

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
            : online?.viaQuickMatch
              ? '아무나와 매칭되길 기다리는 중이에요'
              : online?.role === 'host'
                ? '친구가 들어오길 기다리는 중이에요'
                : '호스트가 게임을 시작하길 기다리는 중이에요'}
        </p>

        {online?.role === 'host' && !online?.viaQuickMatch && (
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

        {online?.viaQuickMatch && (
          <button
            className="reset-btn"
            onClick={async () => {
              await cancelQuickMatch(online.code, online.queueKey);
              await leaveRoom(online.code);
              setOnline(null);
              setStep('online-menu');
            }}
          >
            취소
          </button>
        )}
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

function ChatPanel({ online, user }) {
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

  const colorLabel = online.role === 'spectator' ? '관전자' : PLAYER_LABEL[online.localColor];
  const myLabel = user?.displayName ? `${user.displayName} (${colorLabel})` : colorLabel;

  function send(t) {
    const trimmed = t.trim();
    if (!trimmed) return;
    sendChatMessage(online.code, myLabel, trimmed, isDevAccount(user)).catch(() => {});
    setText('');
  }

  return (
    <div className="chat-panel">
      <div className="chat-title"><MessageCircle size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />채팅</div>
      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && <span className="chat-empty">아직 메시지가 없어요.</span>}
        {messages.map((m) => (
          <div key={m.id} className={`chat-message ${m.sender === myLabel ? 'chat-message-mine' : ''}`}>
            <span className="chat-sender">{m.sender}</span>
            {m.isDev && (
              <span className="dev-badge chat-dev-badge">
                <Sparkles size={9} /> 개발자
              </span>
            )}
            {m.text}
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

function GameScreen({ state, dispatch, online, onReset, settings, updateSettings, user }) {
  const gameOver = state.phase === 'over';
  const isAITurn = state.aiPlayer && state.turn === state.aiPlayer && !gameOver;
  const isSpectator = online && online.role === 'spectator';
  const isOnlineWaiting = online && !isSpectator && state.turn !== online.localColor && !gameOver;
  const [showResignConfirm, setShowResignConfirm] = useState(false);

  let modeLabel = '2인 대국';
  if (state.aiPlayer) modeLabel = `AI 대전 · AI는 ${PLAYER_LABEL[state.aiPlayer]} · 난이도 ${DIFFICULTIES[state.aiDifficulty]?.label ?? '보통'}`;
  if (online) {
    modeLabel = isSpectator
      ? `온라인 대전 · 방 ${online.code} · 관전 중`
      : `온라인 대전 · 방 ${online.code} · 나는 ${PLAYER_LABEL[online.localColor]}`;
  }

  function resignPlayer() {
    if (online && !isSpectator) return online.localColor;
    if (state.aiPlayer) return otherPlayer(state.aiPlayer);
    return undefined; // 2인 대국은 현재 턴 쪽이 기권한 걸로 처리
  }

  function confirmResign() {
    dispatch({ type: 'RESIGN', player: resignPlayer() });
    setShowResignConfirm(false);
  }

  function handleRematch() {
    if (online && !isSpectator) {
      dispatch({ type: 'REQUEST_REMATCH', player: online.localColor });
      return;
    }
    dispatch({
      type: 'START_GAME',
      aiPlayer: state.aiPlayer,
      difficulty: state.aiDifficulty,
      timeLimitSec: state.timeLimitSec,
      cardsPerPlayer: state.draft.order.length / 2,
    });
  }

  const myRematchVote = online && !isSpectator ? state.rematchVotes[online.localColor] : false;
  const opponentRematchVote = online && !isSpectator ? state.rematchVotes[otherPlayer(online.localColor)] : false;

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
        <div style={{ display: 'flex', gap: 8 }}>
          {isSpectator ? (
            <button className="reset-btn" onClick={onReset}>나가기</button>
          ) : gameOver ? (
            <>
              <button className="reset-btn" disabled={myRematchVote} onClick={handleRematch}>
                {online ? (myRematchVote ? '상대 대기 중...' : '재대국') : '재대국'}
              </button>
              <button className="reset-btn" onClick={onReset}>다시 시작</button>
            </>
          ) : (
            <button className="reset-btn" onClick={() => setShowResignConfirm(true)}>기권</button>
          )}
        </div>
      </div>

      {online && gameOver && (myRematchVote || opponentRematchVote) && (
        <p className="setup-card-desc" style={{ marginTop: -10, marginBottom: 12 }}>
          {myRematchVote && opponentRematchVote
            ? '재대국이 성사됐어요!'
            : myRematchVote
              ? '재대국을 신청했어요. 상대의 동의를 기다리는 중...'
              : '상대가 재대국을 신청했어요. "재대국"을 눌러 수락하세요.'}
        </p>
      )}

      {showResignConfirm && (
        <div className="card-use-overlay" style={{ pointerEvents: 'auto' }}>
          <div className="confirm-modal">
            <div className="confirm-modal-title">기권하시겠습니까?</div>
            <p className="confirm-modal-desc">기권하면 상대의 승리로 게임이 바로 끝나요.</p>
            <div className="confirm-modal-actions">
              <button className="reset-btn" onClick={() => setShowResignConfirm(false)}>취소</button>
              <button className="reset-btn confirm-danger-btn" onClick={confirmResign}>기권하기</button>
            </div>
          </div>
        </div>
      )}

      <TurnTimer state={state} dispatch={dispatch} online={online} />

      <div className="board-scroll">
        <Board state={state} dispatch={dispatch} online={online} />
      </div>

      <div className="hands-row">
        {[BLACK, WHITE].map((p) => (
          <HandPanel key={p} player={p} state={state} dispatch={dispatch} disabled={gameOver} online={online} />
        ))}
      </div>

      {online && <ChatPanel online={online} user={user} />}
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
            const isLastMove = state.lastMove && state.lastMove.x === x && state.lastMove.y === y;

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
                  >
                    {isLastMove && <span className="last-move-dot" />}
                  </span>
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
