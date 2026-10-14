type LogLevel = 'info' | 'warn' | 'error';

function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const runtime = window as unknown as { __TAURI_INTERNALS__?: unknown };
  return Boolean(runtime.__TAURI_INTERNALS__);
}

function formatDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  try {
    const serialized = JSON.stringify(detail);
    return serialized ?? String(detail);
  } catch (error: unknown) {
    console.warn('[NasaqPOS] Could not serialize log detail', error);
    return String(detail);
  }
}

function writeFileLog(level: LogLevel, message: string, details: unknown[]): void {
  if (!isTauriRuntime()) return;
  const detailText = details.length ? ` ${details.map(formatDetail).join(' ')}` : '';
  const payload = `[NasaqPOS] ${message}${detailText}`;
  void import('@tauri-apps/plugin-log')
    .then((plugin) => plugin[level](payload))
    .catch((error: unknown) => {
      console.warn('[NasaqPOS] File logger unavailable', error);
    });
}

export const logger = {
  info(message: string, ...details: unknown[]): void {
    console.info(`[NasaqPOS] ${message}`, ...details);
    writeFileLog('info', message, details);
  },
  warn(message: string, ...details: unknown[]): void {
    console.warn(`[NasaqPOS] ${message}`, ...details);
    writeFileLog('warn', message, details);
  },
  error(message: string, ...details: unknown[]): void {
    console.error(`[NasaqPOS] ${message}`, ...details);
    writeFileLog('error', message, details);
  },
};
