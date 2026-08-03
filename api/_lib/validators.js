// 순수 함수로 분리해둔 핵심 검증 로직이에요 (Firebase Admin 없이도 직접 테스트할 수 있어요).
import { BLACK, WHITE, WILD, checkWin, isForbiddenMove } from './gameLogic.js';
import { getTierForRating } from './tiers.js';

// ⚠️ 중요: 클라이언트(src/network.js)는 rooms/{code}/state를 객체가 아니라
// JSON.stringify()한 "문자열"로 Firebase에 저장해요 (읽을 때는 JSON.parse로 되돌려요).
// 이걸 모르고 room.state.board처럼 곧바로 접근하면 항상 undefined만 나와서, 검증이
// 실제로는 한 번도 제대로 동작하지 않고 매번 "정보가 이상함"으로 취급되며 그냥
// 통과되기만 했을 거예요. 그래서 항상 이 함수를 통해서만 state를 꺼내요 (이미 객체로
// 들어오는 경우 — 테스트에서 순수 객체를 바로 넣는 경우 — 도 그대로 지원해요).
export // 클라이언트(src/network.js)가 Infinity 값(영구 차단 표시 등)을 JSON으로 저장할 때,
// JSON.stringify가 Infinity를 그냥 없애버리는 문제 때문에 특별한 문자열 마커로 바꿔서
// 저장해요. 여기서도 똑같이 되돌려줘야 blockedCells의 "영구 차단"이 서버에서도 정확히
// 인식돼요 (안 그러면 장벽/판 축소 같은 카드로 막은 칸을 서버가 "안 막혔다"고 오판해요).
const INFINITY_MARKER = '__Infinity__';
function stateReviver(_key, value) {
  return value === INFINITY_MARKER ? Infinity : value;
}

export function parseRoomState(room) {
  if (!room) return null;
  const raw = room.state;
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw, stateReviver);
    } catch {
      return null;
    }
  }
  return raw;
}

function isBlockedCell(blockedCells, x, y, ply) {
  const expire = blockedCells?.[`${x},${y}`];
  if (expire === undefined || expire === null) return false;
  return expire === Infinity || expire === 'Infinity' || ply < expire;
}

// room: { hostUid, guestUid, hostColor, state } / uid: 요청한 사람 / x,y: 두려는 좌표
// 반환: { ok: true, myColor, wouldWin } 또는 { ok: false, code, message }
export function validatePlacement(room, uid, x, y) {
  if (!uid) return { ok: false, code: 'unauthenticated', message: '로그인 후에 대국을 할 수 있어요.' };
  if (!room) return { ok: false, code: 'not-found', message: '존재하지 않는 방이에요.' };

  const state = parseRoomState(room);
  if (!state) return { ok: false, code: 'failed-precondition', message: '아직 대국이 시작되지 않았어요.' };

  let myColor = null;
  if (room.hostUid && room.hostUid === uid) myColor = room.hostColor;
  else if (room.guestUid && room.guestUid === uid) myColor = room.hostColor === BLACK ? WHITE : BLACK;
  if (!myColor) return { ok: false, code: 'permission-denied', message: '이 방의 참가자가 아니에요.' };

  if (state.phase !== 'play') return { ok: false, code: 'stale-state', message: '지금은 착수할 수 있는 상태가 아니에요.' };
  if (state.turn !== myColor) return { ok: false, code: 'stale-state', message: '내 턴이 아니에요.' };

  const board = state.board;
  const size = board.length;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= size || y < 0 || y >= size) {
    return { ok: false, code: 'invalid-argument', message: '판 밖의 좌표예요.' };
  }
  if (board[y][x] !== 0) return { ok: false, code: 'failed-precondition', message: '이미 돌이 있는 칸이에요.' };
  if (isBlockedCell(state.blockedCells, x, y, state.ply)) {
    return { ok: false, code: 'failed-precondition', message: '지금은 놓을 수 없는 칸이에요.' };
  }
  const forbidden = isForbiddenMove(board, x, y, myColor, state.ruleFlags || {});
  if (forbidden) return { ok: false, code: 'failed-precondition', message: `금수 자리예요 (${forbidden}).` };

  const winLength = state.winLengthOverride?.[myColor] ?? 5;
  const nextBoard = board.map((row) => row.slice());
  nextBoard[y][x] = myColor;
  const won = checkWin(nextBoard, x, y, myColor, {
    winLength,
    excludeDiagonal: state.ruleFlags?.noDiagonalFor === myColor,
    markedStones: state.markedStones,
    sealedLines: state.sealedLines,
  });

  return { ok: true, myColor, wouldWin: won };
}

