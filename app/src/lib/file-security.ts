// app/src/lib/file-security.ts
/**
 * File security utilities for validating uploaded files
 * 
 * Install: npm install file-type
 */

/**
 * Magic bytes (file signatures) for common file types
 * Used to verify file type by content, not just extension
 */
const MAGIC_NUMBERS: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF (for WEBP)
  'image/heic': [0x66, 0x74, 0x79, 0x70], // ftyp signature
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
};

/**
 * Verify file magic bytes (file signature)
 * Returns true if file starts with expected bytes for the given MIME type
 */
export function verifyMagicBytes(buffer: Uint8Array, mimeType: string): boolean {
  const expectedBytes = MAGIC_NUMBERS[mimeType];
  if (!expectedBytes) return false;

  return expectedBytes.every((byte, index) => buffer[index] === byte);
}

/**
 * Check for embedded JavaScript in PDF
 * This is a basic check - more sophisticated scanning is recommended
 */
export function checkPDFForJavaScript(buffer: Uint8Array): boolean {
  const pdfText = new TextDecoder().decode(buffer.slice(0, 50000)); // Check first 50KB

  // Check for JavaScript indicators
  const dangerousPatterns = ['/JavaScript', '/JS', '/AA', '/OpenAction', '/AcroForm'];

  return dangerousPatterns.some((pattern) => pdfText.includes(pattern));
}

/**
 * Sanitize filename - remove/replace unsafe characters
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^\w.\- ]+/g, '_') // Replace unsafe chars
    .replace(/\s+/g, '_') // Replace spaces
    .replace(/_{2,}/g, '_') // Collapse underscores
    .slice(0, 100) // Limit length
    || 'file';
}

/**
 * Validate file for upload
 * Returns error message if validation fails, null if valid
 */
export function validateFileForUpload(
  file: File,
  acceptedMimeTypes: Set<string>,
  maxBytes: number
): string | null {
  // Check size
  if (file.size === 0) {
    return 'Choose a file to attach.';
  }

  if (file.size > maxBytes) {
    const maxMB = (maxBytes / 1024 / 1024).toFixed(1);
    const fileMB = (file.size / 1024 / 1024).toFixed(1);
    return `File is ${fileMB} MB. Maximum is ${maxMB} MB.`;
  }

  // Check MIME type
  if (!acceptedMimeTypes.has(file.type)) {
    return 'File type not accepted. Use JPG, PNG, WEBP, HEIC, or PDF.';
  }

  return null;
}

/**
 * Example usage in attachDocument action:
 * 
 * export async function attachDocument(
 *   _prev: UploadState,
 *   formData: FormData,
 * ): Promise<UploadState> {
 *   const file = formData.get('file');
 *   
 *   if (!(file instanceof File)) {
 *     return { error: 'No file provided.' };
 *   }
 *   
 *   const ACCEPTED = new Set([
 *     'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf',
 *   ]);
 *   const MAX_BYTES = 5 * 1024 * 1024;
 *   
 *   // Basic validation
 *   const error = validateFileForUpload(file, ACCEPTED, MAX_BYTES);
 *   if (error) return { error };
 *   
 *   // Verify magic bytes
 *   const buffer = await file.arrayBuffer();
 *   const bytes = new Uint8Array(buffer);
 *   
 *   if (!verifyMagicBytes(bytes, file.type)) {
 *     return { error: 'File content does not match its type.' };
 *   }
 *   
 *   // Check PDF for embedded JS
 *   if (file.type === 'application/pdf' && checkPDFForJavaScript(bytes)) {
 *     return { error: 'PDF files with JavaScript are not allowed.' };
 *   }
 *   
 *   // Upload to Supabase Storage
 *   const supabase = await createClient();
 *   const path = `${businessId}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
 *   
 *   const { error: uploadError } = await supabase.storage
 *     .from('proofs')
 *     .upload(path, file, { contentType: file.type, upsert: false });
 *     
 *   if (uploadError) {
 *     return { error: 'Upload failed. Please try again.' };
 *   }
 *   
 *   // Continue with document record insertion...
 * }
 */
