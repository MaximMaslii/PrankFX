"""The two-pass Snap pipeline.

Only the tail of the clip is sent to Lucy. The first 1.2 seconds stay exactly
as recorded, which is what creates the contrast the whole format rests on — and
it is also 24% cheaper, because those 1.2 seconds are never billed.

    [0.0 .. 1.2]   seg_a      untouched original
    [1.2 .. 5.0]   seg_b      -> Lucy -> seg_b_fx
    [4.6 .. 5.0]   tail       frame zero of seg_a, frozen, crossfaded in

The last frame therefore matches the first, and TikTok's loop plays it back
seamlessly.
"""
import asyncio
import logging
import os
import shutil
import subprocess
from pathlib import Path

from app.config import settings
from snap_effects import (
    SNAP_AT_SECONDS,
    SNAP_OUTPUT_FPS,
    SNAP_OUTPUT_HEIGHT,
    SNAP_OUTPUT_WIDTH,
    SNAP_TAIL_SECONDS,
    SNAP_TOTAL_SECONDS,
    SNAP_XFADE_OFFSET,
)


logger = logging.getLogger("prankfx.snap.pipeline")


class FFmpegError(RuntimeError):
    """Raised when an ffmpeg invocation fails."""


# Every input is normalised to the same size, SAR, frame rate AND timebase
# before concat/xfade. Without this the filters fail with an opaque complaint
# about incompatible streams — and `settb` in particular is easy to miss:
# concat hands its output on at 1/1000000 while a still-image input stays at
# 1/30, and xfade refuses the mismatch outright.
_NORMALISE = (
    f"scale={SNAP_OUTPUT_WIDTH}:{SNAP_OUTPUT_HEIGHT}"
    ":force_original_aspect_ratio=increase,"
    f"crop={SNAP_OUTPUT_WIDTH}:{SNAP_OUTPUT_HEIGHT},"
    "setsar=1,"
    f"fps={SNAP_OUTPUT_FPS},"
    "settb=AVTB"
)


# ==========================================================================
# Locating ffmpeg / ffprobe
#
# `shutil.which("ffmpeg")` alone finds the binary only when it is on PATH,
# which on Windows it usually is not: winget and Chocolatey drop it in their
# own folders, and a hand-unzipped build sits wherever it was unzipped. The
# whole Snap feature then fails with "ffmpeg is not installed" even though the
# machine has it. Every likely location is searched instead, and an absolute
# path in FFMPEG_BIN / FFPROBE_BIN always wins.
# ==========================================================================

_BACKEND_DIR = Path(__file__).resolve().parents[2]
_PROJECT_DIR = _BACKEND_DIR.parent

# Successful lookups only — a negative result is never cached, so installing
# ffmpeg while the server runs takes effect on the next clip.
_BINARY_CACHE: dict[str, str] = {}


def _search_dirs() -> list[Path]:
    """Folders to look in when the binary is not on PATH."""

    dirs: list[Path] = [
        _BACKEND_DIR / "ffmpeg" / "bin",
        _BACKEND_DIR / "ffmpeg",
        _PROJECT_DIR / "ffmpeg" / "bin",
        _PROJECT_DIR / "ffmpeg",
        _PROJECT_DIR.parent / "ffmpeg" / "bin",
    ]

    if os.name == "nt":
        program_files = os.environ.get("ProgramFiles", r"C:\Program Files")
        local_app_data = os.environ.get("LOCALAPPDATA", "")

        dirs += [
            Path(r"C:\ffmpeg\bin"),
            Path(program_files) / "ffmpeg" / "bin",
            Path(r"C:\ProgramData\chocolatey\bin"),
        ]

        if local_app_data:
            winget = Path(local_app_data) / "Microsoft" / "WinGet"

            dirs.append(winget / "Links")

            # winget keeps the real build under Packages/<id>/<ffmpeg-x.y>/bin.
            try:
                dirs += sorted((winget / "Packages").glob("*FFmpeg*/*/bin"))
            except OSError:
                pass

    return dirs


