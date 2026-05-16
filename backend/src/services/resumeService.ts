import prisma from '../config/database';
import logger from '../config/logger';
import { uploadToSupabase, deleteFromSupabase } from '../config/supabaseStorage';
import { addResumeJob } from '../queues';
import { v4 as uuidv4 } from 'uuid';

type UserContext = { id: string; role: string };

export class ResumeService {
  static async upload(userId: string, file: Express.Multer.File) {
    // Upload buffer directly to Supabase Storage
    const storageFileName = `${uuidv4()}.pdf`;
    const publicUrl = await uploadToSupabase(file.buffer, storageFileName, 'application/pdf');

    const resume = await prisma.resume.create({
      data: {
        userId,
        fileName: file.originalname,
        fileUrl: publicUrl,        // Supabase public URL stored in DB
        fileSize: file.size,
      },
    });

    logger.info({ resumeId: resume.id, userId, storageFileName }, 'Resume uploaded to Supabase Storage');

    // Enqueue AI analysis via BullMQ (non-blocking, with retries)
    addResumeJob({
      resumeId: resume.id,
      fileUrl: publicUrl,
      fileName: resume.fileName,
    }).catch(err => {
      logger.error({ error: err, resumeId: resume.id }, 'Failed to enqueue resume analysis');
    });

    return resume;
  }

  static async getByUserId(userId: string) {
    return prisma.resume.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  static async getByIdForUser(id: string, user: UserContext) {
    const resume = await prisma.resume.findUnique({ where: { id } });
    if (!resume) return null;
    if (user.role === 'ADMIN' || resume.userId === user.id) return resume;
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }

  static async delete(id: string, user: UserContext) {
    const resume = await prisma.resume.findUnique({ where: { id } });

    if (!resume) throw Object.assign(new Error('Resume not found'), { status: 404 });
    if (user.role !== 'ADMIN' && resume.userId !== user.id) {
      throw Object.assign(new Error('Access denied'), { status: 403 });
    }

    // Delete from Supabase Storage (non-fatal if it fails — file may already be gone)
    await deleteFromSupabase(resume.fileUrl).catch(err =>
      logger.warn({ err, resumeId: id }, 'Could not delete file from Supabase Storage')
    );

    await prisma.resume.delete({ where: { id } });
    logger.info({ resumeId: id }, 'Resume deleted');
  }

  static async analyzeResume(resumeId: string, user?: UserContext) {
    const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) {
      throw Object.assign(new Error('Resume not found'), { status: 404 });
    }
    if (user && user.role !== 'ADMIN' && resume.userId !== user.id) {
      throw Object.assign(new Error('Access denied'), { status: 403 });
    }

    // Enqueue via BullMQ — file lives in Supabase, worker fetches it via URL
    await addResumeJob({
      resumeId: resume.id,
      fileUrl: resume.fileUrl,
      fileName: resume.fileName,
    });

    logger.info({ resumeId }, 'Resume analysis enqueued');
  }
}
