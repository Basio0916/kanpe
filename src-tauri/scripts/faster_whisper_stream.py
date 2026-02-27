#!/usr/bin/env python3
import argparse
import json
import re
import shutil
import sys
from pathlib import Path
from typing import Any

import numpy as np
from faster_whisper import WhisperModel

BROKEN_MODEL_CACHE_RE = re.compile(r"Unable to open file 'model\.bin' in model '([^']+)'")


def emit(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def emit_error(message: str) -> None:
    emit({"type": "error", "message": message})


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="kanpe faster-whisper stream helper")
    parser.add_argument("--sample-rate", type=int, default=16000)
    parser.add_argument("--model", type=str, default="small")
    parser.add_argument("--language", type=str, default="en")
    parser.add_argument("--chunk-ms", type=int, default=2000)
    parser.add_argument("--device", type=str, default="auto")
    parser.add_argument("--compute-type", type=str, default="int8")
    return parser.parse_args()


def load_model_with_cache_repair(
    model_name: str,
    device: str,
    compute_type: str,
) -> WhisperModel:
    try:
        return WhisperModel(model_name, device=device, compute_type=compute_type)
    except Exception as first_exc:
        first_message = str(first_exc)
        match = BROKEN_MODEL_CACHE_RE.search(first_message)
        if not match:
            raise

        broken_snapshot = Path(match.group(1))
        if not broken_snapshot.exists():
            raise

        print(
            f"[kanpe] detected broken faster-whisper cache at {broken_snapshot}, recreating...",
            file=sys.stderr,
            flush=True,
        )
        shutil.rmtree(broken_snapshot, ignore_errors=True)
        return WhisperModel(model_name, device=device, compute_type=compute_type)


def transcribe_chunk(
    model: WhisperModel,
    pcm: np.ndarray,
    language: str,
    chunk_start_sec: float,
    sample_rate: int,
) -> None:
    if pcm.size == 0:
        return

    float_audio = pcm.astype(np.float32) / 32768.0
    segments, _ = model.transcribe(
        float_audio,
        language=language or None,
        vad_filter=True,
        beam_size=1,
        best_of=1,
        condition_on_previous_text=False,
    )

    merged = " ".join(seg.text.strip() for seg in segments if seg.text and seg.text.strip()).strip()
    if not merged:
        return

    duration_sec = float_audio.shape[0] / float(sample_rate)
    emit(
        {
            "type": "transcript",
            "status": "final",
            "source": "SPK",
            "text": merged,
            "start": chunk_start_sec,
            "duration": duration_sec,
            "end": chunk_start_sec + duration_sec,
        }
    )


def main() -> int:
    args = parse_args()
    if args.sample_rate <= 0:
        emit_error("sample-rate must be greater than 0")
        return 1

    chunk_samples = max(1, int(args.sample_rate * max(args.chunk_ms, 200) / 1000))
    chunk_bytes = chunk_samples * 2

    try:
        model = load_model_with_cache_repair(args.model, args.device, args.compute_type)
    except Exception as exc:
        emit_error(f"failed to load faster-whisper model: {exc}")
        return 1

    emit(
        {
            "type": "ready",
            "model": args.model,
            "language": args.language,
            "sample_rate": args.sample_rate,
            "chunk_ms": args.chunk_ms,
        }
    )

    buffer = bytearray()
    processed_samples = 0

    while True:
        data = sys.stdin.buffer.read(4096)
        if not data:
            break
        buffer.extend(data)

        while len(buffer) >= chunk_bytes:
            chunk = bytes(buffer[:chunk_bytes])
            del buffer[:chunk_bytes]

            pcm = np.frombuffer(chunk, dtype=np.int16)
            chunk_start_sec = processed_samples / float(args.sample_rate)
            try:
                transcribe_chunk(model, pcm, args.language, chunk_start_sec, args.sample_rate)
            except Exception as exc:
                emit_error(f"transcription failed: {exc}")
            processed_samples += pcm.shape[0]

    if len(buffer) >= 2:
        complete_len = len(buffer) - (len(buffer) % 2)
        if complete_len > 0:
            pcm = np.frombuffer(bytes(buffer[:complete_len]), dtype=np.int16)
            chunk_start_sec = processed_samples / float(args.sample_rate)
            try:
                transcribe_chunk(model, pcm, args.language, chunk_start_sec, args.sample_rate)
            except Exception as exc:
                emit_error(f"transcription failed: {exc}")

    emit({"type": "closed"})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
