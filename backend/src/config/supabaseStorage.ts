import { createClient } from '@supabase/supabase-js';
import { config } from './index';
import logger from './logger';

if (!config.supabase.url || !config.supabase.serviceKey) {
  logger.warn('Supabase credentials missing — file storage will fail until configured.');
}

const supabase = createClient(
  config.supabase.url || 'https://placeholder.supabase.co',
  config.supabase.serviceKey || 'placeholder',
);

const BUCKET = config.supabase.bucket;

/**
 * Upload a file buffer to Supabase Storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadToSupabase(
  buffer: Buffer,
  fileName: string,
  contentType: string = 'application/pdf',
): Promise<string> {
  const storagePath = `uploads/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    logger.error({ error, storagePath }, 'Supabase Storage upload failed');
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  logger.info({ storagePath, url: urlData.publicUrl }, 'File uploaded to Supabase Storage');
  return urlData.publicUrl;
}

/**
 * Delete a file from Supabase Storage by its public URL or storage path.
 */
export async function deleteFromSupabase(fileUrl: string): Promise<void> {
  // Extract the storage path from the public URL
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = fileUrl.indexOf(marker);
  const storagePath = idx !== -1
    ? fileUrl.substring(idx + marker.length)
    : fileUrl;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (error) {
    logger.warn({ error, storagePath }, 'Supabase Storage delete failed (non-fatal)');
  }
}

/**
 * Download a file from Supabase Storage by its public URL.
 * Returns the file as a Buffer.
 */
export async function downloadFromSupabase(fileUrl: string): Promise<Buffer> {
  // Extract the storage path from the public URL
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = fileUrl.indexOf(marker);
  const storagePath = idx !== -1
    ? fileUrl.substring(idx + marker.length)
    : fileUrl;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);

  if (error || !data) {
    throw new Error(`Supabase download failed: ${error?.message || 'No data'}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export { supabase, BUCKET };
