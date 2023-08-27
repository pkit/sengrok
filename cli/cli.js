import * as commander from "commander";
import WebSocket from "ws";
import fetch from "node-fetch";

export class Cli {
  constructor(config) {
    this.config = config;
    if (config) {
      this.program = config.program;
    } else {
      this.program = new commander.Command();
      this.program.name("cli");
    }
  }

  run() {
    this.program.parseAsync(process.argv).catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
  }

  setup() {
    this._setupForward();
  }

  getAction(method) {
    const func = method.bind(this);
    const action = async (...args) => {
      await func(...args);
    };
    return action;
  }

  _setupForward() {
    const action = async (url, hook, port, options) => {
      const host = options.host || "http://localhost";
      console.log(`Forwarding: ${hook} -> ${host}:${port}`);
      const ws = new WebSocket(url);
      ws.on("error", (e) => {
        console.error(e);
        process.exit(1);
      });
      ws.on("message", async (data) => {
        const msg = JSON.parse(data.toString());
        if (msg?.hook === hook) {
          switch (msg?.type || "") {
            case "event":
              fetch(`${host}:${port}`, {
                method: "POST",
                headers: msg.headers,
                body: msg.body,
              }).then(res => {
                console.log("sent", res.statusText);
              });
              break;
            case "system":
            default:
              console.log("message", msg);
          }
        }
      });
      ws.on("open", () => {
        ws.send(JSON.stringify({
          action: "subscribe",
          webhook: hook,
        }));
      });
    };
    this.program
      .command("forward")
      .description("forward events from hook to a local service")
      .argument("<url>", "websocket url of a sengrok service")
      .argument("<hook>", "hook route to forward from, ex. /github")
      .argument("<port>", "forward to this port locally, ex. 3000")
      .option("--host <host>", "use a different hostname, instead of `localhost`")
      .action(this.getAction(action));
  }
}
