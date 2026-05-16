from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import tempfile
import logging
import functools
from pydantic import BaseModel
from typing import Optional
import aiofiles
import asyncio

# Global model instance
whisper_model = None

class TranscriptionResponse(BaseModel):
    text: str
    language: Optional[str] = None
    duration: Optional[float] = None

router = APIRouter(prefix="/transcribe", tags=["transcription"])

async def get_whisper_model():
    """Get or initialize the Whisper model singleton"""
    global whisper_model
    if whisper_model is None:
        try:
            from faster_whisper import WhisperModel
            logging.info("Loading Whisper base model...")
            whisper_model = WhisperModel(
                "base",
                device="cpu",
                compute_type="int8"
            )
            logging.info("Whisper base model loaded successfully")
        except Exception as e:
            logging.error(f"Failed to load Whisper model: {e}")
            raise HTTPException(status_code=500, detail="Failed to load transcription model")
    return whisper_model

def _run_transcribe(model, audio_path: str):
    """
    Synchronous helper that calls faster-whisper and collects the segment generator.
    faster-whisper returns (segments_generator, TranscriptionInfo) — NOT a dict.
    This must run in an executor because the generator is lazy/CPU-bound.
    """
    segments, info = model.transcribe(
        audio_path,
        language="en",
        beam_size=1,
        best_of=1,
        temperature=0.0,
    )
    # Consume the generator while still in the executor thread
    text = " ".join(segment.text for segment in segments).strip()
    return text, info.language, getattr(info, "duration", None)

@router.post("/", response_model=TranscriptionResponse)
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe audio/video file using Faster-Whisper"""
    temp_path = None
    try:
        # Validate file type
        content_type = file.content_type or ""
        if not content_type.startswith(('audio/', 'video/')):
            raise HTTPException(status_code=400, detail="Invalid file type. Expected audio or video.")

        # Write upload to a named temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            temp_path = tmp.name

        async with aiofiles.open(temp_path, 'wb') as f:
            content = await file.read()
            await f.write(content)

        # Load model singleton
        model = await get_whisper_model()

        # Run synchronous transcription in thread pool
        logging.info(f"Transcribing file: {file.filename} ({len(content)} bytes)")
        loop = asyncio.get_event_loop()
        text, language, duration = await loop.run_in_executor(
            None,
            functools.partial(_run_transcribe, model, temp_path)
        )

        logging.info(f"Transcription complete: '{text[:80]}...' lang={language}")
        return TranscriptionResponse(text=text, language=language, duration=duration)

    except HTTPException as e:
        if e.status_code == 400:
            raise
        logging.error(f"Transcription HTTP error: {e.detail}")
        return TranscriptionResponse(text="", language="en", duration=0.0)
    except Exception as e:
        logging.error(f"Transcription error: {e}", exc_info=True)
        return TranscriptionResponse(text="", language="en", duration=0.0)
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except OSError:
                pass
