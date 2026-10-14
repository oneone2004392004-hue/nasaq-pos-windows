import { SettingsRepository } from '../../repositories/SettingsRepository';
import { logger } from '../../utils/logger';

export interface ActivationPayload { v: 1; d: string; e: string; n?: string; }
export interface ActivationStatus { deviceId: string; active: boolean; expiryDate: string | null; keyName: string | null; reason?: string; }
export interface ActivationFileState { deviceId: string; key: string; last_seen_at?: string; }

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
const DEVICE_ID_STORAGE_KEY = 'nasaq_device_id_v1';
const ACTIVATION_STORAGE_KEY = 'nasaq_activation_key_v1';
const LAST_SEEN_SETTING = 'activation_last_seen_at';
const PUBLIC_KEY_SPKI_BASE64 = 'MCowBQYDK2VwAyEAtLT9ufgDdftdBR3JiAYKqsmOn/1x/RNAxgO2GE82+q0=';
const KEY_PREFIX = 'NQ2';

interface ActivationAdapters {
  readFile: () => Promise<string | null>;
  writeFile: (state: ActivationFileState) => Promise<void>;
  readLastSeen: () => Promise<string | null>;
  writeLastSeen: (value: string) => Promise<void>;
  verifySignature?: (signature: Uint8Array, message: Uint8Array) => Promise<boolean>;
}
let testAdapters: ActivationAdapters | null = null;
let testInvoke: Invoke | null = null;
export function setActivationAdaptersForTesting(adapters: ActivationAdapters | null): void { testAdapters = adapters; }
export function setActivationInvokeForTesting(invoke: Invoke | null): void { testInvoke = invoke; }

function bytesToBase64Url(bytes: Uint8Array): string { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function base64UrlToBytes(value: string): Uint8Array { const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4); return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)); }
function toCanonicalMessage(payload: ActivationPayload): string { return `nasaq|${payload.v}|${payload.d}|${payload.e}|${payload.n || ''}`; }
function isValidExpiry(expiryDate: string, now = new Date()): boolean { if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) return false; const expiry = Date.parse(`${expiryDate}T23:59:59.999Z`); return Number.isFinite(expiry) && now.getTime() <= expiry; }
function makeDeviceId(): string { const random = new Uint8Array(12); crypto.getRandomValues(random); return `NQ-${bytesToBase64Url(random).toUpperCase().slice(0, 16)}`; }
function getLocalStorage(): Storage | null { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }
function syncLocal(state: ActivationFileState): void { const storage = getLocalStorage(); if (!storage) return; storage.setItem(DEVICE_ID_STORAGE_KEY, state.deviceId); storage.setItem(ACTIVATION_STORAGE_KEY, state.key); }
function isTauriRuntime(): boolean { if (typeof window === 'undefined') return false; const win = window as unknown as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown }; return Boolean(win.__TAURI__ || win.__TAURI_INTERNALS__ || window.location?.protocol === 'tauri:' || window.location?.hostname === 'tauri.localhost'); }
async function getInvoke(): Promise<Invoke | null> { if (testInvoke) return testInvoke; if (!isTauriRuntime()) return null; const api = await import('@tauri-apps/api/core'); return api.invoke as Invoke; }

async function readAppDataState(): Promise<{ state: ActivationFileState | null; corrupt: boolean }> {
  if (testAdapters) {
    try { const raw = await testAdapters.readFile(); if (!raw) return { state: null, corrupt: false }; const parsed = JSON.parse(raw) as ActivationFileState; return typeof parsed.deviceId === 'string' && typeof parsed.key === 'string' ? { state: parsed, corrupt: false } : { state: null, corrupt: true }; }
    catch { return { state: null, corrupt: true }; }
  }
  try {
    const invoke = await getInvoke();
    if (invoke) {
      const raw = await invoke<string | null>('activation_read');
      if (!raw) return { state: null, corrupt: false };
      const parsed = JSON.parse(raw) as ActivationFileState;
      return typeof parsed.deviceId === 'string' && typeof parsed.key === 'string' ? { state: parsed, corrupt: false } : { state: null, corrupt: true };
    }
  } catch { return { state: null, corrupt: true }; }
  return { state: null, corrupt: false };
}
async function writeAppDataState(state: ActivationFileState): Promise<void> {
  if (testAdapters) { await testAdapters.writeFile(state); return; }
  try { const invoke = await getInvoke(); if (invoke) { await invoke('activation_write', { content: JSON.stringify(state) }); return; } }
  catch (error) { logger.warn('تعذر حفظ ملف التفعيل عبر جسر Tauri', error); }
}
async function readLastSeen(fileValue?: string): Promise<string | null> { if (testAdapters) return await testAdapters.readLastSeen() || fileValue || null; try { return await new SettingsRepository().get(LAST_SEEN_SETTING) || fileValue || null; } catch { return fileValue || null; } }
async function writeLastSeen(value: string): Promise<void> { if (testAdapters) { await testAdapters.writeLastSeen(value); return; } try { await new SettingsRepository().set(LAST_SEEN_SETTING, value, 'آخر وقت تحقق من التفعيل'); } catch (error) { logger.warn('تعذر حفظ وقت آخر تحقق من التفعيل', error); } }

