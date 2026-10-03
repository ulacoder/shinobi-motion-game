#!/usr/bin/env python3
"""Обработка озвучки команды: обрезка тишины, шумоподавление, громкость и эффекты по персонажу.

Запуск:
  python3 scripts/process-voices.py <папка с сырыми записями> <voices-map.json> [public/voices]

voices-map.json — {"имя_записи.ogg": "id_реплики", ...}; id из VOICES.md.
Нужен ffmpeg с фильтрами rubberband, afftdn, loudnorm.
"""
import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

# Кто говорит какую реплику (для эффектов). Остальное — по префиксу.
ROLE = {
    'intro_1': 'sensei', 's3_2': 'sensei', 'end_4': 'sensei',
    'intro_5': 'scout', 's2_1': 'scout',
    's3_3': 'oni', 's3_4': 'oni', 's4_1': 'oni',
    's5_1': 'boss', 'end_1': 'boss',
    'cast_fire': 'cast', 'cast_lightning': 'cast', 'cast_shield': 'cast', 'cast_sphere': 'cast',
    'hero_hurt': 'hurt', 'combo': 'cast',
    'cast_wind': 'cast', 'cast_dragon': 'cast', 'cast_forged': 'clear', 'u_read_won': 'clear',
    # финал: новые реплики сенсея и Кагэро
    'g_ready': 'sensei', 'f_1': 'sensei', 'f_2': 'sensei',
    'f_3': 'boss',
}


def _role_by_prefix(line_id: str):
    if line_id.startswith(('se_', 'h_')):
        return 'sensei'
    if line_id.startswith('k_'):
        return 'boss'
    return None

# Базовая чистка: срез низа, шумодав, компрессор. Тишину режем отдельно (см. gate_trim).
CLEAN = ','.join([
    'highpass=f=85',
    'lowpass=f=13000',
    'afftdn=nr=16:nf=-40:tn=1',
    'acompressor=threshold=-20dB:ratio=3.5:attack=6:release=120:makeup=4',
])
SR = 48000


def decode(src: Path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(src), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         check=True, stdout=subprocess.PIPE).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def gate_trim(x, keep_gap=0.28, max_gap=0.45, pad=0.15):
    """Обрезает тишину по краям и укорачивает длинные паузы внутри.
    Порог считается от шума конкретной записи (у всех разный микрофон и комната)."""
    win = int(SR * 0.02)
    n = len(x) // win
    if n < 5:
        return x
    rms = np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    floor = np.percentile(db, 15)
    peak = np.percentile(db, 97)
    thr = max(floor + 0.35 * (peak - floor), floor + 8)
    loud = db > thr
    # сглаживаем: короткие провалы внутри слова не считаем паузой
    idx = np.where(loud)[0]
    if not len(idx):
        return x
    segs = []
    start = prev = idx[0]
    for i in idx[1:]:
        if (i - prev) * 0.02 > 0.12:
            segs.append((start, prev))
            start = i
        prev = i
    segs.append((start, prev))
    padw = int(pad / 0.02)
    out = []
    for k, (a, b) in enumerate(segs):
        a = max(0, a - padw)
        b = min(n - 1, b + padw)
        piece = x[a * win:(b + 1) * win]
        if out:
            gap = (a - segs[k - 1][1]) * 0.02
            if gap > max_gap:
                out.append(np.zeros(int(SR * keep_gap), dtype=np.float32))
        out.append(piece)
    y = np.concatenate(out)
    fade = int(SR * 0.01)
    y[:fade] *= np.linspace(0, 1, fade)
    y[-fade:] *= np.linspace(1, 0, fade)
    return y


