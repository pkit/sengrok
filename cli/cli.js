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
    this.refresher = null;
    this.ws = null;
    this.options = {};
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
    const action = async (url, hook, local) => {
      console.log(`Forwarding: ${hook} -> ${local}`);
      this.options = { url, hook, local };
      this.createWs();
    };
    this.program
      .command("forward")
      .description("forward events from hook to a local service")
      .argument("<url>", "websocket url of a sengrok service")
      .argument("<hook>", "hook route to forward from, ex. /github")
      .argument("[local]", "forward to local url, ex. http://localhost:3000/github")
      .action(this.getAction(action));
  }

  createWs() {
    if (this.refresher) {
      clearInterval(this.refresher);
      this.refresher = null;
    }
    this.ws = new WebSocket(this.options.url);
    const errExit = (e) => {
      console.error(e);
      process.exit(1);
    };
    // exit on any error while connection is not OPEN
    this.ws.on("error", errExit);
    this.ws.on("message", async (data) => {
      const msg = JSON.parse(data.toString());
      if (msg?.hook === this.options.hook) {
        switch (msg?.type || "") {
          case "event":
            if (!this.options.local) {
              console.log({ type: "event", headers: msg.headers, body: msg.body });
            } else {
              const suffix = (msg.path || "").substring(msg.hook.length);
              const qs = msg.queryString ? `?${msg.queryString}` : "";
              const localUrl = this.options.local.replace(/\/$/, "") + suffix + qs;
              fetch(localUrl, {
                method: "POST",
                headers: msg.headers,
                body: msg.body,
              }).then(res => {
                console.log("sent", localUrl, res.statusText);
              }).catch(err => {
                console.error("failed to forward to", localUrl, err.message);
              });
            }
            break;
          case "system":
          default:
            console.log("message", msg);
        }
      }
    });
    this.ws.on("open", () => {
      this.ws.send(JSON.stringify({
        action: "subscribe",
        webhook: this.options.hook,
      }));
      // enable reconnect on any error
      this.ws.on("error", (e) => {
        console.log(e);
        console.log("Reconnecting...");
        setTimeout(() => this.createWs(), 0);
      });
      // disable exit on error
      this.ws.off("error", errExit);
      this.startRefresh();
    });
  }

  startRefresh() {
    this.refresher = setInterval(() => {
      try {
        this.ws.send(JSON.stringify({
          action: "refresh",
        }));
      } catch (e) {
        // no-op, should be handled in `ws.on("error", ...)`
      }
    }, 1000 * 60 * 5); // 5 min intervals (API GW timeout / 2)
  }
}
