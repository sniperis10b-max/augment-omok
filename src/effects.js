// 돌을 놓을 때 나오는 시각 이펙트 카탈로그예요. 지금은 개발자 계정 전용이에요.
// className은 index.css에 정의된 CSS 애니메이션 클래스와 짝을 이뤄요.

export const PLACEMENT_EFFECTS = [
  { id: 'none', name: '없음 (기본)', className: '' },
  { id: 'ripple', name: '파동', className: 'fx-ripple' },
  { id: 'shock', name: '충격파', className: 'fx-shock' },
  { id: 'flash', name: '섬광', className: 'fx-flash' },
  { id: 'glow', name: '잔광', className: 'fx-glow' },
];

export function getPlacementEffectById(id) {
  return PLACEMENT_EFFECTS.find((e) => e.id === id) || PLACEMENT_EFFECTS[0];
}
