// Settings: general app-data location + defaults, and preset management.
// Presets *are* the yt-dlp configuration (see model.rs's own doc comment) —
// this exposes the fields people actually reach for (format, resolution,
// container, embedding, retries) and leaves the rarer ones (rate limit,
// cookies-from-browser, sponsorblock, extra_args, subtitle languages) at
// their serde defaults rather than building a form field for every one of
// YtdlpOptions's fifteen fields on the first pass.

import { useEffect, useState } from "react";
import { FolderOpen, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import { deletePreset, getSetting, listPresets, openBinDir, savePreset, setSetting, updateYtdlp } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import type { ThemePreference } from "@/lib/theme";
import type { FormatMode, Preset, YtdlpOptions } from "@/lib/types";

const DEFAULT_OPTIONS: YtdlpOptions = {
  format: "BestVideoAudio",
  max_height: 1080,
  container: "mp4",
  output_template: "%(title)s [%(id)s].%(ext)s",
  download_dir: "",
  subtitle_langs: [],
  embed_subs: false,
  embed_thumbnail: true,
  embed_metadata: true,
  sponsorblock_remove: null,
  rate_limit: null,
  concurrent_fragments: 1,
  cookies_from_browser: null,
  download_archive: false,
  retries: 10,
  extra_args: [],
};

type SimpleFormat = "best" | "audio" | "custom";

function toSimpleFormat(f: FormatMode): SimpleFormat {
  if (f === "BestVideoAudio") return "best";
  if (typeof f === "object" && "AudioOnly" in f) return "audio";
  return "custom";
}

export default function Settings() {
  const { preference, setPreference } = useTheme();
  const [downloadDir, setDownloadDir] = useState("");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [ytdlpStatus, setYtdlpStatus] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [draft, setDraft] = useState<Preset | null>(null);

  useEffect(() => {
    void getSetting("download_dir").then((v) => setDownloadDir(v ?? ""));
    void listPresets().then(setPresets);
  }, []);

  async function pickDownloadDir() {
    const picked = await openFolderDialog({ directory: true, defaultPath: downloadDir || undefined });
    if (typeof picked === "string") {
      setDownloadDir(picked);
      await setSetting("download_dir", picked);
    }
  }

  async function refreshPresets() {
    setPresets(await listPresets());
  }

  async function onSetDefault(p: Preset) {
    await savePreset({ ...p, is_default: true });
    await refreshPresets();
  }

  async function onDeletePreset(name: string) {
    await deletePreset(name);
    await refreshPresets();
  }

  function startNewPreset() {
    setDraft({ name: "", is_default: presets.length === 0, options: { ...DEFAULT_OPTIONS, download_dir: downloadDir } });
  }

  async function saveDraft() {
    if (!draft || !draft.name.trim()) return;
    await savePreset(draft);
    setDraft(null);
    await refreshPresets();
  }

  async function onUpdateYtdlp() {
    setUpdating(true);
    try {
      setYtdlpStatus(await updateYtdlp());
    } catch (err) {
      setYtdlpStatus(String(err));
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto p-6">
      <h1 className="mb-6 text-lg font-semibold">Settings</h1>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="presets">Presets</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="flex flex-col gap-6">
          <div className="space-y-1.5">
            <Label>Theme</Label>
            <Select value={preference} onValueChange={(v: ThemePreference) => setPreference(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>Default download folder</Label>
            <div className="flex gap-2">
              <Input value={downloadDir} onChange={(e) => setDownloadDir(e.target.value)} onBlur={() => void setSetting("download_dir", downloadDir)} />
              <Button type="button" variant="outline" onClick={() => void pickDownloadDir()}>
                Browse
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>yt-dlp</Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => void onUpdateYtdlp()} disabled={updating}>
                {updating ? "Checking…" : "Check for updates"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void openBinDir()}>
                <FolderOpen className="mr-1 size-4" /> Open binaries folder
              </Button>
            </div>
            {ytdlpStatus && <p className="text-muted-foreground text-xs">{ytdlpStatus}</p>}
          </div>
        </TabsContent>

        <TabsContent value="presets" className="flex flex-col gap-4">
          <ul className="divide-y rounded-lg border">
            {presets.map((p) => (
              <li key={p.name} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                {p.is_default && <Badge variant="secondary">Default</Badge>}
                {!p.is_default && (
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => void onSetDefault(p)} aria-label="Set as default">
                    <Star className="size-4" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="size-7" onClick={() => void onDeletePreset(p.name)} aria-label="Delete preset">
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
            {presets.length === 0 && <li className="text-muted-foreground px-3 py-4 text-sm">No presets yet.</li>}
          </ul>

          {draft ? (
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
              </div>

              <div className="space-y-1.5">
                <Label>Format</Label>
                <Select
                  value={toSimpleFormat(draft.options.format)}
                  onValueChange={(v: SimpleFormat) =>
                    setDraft({
                      ...draft,
                      options: {
                        ...draft.options,
                        format: v === "best" ? "BestVideoAudio" : v === "audio" ? { AudioOnly: { codec: "mp3" } } : { Custom: "bv*+ba/b" },
                      },
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="best">Best video + audio</SelectItem>
                    <SelectItem value="audio">Audio only</SelectItem>
                    <SelectItem value="custom">Custom selector</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {toSimpleFormat(draft.options.format) === "best" && (
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Label>Max height</Label>
                    <Input
                      type="number"
                      value={draft.options.max_height ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, options: { ...draft.options, max_height: e.target.value ? Number(e.target.value) : null } })
                      }
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label>Container</Label>
                    <Input
                      value={draft.options.container ?? ""}
                      onChange={(e) => setDraft({ ...draft, options: { ...draft.options, container: e.target.value || null } })}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="embed-thumb">Embed thumbnail</Label>
                <Switch
                  id="embed-thumb"
                  checked={draft.options.embed_thumbnail}
                  onCheckedChange={(v) => setDraft({ ...draft, options: { ...draft.options, embed_thumbnail: v } })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="embed-meta">Embed metadata</Label>
                <Switch
                  id="embed-meta"
                  checked={draft.options.embed_metadata}
                  onCheckedChange={(v) => setDraft({ ...draft, options: { ...draft.options, embed_metadata: v } })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button onClick={() => void saveDraft()} disabled={!draft.name.trim()}>
                  Save preset
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={startNewPreset} className="self-start">
              New preset
            </Button>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
