// Video.js instead of a hand-rolled <video> — buffering states, seeking,
// fullscreen, and volume all get real edge-case handling instead of what a
// few Tailwind classes over the raw element could cover.
//
// Video.js takes DOM ownership of the element it's given, so this follows
// the library's own recommended React pattern: create the player once on
// mount into an *inner* div React never touches again, then on a source
// change call player.src(...) instead of unmounting/remounting — doing the
// latter fights Video.js for control of the DOM node.

import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import "video.js/dist/video-js.css";
import { Button } from "@/components/ui/button";
import { openFile } from "@/lib/api";
import { isLikelyPlayable } from "@/lib/media";
import { isTauri } from "@/lib/tauri-env";

function assetSrc(path: string): string {
  // convertFileSrc reads window.__TAURI_INTERNALS__ unguarded and throws
  // synchronously outside the real shell (no error boundary above this).
  return isTauri() ? convertFileSrc(path) : path;
}

export function VideoPlayer({ path }: { path: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [failed, setFailed] = useState(false);

  const attemptPlayback = isLikelyPlayable(path);

  // Mount/dispose once.
  useEffect(() => {
    if (!containerRef.current) return;
    const videoEl = document.createElement("video-js");
    videoEl.classList.add("vjs-big-play-centered");
    containerRef.current.appendChild(videoEl);

    // fill (not fluid): fluid sizes purely off the source's own aspect
    // ratio, so a portrait/Shorts-style video grows to whatever height
    // matches full container width — here that meant a video taller than
    // the viewport with its own control bar scrolled out of view. fill
    // makes the player match its parent box exactly (the aspect-video div
    // below), and video.js letterboxes anything that isn't 16:9 inside it.
    const player = videojs(videoEl, { controls: true, fill: true, preload: "metadata" });
    player.on("error", () => setFailed(true));
    playerRef.current = player;

    return () => {
      player.dispose();
      playerRef.current = null;
    };
  }, []);

  // Source changes: update the existing player instead of recreating it.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !attemptPlayback) return;
    setFailed(false);
    player.src({ src: assetSrc(path) });
  }, [path, attemptPlayback]);

  if (!attemptPlayback || failed) {
    return (
      <div className="bg-muted flex flex-col items-center justify-center gap-3 rounded-lg p-16">
        <p className="text-muted-foreground text-sm">
          {attemptPlayback ? "Playback failed in-app." : "This format isn't supported in-app."}
        </p>
        <Button onClick={() => void openFile(path)}>Open externally</Button>
      </div>
    );
  }

  return (
    <div data-vjs-player className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
