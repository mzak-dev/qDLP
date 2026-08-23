// The app's suggested download location whenever nothing's been chosen yet
// (a fresh New Download dialog, or an empty Settings field) — <Videos>/qDLP,
// not the OS Downloads folder. yt-dlp creates missing destination
// directories itself, so no backend change is needed for this to work the
// first time it's actually used.

import { join, videoDir } from "@tauri-apps/api/path";

export async function defaultDownloadDir(): Promise<string> {
  return join(await videoDir(), "qDLP");
}
