/**
 * Media Service
 * Handles media download from WAHA and upload to Supabase Storage
 */

const axios = require('axios');
const { supabaseAdmin } = require('../config/database');
const wahaClient = require('../config/waha');
const path = require('path');

/**
 * Download media from WAHA and upload to Supabase Storage
 */
async function downloadAndUploadMedia(messageId, mediaUrl, messageData) {
  try {
    console.log(`[Media] Processing media for message: ${messageId}`);

    // Download media from WAHA
    const mediaResponse = await wahaClient.get(mediaUrl, {
      responseType: 'arraybuffer'
    });

    const mediaBuffer = Buffer.from(mediaResponse.data);
    const mimetype = messageData.mimetype || 'application/octet-stream';
    const filename = messageData.filename || generateFilename(messageId, mimetype);

    // Generate storage path
    const storagePath = `messages/${messageId}/${filename}`;

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

    // Get public URL (even though bucket is private, we need the path)
    const { data: urlData } = supabaseAdmin
      .storage
      .from('whatsapp-media')
      .getPublicUrl(storagePath);

    // Update message with media info
    await supabaseAdmin
      .from('messages')
      .update({
        media_url: urlData.publicUrl,
        media_mimetype: mimetype,
        media_size: mediaBuffer.length,
        media_filename: filename
      })
      .eq('id', messageId);

    // Create media_files record
    await supabaseAdmin
      .from('media_files')
      .insert({
        message_id: messageId,
        storage_bucket: 'whatsapp-media',
        storage_path: storagePath,
        filename,
        mimetype,
        size_bytes: mediaBuffer.length,
        uploaded: true
      });

    console.log(`[Media] Successfully uploaded: ${storagePath}`);
  } catch (error) {
    console.error('[Media] Upload error:', error);

    // Log failed upload
    await supabaseAdmin
      .from('media_files')
      .insert({
        message_id: messageId,
        storage_bucket: 'whatsapp-media',
        storage_path: `failed/${messageId}`,
        filename: 'unknown',
        mimetype: 'application/octet-stream',
        size_bytes: 0,
        uploaded: false,
        upload_error: error.message
      });

    throw error;
  }
}

/**
 * Generate filename from mimetype
 */
function generateFilename(messageId, mimetype) {
  const ext = getExtensionFromMimetype(mimetype);
  return `${messageId}${ext}`;
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimetype(mimetype) {
  const mimeMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
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

module.exports = {
  downloadAndUploadMedia,
  getMediaSignedUrl
};
