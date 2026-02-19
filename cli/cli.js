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
    this.pending = {};
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

  handleEvent(msg) {
    const body = msg.isBase64Encoded ? Buffer.from(msg.body, "base64") : msg.body;
    if (!this.options.local) {
      console.log({ type: "event", headers: msg.headers, body: body.toString() });
    } else {
      const suffix = (msg.path || "").substring(msg.hook.length);
      const qs = msg.queryString ? `?${msg.queryString}` : "";
      const localUrl = this.options.local.replace(/\/$/, "") + suffix + qs;
      fetch(localUrl, {
        method: "POST",
        headers: msg.headers,
        body,
      }).then(res => {
        console.log("sent", localUrl, res.statusText);
      }).catch(err => {
        console.error("failed to forward to", localUrl, err.message);
      });
    }
  }

  createWs() {
    if (this.refresher) {
      clearInterval(this.refresher);
      this.refresher = null;
    }
    this.pending = {};
    this.ws = new WebSocket(this.options.url);
    const errExit = (e) => {
      console.error(e);
      process.exit(1);
    };
    // exit on any error while connection is not OPEN
    this.ws.on("error", errExit);
    this.ws.on("message", async (data) => {
      const msg = JSON.parse(data.toString());
      switch (msg?.type || "") {
        case "event":
          if (msg?.hook === this.options.hook) {
            this.handleEvent(msg);
          }
          break;
        case "event-start":
          if (msg?.hook === this.options.hook) {
            this.pending[msg.id] = { ...msg, body: "" };
          }
          break;
        case "event-chunk":
          if (this.pending[msg.id]) {
            this.pending[msg.id].body += msg.data;
          }
          break;
        case "event-end":
          if (this.pending[msg.id]) {
            const complete = this.pending[msg.id];
            delete this.pending[msg.id];
            this.handleEvent(complete);
          }
          break;
        case "system":
        default:
          if (msg?.hook === this.options.hook) {
            console.log("message", msg);
          }
          break;
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
