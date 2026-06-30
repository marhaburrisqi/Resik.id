/**
 * lib/supabase/storage.ts
 *
 * Production photo storage layer for RESIK report photos.
 *
 * Bucket layout:
 *   report-photos/
 *     {userId}/
 *       {reportId}/
 *         photo.jpg
 *
 * Design decisions:
 * - One photo per report (overwrite if re-submitted with same reportId).
 * - `upsert: true` allows safe retry if upload was interrupted mid-flight.
 * - Returns both a public URL (for <Image> rendering) and the storage path
 *   (for deletion and URL reconstruction without an extra RPC call).
 * - Never throws raw Supabase errors to the caller — wraps them in
 *   Indonesian-language Error messages for citizen-facing UI.
 */

import { supabase, supabaseUrl, supabaseAnonKey } from './client';
import { logger } from '../../utils/logger';

const BUCKET = 'report-photos';

export interface PhotoUploadResult {
  /** Publicly accessible HTTPS URL for use in <Image source={{ uri }} /> */
  publicUrl: string;
  /** Storage object path: report-photos/{userId}/{reportId}/photo.jpg */
  storagePath: string;
}

/**
 * Upload a local image URI to Supabase Storage.
 *
 * @param localUri  - The file:// or content:// URI from expo-image-picker.
 * @param userId    - Authenticated citizen's UUID (partition key in bucket).
 * @param reportId  - The idempotency_key / local_uuid of the report (folder key).
 * @returns PhotoUploadResult with publicUrl and storagePath.
 * @throws Error with Indonesian message on failure.
 */
export async function uploadReportPhoto(
  localUri: string,
  userId: string,
  reportId: string
): Promise<PhotoUploadResult> {
  // If already a remote URL, just return it as-is (idempotent)
  if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
    const storagePath = `${userId}/${reportId}/photo.jpg`;
    return { publicUrl: localUri, storagePath };
  }

  // Build the deterministic storage path
  const storagePath = `${userId}/${reportId}/photo.jpg`;

  try {
    // React Native supports reading local file:// URIs via FormData directly.
    // Using fetch→blob fails on Android — use XHR multipart upload instead.
    const formData = new FormData();
    formData.append('file', {
      uri: localUri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);

    // Get the Supabase storage upload URL and auth token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Sesi login tidak aktif. Silakan login ulang.');
    }

    const uploadUrl = `${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`;

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: supabaseAnonKey,
        'x-upsert': 'true',
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      logger.error('Supabase Storage upload failed', errText);
      throw new Error(`Gagal mengunggah foto ke server: ${errText}`);
    }

    // Retrieve the permanent public URL (sync, no network call)
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;
    logger.info('Photo uploaded successfully', { storagePath, publicUrl });

    return { publicUrl, storagePath };
  } catch (err: unknown) {
    if (err instanceof Error) throw err;
    throw new Error('Terjadi kesalahan tidak dikenal saat mengunggah foto.');
  }
}

/**
 * Delete a photo from Supabase Storage by its storage path.
 * Safe to call even if the object does not exist (no-op).
 *
 * @param storagePath - The object path returned by uploadReportPhoto().
 */
export async function deleteReportPhoto(storagePath: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([storagePath]);

    if (error) {
      // Log but do not throw — deletion failure is non-critical
      logger.error('Failed to delete report photo from storage', error);
    } else {
      logger.info('Report photo deleted from storage', { storagePath });
    }
  } catch (err) {
    logger.error('Unexpected error deleting report photo', err);
  }
}

/**
 * Get the public URL for a photo by its storage path.
 * This is a synchronous computation — no network call required.
 *
 * @param storagePath - The object path: {userId}/{reportId}/photo.jpg
 * @returns The public HTTPS URL string.
 */
export function getReportPhotoUrl(storagePath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Build the canonical storage path for a given user+report combination.
 * Useful for constructing the path before an upload (e.g., for optimistic UI).
 */
export function buildStoragePath(userId: string, reportId: string): string {
  return `${userId}/${reportId}/photo.jpg`;
}
