import { Router, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ResumeService } from '../services/resumeService';
import { config } from '../config';
import { validateParams } from '../middleware/validate';
import { supabase, BUCKET } from '../config/supabaseStorage';

const router = Router();

// Use memory storage — no local disk writes, buffer goes straight to Supabase
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().split('.').pop();
    if (ext === 'pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

const idParamSchema = z.object({ id: z.string().uuid() });

function ensurePdfSignature(buffer: Buffer): void {
  if (buffer.length < 4 || buffer.slice(0, 4).toString() !== '%PDF') {
    throw new Error('Invalid PDF file');
  }
}

router.post('/', authenticate, upload.single('resume'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Resume file is required' });
    if (req.user!.role !== 'CANDIDATE' && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Candidate access required' });
    }
    try {
      ensurePdfSignature(req.file.buffer);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Invalid PDF file' });
    }
    const resume = await ResumeService.upload(req.user!.id, req.file);
    res.status(201).json(resume);
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const resumes = await ResumeService.getByUserId(req.user!.id);
    res.json(resumes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticate, validateParams(idParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const resume = await ResumeService.getByIdForUser(req.params.id as string, req.user!);
    if (!resume) return res.status(404).json({ error: 'Resume not found' });
    res.json(resume);
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Download: generate a short-lived signed URL from Supabase and redirect
router.get('/:id/download', authenticate, validateParams(idParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const resume = await ResumeService.getByIdForUser(req.params.id as string, req.user!);
    if (!resume) return res.status(404).json({ error: 'Resume not found' });

    // Extract storage path from the public URL stored in DB
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = resume.fileUrl.indexOf(marker);
    const storagePath = idx !== -1
      ? resume.fileUrl.substring(idx + marker.length)
      : resume.fileUrl;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60); // 60-second expiry

    if (error || !data?.signedUrl) {
      return res.status(404).json({ error: 'File not available' });
    }

    res.redirect(data.signedUrl);
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.delete('/:id', authenticate, validateParams(idParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    await ResumeService.delete(req.params.id as string, req.user!);
    res.json({ message: 'Resume deleted' });
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/:id/analyze', authenticate, validateParams(idParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    await ResumeService.analyzeResume(req.params.id as string, req.user!);
    res.json({ message: 'Analysis started' });
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

export default router;
