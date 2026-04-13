-- Allow M4A (AAC in MP4): typical browser MIME is audio/mp4; some clients send audio/x-m4a.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a'
]
WHERE id = 'songs';
