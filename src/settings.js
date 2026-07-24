// 앱 전역 설정(테마, 효과음, 시간제한, 카드 개수)을 로컬 스토리지에 저장해요.
// 게임 하나의 상태가 아니라, 이 브라우저에서 계속 유지되는 사용자 취향이에요.

const KEY = 'augment-omok-settings';

// "업데이트 소식" 팝업 관련. version을 올릴 때마다 새 소식이 다시 한 번 노출돼요.
// (사용자가 "다시 보지 않기"를 눌렀어도, 새 버전이 나오면 다시 보여줘요)
export const LATEST_UPDATE = {
  version: 12,
  title: '새로운 업데이트가 있어요!',
  items: [
    '온라인 대전에 "랭크전"이 추가됐어요! 레이팅(친선전 포함 전체 온라인 대전 기준)과는 완전히 별개로, 랭크전 결과만 반영되는 랭크 점수·티어가 새로 생겼어요.',
    '랭크 점수는 0점에서 시작, 승리 시 +100점 고정, 패배 시 현재 티어에 따라 감점돼요: 브론즈 -10 / 실버 -30 / 골드 -50 / 플래티넘 -70 / 다이아몬드 -90 / 루비 -110 / 에메랄드 -130 / 신화 -165 / 마스터 -200.',
    '티어는 브론즈 → 실버 → 골드 → 플래티넘 → 다이아몬드 → 루비 → 에메랄드 → 신화 → 마스터 순이고, 마스터를 제외한 모든 티어는 1→2→3단계로 나뉘어요. 한 단계를 넘는 데 필요한 점수도 티어가 높아질수록 늘어나요 (브론즈 300점 → 신화 1100점).',
    '순위표 화면에 "레이팅" / "랭크전" 탭이 생겨서 둘을 따로 확인할 수 있어요.',
  ],
};

const DEFAULTS = {
  theme: 'light', // 'light' | 'dark'
  soundEnabled: true,
  timeLimitSec: 0, // 0 = 제한 없음
  cardsPerPlayer: 3,
  whatsNewSeenVersion: 0, // 사용자가 "다시 보지 않기"를 누른 마지막 업데이트 버전
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // 저장 실패해도 게임 진행에는 지장 없음
  }
}

// 이 브라우저(기기)를 구분하는 고유 ID. 온라인 방에 재접속할 때 "원래 그 사람"인지
// 확인하는 데 써요.
const CLIENT_ID_KEY = 'augment-omok-client-id';

export function getClientId() {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}
