import { Handler } from "../lib/handler";
import { findByHook } from "../lib/router";
import { WsHandler } from "../lib/ws";

// API Gateway WebSocket PostToConnection limit is 128KB
const MAX_MESSAGE_SIZE = 120000;
const MAX_CHUNK_SIZE = 100000;

async function sendEvent(conn, message) {
  const serialized = JSON.stringify(message);
  if (serialized.length <= MAX_MESSAGE_SIZE) {
    return WsHandler.notify(conn, serialized);
  }

  // Chunked transfer for large payloads
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const body = message.body || "";

  // Send header without body
  await WsHandler.notify(conn, JSON.stringify({
    type: "event-start",
    id,
    hook: message.hook,
    path: message.path,
    queryString: message.queryString,
    headers: message.headers,
    isBase64Encoded: message.isBase64Encoded,
  }));

  // Send body in chunks
  for (let i = 0; i < body.length; i += MAX_CHUNK_SIZE) {
    await WsHandler.notify(conn, JSON.stringify({
      type: "event-chunk",
      id,
      data: body.substring(i, i + MAX_CHUNK_SIZE),
    }));
  }

  // Send end marker
  await WsHandler.notify(conn, JSON.stringify({ type: "event-end", id }));
}

export async function webhookListener (event, context) {
  console.log("webhookListener", event);
  return new Handler(event).run(async (event) => {
    const connections = await findByHook(event.rawPath);
    if (connections) {
      // do not send proxy headers
      const headers = Object.fromEntries(
        Object.entries(event.headers).filter(
          ([key, val]) => !key.startsWith("x-amzn-") && !key.startsWith("x-forwarded-") && key !== "host"
        )
      );
      await Promise.all(connections.map(async (conn) => {
        const message = {
          type: "event",
          hook: conn.hook,
          path: event.rawPath,
          queryString: event.rawQueryString || "",
          headers,
          body: event.body,
          isBase64Encoded: !!event.isBase64Encoded,
        };
        return sendEvent(conn, message);
      }));
    } else {
      console.error(`Could not find hook for: ${event.rawPath}`);
    }
    return {
      statusCode: 200,
    };
  });
}
