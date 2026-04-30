export function parseJsonObjectFromModel<T>(
  raw: string,
  isExpectedShape?: (value: unknown) => boolean
): T {
  const candidates = getJsonObjectCandidates(raw);
  let firstParsed: unknown;

  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate);
    if (parsed === undefined) continue;
    if (firstParsed === undefined) firstParsed = parsed;
    if (!isExpectedShape || isExpectedShape(parsed)) return parsed as T;
  }

  if (firstParsed !== undefined && isExpectedShape) {
    throw new Error("Parsed JSON object did not match expected response shape");
  }
  if (firstParsed !== undefined) return firstParsed as T;
  throw new Error("No parseable JSON object found in model response");
}

function getJsonObjectCandidates(raw: string): string[] {
  const trimmed = raw.trim();
  const candidates: string[] = [];

  const fenced: string[] = [];
  const fencePattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  let fenceMatch: RegExpExecArray | null;
  while ((fenceMatch = fencePattern.exec(trimmed)) !== null) {
    const value = fenceMatch[1]?.trim();
    if (value) fenced.push(value);
  }
  candidates.push(...fenced);
  candidates.push(...extractBalancedObjects(trimmed));
  candidates.push(trimmed);

  return Array.from(new Set(candidates.map(cleanJsonCandidate).filter(Boolean)));
}

function cleanJsonCandidate(candidate: string): string {
  return candidate
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim()
    .replace(/,\s*([}\]])/g, "$1");
}

function tryParseJson(candidate: string): unknown | undefined {
  try {
    return JSON.parse(candidate);
  } catch {
    return undefined;
  }
}

function extractBalancedObjects(raw: string): string[] {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < raw.length; index++) {
    const char = raw[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }

    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(raw.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return objects;
}