export function getDeviceId(): string { const existing = getLocalStorage()?.getItem(DEVICE_ID_STORAGE_KEY)?.trim(); if (existing) return existing; const created = makeDeviceId(); getLocalStorage()?.setItem(DEVICE_ID_STORAGE_KEY, created); return created; }
export function getStoredActivationKey(): string | null { return getLocalStorage()?.getItem(ACTIVATION_STORAGE_KEY) || null; }
export function clearStoredActivation(): void { getLocalStorage()?.removeItem(ACTIVATION_STORAGE_KEY); }
async function importPublicKey(): Promise<CryptoKey> { return crypto.subtle.importKey('spki', base64ToBytes(PUBLIC_KEY_SPKI_BASE64), { name: 'Ed25519' }, false, ['verify']); }
function base64ToBytes(value: string): Uint8Array { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); }
async function verifyEd25519(signature: Uint8Array, message: Uint8Array): Promise<boolean> { try { return await crypto.subtle.verify({ name: 'Ed25519' }, await importPublicKey(), signature, message); } catch { const noble = await import('@noble/ed25519'); return await noble.verifyAsync(signature, message, base64ToBytes(PUBLIC_KEY_SPKI_BASE64).slice(-32)); } }
export function parseActivationKey(key: string): { payload: ActivationPayload; signature: Uint8Array } | null { const parts = key.trim().split('.'); if (parts.length !== 3 || parts[0] !== KEY_PREFIX) return null; try { const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[1]))) as ActivationPayload; if (payload?.v !== 1 || typeof payload.d !== 'string' || typeof payload.e !== 'string') return null; return { payload, signature: base64UrlToBytes(parts[2]) }; } catch { return null; } }
export async function verifyActivationKey(key: string, expectedDeviceId = getDeviceId(), now = new Date()): Promise<ActivationStatus> { const parsed = parseActivationKey(key); if (!parsed) return { deviceId: expectedDeviceId, active: false, expiryDate: null, keyName: null, reason: 'صيغة مفتاح التفعيل غير صحيحة.' }; const { payload, signature } = parsed; if (payload.d !== expectedDeviceId) return { deviceId: expectedDeviceId, active: false, expiryDate: payload.e, keyName: payload.n || null, reason: 'المفتاح صادر لجهاز آخر.' }; if (!isValidExpiry(payload.e, now)) return { deviceId: expectedDeviceId, active: false, expiryDate: payload.e, keyName: payload.n || null, reason: 'انتهت صلاحية مفتاح التفعيل.' }; try { const message = new TextEncoder().encode(toCanonicalMessage(payload)); const valid = testAdapters?.verifySignature ? await testAdapters.verifySignature(signature, message) : await verifyEd25519(signature, message); if (!valid) return { deviceId: expectedDeviceId, active: false, expiryDate: payload.e, keyName: payload.n || null, reason: 'توقيع مفتاح التفعيل غير صالح.' }; return { deviceId: expectedDeviceId, active: true, expiryDate: payload.e, keyName: payload.n || null }; } catch { return { deviceId: expectedDeviceId, active: false, expiryDate: payload.e, keyName: payload.n || null, reason: 'لا يمكن التحقق من المفتاح على هذا الجهاز.' }; } }

export async function getActivationStatus(now = new Date()): Promise<ActivationStatus> {
  const { state: fileState } = await readAppDataState(); const storage = getLocalStorage(); const localDeviceId = storage?.getItem(DEVICE_ID_STORAGE_KEY)?.trim() || ''; const localKey = storage?.getItem(ACTIVATION_STORAGE_KEY)?.trim() || ''; const deviceId = fileState?.deviceId || localDeviceId || makeDeviceId(); const key = fileState?.key || localKey; const existingState = fileState || { deviceId, key }; const lastSeen = await readLastSeen(fileState?.last_seen_at);
  if (lastSeen) { const lastSeenMs = Date.parse(lastSeen); if (Number.isFinite(lastSeenMs) && now.getTime() < lastSeenMs - 24 * 60 * 60 * 1000) { syncLocal({ ...existingState, deviceId, key }); await writeAppDataState({ ...existingState, deviceId, key }); return { deviceId, active: false, expiryDate: null, keyName: null, reason: `ساعة الجهاز أقدم من آخر تحقق محفوظ (${formatExpiryDate(lastSeen.slice(0, 10))}). أدخل مفتاح reset-clock موقّعاً لإعادة الضبط.` }; } }
  const synced: ActivationFileState = { ...existingState, deviceId, key, last_seen_at: now.toISOString() }; syncLocal(synced); await writeAppDataState(synced); await writeLastSeen(synced.last_seen_at!); if (!key) return { deviceId, active: false, expiryDate: null, keyName: null, reason: 'لم يتم إدخال مفتاح تفعيل لهذا الجهاز.' }; return verifyActivationKey(key, deviceId, now);
}

export async function activateWithKey(key: string, now = new Date()): Promise<ActivationStatus> {
  const currentStatus = await getActivationStatus(now); const parsed = parseActivationKey(key); const deviceId = currentStatus.deviceId;
  if (currentStatus.reason?.includes('ساعة الجهاز أقدم')) {
    if (!parsed || parsed.payload.n !== 'reset-clock' || parsed.payload.d !== deviceId) return currentStatus;
    const resetStatus = await verifyActivationKey(key, deviceId, now);
    if (!resetStatus.active) return resetStatus;
    await writeLastSeen(now.toISOString());
    const stored = getStoredActivationKey();
    if (stored) return verifyActivationKey(stored, deviceId, now);
    return { deviceId, active: false, expiryDate: null, keyName: null, reason: 'تم تصحيح الساعة. أدخل مفتاح التفعيل الأساسي.' };
  }
  const status = await verifyActivationKey(key, deviceId, now); if (status.active) { const timestamp = now.toISOString(); const state = { deviceId: status.deviceId, key: key.trim(), last_seen_at: timestamp }; syncLocal(state); await writeAppDataState(state); await writeLastSeen(timestamp); } return status;
}
export function formatExpiryDate(value: string | null): string { if (!value) return '—'; const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }).format(date); }
