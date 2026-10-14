import { ISqliteDriver } from '../contracts';
import { WasmSqliteDriver } from './WasmSqliteDriver';
import { TauriSqliteDriver } from './TauriSqliteDriver';

/**
 * Explicit runtime detection for Tauri v2 desktop environment.
 * Checks for both standard window.__TAURI__ and internal Tauri bridge objects.
 */
export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
  const protocol = window.location?.protocol;
  const host = window.location?.hostname;
  return Boolean(
    win.__TAURI__ ||
    win.__TAURI_INTERNALS__ ||
    protocol === 'tauri:' ||
    host === 'tauri.localhost'
  );
}

/**
 * Returns the active driver type identifier.
 */
export function getActiveDriverType(): 'tauri' | 'wasm' {
  return isTauriRuntime() ? 'tauri' : 'wasm';
}

/**
 * Factory for creating the appropriate SQLite driver depending on the runtime environment.
 * - Detects Desktop runtime (Tauri): Instantiates TauriSqliteDriver with persistent storage.
 * - Otherwise defaults to local WasmSqliteDriver (official C SQLite compiled to WebAssembly) for browser previews.
 */
export async function createSqliteDriver(): Promise<ISqliteDriver> {
  const isTauri = isTauriRuntime();

  if (isTauri) {
    if (typeof console !== 'undefined' && console.info) {
      console.info('[DriverFactory] Selected Driver: Tauri Native SQLite (Persistent File Storage)');
    }
    const tauriDriver = new TauriSqliteDriver();
    await tauriDriver.init();
    return tauriDriver;
  }

  if (typeof console !== 'undefined' && console.info) {
    console.info('[DriverFactory] Selected Driver: WASM SQLite (In-Memory Browser Storage)');
  }
  const wasmDriver = new WasmSqliteDriver();
  await wasmDriver.init();
  return wasmDriver;
}
