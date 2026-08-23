// i.ytimg.com serves a video's thumbnail directly from its id, no API key
// needed — a more reliable grid thumbnail than the locally downloaded file:
// YtdlpOptions.embed_thumbnail defaults to true (new-convert/download
// dialogs), which has yt-dlp embed the thumbnail into the video file and
// delete the standalone image, so Item.thumb_path often points at a file
// that no longer exists by the time the job is "done".
const YOUTUBE_ID_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/;

export function youtubeThumbUrl(url: string): string | null {
  const match = YOUTUBE_ID_RE.exec(url);
  return match ? `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg` : null;
}
