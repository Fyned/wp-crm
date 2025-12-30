/**
 * Professional Media Service for Evolution API
 * Handles ALL media types: images, videos, audio, documents (PDF, Word, Excel, etc.)
 * Downloads from Evolution API → Uploads to Supabase Storage
 */

const axios = require('axios');
const { supabaseAdmin } = require('../config/database');
const evolutionClient = require('../config/evolution');
const path = require('path');

/**
 * Download media from Evolution API and upload to Supabase Storage
 * Supports: Images, Videos, Audio, Documents (PDF, Word, Excel, PPT, etc.)
 */
async function downloadAndUploadMedia(instanceName, messageKey, mediaData, messageType) {
  try {
    console.log(`[Media] Processing ${messageType} for message: ${messageKey.id}`);

    // Extract media URL from Evolution API message data
    const mediaUrl = extractMediaUrl(mediaData, messageType);

    if (!mediaUrl) {
      console.log(`[Media] No media URL found for message type: ${messageType}`);
      return null;
    }

    // Download media from Evolution API
    let mediaBuffer;
    let mimetype = mediaData.mimetype || 'application/octet-stream';
    let originalFilename = mediaData.fileName || null;

    // Evolution API provides base64 or URL
    if (mediaUrl.startsWith('data:')) {
      // Base64 data URL
      const base64Data = mediaUrl.split(',')[1];
      mediaBuffer = Buffer.from(base64Data, 'base64');
    } else if (mediaUrl.startsWith('http')) {
      // External URL - download
      const response = await axios.get(mediaUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });
      mediaBuffer = Buffer.from(response.data);
    } else {
      console.error(`[Media] Invalid media URL format: ${mediaUrl}`);
      return null;
    }

    const filename = originalFilename || generateFilename(messageKey.id, mimetype, messageType);

    // Generate storage path with date organization
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const storagePath = `messages/${year}/${month}/${messageKey.id}/${filename}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('whatsapp-media')
      .upload(storagePath, mediaBuffer, {
        contentType: mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin
      .storage
      .from('whatsapp-media')
      .getPublicUrl(storagePath);

    console.log(`[Media] ✅ Successfully uploaded: ${storagePath} (${formatBytes(mediaBuffer.length)})`);

    // Return media info to be saved with message
    return {
      storage_path: storagePath,
      public_url: urlData.publicUrl,
      filename: filename,
      mimetype: mimetype,
      size_bytes: mediaBuffer.length,
      media_type: messageType
    };
  } catch (error) {
    console.error('[Media] ❌ Upload error:', error.message);

    // Don't throw - just log and return null
    // This prevents the entire message from failing if media fails
    return null;
  }
}

/**
 * Extract media URL from Evolution API message data
 */
function extractMediaUrl(mediaData, messageType) {
  switch (messageType) {
    case 'image':
      return mediaData.url || null;
    case 'video':
      return mediaData.url || null;
    case 'audio':
      return mediaData.url || null;
    case 'document':
      return mediaData.url || null;
    case 'sticker':
      return mediaData.url || null;
    default:
      return null;
  }
}

/**
 * Generate filename from mimetype
 */
function generateFilename(messageId, mimetype, messageType) {
  const ext = getExtensionFromMimetype(mimetype);
  const timestamp = Date.now();
  return `${messageType}_${timestamp}${ext}`;
}

/**
 * Format bytes to human readable size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get file extension from MIME type
 * Comprehensive support for all common document types
 */
function getExtensionFromMimetype(mimetype) {
  const mimeMap = {
    // Images
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/svg+xml': '.svg',

    // Videos
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/x-msvideo': '.avi',
    'video/x-matroska': '.mkv',
    'video/webm': '.webm',

    // Audio
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'audio/mp4': '.m4a',
    'audio/webm': '.weba',
    'audio/opus': '.opus',

    // Documents - PDF
    'application/pdf': '.pdf',

    // Documents - Microsoft Word
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',

    // Documents - Microsoft Excel
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',

    // Documents - Microsoft PowerPoint
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',

    // Documents - Text
    'text/plain': '.txt',
    'text/csv': '.csv',
    'text/html': '.html',
    'application/rtf': '.rtf',

    // Archives
    'application/zip': '.zip',
    'application/x-rar-compressed': '.rar',
    'application/x-7z-compressed': '.7z',
    'application/x-tar': '.tar',
    'application/gzip': '.gz',

    // Other
    'application/json': '.json',
    'application/xml': '.xml'
  };

  return mimeMap[mimetype] || '.bin';
}

/**
 * Get signed URL for media file (for client access)
 */
async function getMediaSignedUrl(storagePath, expiresIn = 3600) {
  try {
    const { data, error } = await supabaseAdmin
      .storage
      .from('whatsapp-media')
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      throw error;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('[Media] Signed URL error:', error);
    throw error;
  }
}

/**
 * Create thumbnail for images (optional - for future implementation)
 */
async function createThumbnail(mediaBuffer, mimetype) {
  // TODO: Implement image thumbnail generation using sharp
  // For now, return null
  return null;
}

module.exports = {
  downloadAndUploadMedia,
  getMediaSignedUrl,
  getExtensionFromMimetype,
  formatBytes
};