def _resolve_binary(name: str, configured: str) -> str | None:
    """Full path to `ffmpeg` / `ffprobe`, or None when it cannot be found."""

    cached = _BINARY_CACHE.get(name)

    if cached and Path(cached).is_file():
        return cached

    candidates: list[Path] = []

    # 1. An absolute path in the settings always wins — it is the escape hatch
    #    for an install in a place nobody could guess.
    configured_path = Path(configured)

    if configured_path.is_absolute():
        candidates.append(configured_path)

        if os.name == "nt" and configured_path.suffix == "":
            candidates.append(configured_path.with_suffix(".exe"))

    for candidate in candidates:
        if candidate.is_file():
            _BINARY_CACHE[name] = str(candidate)
            return str(candidate)

    # 2. PATH.
    found = shutil.which(configured) or shutil.which(name)

    if found:
        _BINARY_CACHE[name] = found
        return found

    # 3. The usual install locations.
    filenames = [f"{name}.exe", name] if os.name == "nt" else [name]

    for directory in _search_dirs():
        for filename in filenames:
            candidate = directory / filename

            if candidate.is_file():
                _BINARY_CACHE[name] = str(candidate)
                return str(candidate)

    # 4. Last resort: the binary bundled with the imageio-ffmpeg wheel, if it
    #    happens to be installed. It ships ffmpeg but no ffprobe.
    if name == "ffmpeg":
        try:
            import imageio_ffmpeg

            found = imageio_ffmpeg.get_ffmpeg_exe()

            if found and Path(found).is_file():
                _BINARY_CACHE[name] = found
                return found

        except Exception:
            pass

    return None


def ffmpeg_path() -> str | None:
    return _resolve_binary("ffmpeg", settings.FFMPEG_BIN)


def ffprobe_path() -> str | None:
    return _resolve_binary("ffprobe", settings.FFPROBE_BIN)


def ffmpeg_available() -> bool:
    return ffmpeg_path() is not None


# ==========================================================================
# Running the binaries
#
# `asyncio.create_subprocess_exec` needs a ProactorEventLoop on Windows. Under
# a SelectorEventLoop — which is what several servers and libraries install
# there — it does not fail gracefully: it raises a bare NotImplementedError
# with no message, so the job died as "Unexpected error:" with nothing after
# the colon. blocking `subprocess.run` handed to a worker thread behaves the
# same on every platform and every event loop.
# ==========================================================================

# Hard ceiling per invocation: a wedged ffmpeg would otherwise hold the job
# (and its FX credits) forever.
_PROCESS_TIMEOUT_SECONDS = 300

# Keeps a console window from flashing up on Windows for every step.
_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0


def _run_blocking(command: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=_PROCESS_TIMEOUT_SECONDS,
        creationflags=_NO_WINDOW,
    )


async def _run_process(command: list[str], label: str) -> tuple[int, bytes, bytes]:
    """Run a binary off the event loop and return (returncode, stdout, stderr)."""

    try:
        result = await asyncio.to_thread(_run_blocking, command)

    except subprocess.TimeoutExpired as e:
        raise FFmpegError(
            f"Video processing timed out at step '{label}' "
            f"after {_PROCESS_TIMEOUT_SECONDS} seconds."
        ) from e

    except OSError as e:
        raise FFmpegError(
            f"Could not start {Path(command[0]).name} at step '{label}': {e}"
        ) from e

    return result.returncode, result.stdout or b"", result.stderr or b""


async def run_ffmpeg(args: list[str], label: str) -> None:
    """Run ffmpeg and raise with the tail of stderr when it fails."""

    binary = ffmpeg_path()

    if not binary:
        raise FFmpegError(
            "ffmpeg was not found. Install it (Windows: "
            "`winget install Gyan.FFmpeg`) or set FFMPEG_BIN in backend/.env "
            "to the full path of ffmpeg.exe, then restart the backend."
        )

    command = [binary, "-hide_banner", "-loglevel", "error", "-y", *args]

    returncode, _, stderr = await _run_process(command, label)

    if returncode != 0:
        detail = stderr.decode("utf-8", "replace").strip()
        logger.error("ffmpeg step %s failed: %s", label, detail)

        raise FFmpegError(
            f"Video processing failed at step '{label}': {detail[-400:]}"
        )


