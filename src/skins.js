// 바둑판과 바둑돌의 겉모습을 바꾸는 스킨 카탈로그예요. 지금은 개발자 계정에서만 고를 수 있어요
// (settings 자체는 이 브라우저에만 저장되는 로컬 설정이라, Firebase 계정 데이터와는 별개예요 -
// "내 계정만 열어준다"는 건 UI에서 개발자 계정일 때만 선택 가능하게 막아둔다는 뜻이에요).

export const BOARD_SKINS = [
  {
    id: 'classic',
    name: '클래식 나무',
    background: '#dcb35c',
    border: '#b8903f',
    line: 'rgba(0, 0, 0, 0.35)',
  },
  {
    id: 'darkWalnut',
    name: '다크 월넛',
    background: 'linear-gradient(135deg, #6b4a2f, #4a3120)',
    border: '#3a2718',
    line: 'rgba(255, 255, 255, 0.18)',
  },
  {
    id: 'marble',
    name: '대리석',
    background: 'linear-gradient(135deg, #f2f0ea, #dedad0)',
    border: '#c7c2b4',
    line: 'rgba(0, 0, 0, 0.25)',
  },
  {
    id: 'deepBlue',
    name: '딥 블루',
    background: 'linear-gradient(135deg, #1e3a5f, #0f2138)',
    border: '#0a1826',
    line: 'rgba(255, 255, 255, 0.2)',
  },
  {
    id: 'emeraldFelt',
    name: '에메랄드 펠트',
    background: 'linear-gradient(135deg, #1f5c42, #123a29)',
    border: '#0d2a1d',
    line: 'rgba(255, 255, 255, 0.18)',
  },
  {
    id: 'roseGold',
    name: '로즈 골드',
    background: 'linear-gradient(135deg, #e8b4a8, #c98a7a)',
    border: '#a8695a',
    line: 'rgba(0, 0, 0, 0.25)',
  },
  {
    id: 'midnight',
    name: '미드나잇',
    background: 'linear-gradient(135deg, #2a2a30, #121216)',
    border: '#08080a',
    line: 'rgba(255, 255, 255, 0.18)',
  },
  {
    id: 'pastelMint',
    name: '파스텔 민트',
    background: 'linear-gradient(135deg, #d5f0e0, #b8e0cc)',
    border: '#9bcbb2',
    line: 'rgba(0, 0, 0, 0.2)',
  },
];

export const STONE_SKINS = [
  {
    id: 'classic',
    name: '클래식',
    black: '#1a1a1a',
    white: '#fbfaf6',
    whiteBorder: '#8a8678',
  },
  {
    id: 'onyxPearl',
    name: '오닉스 & 진주',
    black: 'linear-gradient(160deg, #2a2a2a, #050505)',
    white: 'linear-gradient(160deg, #fffdf5, #e8e2cf)',
    whiteBorder: '#c9bfa0',
  },
  {
    id: 'neon',
    name: '네온',
    black: 'linear-gradient(160deg, #ff2e93, #7a0f47)',
    white: 'linear-gradient(160deg, #39f3ff, #0b8b96)',
    whiteBorder: '#0b8b96',
  },
  {
    id: 'goldSilver',
    name: '골드 & 실버',
    black: 'linear-gradient(160deg, #caa243, #7a5c14)',
    white: 'linear-gradient(160deg, #f2f2f2, #b9b9b9)',
    whiteBorder: '#9c9c9c',
  },
  {
    id: 'pastel',
    name: '파스텔',
    black: 'linear-gradient(160deg, #9d8ce0, #6a58b8)',
    white: 'linear-gradient(160deg, #fff3b0, #ffe27a)',
    whiteBorder: '#e0c460',
  },
  {
    id: 'woodTone',
    name: '우드톤',
    black: 'linear-gradient(160deg, #6b4226, #3d2314)',
    white: 'linear-gradient(160deg, #e8c9a0, #cca774)',
    whiteBorder: '#a98552',
  },
  {
    id: 'rubySapphire',
    name: '루비 & 사파이어',
    black: 'linear-gradient(160deg, #c22b3d, #6e1420)',
    white: 'linear-gradient(160deg, #4d7ee0, #1f4a9e)',
    whiteBorder: '#1f4a9e',
  },
  {
    id: 'monochrome',
    name: '모노크롬 그라데이션',
    black: 'linear-gradient(160deg, #4a4a4a, #0a0a0a)',
    white: 'linear-gradient(160deg, #ffffff, #cfcfcf)',
    whiteBorder: '#aaaaaa',
  },
];

export function getBoardSkinById(id) {
  return BOARD_SKINS.find((s) => s.id === id) || BOARD_SKINS[0];
}

export function getStoneSkinById(id) {
  return STONE_SKINS.find((s) => s.id === id) || STONE_SKINS[0];
}
