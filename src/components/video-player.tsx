import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { openFile } from "@/lib/api";
import { isLikelyPlayable } from "@/lib/media";

export function VideoPlayer({ path }: { path: string }) {
  const [failed, setFailed] = useState(false);
  const attemptPlayback = isLikelyPlayable(path);

  if (!attemptPlayback || failed) {
    return (
      <div className="bg-muted flex flex-col items-center justify-center gap-3 rounded-lg p-12">
        <p className="text-muted-foreground text-sm">
          {attemptPlayback ? "Playback failed in-app." : "This format isn't supported in-app."}
        </p>
        <Button onClick={() => void openFile(path)}>Open externally</Button>
      </div>
    );
  }

  return <video src={convertFileSrc(path)} controls className="w-full rounded-lg bg-black" onError={() => setFailed(true)} />;
}