async def _has_audio_stream_via_ffmpeg(path: Path) -> bool:
    """Audio probe without ffprobe: read what `ffmpeg -i` prints about the file.

    Assuming "no audio" instead would silently drop the voice — and the voice is
    half the Snap format — so this fallback matters whenever ffmpeg was found
    but ffprobe was not (an imageio-ffmpeg install, for instance).
    """
    binary = ffmpeg_path()

    if not binary:
        return False

    # `ffmpeg -i` with no output file always exits non-zero; the stream summary
    # it prints on stderr is what is wanted here.
    try:
        _, _, stderr = await _run_process(
            [binary, "-hide_banner", "-i", str(path)],
            "probe:audio",
        )

    except FFmpegError:
        return False

    return b"Audio:" in stderr


async def has_audio_stream(path: Path) -> bool:
    """True when the file carries at least one audio stream."""

    ffprobe = ffprobe_path()

    if not ffprobe:
        return await _has_audio_stream_via_ffmpeg(path)

    try:
        _, stdout, _ = await _run_process(
            [
                ffprobe,
                "-v", "error",
                "-select_streams", "a:0",
                "-show_entries", "stream=codec_type",
                "-of", "csv=p=0",
                str(path),
            ],
            "probe:audio",
        )

    except FFmpegError:
        # ffprobe itself would not start — fall back rather than lose the voice.
        return await _has_audio_stream_via_ffmpeg(path)

    return b"audio" in stdout


# ==========================================================================
# Steps
# ==========================================================================


async def split_clip(source: Path, work_dir: Path) -> tuple[Path, Path]:
    """Cut the recording at SNAP_AT_SECONDS.

    Deliberately re-encoded rather than stream-copied: `-c copy` snaps to the
    nearest keyframe and the boundary drifts by 200-400 ms, which is exactly
    the frame the whole effect hangs on.
    """
    seg_a = work_dir / "seg_a.mp4"
    seg_b = work_dir / "seg_b.mp4"

    await run_ffmpeg(
        [
            "-i", str(source),
            "-t", f"{SNAP_AT_SECONDS}",
            "-r", str(SNAP_OUTPUT_FPS),
            "-vf", _NORMALISE,
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-pix_fmt", "yuv420p",
            "-an",
            str(seg_a),
        ],
        "split:head",
    )

    await run_ffmpeg(
        [
            "-i", str(source),
            "-ss", f"{SNAP_AT_SECONDS}",
            "-t", f"{SNAP_TOTAL_SECONDS - SNAP_AT_SECONDS}",
            "-r", str(SNAP_OUTPUT_FPS),
            "-vf", _NORMALISE,
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-pix_fmt", "yuv420p",
            "-an",
            str(seg_b),
        ],
        "split:tail",
    )

    return seg_a, seg_b


async def build_frozen_tail(seg_a: Path, work_dir: Path) -> Path:
    """Freeze frame zero — the target the clip collapses back into."""

    frame_zero = work_dir / "frame0.png"
    tail = work_dir / "tail.mp4"

    await run_ffmpeg(
        [
            "-i", str(seg_a),
            "-vf", "select=eq(n\\,0)",
            "-frames:v", "1",
            str(frame_zero),
        ],
        "tail:frame0",
    )

    await run_ffmpeg(
        [
            "-loop", "1",
            "-i", str(frame_zero),
            "-t", f"{SNAP_TAIL_SECONDS}",
            "-r", str(SNAP_OUTPUT_FPS),
            "-vf", _NORMALISE,
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-pix_fmt", "yuv420p",
            str(tail),
        ],
        "tail:freeze",
    )

    return tail


def watermark_file() -> Path | None:
    """The mark to burn in, or None when it is switched off or missing."""

    if not settings.SNAP_WATERMARK:
        return None

    path = Path(settings.snap_watermark_path)

    if not path.is_file():
        logger.warning("Watermark enabled but %s is missing", path)
        return None

    return path


