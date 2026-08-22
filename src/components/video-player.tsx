// Video.js instead of a hand-rolled <video> — buffering states, seeking,
// fullscreen, and volume all get real edge-case handling instead of what a
// few Tailwind classes over the raw element could cover.
//
// Video.js takes DOM ownership of the element it's given, so this follows
// the library's own recommended React pattern: create the player once on
// mount into an *inner* div React never touches again, then on a source
// change call player.src(...) instead of unmounting/remounting.
//
// The container div is *never* conditionally unmounted, even on failure —
// it used to be (early-returning a different JSX branch when `failed` was
// true), which meant React tore down the DOM subtree Video.js had taken
// over out from under it the moment a video failed to load. The fallback
// message is an overlay instead, so the same DOM node lives for the whole
// component lifetime and only React (never Video.js) owns whether it exists.

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

    const player = videojs(videoEl, {
      controls: true,
      fill: true,
      preload: "metadata",
      // Default is 2000ms, after which the control bar fades out until the
      // next mouse move — wrong instinct for a paused library video the
      // user just opened; keep it visible until they actually play it.
      inactivityTimeout: 0,
      // NOT `children: { errorDisplay: false }` — per video.js's own docs,
      // passing `children` at all replaces the *entire* default children
      // list with only what's named, not just the one key. That silently
      // deleted the control bar and big-play-button along with the error
      // display. The CSS rule in index.css (.vjs-error-display) is the only
      // suppression needed; our own fallback UI already covers the error case.
    });
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

  const showFallback = !attemptPlayback || failed;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <div data-vjs-player className="absolute inset-0" style={{ visibility: showFallback ? "hidden" : "visible" }}>
        <div ref={containerRef} className="absolute inset-0" />
      </div>
      {showFallback && (
        <div className="bg-muted absolute inset-0 flex flex-col items-center justify-center gap-3">
          <p className="text-muted-foreground text-sm">
            {attemptPlayback ? "Playback failed in-app." : "This format isn't supported in-app."}
          </p>
          <Button onClick={() => void openFile(path)}>Open externally</Button>
        </div>
      )}
    </div>
  );
}
