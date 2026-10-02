// Камера и модель рук MediaPipe. Модель и WASM сначала берём у себя (public/, в сжатом виде),
// если их нет — из официальных источников. Так игра не упадёт из-за одного CDN.

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const LOCAL_WASM = './wasm';
const CDN_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const LOCAL_MODEL = './models/hand_landmarker.task';
const REMOTE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export class CameraError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

export async function startCamera(video) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError(
      'unsupported',
      'Браузер не даёт доступ к камере. Открой игру в Chrome, Edge или Safari по ссылке https://',
    );
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 30, max: 30 } },
      audio: false,
    });
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    await new Promise((res) => (video.readyState >= 2 ? res() : video.addEventListener('loadeddata', res, { once: true })));
    return stream;
  } catch (err) {
    if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
      throw new CameraError(
        'denied',
        'Доступ к камере запрещён. Нажми на значок камеры в адресной строке, разреши доступ и обнови страницу.',
      );
    }
    if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
      throw new CameraError('missing', 'Камера не найдена. Подключи веб-камеру и обнови страницу.');
    }
    if (err?.name === 'NotReadableError') {
      throw new CameraError('busy', 'Камера занята другой программой (Zoom, Teams…). Закрой её и обнови страницу.');
    }
    throw new CameraError('unknown', `Не удалось включить камеру: ${err?.message ?? err}`);
  }
}

// ---------- предзагрузка ----------
// Движок MediaPipe (11.7 МБ) и модель руки (7.8 МБ) лежат у нас ещё и в сжатом виде (.gz, всего ~9 МБ).
// Качаем сжатые копии сразу при открытии страницы, пока игрок читает заставку, и распаковываем
// в браузере (DecompressionStream). Движок отдаём MediaPipe прямо из памяти — второй раз он не скачивается.
// Затем заранее создаём распознаватель и «прогреваем» его на пустом кадре: видеокарта компилирует
// шейдеры до того, как игрок включит камеру. Если что-то не вышло — запасной путь: несжатые файлы или CDN.

const WEIGHT = { wasm: 3.4, model: 5.8 }; // примерный вес сжатых файлов в МБ — для общего процента
const progress = { model: 0, wasm: 0 };
const listeners = new Set();
let prefetchPromise = null;
let trackerPromise = null;
const statusFns = new Set();
let lastStatus = '';
function setStatus(text) {
  lastStatus = text;
  for (const fn of statusFns) fn(text);
}

function emit() {
  const total = (progress.model * WEIGHT.model + progress.wasm * WEIGHT.wasm) / (WEIGHT.model + WEIGHT.wasm);
  for (const fn of listeners) fn(total);
}

async function download(url, key) {
  const res = await fetch(url);
  const type = res.headers.get('content-type') || '';
  if (!res.ok || !res.body || type.includes('text/html')) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (total) progress[key] = Math.min(0.99, loaded / total);
    emit();
  }
  progress[key] = 1;
  emit();
  const out = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

/** Если байты — gzip (сигнатура 1f 8b), распаковываем. Иначе (сервер уже распаковал) — отдаём как есть. */
async function gunzip(bytes) {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const canGunzip = typeof DecompressionStream !== 'undefined';

/** Сжатая копия → несжатый файл → внешний адрес. Возвращает байты или null. */
async function loadAsset(key, urls) {
  for (const url of urls) {
    try {
      const bytes = await download(url, key);
      return url.endsWith('.gz') ? await gunzip(bytes) : bytes;
    } catch {
      progress[key] = 0;
    }
  }
  return null;
}

/** Начать скачивание модели и движка заранее. onProgress(0..1) можно вызывать много раз. */
export function prefetchRecognition(onProgress) {
  if (onProgress) listeners.add(onProgress);
  if (!prefetchPromise) {
    prefetchPromise = (async () => {
      const gz = (u) => (canGunzip ? [`${u}.gz`, u] : [u]);
      // загрузчик движка маленький (0.3 МБ): кладём его в кэш браузера параллельно
      fetch(`${LOCAL_WASM}/vision_wasm_internal.js`).catch(() => {});
      const [wasm, model] = await Promise.all([
        loadAsset('wasm', gz(`${LOCAL_WASM}/vision_wasm_internal.wasm`)),
        loadAsset('model', [...gz(LOCAL_MODEL), REMOTE_MODEL]),
      ]);
      return { wasm, model };
    })();
  }
  return prefetchPromise;
}

export function stopProgress(onProgress) {
  listeners.delete(onProgress);
}

async function makeFileset(wasm) {
  if (wasm) {
    const binary = URL.createObjectURL(new Blob([wasm], { type: 'application/wasm' }));
    return { wasmLoaderPath: `${LOCAL_WASM}/vision_wasm_internal.js`, wasmBinaryPath: binary };
  }
  // своих файлов нет — пусть MediaPipe сам скачает движок с CDN
  return FilesetResolver.forVisionTasks(CDN_WASM);
}

/** Пустой кадр через распознаватель: видеокарта компилирует шейдеры заранее, а не на первом кадре с камеры. */
function warmUp(landmarker) {
  try {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 144;
    c.getContext('2d').fillRect(0, 0, c.width, c.height);
    // метка времени 1 мс: все настоящие кадры потом идут с бо́льшими метками, как требует MediaPipe
    landmarker.detectForVideo(c, 1);
  } catch (err) {
    console.warn('Прогрев распознавания не удался', err);
  }
}

/**
 * Создаёт распознаватель рук один раз: можно вызвать ещё на заставке (без камеры),
 * а потом просто получить готовый. onStatus — текст для экрана.
 */
export function createHandTracker(onStatus = () => {}) {
  statusFns.add(onStatus);
  if (lastStatus) onStatus(lastStatus);
  if (!trackerPromise) {
    trackerPromise = (async () => {
      const report = (p) => setStatus(`Загружаю распознавание рук: ${Math.round(p * 100)}%`);
      const pre = await prefetchRecognition(report);
      stopProgress(report);
      setStatus('Прогреваю распознавание…');
      const fileset = await makeFileset(pre.wasm);
      const modelSource = pre.model ? { modelAssetBuffer: pre.model } : { modelAssetPath: REMOTE_MODEL };
      const options = (delegate) => ({
        baseOptions: { ...modelSource, delegate },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      let landmarker;
      try {
        landmarker = await HandLandmarker.createFromOptions(fileset, options('GPU'));
      } catch (err) {
        console.warn('GPU недоступен, переключаюсь на CPU', err);
        setStatus('Видеокарта недоступна, запускаю на процессоре…');
        landmarker = await HandLandmarker.createFromOptions(fileset, options('CPU'));
      }
      warmUp(landmarker);
      setStatus('Распознавание рук готово');
      return landmarker;
    })();
    trackerPromise.catch(() => (trackerPromise = null));
  }
  const p = trackerPromise;
  p.finally(() => statusFns.delete(onStatus)).catch(() => {});
  return p;
}

export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];