async def assemble_video(
    seg_a: Path,
    seg_b_fx: Path,
    tail: Path,
    work_dir: Path,
    xfade_duration: float,
    watermark: bool = False,
) -> Path:
    """Concat head + effected tail, then crossfade into the frozen frame.

    The watermark rides along in the same filter graph rather than in a second
    pass: an extra encode would cost another few seconds per clip and a second
    generation loss, for a logo.
    """

    out = work_dir / "video_only.mp4"

    offset = max(0.1, SNAP_TOTAL_SECONDS - xfade_duration)

    mark = watermark_file() if watermark else None

    filter_complex = (
        f"[0:v]{_NORMALISE}[a0];"
        f"[1:v]{_NORMALISE}[b0];"
        f"[2:v]{_NORMALISE}[t0];"
        "[a0][b0]concat=n=2:v=1:a=0,settb=AVTB[ab];"
        f"[ab][t0]xfade=transition=fade:duration={xfade_duration}"
        f":offset={offset}[v]"
    )

    inputs = [
        "-i", str(seg_a),
        "-i", str(seg_b_fx),
        "-i", str(tail),
    ]

    video_out = "[v]"

    if mark:
        mark_width = max(
            48,
            int(SNAP_OUTPUT_WIDTH * settings.SNAP_WATERMARK_WIDTH_RATIO),
        )

        opacity = min(max(settings.SNAP_WATERMARK_OPACITY, 0.1), 1.0)

        # Bottom-right, inset by ~3% of the width, which keeps it clear of
        # TikTok's own UI overlay in the corner.
        inset = int(SNAP_OUTPUT_WIDTH * 0.035)

        inputs += ["-i", str(mark)]

        filter_complex += (
            f";[3:v]scale={mark_width}:-1,format=rgba,"
            f"colorchannelmixer=aa={opacity}[wm];"
            f"[v][wm]overlay=W-w-{inset}:H-h-{inset}:format=auto[vout]"
        )

        video_out = "[vout]"

    await run_ffmpeg(
        [
            *inputs,
            "-filter_complex", filter_complex,
            "-map", video_out,
            "-an",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-pix_fmt", "yuv420p",
            "-t", f"{SNAP_TOTAL_SECONDS}",
            "-movflags", "+faststart",
            str(out),
        ],
        "assemble:video",
    )

    return out


async def mix_audio(
    video_only: Path,
    source: Path,
    work_dir: Path,
    destination: Path,
) -> Path:
    """Lay the original voice back under the clip and drop the impact hit on 1.2s.

    Audio is taken from the ORIGINAL recording rather than from the segments,
    because Lucy returns video without an audio track and concatenating a
    missing stream is a hard ffmpeg failure.

    The impact sound ships with the app and is generated, not licensed: a
    trending track would survive neither TikTok's rights matching nor app-store
    review.
    """
    impact = Path(settings.snap_impact_path)

    source_has_audio = await has_audio_stream(source)
    impact_exists = impact.is_file()

    if not source_has_audio and not impact_exists:
        # Nothing to mux — ship the silent cut rather than failing the job.
        shutil.copyfile(video_only, destination)
        return destination

    delay_ms = int(SNAP_AT_SECONDS * 1000)

    inputs: list[str] = ["-i", str(video_only)]
    parts: list[str] = []
    mix_labels: list[str] = []
    index = 1

    if source_has_audio:
        inputs += ["-i", str(source)]
        parts.append(
            f"[{index}:a]atrim=0:{SNAP_TOTAL_SECONDS},asetpts=PTS-STARTPTS,"
            "aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,"
            "volume=1.0[voice]"
        )
        mix_labels.append("[voice]")
        index += 1

    if impact_exists:
        inputs += ["-i", str(impact)]
        parts.append(
            f"[{index}:a]adelay={delay_ms}|{delay_ms},"
            "aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,"
            "volume=0.8[sfx]"
        )
        mix_labels.append("[sfx]")
        index += 1

    if len(mix_labels) == 2:
        parts.append(
            f"{mix_labels[0]}{mix_labels[1]}"
            "amix=inputs=2:duration=first:dropout_transition=0,"
            "alimiter=limit=0.95[a]"
        )
    else:
        parts.append(f"{mix_labels[0]}apad,alimiter=limit=0.95[a]")

    await run_ffmpeg(
        [
            *inputs,
            "-filter_complex", ";".join(parts),
            "-map", "0:v",
            "-map", "[a]",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "128k",
            "-shortest",
            "-movflags", "+faststart",
            str(destination),
        ],
        "assemble:audio",
    )

    return destination


