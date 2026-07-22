// 오목 핵심 로직 + 렌주 금수 규칙(3-3, 4-4, 육목).
// 렌주 룰은 표준적으로 흑(선공)에게만 적용돼요. 백은 제한이 없어요.

export const BOARD_SIZE = 15;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const WILD = 3; // 와일드카드로 놓이는 중립 돌. 흑/백 어느 쪽 라인으로도 인정돼요.

function matches(v, player) {
  return v === player || v === WILD;
}

export function createEmptyBoard(size = BOARD_SIZE) {
  return Array.from({ length: size }, () => Array(size).fill(EMPTY));
}

export function otherPlayer(player) {
  return player === BLACK ? WHITE : BLACK;
}

export const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

export function inBounds(board, x, y) {
  const size = board.length;
  return x >= 0 && x < size && y >= 0 && y < size;
}

// 특정 방향 직선의 정체성(행/열/두 대각선 중 하나) - 라인 봉인 판정에 사용
export function lineIdentifier(x, y, dx, dy) {
  if (dx === 1 && dy === 0) return { type: 'row', index: y };
  if (dx === 0 && dy === 1) return { type: 'col', index: x };
  if (dx === 1 && dy === 1) return { type: 'diag1', index: y - x };
  if (dx === 1 && dy === -1) return { type: 'diag2', index: y + x };
  return null;
}

export function isLineSealed(sealedLines, lineId) {
  if (!lineId) return false;
  return sealedLines.some((l) => l.type === lineId.type && l.index === lineId.index);
}

// x, y에 방금 놓은 player가 승리했는지. 봉인된 라인 위에서만 완성된 5목은 무효 처리.
export function checkWin(board, x, y, player, options = {}) {
  const { winLength = 5, sealedLines = [] } = options;
  const size = board.length;

  for (const [dx, dy] of DIRECTIONS) {
    let count = 1;
    let minStep = 0;
    let maxStep = 0;

    for (let step = 1; step < 8; step++) {
      const nx = x + dx * step;
      const ny = y + dy * step;
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) break;
      if (!matches(board[ny][nx], player)) break;
      count++;
      maxStep = step;
    }

    for (let step = 1; step < 8; step++) {
      const nx = x - dx * step;
      const ny = y - dy * step;
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) break;
      if (!matches(board[ny][nx], player)) break;
      count++;
      minStep = -step;
    }

    if (count >= winLength) {
      const lineId = lineIdentifier(x, y, dx, dy);
      if (!isLineSealed(sealedLines, lineId)) return true;
    }
    void minStep;
    void maxStep;
  }

  return false;
}

export function isBoardFull(board) {
  return board.every((row) => row.every((cell) => cell !== EMPTY));
}

export function placeStone(board, x, y, player) {
  if (board[y][x] !== EMPTY) return null;
  const next = board.map((row) => row.slice());
  next[y][x] = player;
  return next;
}

// ---------- 렌주 금수 규칙 ----------
// 방향 하나에 대해 x,y를 중심으로 한 9칸짜리 문자열을 만들어요.
// 'X' = player 돌, 'O' = 상대 돌 또는 벽(보드 밖), '.' = 빈 칸
function buildLineWindow(board, x, y, dx, dy, player, half = 4) {
  const size = board.length;
  let s = '';
  for (let i = -half; i <= half; i++) {
    const nx = x + dx * i;
    const ny = y + dy * i;
    if (nx < 0 || nx >= size || ny < 0 || ny >= size) {
      s += 'O';
    } else if (nx === x && ny === y) {
      s += 'X'; // 지금 판정하려는 자리(가정으로 이미 놓였다고 취급)
    } else {
      const v = board[ny][nx];
      if (v === EMPTY) s += '.';
      else if (v === player || v === WILD) s += 'X';
      else s += 'O';
    }
  }
  return s;
}

