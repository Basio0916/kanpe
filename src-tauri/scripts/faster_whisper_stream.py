#!/usr/bin/env python3
import argparse
import json
import os
import re
import shutil
import sys
from pathlib import Path
from typing import Any

import numpy as np
from faster_whisper import WhisperModel

BROKEN_MODEL_CACHE_RE = re.compile(r"Unable to open file 'model\.bin' in model '([^']+)'")
DEFAULT_MIN_RMS_DBFS = -55.0
DEFAULT_MIN_SEGMENT_LOGPROB = -1.0
DEFAULT_MAX_NO_SPEECH_PROB = 0.6
DEFAULT_MAX_COMPRESSION_RATIO = 2.4
DEFAULT_HALLUCINATION_SILENCE_THRESHOLD = 0.8


def emit(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def emit_error(message: str) -> None:
    emit({"type": "error", "message": message})


def parse_env_float(name: str, default: float, min_value: float, max_value: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = float(raw.strip())
    except (TypeError, ValueError):
        return default
    return max(min_value, min(max_value, value))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="kanpe faster-whisper stream helper")
    parser.add_argument("--sample-rate", type=int, default=16000)
    parser.add_argument("--model", type=str, default="small")
    parser.add_argument("--language", type=str, default="en")
    parser.add_argument("--chunk-ms", type=int, default=2000)
    parser.add_argument("--device", type=str, default="auto")
    parser.add_argument("--compute-type", type=str, default="int8")
    parser.add_argument(
        "--min-rms-dbfs",
        type=float,
        default=parse_env_float("STT_SEND_AUDIO_FLOOR_DBFS", DEFAULT_MIN_RMS_DBFS, -120.0, -10.0),
    )
    parser.add_argument(
        "--min-segment-logprob",
        type=float,
        default=parse_env_float(
            "FASTER_WHISPER_MIN_SEGMENT_LOGPROB",
            DEFAULT_MIN_SEGMENT_LOGPROB,
            -10.0,
            0.0,
        ),
    )
    parser.add_argument(
        "--max-no-speech-prob",
        type=float,
        default=parse_env_float(
            "FASTER_WHISPER_MAX_NO_SPEECH_PROB",
            DEFAULT_MAX_NO_SPEECH_PROB,
            0.0,
            1.0,
        ),
    )
    parser.add_argument(
        "--max-compression-ratio",
        type=float,
        default=parse_env_float(
            "FASTER_WHISPER_MAX_COMPRESSION_RATIO",
            DEFAULT_MAX_COMPRESSION_RATIO,
            1.0,
            10.0,
        ),
    )
    parser.add_argument(
        "--hallucination-silence-threshold",
        type=float,
        default=parse_env_float(
            "FASTER_WHISPER_HALLUCINATION_SILENCE_THRESHOLD",
            DEFAULT_HALLUCINATION_SILENCE_THRESHOLD,
            0.0,
            10.0,
        ),
    )
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
    args: argparse.Namespace,
    chunk_start_sec: float,
) -> None:
    if pcm.size == 0:
        return

    float_audio = pcm.astype(np.float32) / 32768.0

    # Silence gate to avoid common hallucinations on near-silent chunks.
    rms = float(np.sqrt(np.mean(np.square(float_audio), dtype=np.float64)))
    rms_dbfs = 20.0 * np.log10(max(rms, 1e-9))
    if rms_dbfs < args.min_rms_dbfs:
        return

    segments, _ = model.transcribe(
        float_audio,
        language=args.language or None,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500, "speech_pad_ms": 160},
        beam_size=1,
        best_of=1,
        temperature=0.0,
        log_prob_threshold=args.min_segment_logprob,
        no_speech_threshold=args.max_no_speech_prob,
        compression_ratio_threshold=args.max_compression_ratio,
        condition_on_previous_text=False,
        hallucination_silence_threshold=args.hallucination_silence_threshold,
    )

    accepted_texts: list[str] = []
    for seg in segments:
        text = seg.text.strip() if seg.text else ""
        if not text:
            continue
        if seg.avg_logprob < args.min_segment_logprob:
            continue
        if seg.no_speech_prob > args.max_no_speech_prob:
            continue
        if seg.compression_ratio > args.max_compression_ratio:
            continue
        accepted_texts.append(text)

    merged = " ".join(accepted_texts).strip()
    if not merged:
        return

    duration_sec = float_audio.shape[0] / float(args.sample_rate)
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
                transcribe_chunk(model, pcm, args, chunk_start_sec)
            except Exception as exc:
                emit_error(f"transcription failed: {exc}")
            processed_samples += pcm.shape[0]

    if len(buffer) >= 2:
        complete_len = len(buffer) - (len(buffer) % 2)
        if complete_len > 0:
            pcm = np.frombuffer(bytes(buffer[:complete_len]), dtype=np.int16)
            chunk_start_sec = processed_samples / float(args.sample_rate)
            try:
                transcribe_chunk(model, pcm, args, chunk_start_sec)
            except Exception as exc:
                emit_error(f"transcription failed: {exc}")

    emit({"type": "closed"})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
