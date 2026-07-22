// 온라인 대전(친구와 플레이) 기능을 위한 Firebase 설정이에요.
// 이미 사용자님의 Firebase 프로젝트 값으로 채워져 있어요.
export const firebaseConfig = {
  apiKey: 'AIzaSyAV5fkV1rNnhc2F3QjR6CB4iz_m1LU_9PM',
  authDomain: 'augment-omok.firebaseapp.com',
  databaseURL: 'https://augment-omok-default-rtdb.firebaseio.com',
  projectId: 'augment-omok',
};

export const isFirebaseConfigured = () => firebaseConfig.apiKey !== 'YOUR_API_KEY';