# Эффекты персонажей. Герои — живой голос с лёгким «залом», злодеи — ниже и мрачнее.
FX = {
    'hero': 'equalizer=f=3000:t=q:w=1.2:g=3,aecho=0.8:0.35:45|90:0.18|0.10',
    # эхо у выкриков слабее, чем в первой записи: короткие слова («Клинок») иначе смазываются
    'cast': ('equalizer=f=120:t=q:w=1:g=4,equalizer=f=3200:t=q:w=1.2:g=4,aexciter=amount=2:drive=6,'
             'aecho=0.85:0.4:90|200:0.22|0.12,asoftclip=type=tanh'),
    # почти сухой голос — для быстрых фраз, где согласные теряются даже в лёгком эхе
    'clear': 'equalizer=f=3000:t=q:w=1.2:g=3,aecho=0.8:0.25:40:0.08',
    'hurt': 'equalizer=f=200:t=q:w=1:g=3,aecho=0.8:0.4:60|120:0.25|0.12',
    'sensei': 'rubberband=pitch=0.9:formant=preserved,equalizer=f=250:t=q:w=1:g=3,aecho=0.8:0.6:90|180|320:0.30|0.20|0.12',
    'scout': 'rubberband=pitch=0.92,equalizer=f=900:t=q:w=1.5:g=4,highpass=f=180,aecho=0.8:0.3:35:0.2',
    'oni': ('rubberband=pitch=0.82,chorus=0.6:0.9:40|55:0.35|0.3:0.25|0.4:2|2.3,'
            'equalizer=f=150:t=q:w=1:g=4,aecho=0.8:0.5:60|120:0.3|0.18'),
    'boss': ('rubberband=pitch=0.74:formant=shifted,equalizer=f=110:t=q:w=1:g=6,'
             'aexciter=amount=1.5:drive=5,aecho=0.8:0.7:120|260|480:0.40|0.28|0.16,asoftclip=type=atan'),
}

LOUD = 'loudnorm=I=-15:TP=-1.5:LRA=9'
TARGET_LUFS = -15.5
PAD = 'adelay=40:all=1,apad=pad_dur=0.25'


def write_wav(path: Path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm)


def role_of(line_id: str) -> str:
    return ROLE.get(line_id) or _role_by_prefix(line_id) or 'hero'


def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def process(src: Path, line_id: str, out_dir: Path) -> Path:
    fx = FX[role_of(line_id)]
    dst = out_dir / f'{line_id}.mp3'
    with tempfile.TemporaryDirectory() as tmp:
        clean = Path(tmp) / 'clean.wav'
        cut = Path(tmp) / 'cut.wav'
        run(['ffmpeg', '-y', '-i', str(src), '-ac', '1', '-ar', str(SR), '-af', CLEAN, str(clean)])
        write_wav(cut, gate_trim(decode(clean)))
        styled = Path(tmp) / 'styled.wav'
        run(['ffmpeg', '-y', '-i', str(cut), '-af', f'{fx},{LOUD},{PAD}', '-ar', '44100', '-ac', '1', str(styled)])
        # loudnorm на коротких фразах иногда промахивается — добиваем громкость точно до цели
        gain = TARGET_LUFS - measure_lufs(styled)
        run(['ffmpeg', '-y', '-i', str(styled), '-af', f'volume={gain:.2f}dB,alimiter=limit=0.89', '-ar', '44100',
             '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '112k', str(dst)])
    return dst


def measure_lufs(path: Path) -> float:
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(path), '-af', 'ebur128', '-f', 'null', '-'],
                         stderr=subprocess.PIPE, text=True).stderr
    for line in reversed(out.splitlines()):
        line = line.strip()
        if line.startswith('I:'):
            return float(line.split()[1])
    return TARGET_LUFS


def main():
    raw = Path(sys.argv[1])
    mapping = json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
    out_dir = Path(sys.argv[3] if len(sys.argv) > 3 else 'public/voices')
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, line_id in mapping.items():
        if not line_id:
            continue
        dst = process(raw / name, line_id, out_dir)
        print(f'✓ {name} → {dst.name} ({role_of(line_id)})')


if __name__ == '__main__':
    main()
