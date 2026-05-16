import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth';
import logger from '../config/logger';
import redisClient from '../config/redis';

const router = Router();

const PIPER_URL = process.env.AI_SERVICE_URL || 'http://mockmate-ai:8000';

router.post('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, voice } = req.body;
    
    if (!text || !voice) {
      res.status(400).json({ error: 'Text and voice are required' });
      return;
    }

    const hash = crypto.createHash('sha256').update(`${voice}:${text}`).digest('hex');
    const cacheKey = `tts:${hash}`;

    const cachedAudio = await redisClient.getBuffer(cacheKey);
    if (cachedAudio) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.send(cachedAudio);
      return;
    }

    // Call AI Service TTS endpoint
    const response = await fetch(`${PIPER_URL}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice })
    });

    if (!response.ok) {
      throw new Error(`TTS failed: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Cache in Redis for 24 hours
    await redisClient.set(cacheKey, buffer, 'EX', 86400);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (error) {
    logger.error({ error }, 'TTS generation failed');
    res.status(500).json({ error: 'TTS generation failed' });
  }
});

export default router;
