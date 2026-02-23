import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// ── Typed invoke wrappers ──

export async function startRecording(): Promise<string> {
  return invoke("start_recording");
}

export async function stopRecording(sessionId: string): Promise<void> {
  return invoke("stop_recording", { sessionId });
}

export async function pauseRecording(sessionId: string): Promise<void> {
  return invoke("pause_recording", { sessionId });
}

export async function resumeRecording(sessionId: string): Promise<void> {
  return invoke("resume_recording", { sessionId });
}

export async function getActiveSessionId(): Promise<string | null> {
  return invoke("get_active_session_id");
}

export async function getSessions(): Promise<Session[]> {
  return invoke("get_sessions");
}

export async function getSession(id: string): Promise<SessionDetail> {
  return invoke("get_session", { id });
}

export async function deleteSession(id: string): Promise<void> {
  return invoke("delete_session", { id });
}

export async function exportSession(
  id: string,
): Promise<string> {
  return invoke("export_session", { id });
}

export async function sendAiQuery(
  sessionId: string,
  query: string,
  action?: string,
): Promise<string> {
  return invoke("send_ai_query", { sessionId, query, action });
}

export async function checkPermissions(): Promise<PermissionStatus> {
  return invoke("check_permissions");
}

export async function requestPermission(kind: string): Promise<boolean> {
  return invoke("request_permission", { kind });
}

export async function openSystemSettings(panel: string): Promise<void> {
  return invoke("open_system_settings", { panel });
}

export async function getSettings(): Promise<AppSettings> {
  return invoke("get_settings");
}

export async function updateSettings(
  settings: Partial<AppSettings>,
): Promise<void> {
  return invoke("update_settings", { settings });
}

export async function showOverlay(): Promise<void> {
  return invoke("show_overlay");
}

export async function hideOverlay(): Promise<void> {
  return invoke("hide_overlay");
}

// ── Event listeners ──

export type CaptionEvent = {
  time: string;
  source: string;
  status: "interim" | "final";
  text: string;
};

export type AiResponseEvent = {
  sessionId: string;
  content: string;
};

export type RecordingStateEvent = {
  state: "recording" | "paused" | "stopped";
  sessionId: string;
};

export type ConnectionEvent = {
  status: "connected" | "reconnecting" | "disconnected";
};

export type SessionCompletedEvent = {
  sessionId: string;
  title: string;
  summary: string;
};

export function onCaption(
  handler: (event: CaptionEvent) => void,
): Promise<UnlistenFn> {
  return listen<CaptionEvent>("caption", (e) => handler(e.payload));
}

export function onAiResponse(
  handler: (event: AiResponseEvent) => void,
): Promise<UnlistenFn> {
  return listen<AiResponseEvent>("ai-response", (e) => handler(e.payload));
}

export function onRecordingState(
  handler: (event: RecordingStateEvent) => void,
): Promise<UnlistenFn> {
  return listen<RecordingStateEvent>("recording-state", (e) =>
    handler(e.payload),
  );
}

export function onConnection(
  handler: (event: ConnectionEvent) => void,
): Promise<UnlistenFn> {
  return listen<ConnectionEvent>("connection", (e) => handler(e.payload));
}

export function onSessionCompleted(
  handler: (event: SessionCompletedEvent) => void,
): Promise<UnlistenFn> {
  return listen<SessionCompletedEvent>("session-completed", (e) =>
    handler(e.payload),
  );
}

// ── Types ──

export interface Session {
  id: string;
  title: string;
  duration: string;
  time: string;
  created_at: string;
  is_active: boolean;
}

export interface SessionDetail {
  id: string;
  title: string;
  duration: string;
  time: string;
  created_at: string;
  is_active: boolean;
  captions: CaptionEvent[];
  ai_logs: AiLogEntry[];
  summary: string;
  participants: number;
  ai_assists: number;
  stt_processing_time: string;
  ai_inference_count: number;
  audio_data_size: string;
  token_usage: number;
}

export interface AiLogEntry {
  time: string;
  type: "recap" | "next-speak" | "followup" | "questions" | "freeform";
  text: string;
}

export interface PermissionStatus {
  microphone: "granted" | "denied" | "unknown";
  screen_audio: "granted" | "denied" | "unknown";
  overlay: "granted" | "denied" | "unknown";
}

export interface AppSettings {
  auto_start: boolean;
  start_on_login: boolean;
  notifications: boolean;
  locale: string;
  stt_language: string;
  llm_language: string;
  mic_input: string;
  system_audio: string;
  noise_suppression: boolean;
  stt_model: string;
  interim_results: boolean;
  endpointing: number;
  auto_delete: string;
  self_speaker_tag: string;
  self_speaker_tags: string[];
}