async def probe_dimensions(path: Path) -> tuple[int, int] | None:
    """(width, height) of the first video stream, or None if unknown."""

    ffprobe = ffprobe_path()

    if ffprobe:
        try:
            code, stdout, _ = await _run_process(
                [
                    ffprobe,
                    "-v", "error",
                    "-select_streams", "v:0",
                    "-show_entries", "stream=width,height",
                    "-of", "csv=p=0:s=x",
                    str(path),
                ],
                "probe:size",
            )
            if code == 0:
                parts = stdout.decode("utf-8", "replace").strip().split("x")
                if len(parts) >= 2 and parts[0].isdigit() and parts[1].isdigit():
                    return int(parts[0]), int(parts[1])
        except FFmpegError:
            pass

    binary = ffmpeg_path()

    if not binary:
        return None

    try:
        _, _, stderr = await _run_process(
            [binary, "-hide_banner", "-i", str(path)],
            "probe:size",
        )
    except FFmpegError:
        return None

    import re

    for line in stderr.decode("utf-8", "replace").splitlines():
        if "Video:" in line:
            match = re.search(r"[ ,](\d{2,5})x(\d{2,5})[ ,\]]", line)
            if match:
                return int(match.group(1)), int(match.group(2))

    return None


async def photo_to_clip(photo: Path, work_dir: Path) -> Path:
    """A 5-second still clip of one photo — what Lucy (video-to-video) edits.

    Short side 720 px (Lucy renders 720p), the photo's own aspect ratio kept,
    even dimensions for H.264.
    """
    out = work_dir / "photo_still.mp4"

    await run_ffmpeg(
        [
            "-loop", "1",
            "-i", str(photo),
            "-t", f"{SNAP_TOTAL_SECONDS}",
            "-r", "24",
            "-vf",
            "scale='if(gte(iw,ih),-2,720)':'if(gte(iw,ih),720,-2)',setsar=1",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            str(out),
        ],
        "photo:still",
    )

    return out


async def finish_photo_clip(
    raw: Path,
    destination: Path,
    watermark: bool,
) -> Path:
    """Turn PixVerse's MP4 into the clip the app downloads.

    Premium users get PixVerse's file as-is (just remuxed for fast start).
    Everyone else gets the same mark the recorded Snaps carry. The mark is
    sized from the real frame width, because a photo clip can be portrait,
    square or landscape — whatever shape the photo was.

    Without ffmpeg the raw clip is shipped rather than failing a job the user
    has already paid for.
    """
    if not ffmpeg_available():
        logger.warning("ffmpeg missing — shipping the PixVerse clip untouched")
        shutil.copyfile(raw, destination)
        return destination

    mark = watermark_file() if watermark else None
    size = await probe_dimensions(raw) if mark else None

    if mark and size:
        width, _ = size

        mark_width = max(48, int(width * settings.SNAP_WATERMARK_WIDTH_RATIO))
        mark_width -= mark_width % 2
        opacity = min(max(settings.SNAP_WATERMARK_OPACITY, 0.1), 1.0)
        inset = int(width * 0.035)

        filter_complex = (
            f"[1:v]scale={mark_width}:-1,format=rgba,"
            f"colorchannelmixer=aa={opacity}[wm];"
            f"[0:v][wm]overlay=W-w-{inset}:H-h-{inset}:format=auto,"
            "format=yuv420p[vout]"
        )

        await run_ffmpeg(
            [
                "-i", str(raw),
                "-i", str(mark),
                "-filter_complex", filter_complex,
                "-map", "[vout]",
                "-map", "0:a?",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
                "-c:a", "aac", "-b:a", "128k",
                "-movflags", "+faststart",
                str(destination),
            ],
            "photo:watermark",
        )

        return destination

    await run_ffmpeg(
        [
            "-i", str(raw),
            "-map", "0",
            "-c", "copy",
            "-movflags", "+faststart",
            str(destination),
        ],
        "photo:remux",
    )

    return destination


async def build_poster(
    video: Path,
    destination: Path,
    at_seconds: float = 0.2,
) -> None:
    """A single JPEG for the history thumbnail. Failure here is not fatal."""
    try:
        await run_ffmpeg(
            [
                "-ss", f"{at_seconds}",
                "-i", str(video),
                "-frames:v", "1",
                "-q:v", "4",
                str(destination),
            ],
            "poster",
        )
    except FFmpegError:
        logger.warning("Could not build a poster for %s", video.name)