// 패턴들이 중심(인덱스 4, 0-based)을 포함해서 매칭되는 방향 개수를 셈
function countDirectionsMatching(board, x, y, player, patterns) {
  const center = 4;
  let count = 0;
  for (const [dx, dy] of DIRECTIONS) {
    const line = buildLineWindow(board, x, y, dx, dy, player, 4);
    let matched = false;
    for (const pat of patterns) {
      const re = new RegExp(pat, 'g');
      let m;
      while ((m = re.exec(line))) {
        const start = m.index;
        const end = start + m[0].length - 1;
        if (center >= start && center <= end) {
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    if (matched) count++;
  }
  return count;
}

// 육목(장목): 놓았을 때 한 방향으로 6개 이상 연속되면 true
export function isOverline(board, x, y, player) {
  for (const [dx, dy] of DIRECTIONS) {
    let count = 1;
    for (let step = 1; step < 8; step++) {
      const nx = x + dx * step;
      const ny = y + dy * step;
      if (!inBounds(board, nx, ny) || !matches(board[ny][nx], player)) break;
      count++;
    }
    for (let step = 1; step < 8; step++) {
      const nx = x - dx * step;
      const ny = y - dy * step;
      if (!inBounds(board, nx, ny) || !matches(board[ny][nx], player)) break;
      count++;
    }
    if (count >= 6) return true;
  }
  return false;
}

// 열린 삼(양쪽이 비어있어 열린 사가 될 수 있는 삼) 이 2개 이상 방향에서 만들어지면 더블쓰리
export function isDoubleThree(board, x, y, player) {
  return countDirectionsMatching(board, x, y, player, ['\\.XXX\\.']) >= 2;
}

// 사(다음 한 수로 오목이 되는 넷)가 2개 이상 방향에서 만들어지면 더블포
export function isDoubleFour(board, x, y, player) {
  return countDirectionsMatching(board, x, y, player, ['\\.XXXX', 'XXXX\\.', '\\.XXXX\\.']) >= 2;
}

// player(와일드 포함)의 열린 삼이 있는 라인에서, 그 삼을 사(四)로 만들 수 있는
// 양쪽 빈 칸 좌표들을 모두 찾아요. '연속 공격 차단' 카드에서 사용해요.
export function findOpenThreeFlankCells(board, player) {
  const size = board.length;
  const results = new Set();

  function scanLine(cells, coordKey) {
    const s = cells
      .map((v) => (v === EMPTY ? '.' : v === player || v === WILD ? 'X' : 'O'))
      .join('');
    const re = /\.XXX\./g;
    let m;
    while ((m = re.exec(s))) {
      results.add(coordKey(m.index));
      results.add(coordKey(m.index + 4));
      re.lastIndex = m.index + 1;
    }
  }

  for (let y = 0; y < size; y++) {
    scanLine(board[y], (i) => `${i},${y}`);
  }
  for (let x = 0; x < size; x++) {
    scanLine(board.map((row) => row[x]), (i) => `${x},${i}`);
  }
  for (let off = -(size - 1); off <= size - 1; off++) {
    const cells = [];
    const coords = [];
    for (let x = 0; x < size; x++) {
      const y = x + off;
      if (y >= 0 && y < size) {
        cells.push(board[y][x]);
        coords.push([x, y]);
      }
    }
    scanLine(cells, (i) => `${coords[i][0]},${coords[i][1]}`);
  }
  for (let off = 0; off <= 2 * (size - 1); off++) {
    const cells = [];
    const coords = [];
    for (let x = 0; x < size; x++) {
      const y = off - x;
      if (y >= 0 && y < size) {
        cells.push(board[y][x]);
        coords.push([x, y]);
      }
    }
    scanLine(cells, (i) => `${coords[i][0]},${coords[i][1]}`);
  }

  return Array.from(results).map((s) => {
    const [x, y] = s.split(',').map(Number);
    return { x, y };
  });
}
export function isForbiddenMove(board, x, y, player, ruleFlags = {}) {
  if (player !== BLACK) return false;
  if (board[y][x] !== EMPTY) return false;

  const trial = board.map((row) => row.slice());
  trial[y][x] = player;

  if (isOverline(trial, x, y, player)) return 'overline';
  if (!ruleFlags.noDoubleThree && isDoubleThree(trial, x, y, player)) return 'double-three';
  if (!ruleFlags.ignoreDoubleFourOnce && isDoubleFour(trial, x, y, player)) return 'double-four';

  return false;
}
