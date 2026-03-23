import path from "path";

export function getProjectRoot(): string {
  return process.cwd();
}

export function getRuntimeDir(): string {
  return path.join(getProjectRoot(), "data", "runtime");
}

export function runtimeFile(...segments: string[]): string {
  return path.join(getRuntimeDir(), ...segments);
}
