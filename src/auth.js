// 계정 로그인 기능. 구글 로그인과 이메일/비밀번호(가입 시 인증메일 발송) 두 가지를 지원해요.
// firebaseConfig.js 설정이 있어야 동작해요 (온라인 대전과 같은 Firebase 프로젝트를 써요).

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  deleteUser,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig.js';

let authInstance = null;

function getAuthInstance() {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase 설정이 비어있어요. firebaseConfig.js를 채워주세요.');
  }
  if (!authInstance) {
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    authInstance = getAuth(app);
  }
  return authInstance;
}

export function watchAuthState(onChange) {
  try {
    const auth = getAuthInstance();
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        onChange(null);
        return;
      }
      onChange({
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        isGoogle: user.providerData.some((p) => p.providerId === 'google.com'),
      });
    });
  } catch {
    return () => {};
  }
}

export async function signInWithGoogle() {
  const auth = getAuthInstance();
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signUpWithEmail(email, password, nickname) {
  const auth = getAuthInstance();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (nickname) {
    await updateProfile(cred.user, { displayName: nickname });
  }
  await sendEmailVerification(cred.user);
  return cred.user;
}

export async function signInWithEmail(email, password) {
  const auth = getAuthInstance();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function resendVerificationEmail() {
  const auth = getAuthInstance();
  if (auth.currentUser) await sendEmailVerification(auth.currentUser);
}

export async function updateUserProfile({ displayName, photoURL }) {
  const auth = getAuthInstance();
  if (!auth.currentUser) throw new Error('로그인이 필요해요.');
  await updateProfile(auth.currentUser, { displayName, photoURL });
  // updateProfile은 auth.currentUser는 갱신하지만 onAuthStateChanged를 다시 쏘지 않아서,
  // 최신 정보를 담은 사용자 객체를 직접 만들어 반환해요.
  const u = auth.currentUser;
  return {
    uid: u.uid,
    displayName: u.displayName,
    email: u.email,
    photoURL: u.photoURL,
    emailVerified: u.emailVerified,
    isGoogle: u.providerData.some((p) => p.providerId === 'google.com'),
  };
}

export async function signOutUser() {
  const auth = getAuthInstance();
  await firebaseSignOut(auth);
}

// 회원 탈퇴. 보안상 최근에 로그인하지 않았으면 Firebase가 재인증을 요구해요 —
// 구글 계정은 팝업으로, 이메일 계정은 비밀번호로 재인증한 뒤 삭제를 재시도해요.
export async function deleteAccount(password) {
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요.');
  const isGoogle = user.providerData.some((p) => p.providerId === 'google.com');

  try {
    await deleteUser(user);
  } catch (e) {
    if (e.code !== 'auth/requires-recent-login') throw e;
    if (isGoogle) {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
    } else {
      if (!password) throw e;
      const cred = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, cred);
    }
    await deleteUser(user);
  }
}

function mapAuthError(code) {
  const map = {
    'auth/email-already-in-use': '이미 가입된 이메일이에요.',
    'auth/invalid-email': '올바른 이메일 형식이 아니에요.',
    'auth/weak-password': '비밀번호는 8자 이상이어야 해요.',
    'auth/user-not-found': '가입되지 않은 이메일이에요.',
    'auth/wrong-password': '비밀번호가 틀렸어요.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않아요.',
    'auth/popup-closed-by-user': '로그인 창이 닫혔어요.',
    'auth/operation-not-allowed': '이 로그인 방식이 Firebase 콘솔에서 아직 켜져있지 않아요.',
  };
  return map[code] || '문제가 발생했어요. 다시 시도해주세요.';
}

export { mapAuthError, isFirebaseConfigured };
