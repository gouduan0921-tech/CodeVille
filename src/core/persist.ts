const PREFIX = 'codeville:v1:';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = (globalThis as any).localStorage?.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): boolean {
  try {
    (globalThis as any).localStorage?.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearAll() {
  try {
    const ls = (globalThis as any).localStorage;
    if (!ls) return;
    Object.keys(ls)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => ls.removeItem(k));
  } catch {
    /* 忽略 */
  }
}
