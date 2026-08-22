// Custom-controlled <video> — browser-native `controls` looks jarring next
// to a hand-styled dark UI (OS chrome dropped into an otherwise consistent
// theme), so this drives play/scrub/volume off the HTMLVideoElement API
// directly instead.

import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { openFile } from "@/lib/api";
import { isLikelyPlayable } from "@/lib/media";
import { isTauri } from "@/lib/tauri-env";

// convertFileSrc reads window.__TAURI_INTERNALS__ unguarded and throws
// synchronously outside the real shell — fatal with no error boundary above
// this component, so browser-preview mode needs its own path.
function assetSrc(path: string): string {
  return isTauri() ? convertFileSrc(path) : path;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoPlayer({ path }: { path: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  // path changes -> new source, reset transport state.
  useEffect(() => {
    setFailed(false);
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [path]);

  const attemptPlayback = isLikelyPlayable(path);

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
    <div className="flex flex-col gap-2">
      <video
        ref={videoRef}
        src={assetSrc(path)}
        className="w-full rounded-lg bg-black"
        onError={() => setFailed(true)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={() => (videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause())}
      />
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0"
          onClick={() => (videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause())}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <span className="text-muted-foreground w-24 shrink-0 text-xs tabular-nums">
          {formatTime(current)} / {formatTime(duration)}
        </span>
        <Slider
          value={[current]}
          max={duration || 1}
          step={0.1}
          className="flex-1"
          onValueChange={([v]) => {
            if (videoRef.current) videoRef.current.currentTime = v;
            setCurrent(v);
          }}
        />
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0"
          onClick={() => {
            const next = !muted;
            setMuted(next);
            if (videoRef.current) videoRef.current.muted = next;
          }}
        >
          {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </Button>
        <Slider
          value={[muted ? 0 : volume]}
          max={1}
          step={0.01}
          className="w-20 shrink-0"
          onValueChange={([v]) => {
            setVolume(v);
            setMuted(v === 0);
            if (videoRef.current) videoRef.current.volume = v;
          }}
        />
      </div>
    </div>
  );
}
