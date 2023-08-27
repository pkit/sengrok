import { Handler } from "../lib/handler";
import { findByHook } from "../lib/router";
import { WsHandler } from "../lib/ws";

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
          headers,
          body: event.body,
        };
        return WsHandler.notify(conn, JSON.stringify(message));
      }));
    } else {
      console.error(`Could not find hook for: ${event.rawPath}`);
    }
    return {
      statusCode: 200,
    };
  });
}
