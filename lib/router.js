import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const dynamoClientConfig= { region: process.env.AWS_REGION };

const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient(dynamoClientConfig));

const CONNECTION_MAX_AGE = Number.parseInt(process.env.CONNECTION_MAX_AGE || "3600", 10);
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;

export async function subscribe(data) {
  console.log("subscribe", data);
  const timestamp = Math.floor(new Date().getTime() / 1000);
  const created_at = data.created_at != null ? data.created_at : timestamp;
  // grace 10 sec for expiration
  const expires_at = data.expires_at != null ? data.expires_at : timestamp + CONNECTION_MAX_AGE + 10;
  const params = {
    TableName: CONNECTIONS_TABLE,
    Item: {
      ...data,
      hook: data.hook,
      created_at,
      expires_at,
    },
  };
  await dynamoDb.send(new PutCommand(params));
  return params.Item;
}

export async function unsubscribe(connectionId) {
  console.log("unsubscribe", connectionId);
  const params = {
    TableName: CONNECTIONS_TABLE,
    Key: { id: connectionId },
  };
  await dynamoDb.send(new DeleteCommand(params));
  return params.Item;
}

export async function refresh(connectionId) {
  const params = {
    TableName: CONNECTIONS_TABLE,
    Key: { id: connectionId },
  };
  const data = (await dynamoDb.send(new GetCommand(params)))?.Item;
  if (data) {
    const timestamp = Math.floor(new Date().getTime() / 1000);
    if ((data.expires_at - timestamp) * 2 < CONNECTION_MAX_AGE) {
      delete data.expires_at;
      return subscribe(data);
    }
  }
  return data;
}

export async function findByHook(path) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) {
    return [];
  }
  const prefixes = {};
  const placeholders = [];
  for (let i = 0; i < parts.length; i++) {
    const key = `:p${i}`;
    prefixes[key] = "/" + parts.slice(0, i + 1).join("/");
    placeholders.push(key);
  }
  let hasNext = true;
  let LastEvaluatedKey;
  const result = [];
  while (hasNext) {
    const params = {
      TableName: CONNECTIONS_TABLE,
      FilterExpression: `hook IN (${placeholders.join(", ")})`,
      ExpressionAttributeValues: prefixes,
      ExclusiveStartKey: LastEvaluatedKey,
    };
    const res = await dynamoDb.send(new ScanCommand(params));
    result.push(...res.Items);
    LastEvaluatedKey = res.LastEvaluatedKey;
    hasNext = !!LastEvaluatedKey;
  }
  result.sort((a, b) => b.hook.length - a.hook.length);
  return result;
}
