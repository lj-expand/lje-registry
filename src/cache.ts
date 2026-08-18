import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CACHE_DIR = ".cache";

export const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface CacheEntry<T> {
  fetchedAt: string;
  data: T;
}

function cachePath(key: string): string {
  return join(CACHE_DIR, `${key.replace(/[^a-zA-Z0-9._-]/g, "-")}.json`);
}

/**
 * Read a time-based cache entry for `key`
 */
export async function cached<T>(
  key: string,
  fetch: () => Promise<T>,
  ttlMs = CACHE_TTL_MS,
): Promise<T> {
  const path = cachePath(key);
  try {
    const entry = JSON.parse(await readFile(path, "utf8")) as CacheEntry<T>;
    const age = Date.now() - Date.parse(entry.fetchedAt);
    if (age >= 0 && age < ttlMs) {
      return entry.data;
    }
  } catch {
    // miss or unreadable entry — fall through to fetch
  }

  console.error(`[cache] miss: ${key}`);
  const data = await fetch();
  await mkdir(CACHE_DIR, { recursive: true });
  const entry: CacheEntry<T> = { fetchedAt: new Date().toISOString(), data };
  await writeFile(path, JSON.stringify(entry));
  return data;
}
