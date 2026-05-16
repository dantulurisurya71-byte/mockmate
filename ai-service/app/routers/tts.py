from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from gtts import gTTS
import io

router = APIRouter()

class TTSRequest(BaseModel):
    text: str
    voice: str = "en_US-ryan-high" # Keeping for compatibility, but gTTS ignores this

@router.post("/tts")
async def synthesize(req: TTSRequest):
    try:
        # gTTS only supports standard text-to-speech without voice selection
        # tld parameter can be used to change accent (e.g., 'co.uk', 'com.au')
        tts = gTTS(text=req.text, lang='en', slow=False)
        
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)
        
        return Response(content=buf.read(), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
