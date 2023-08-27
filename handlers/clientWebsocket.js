import { WsHandler } from "../lib/ws";
import { refresh, subscribe, unsubscribe } from "../lib/router";

export async function clientWebsocket(event) {
  return new WsHandler(event).run({
    default: async function (event)  {
      const req = event.req;
      const action = req.action;
      let res;
      if (action === "subscribe") {
        res = await subscribe({
          id: this.connectionId,
          endpoint: this.endpoint,
          hook: req.webhook,
        });
      } else if (action === "refresh") {
        res = await refresh(this.connectionId);
      }else if (action === "unsubscribe") {
        res = await unsubscribe(this.connectionId);
      } else {
        res = { error: `Unknown command: ${action}` };
      }
      // do not leak connection data
      delete res.id;
      delete res.endpoint;
      res.type = "system";
      await this.send(JSON.stringify(res));
    },
    disconnect: async function ()  {
      await unsubscribe(this.connectionId);
    },
  });
}
