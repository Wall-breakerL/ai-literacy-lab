import fs from "fs/promises";
import path from "path";
import { getRuntimeDir } from "./paths";

/**
 * File-based JSON persistence for research prototype. Replace with DB in production.
 */
export async function ensureRuntimeDir(subdir?: string): Promise<string> {
  const base = getRuntimeDir();
  const dir = subdir ? path.join(base, subdir) : base;
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function readJsonFile<T>(relativePath: string): Promise<T | null> {
  const full = path.join(getRuntimeDir(), relativePath);
  try {
    const raw = await fs.readFile(full, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJsonFile(relativePath: string, data: unknown): Promise<void> {
  const full = path.join(getRuntimeDir(), relativePath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(data, null, 2), "utf-8");
}
