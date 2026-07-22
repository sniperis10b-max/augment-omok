// 대국이 끝나면 기보를 브라우저의 로컬 스토리지에 저장해요.
// 서버가 필요 없고, 이 브라우저에서만 보이는 개인 기록이에요.

const STORAGE_KEY = 'augment-omok-records';
const MAX_RECORDS = 30;

export function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveRecord(record) {
  try {
    const records = loadRecords();
    records.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, ...record });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
  } catch {
    // 저장 공간이 없거나 접근 불가한 경우 조용히 무시
  }
}

export function deleteRecord(id) {
  try {
    const records = loadRecords().filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // 무시
  }
}