// 룰렛 "색깔 교대전"(10수마다 보드 전체 흑/백 반전), "자동 소멸"(오래된 돌 자동 제거)처럼
// 착수 외의 순간에도 보드가 바뀌는 규칙이 있어요. 이런 경우 착수 하나에 여러 칸이 달라지는
// 게 정상이라, 엄격한 "딱 1칸만 바뀜" 검증을 적용하면 정상 승리까지 오탐지해서 막아버려요.
// 그래서 이런 규칙이 활성화된 게임은 완화된 검증(그 칸에 정확한 색이 실제로 놓였는지만
// 확인)을 쓰고, 그 외의 평범한 게임만 엄격하게 검증해요.
const BOARD_MUTATING_ROULETTE_RULES = new Set(['colorSwap', 'autoDecay']);

// 카드의 targets 배열 중 index번째 좌표가 실제 변화 위치(diff)와 일치하는지 확인해요.
// targets 정보가 없는 옛날 기록 등은 너그럽게 통과시켜요(좌표 자체 검증만 못 할 뿐, 색/개수
// 검증은 이미 위에서 끝났어요).
function targetMatches(targets, index, diff) {
  const t = targets?.[index];
  if (!t) return true;
  return t.x === diff.x && t.y === diff.y;
}

// state.moveLog는 한 수 한 수마다 그 시점의 보드 스냅샷을 같이 기록해둬요. 이걸 이용해서,
// "돌 놓기(place)" 타입 기록들이 실제로 매번 딱 한 칸만, 그것도 기록된 사람의 색으로,
// 원래 비어있던 곳에 놓인 게 맞는지 하나하나 대조해요. 카드 효과(파괴/변환 등)로 인한
// 변화까지는 검증하지 않지만(그건 별도의 큰 작업이에요), 이 정도만으로도 콘솔에서
// 보드 배열을 직접 통째로 바꿔치기하는 식의 "빠르고 티 나는" 조작은 걸러낼 수 있어요.
function validateMoveLogIntegrity(moveLog, rouletteRule, challengeId, humanColor) {
  const strict = !BOARD_MUTATING_ROULETTE_RULES.has(rouletteRule);
  if (!Array.isArray(moveLog) || moveLog.length === 0) {
    return { ok: false, message: '대국 기록이 없어요.' };
  }
  let prevBoard = null;
  for (const entry of moveLog) {
    if (!entry || !Array.isArray(entry.board)) {
      return { ok: false, message: '대국 기록의 보드 정보가 이상해요.' };
    }
    if (prevBoard && entry.type === 'place') {
      const size = entry.board.length;
      if (prevBoard.length !== size) {
        return { ok: false, message: '대국 기록 중 판 크기가 갑자기 바뀌었어요.' };
      }
      const expectedColor = entry.placedColor ?? entry.player;
      if (!strict) {
        // 완화된 검증: 기록된 좌표에 실제로 정확한 색이 놓여있기만 하면 통과해요.
        if (entry.board[entry.y]?.[entry.x] !== expectedColor) {
          return { ok: false, message: `${entry.seq}번째 기록의 좌표에 기록된 색이 실제로 없어요.` };
        }
        prevBoard = entry.board;
        continue;
      }
      let diffCount = 0;
      const diffs = [];
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (entry.board[y][x] !== prevBoard[y][x]) {
            diffCount++;
            diffs.push({ x, y, before: prevBoard[y][x], after: entry.board[y][x] });
          }
        }
      }
      // 착수와 같은 타이밍에 "시한폭탄"이 터지면 그 폭발(최대 3x3칸 제거)까지 같은 기록에
      // 함께 반영돼요. 그래서 "빈 칸 → 내 색"으로 바뀐 추가는 정확히 1개만 있어야 하고,
      // 그 나머지는 전부 "돌이 있던 칸 → 빈 칸"(제거, 폭탄 효과)만 허용해요.
      const additions = diffs.filter((d) => d.before === 0);
      const removals = diffs.filter((d) => d.before !== 0 && d.after === 0);
      const weird = diffs.filter((d) => d.before !== 0 && d.after !== 0);
      if (additions.length !== 1 || weird.length > 0 || additions.length + removals.length !== diffCount) {
        return { ok: false, message: `${entry.seq}번째 기록에서 한 수에 이상한 변화가 있어요.` };
      }
      const diffCell = additions[0];
      if (diffCell.after !== expectedColor) {
        return { ok: false, message: `${entry.seq}번째 기록의 돌 색이 실제 놓인 색과 달라요.` };
      }
      if (diffCell.x !== entry.x || diffCell.y !== entry.y) {
        return { ok: false, message: `${entry.seq}번째 기록의 좌표가 실제 변화 위치와 달라요.` };
      }
    } else if (prevBoard && entry.type === 'card') {
      const size = entry.board.length;
      if (prevBoard.length === size) {
        let diffs = [];
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            if (entry.board[y][x] !== prevBoard[y][x]) {
              diffs.push({ x, y, before: prevBoard[y][x], after: entry.board[y][x] });
            }
          }
        }
        const mover = entry.player;
        const opponent = mover === BLACK ? WHITE : BLACK;
        const cardId = entry.cardId;

        // 챌린지 "유리 심장": 어떤 카드든 돌 하나만 파괴/변환해도 내(사람) 돌 전부가 같이
        // 사라져요. 그러면 카드 하나의 원래 효과보다 훨씬 많은 칸이 한꺼번에 바뀌어서,
        // 아래의 카드별 정밀 검증이 이걸 조작으로 오해할 수 있어요. alchemy/swap/overwrite/
        // wildcard처럼 "OO → 0"이 원래 효과에 없는 카드는 그런 칸을 전부 미리 빼고
        // 검증해요. destroy/destroyChain처럼 원래 효과 자체가 "상대 돌 → 0"인 카드는
        // (상대가 마침 사람일 수도 있어서) 뒤에서 별도로 판단해요.
        const isGlassHeart = challengeId === 'glassHeart' && !!humanColor;
        if (isGlassHeart && !['destroy', 'destroyChain'].includes(cardId)) {
          diffs = diffs.filter((d) => !(d.before === humanColor && d.after === 0));
        }

        // "반사" 카드가 활성화되어 있으면, 파괴 계열 효과(파괴/연쇄파괴/연금술/동전던지기/
        // 주사위/낙뢰/해일/침식)를 걸었다가 오히려 그대로 반사당해서, 원래 대상이 아니라
        // 시전자(mover) 자신의 돌 하나가 파괴되는 것으로 결과가 완전히 바뀔 수 있어요.
        // 이 경우 diffs가 "시전자 자신의 돌 1개 → 0"이라는, 각 카드 고유의 패턴과는 전혀
        // 다른 모양이 되는데, 이것도 정상적인 결과라서 카드별 정밀 검증보다 먼저 확인해요.
        const REFLECTABLE_CARDS = new Set(['destroy', 'destroyChain', 'alchemy', 'coinFlip', 'dice', 'lightning', 'tsunami', 'erosion']);
        if (REFLECTABLE_CARDS.has(cardId) && diffs.length === 1 && diffs[0].before === mover && diffs[0].after === 0) {
          prevBoard = entry.board;
          continue;
        }

        // 위험도가 높은 카드들(상대 돌 제거/전환, 위치 조작)은 실제 효과 모양까지 정확히 대조해요.
        if (cardId === 'destroy') {
          const t = entry.targets?.[0];
          const primary = t && diffs.find((d) => d.x === t.x && d.y === t.y && d.before === opponent && d.after === 0);
          const rest = diffs.filter((d) => d !== primary);
          const restOk = isGlassHeart ? rest.every((d) => d.before === humanColor && d.after === 0) : rest.length === 0;
          if (!primary || !restOk) {
            return { ok: false, message: `${entry.seq}번째 '파괴' 카드 기록이 실제 효과와 안 맞아요.` };
          }
        } else if (cardId === 'destroyChain') {
          const t = entry.targets?.[0];
          const hasSeed = t && diffs.some((d) => d.x === t.x && d.y === t.y && d.before === opponent && d.after === 0);
          const opponentRemovals = diffs.filter((d) => d.before === opponent && d.after === 0);
          const rest = diffs.filter((d) => !(d.before === opponent && d.after === 0));
          const restOk = isGlassHeart ? rest.every((d) => d.before === humanColor && d.after === 0) : rest.length === 0;
          if (!hasSeed || opponentRemovals.length > 2 || !restOk) {
            return { ok: false, message: `${entry.seq}번째 '연쇄 파괴' 카드 기록이 실제 효과와 안 맞아요.` };
          }
        } else if (cardId === 'alchemy') {
          if (diffs.length !== 1 || diffs[0].before !== opponent || diffs[0].after !== mover) {
            return { ok: false, message: `${entry.seq}번째 '연금술' 카드 기록이 실제 효과와 안 맞아요.` };
          }
          if (!targetMatches(entry.targets, 0, diffs[0])) {
            return { ok: false, message: `${entry.seq}번째 '연금술' 카드의 대상 좌표가 실제 변화 위치와 달라요.` };
          }
        } else if (cardId === 'swap') {
          const validSwap = diffs.length === 2 && (
            (diffs[0].before === mover && diffs[0].after === opponent && diffs[1].before === opponent && diffs[1].after === mover)
            || (diffs[0].before === opponent && diffs[0].after === mover && diffs[1].before === mover && diffs[1].after === opponent)
          );
          if (!validSwap) {
            return { ok: false, message: `${entry.seq}번째 '위치 교환' 카드 기록이 실제 효과와 안 맞아요.` };
          }
        } else if (cardId === 'overwrite') {
          if (diffs.length !== 1 || diffs[0].before === 0 || diffs[0].after !== mover) {
            return { ok: false, message: `${entry.seq}번째 '관통' 카드 기록이 실제 효과와 안 맞아요.` };
          }
          if (!targetMatches(entry.targets, 0, diffs[0])) {
            return { ok: false, message: `${entry.seq}번째 '관통' 카드의 대상 좌표가 실제 변화 위치와 달라요.` };
          }
        } else if (cardId === 'wildcard') {
          if (diffs.length !== 1 || diffs[0].before !== 0 || diffs[0].after !== WILD) {
            return { ok: false, message: `${entry.seq}번째 '와일드카드' 기록이 실제 효과와 안 맞아요.` };
          }
          if (!targetMatches(entry.targets, 0, diffs[0])) {
            return { ok: false, message: `${entry.seq}번째 '와일드카드'의 대상 좌표가 실제 변화 위치와 달라요.` };
          }
        } else if (cardId === 'mark' || cardId === 'duplicate' || cardId === 'trade') {
          // 이 카드들은 보드 자체를 안 바꿔요(낙인은 표시만, 복제/거래는 손패만 변해요).
          if (diffs.length !== 0) {
            return { ok: false, message: `${entry.seq}번째 '${entry.cardId}' 카드가 보드를 바꾸면 안 되는데 바뀌었어요.` };
          }
        } else if (cardId === 'coinFlip') {
          // 지정한 상대 돌 2개 각각 50%로 파괴 - 0~2개까지 파괴될 수 있어요.
          const targetKeys = new Set((entry.targets || []).map((t) => `${t.x},${t.y}`));
          if (diffs.length > 2 || diffs.some((d) => d.before !== opponent || d.after !== 0 || !targetKeys.has(`${d.x},${d.y}`))) {
            return { ok: false, message: `${entry.seq}번째 '동전 던지기' 카드 기록이 실제 효과와 안 맞아요.` };
          }
        } else if (cardId === 'dice') {
          // 지정한 상대 돌 1개 + 인접 최대 2개까지, 최대 3개 파괴돼요. 대상 자신은 항상
          // 파괴 후보에 포함되지만, "실패"(1~2)면 0개예요.
          if (diffs.length > 3 || diffs.some((d) => d.before !== opponent || d.after !== 0)) {
            return { ok: false, message: `${entry.seq}번째 '주사위' 카드 기록이 실제 효과와 안 맞아요.` };
          }
        } else if (cardId === 'lightning' || cardId === 'tsunami') {
          // 지정한 칸이 속한 세로줄(낙뢰)/가로줄(해일)에서 최대 3개까지 파괴돼요.
          const t = entry.targets?.[0];
          const sameLine = (d) => (cardId === 'lightning' ? d.x === t?.x : d.y === t?.y);
          if (diffs.length > 3 || diffs.some((d) => d.before !== opponent || d.after !== 0 || (t && !sameLine(d)))) {
            return { ok: false, message: `${entry.seq}번째 '${cardId === 'lightning' ? '낙뢰' : '해일'}' 카드 기록이 실제 효과와 안 맞아요.` };
          }
        } else if (cardId === 'blackhole') {
          // 지정한 칸 반경 2칸(5x5) 안의 모든 돌(양쪽 다)을 제거해요.
          const t = entry.targets?.[0];
          const inRange = (d) => !t || (Math.abs(d.x - t.x) <= 2 && Math.abs(d.y - t.y) <= 2);
          if (diffs.some((d) => d.after !== 0 || (d.before !== BLACK && d.before !== WHITE) || !inRange(d))) {
            return { ok: false, message: `${entry.seq}번째 '블랙홀' 카드 기록이 실제 효과와 안 맞아요.` };
          }
        } else if (cardId === 'vortex') {
          // 지정한 칸 3x3 범위 안의 돌들이 뒤섞여요 - 새로 생기거나 사라지진 않고 위치만
          // 바뀌어야 해요(범위 안에서 색깔별 개수가 그대로 보존돼야 해요).
          const t = entry.targets?.[0];
          const inRange = (x, y) => !t || (Math.abs(x - t.x) <= 1 && Math.abs(y - t.y) <= 1);
          if (diffs.some((d) => !inRange(d.x, d.y))) {
            return { ok: false, message: `${entry.seq}번째 '소용돌이' 카드가 지정 범위 밖까지 바꿨어요.` };
          }
          const beforeCounts = {};
          const afterCounts = {};
          for (const d of diffs) {
            beforeCounts[d.before] = (beforeCounts[d.before] || 0) + 1;
            afterCounts[d.after] = (afterCounts[d.after] || 0) + 1;
          }
          const sameDistribution = [BLACK, WHITE, WILD, 0].every((v) => (beforeCounts[v] || 0) === (afterCounts[v] || 0));
          if (!sameDistribution) {
            return { ok: false, message: `${entry.seq}번째 '소용돌이' 카드가 돌을 없애거나 새로 만들었어요.` };
          }
        } else if (cardId === 'undoLast' || cardId === 'erosion') {
          // undoLast: 가장 최근에 놓인 돌 1개 제거(어느 색이든). erosion: 상대의 가장 오래된
          // 돌 1개 제거(상대 색만).
          const okShape = diffs.length <= 1 && diffs.every((d) => (
            d.after === 0 && (cardId === 'erosion' ? d.before === opponent : d.before !== 0)
          ));
          if (!okShape) {
            return { ok: false, message: `${entry.seq}번째 '${cardId === 'undoLast' ? '타임 리턴' : '침식'}' 카드 기록이 실제 효과와 안 맞아요.` };
          }
        } else if (cardId === 'timeReset') {
          // 판을 5수 전으로 되돌려요 - 여러 칸이 한꺼번에 사라질 수 있지만, 새로 생기거나
          // 색이 바뀌는 칸은 없어야 해요(전부 제거만).
          if (diffs.some((d) => d.after !== 0)) {
            return { ok: false, message: `${entry.seq}번째 '타임 리셋' 카드 기록이 실제 효과와 안 맞아요.` };
          }
        } else if (cardId === 'chaosShift') {
          // 모든 돌이 무작위 방향으로 한 칸씩 밀려요 - 판 밖으로 밀려나면 사라질 수 있지만,
          // 색깔별 전체 개수가 원래보다 늘어나면 안 돼요(새로 생기면 안 되니까요).
          const countColor = (b, color) => {
            let n = 0;
            for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (b[y][x] === color) n++;
            return n;
          };
          const notIncreased = [BLACK, WHITE, WILD].every((c) => countColor(entry.board, c) <= countColor(prevBoard, c));
          if (!notIncreased) {
            return { ok: false, message: `${entry.seq}번째 '격동' 카드 기록에서 돌 개수가 늘어났어요.` };
          }
        } else if (cardId === 'restore') {
          // 최근에 잃은 내 돌 1개를 원래 자리에 되돌려요.
          if (diffs.length > 1 || diffs.some((d) => d.before !== 0 || d.after !== mover)) {
            return { ok: false, message: `${entry.seq}번째 '복구' 카드 기록이 실제 효과와 안 맞아요.` };
          }
        } else if (cardId === 'resurrection') {
          // 이번 판에서 잃은 내 돌을 전부 되돌려요(0개 이상, 전부 내 색으로 추가만).
          if (diffs.some((d) => d.before !== 0 || d.after !== mover)) {
            return { ok: false, message: `${entry.seq}번째 '재림' 카드 기록이 실제 효과와 안 맞아요.` };
          }
        } else if (diffs.length !== 0) {
          // 그 외 카드(방어막/버프/확률/카드 뽑기류)는 전부 보드 자체를 바꾸지 않아요.
          // 위에서 다루지 않은 카드인데 보드가 바뀌었다면 의심스러운 조작이에요.
          return { ok: false, message: `${entry.seq}번째 '${cardId || '알 수 없는'}' 카드는 보드를 바꾸면 안 되는데 ${diffs.length}칸이 바뀌었어요.` };
        }
      }
    }
    prevBoard = entry.board;
  }
  return { ok: true };
}

