import {
  ApiGatewayManagementApiClient,
  DeleteConnectionCommand,
  PostToConnectionCommand
} from "@aws-sdk/client-apigatewaymanagementapi";
import { Handler } from "./handler";

export class WsHandler extends Handler {
  constructor(event) {
    super(event);
    this.connectionId = event.requestContext.connectionId;
    const domain = event.requestContext.domainName;
    const stage = event.requestContext.stage;
    const callbackUrl = `https://${domain}/${stage}`;
    this.client = new ApiGatewayManagementApiClient({ endpoint: callbackUrl });
    this.endpoint = callbackUrl;
  }

  async run(eventHandlers) {
    const routeKey = this.event.requestContext.routeKey;
    let func = async () => {};
    switch (routeKey) {
      case "$connect":
        if (eventHandlers?.connect) {
          func = eventHandlers.connect.bind(this);
        }
        break;
      case "$disconnect":
        if (eventHandlers?.disconnect) {
          func = eventHandlers.disconnect.bind(this);
        }
        break;
      case "$default":
      default:
        if (eventHandlers?.default) {
          func = eventHandlers.default.bind(this);
        } else if (eventHandlers) {
          func = eventHandlers.bind(this);
        }
        break;
    }

    try {
      await func(this.event);
      return {
        statusCode: 200,
      };
    } catch (e) {
      console.log(e);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Unexpected error. Please try again later" }),
      };
    }
  }

  async send(message) {
    const requestParams = {
      ConnectionId: this.connectionId,
      Data: message,
    };
    const command = new PostToConnectionCommand(requestParams);
    await this.client.send(command);
  }

  async disconnect() {
    const requestParams = {
      ConnectionId: this.connectionId,
    };
    const command = new DeleteConnectionCommand(requestParams);
    await this.client.send(command);
  }

  static async notify(conn, message) {
    const client = new ApiGatewayManagementApiClient({ endpoint: conn.endpoint });
    const requestParams = {
      ConnectionId: conn.id,
      Data: message,
    };
    const command = new PostToConnectionCommand(requestParams);
    await client.send(command);
  }
}
