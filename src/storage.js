// Таблица рекордов и прогресс игрока. Хранится в браузере (localStorage).
// Все обращения обёрнуты в try/catch: в приватном режиме хранилище может быть недоступно.

const KEY = 'shinobi-motion:v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (data && Array.isArray(data.records)) return data;
  } catch {
    /* хранилище недоступно */
  }
  return { records: [], games: 0, sealBest: {} };
}

function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ничего страшного — просто не сохраним */
  }
}

const NAMES = ['Тень', 'Ветер', 'Искра', 'Камень', 'Волна', 'Коготь', 'Туман', 'Гром', 'Лист', 'Пепел'];

export function randomNinjaName() {
  return `${NAMES[Math.floor(Math.random() * NAMES.length)]}-${Math.floor(10 + Math.random() * 90)}`;
}

/** Сохраняет результат боя. Возвращает id записи и место в таблице (0 — не попал в топ). */
export function addRecord(record) {
  const data = load();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  data.games += 1;
  data.records.push({ ...record, id, date: new Date().toISOString() });
  data.records.sort((a, b) => b.score - a.score);
  data.records = data.records.slice(0, 7);
  save(data);
  const place = data.records.findIndex((r) => r.id === id);
  return { id, place: place >= 0 ? place + 1 : 0 };
}

export function getRecords() {
  return load().records;
}

export function getGamesPlayed() {
  return load().games;
}

/** Лучшая точность по каждой печати — прогресс игрока между сессиями. */
export function updateSealBest(sealId, accuracy) {
  const data = load();
  if (!data.sealBest[sealId] || accuracy > data.sealBest[sealId]) {
    data.sealBest[sealId] = accuracy;
    save(data);
  }
}

export function getSealBest() {
  return load().sealBest;
}

/** Печати из Кузницы: храним последние три (эталон, имя, рисунок формы). */
export function saveForged(seal) {
  const data = load();
  data.forged = [seal, ...(data.forged ?? [])].slice(0, 3);
  save(data);
}

export function getForged() {
  return load().forged ?? [];
}
