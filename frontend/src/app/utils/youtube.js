// Extracts the 11-character video ID from any common YouTube URL shape
// (watch?v=, youtu.be/, /embed/, /shorts/). Returns null for anything else
// (including a direct-hosted audio file URL), which callers use to decide
// whether to render a YouTube iframe player or a plain <audio> element.
export function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}
