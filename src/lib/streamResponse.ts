export type StreamEventPayload = Record<string, unknown>;

export function encodeStreamEvent(type: string, payload: StreamEventPayload): string {
  return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export function createSseStream(
  run: (controller: ReadableStreamDefaultController<Uint8Array>) => Promise<void>
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      try {
        await run(controller);
      } catch (error) {
        controller.enqueue(
          encodeText(
            encodeStreamEvent("error", {
              message: error instanceof Error ? error.message : String(error),
            })
          )
        );
      } finally {
        controller.close();
      }
    },
  });
}

export function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export const SSE_HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
};
