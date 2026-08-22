// Dev-only fixture data — see tauri-env.ts. Mirrors the reference rustyDLP
// screenshot's sidebar rows so the layout can be compared directly against
// it in a plain browser tab, without launching the native app each time.

import type { Job } from "./types";

export const MOCK_JOBS: Job[] = [
  {
    id: "mock-1",
    kind: "download",
    url: "https://www.youtube.com/playlist?list=mock",
    title: "Gold Rush Titles / Intro - Season 1",
    preset: "Best available",
    state: "done",
    error: null,
    created_at: Date.now() / 1000 - 3000,
    items: Array.from({ length: 7 }, (_, i) => ({
      id: `mock-1-item-${i}`,
      index: i,
      title: `Gold Rush Titles ${i + 1}`,
      duration: 180,
      thumb_path: null,
      webpage_url: "https://www.youtube.com/watch?v=mock",
      files: i === 0 ? [{ id: "mock-1-file-0", path: "C:\\Downloads\\Gold Rush Titles 1.mp4", kind: "video", format_id: null, bytes: 6_400_000 }] : [],
    })),
  },
  {
    id: "mock-2",
    kind: "download",
    url: "https://www.youtube.com/watch?v=gFx-NjT",
    title: "I asked Fable 5 to make me a lyric video",
    preset: "Best available",
    state: "done",
    error: null,
    created_at: Date.now() / 1000 - 2000,
    items: [
      {
        id: "mock-2-item-0",
        index: 0,
        title: "I asked Fable 5 to make me a lyric video",
        duration: 197,
        thumb_path: null,
        webpage_url: "https://www.youtube.com/watch?v=gFx-NjT",
        files: [
          {
            id: "mock-2-file-0",
            path: "C:\\Downloads\\I asked Fable 5 to make me a lyric video.mp4",
            kind: "video",
            format_id: null,
            bytes: 6_400_000,
          },
          {
            id: "mock-2-file-1",
            path: "C:\\Downloads\\I asked Fable 5 to make me a lyric video.webp",
            kind: "thumbnail",
            format_id: null,
            bytes: 45_000,
          },
        ],
      },
    ],
  },
  {
    id: "mock-3",
    kind: "download",
    url: "https://www.youtube.com/watch?v=mock3",
    title: "The Strongest Alcohol From Poland",
    preset: "Best available",
    state: "running",
    error: null,
    created_at: Date.now() / 1000 - 10,
    items: [],
  },
];
