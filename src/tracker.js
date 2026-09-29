// Камера и модель рук MediaPipe. Модель и WASM сначала ищем у себя (public/),
// если их нет — берём из официальных источников. Так игра не упадёт из-за одного CDN.

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

async function urlExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const type = res.headers.get('content-type') || '';
    return res.ok && !type.includes('text/html');
  } catch {
    return false;
  }
}

// ---------- предзагрузка ----------
// Модель (~7.8 МБ) и движок (~11.7 МБ) начинаем качать сразу при открытии страницы,
// пока игрок читает заставку и разрешает камеру. Прогресс показываем в процентах.

const WASM_SIZE = 11756954;
const MODEL_SIZE = 7819105;
const progress = { model: 0, wasm: 0 };
const listeners = new Set();
let prefetchPromise = null;

function emit() {
  const total = (progress.model * MODEL_SIZE + progress.wasm * WASM_SIZE) / (MODEL_SIZE + WASM_SIZE);
  for (const fn of listeners) fn(total);
}

async function download(url, size, key) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || size;
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    progress[key] = Math.min(0.99, loaded / total);
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

/** Начать скачивание модели и движка заранее. onProgress(0..1) можно вызывать много раз. */
export function prefetchRecognition(onProgress) {
  if (onProgress) listeners.add(onProgress);
  if (!prefetchPromise) {
    prefetchPromise = (async () => {
      const localWasm = await urlExists(`${LOCAL_WASM}/vision_wasm_internal.wasm`);
      const wasmBase = localWasm ? LOCAL_WASM : CDN_WASM;
      // Движок кладём в HTTP-кэш браузера: MediaPipe потом возьмёт его оттуда.
      const wasmDone = download(`${wasmBase}/vision_wasm_internal.wasm`, WASM_SIZE, 'wasm').catch(() => null);
      const localModel = await urlExists(LOCAL_MODEL);
      const model = await download(localModel ? LOCAL_MODEL : REMOTE_MODEL, MODEL_SIZE, 'model').catch(() => null);
      await wasmDone;
      return { wasmBase, model, modelPath: localModel ? LOCAL_MODEL : REMOTE_MODEL };
    })();
  }
  return prefetchPromise;
}

export function stopProgress(onProgress) {
  listeners.delete(onProgress);
}

export async function createHandTracker(onStatus = () => {}) {
  onStatus('Загружаю распознавание рук…');
  const report = (p) => onStatus(`Загружаю распознавание рук: ${Math.round(p * 100)}%`);
  const pre = await prefetchRecognition(report);
  stopProgress(report);
  onStatus('Запускаю распознавание…');
  const fileset = await FilesetResolver.forVisionTasks(pre.wasmBase);
  const modelSource = pre.model ? { modelAssetBuffer: pre.model } : { modelAssetPath: pre.modelPath };

  const options = (delegate) => ({
    baseOptions: { ...modelSource, delegate },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  try {
    return await HandLandmarker.createFromOptions(fileset, options('GPU'));
  } catch (err) {
    console.warn('GPU недоступен, переключаюсь на CPU', err);
    onStatus('Видеокарта недоступна, запускаю на процессоре…');
    return HandLandmarker.createFromOptions(fileset, options('CPU'));
  }
}

export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];
