// Thin wrappers around src-tauri/src/commands.rs. One function per command —
// keeps invoke()'s stringly-typed name and its argument-name camelCasing
// (Tauri auto-converts JS camelCase args to Rust's snake_case params) in
// exactly one place per command.

import { invoke } from "@tauri-apps/api/core";
import type { ConvertFormat, Job, Preset, Probe } from "./types";

export function probeUrl(url: string): Promise<Probe> {
  return invoke("probe_url", { url });
}

export function createDownload(url: string, downloadDir: string): Promise<string> {
  return invoke("create_download", { url, downloadDir });
}

export function createConvert(sourcePath: string, format: ConvertFormat): Promise<string> {
  return invoke("create_convert", { sourcePath, format });
}

export function retryJob(jobId: string, downloadDir: string): Promise<void> {
  return invoke("retry_job", { jobId, downloadDir });
}

export function cancelJob(jobId: string): Promise<void> {
  return invoke("cancel_job", { jobId });
}

export function listJobs(): Promise<Job[]> {
  return invoke("list_jobs");
}

export function getJob(jobId: string): Promise<Job | null> {
  return invoke("get_job", { jobId });
}

export function deleteJob(jobId: string): Promise<void> {
  return invoke("delete_job", { jobId });
}

export function listPresets(): Promise<Preset[]> {
  return invoke("list_presets");
}

export function savePreset(preset: Preset): Promise<void> {
  return invoke("save_preset", { preset });
}

export function deletePreset(name: string): Promise<void> {
  return invoke("delete_preset", { name });
}

export function getSetting(key: string): Promise<string | null> {
  return invoke("get_setting", { key });
}

export function setSetting(key: string, value: string): Promise<void> {
  return invoke("set_setting", { key, value });
}

export function updateYtdlp(): Promise<string> {
  return invoke("update_ytdlp");
}

export function openFile(path: string): Promise<void> {
  return invoke("open_file", { path });
}

export function revealFile(path: string): Promise<void> {
  return invoke("reveal_file", { path });
}

export function openBinDir(): Promise<void> {
  return invoke("open_bin_dir");
}
