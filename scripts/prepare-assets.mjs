// Готовит статические файлы для MediaPipe, чтобы игра не зависела от внешних CDN:
// 1) копирует WASM-рантайм из node_modules в public/wasm
// 2) скачивает модель рук в public/models (если её ещё нет)
// 3) собирает audio-manifest.json — список своих звуков (public/sounds) и озвучки (public/voices)
// Если скачать модель не удалось, игра сама загрузит её с серверов Google при запуске.
import { cp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { gzipSync, constants } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmDst = join(root, 'public', 'wasm');
const modelDst = join(root, 'public', 'models', 'hand_landmarker.task');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

async function exists(path) {
  try {
    const s = await stat(path);
    return s.size > 0;
  } catch {
    return false;
  }
}

await mkdir(wasmDst, { recursive: true });
await cp(wasmSrc, wasmDst, { recursive: true });
console.log('✓ WASM скопирован в public/wasm');

if (await exists(modelDst)) {
  console.log('✓ Модель рук уже есть в public/models');
} else {
  try {
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(dirname(modelDst), { recursive: true });
    await writeFile(modelDst, buf);
    console.log(`✓ Модель рук скачана (${(buf.length / 1e6).toFixed(1)} МБ)`);
  } catch (err) {
    console.warn(`! Не удалось скачать модель (${err.message}). Игра загрузит её из сети при запуске.`);
  }
}

// Сжатые копии движка и модели: браузер скачивает ~9 МБ вместо ~20 и сам распаковывает их
// (DecompressionStream). Так загрузка быстрее на любом хостинге, даже если сервер не сжимает файлы.
async function gzipCopy(src) {
  if (!(await exists(src))) return;
  const raw = await readFile(src);
  const gz = gzipSync(raw, { level: constants.Z_BEST_COMPRESSION });
  await writeFile(`${src}.gz`, gz);
  console.log(`✓ ${src.split('/').slice(-2).join('/')}.gz: ${(raw.length / 1e6).toFixed(1)} → ${(gz.length / 1e6).toFixed(1)} МБ`);
}
await gzipCopy(join(wasmDst, 'vision_wasm_internal.wasm'));
await gzipCopy(modelDst);

// Список записанных звуков и реплик, чтобы игра не искала файлы наугад.
const AUDIO = /\.(mp3|wav|ogg|m4a|webm)$/i;
async function listAudio(dir) {
  try {
    return (await readdir(join(root, 'public', dir))).filter((f) => AUDIO.test(f)).sort();
  } catch {
    return [];
  }
}
const audioManifest = { sounds: await listAudio('sounds'), voices: await listAudio('voices') };
await writeFile(join(root, 'public', 'audio-manifest.json'), JSON.stringify(audioManifest, null, 2));
console.log(`✓ Звуков: ${audioManifest.sounds.length}, реплик озвучки: ${audioManifest.voices.length}`);