// 보드 전체를 훑어서, player가 실제로 승리 조건(연속 돌)을 만족하는 자리가 있는지 확인해요.
function boardHasWinFor(board, player, options) {
  const size = board.length;
  const markedStones = options?.markedStones || {};
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y][x] !== player) continue;
      // checkWin은 "시작점으로 준 좌표 자체"가 낙인 찍혔는지는 검사하지 않고, 거기서부터
      // 뻗어나가며 지나치는 낙인만 걸러요. 원래는 "방금 놓은 돌"에서만 호출되니 문제가
      // 없었는데, 여기서는 보드 전체 칸을 다 시작점 삼아 스캔하다 보니 "낙인 찍힌 돌
      // 자신을 시작점으로 스캔하면 낙인이 무시되는" 우회로가 생겨요. 그래서 낙인 찍힌
      // 칸은 아예 시작점 후보에서 빼요.
      if (markedStones[`${x},${y}`]) continue;
      if (checkWin(board, x, y, player, options)) return true;
    }
  }
  return false;
}

// 반환: { ok: true, myColor, hostColor, guestColor } 또는 { ok: false, code, message }
export function validateGameResult(room, uid) {
  if (!uid) return { ok: false, code: 'unauthenticated', message: '로그인 후에 대국을 할 수 있어요.' };
  if (!room) return { ok: false, code: 'not-found', message: '존재하지 않는 방이에요.' };

  const state = parseRoomState(room);
  if (!state) return { ok: false, code: 'failed-precondition', message: '대국 정보가 없어요.' };

  let myColor = null;
  if (room.hostUid && room.hostUid === uid) myColor = room.hostColor;
  else if (room.guestUid && room.guestUid === uid) myColor = room.hostColor === BLACK ? WHITE : BLACK;
  if (!myColor) return { ok: false, code: 'permission-denied', message: '이 방의 참가자가 아니에요.' };

  if (state.phase !== 'over') return { ok: false, code: 'stale-state', message: '아직 대국이 끝나지 않았어요.' };

  const winner = state.winner;
  if (winner !== null && winner !== BLACK && winner !== WHITE) {
    return { ok: false, code: 'failed-precondition', message: '승자 값이 이상해요.' };
  }

  if (winner !== null) {
    const winLength = state.winLengthOverride?.[winner] ?? 5;
    const hasWin = boardHasWinFor(state.board, winner, {
      winLength,
      excludeDiagonal: state.ruleFlags?.noDiagonalFor === winner,
      markedStones: state.markedStones,
      sealedLines: state.sealedLines,
    });
    if (!hasWin) {
      return { ok: false, code: 'failed-precondition', message: '보드 상태에서 실제로 승리 조건을 확인할 수 없어요.' };
    }
    // 보드 모양이 진짜 승리 조건이어도, 그 모양이 실제로 정상적인 수순으로 만들어졌는지도
    // 이동 기록으로 한 번 더 대조해요 (콘솔로 보드를 직접 바꿔치기하는 조작을 잡기 위해서).
    // 이동 기록의 마지막 스냅샷과 실제로 제출된 최종 보드가 같은지도 확인해요.
    // (여기가 없으면, 기록 자체는 멀쩡해도 마지막에 최종 board만 몰래 바꿔치기하는 걸 못 잡아요.)
    const lastEntry = Array.isArray(state.moveLog) ? state.moveLog[state.moveLog.length - 1] : null;
    if (lastEntry && Array.isArray(lastEntry.board)) {
      const size = state.board.length;
      let mismatch = lastEntry.board.length !== size;
      if (!mismatch) {
        outer: for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            if (state.board[y][x] !== lastEntry.board[y][x]) { mismatch = true; break outer; }
          }
        }
      }
      if (mismatch) {
        return { ok: false, code: 'failed-precondition', message: '최종 보드가 이동 기록의 마지막 상태와 달라요.' };
      }
    }

    const integrity = validateMoveLogIntegrity(state.moveLog, state.rouletteRule, state.challengeId, state.humanColor);
    if (!integrity.ok) {
      return { ok: false, code: 'failed-precondition', message: `대국 기록이 실제 보드와 안 맞아요: ${integrity.message}` };
    }

    // 연금술/위치 교환/관통/돌 이동은 카드 설명에 "이 카드로는 승리를 완성할 수 없어요"라고
    // 명시되어 있어요. 마지막 기록이 이런 카드였다면(=그 카드로 승리 모양이 막 만들어진
    // 거라면) 거부해요.
    const NO_WIN_CARDS = new Set(['alchemy', 'swap', 'overwrite', 'moveStone']);
    if (lastEntry && lastEntry.type === 'card' && NO_WIN_CARDS.has(lastEntry.cardId)) {
      return { ok: false, code: 'failed-precondition', message: '이 카드로는 승리를 완성할 수 없어요.' };
    }
  }

  const hostColor = room.hostColor;
  const guestColor = hostColor === BLACK ? WHITE : BLACK;
  return { ok: true, myColor, hostColor, guestColor };
}

// src/rating.js의 computeRatingDelta와 동일한 로직이에요 (레이팅 변동폭 계산).
export function computeRatingDelta(myRating, opponentRating, result) {
  const diff = Math.abs(myRating - opponentRating);
  const amHigher = myRating >= opponentRating;
  let table;
  if (diff <= 100) {
    table = { win: 10, draw: 0, loss: -10 };
  } else if (diff <= 300) {
    table = amHigher ? { win: 7, draw: -1, loss: -13 } : { win: 13, draw: 1, loss: -7 };
  } else {
    table = amHigher ? { win: 5, draw: -2, loss: -15 } : { win: 15, draw: 2, loss: -5 };
  }
  return table[result] ?? 0;
}

// src/rankpoints.js의 computeRankPointsDelta와 동일한 로직이에요 (랭크 포인트 변동폭 계산).
export function computeRankPointsDelta(myPointsBefore, result) {
  if (result === 'win') return 100;
  if (result === 'loss') return -getTierForRating(myPointsBefore).lossAmount;
  return 0;
}

export const DEFAULT_RATING = 1000;
export const DEFAULT_RANK_POINTS = 0;
