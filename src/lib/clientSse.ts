type SseHandlers = {
  onEvent: (event: string, data: unknown) => void;
};

export async function readSseResponse(response: Response, handlers: SseHandlers) {
  if (!response.body) throw new Error("响应不支持流式读取");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const rawEvent of events) {
        parseSseEvent(rawEvent, handlers);
      }
    }
    if (buffer.trim()) parseSseEvent(buffer, handlers);
  } finally {
    reader.releaseLock();
  }
}

function parseSseEvent(rawEvent: string, handlers: SseHandlers) {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of rawEvent.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim() || "message";
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (!dataLines.length) return;
  const rawData = dataLines.join("\n");
  let data: unknown = rawData;
  try {
    data = JSON.parse(rawData);
  } catch {
    data = rawData;
  }
  handlers.onEvent(event, data);
}
