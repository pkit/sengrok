locals {
  source_files = [
    "${path.module}/../handlers/webhookListener.js",
    "${path.module}/../handlers/clientWebsocket.js",
    "${path.module}/../lib/handler.js",
    "${path.module}/../lib/ws.js",
    "${path.module}/../lib/router.js",
  ]
  source_hash = base64sha256(join("", [for f in local.source_files : file(f)]))
}

resource "terraform_data" "lambda_build" {
  triggers_replace = local.source_hash

  provisioner "local-exec" {
    command     = "bash build.sh"
    working_dir = path.module
  }
}

# --- Webhook Listener Lambda ---

resource "aws_lambda_function" "webhook_listener" {
  depends_on = [terraform_data.lambda_build]

  function_name    = "${var.service_name}-${var.stage}-webhookListener"
  filename         = "${path.module}/.build/webhookListener.zip"
  source_code_hash = local.source_hash
  handler          = "index.webhookListener"
  runtime          = "nodejs22.x"
  timeout          = 20
  role             = aws_iam_role.webhook_listener.arn

  environment {
    variables = {
      NAME_PREFIX       = "${var.service_name}-${var.stage}-"
      CONNECTIONS_TABLE = aws_dynamodb_table.connections.name
    }
  }
}

resource "aws_lambda_function_event_invoke_config" "webhook_listener" {
  function_name          = aws_lambda_function.webhook_listener.function_name
  maximum_retry_attempts = 0
}

# --- Client WebSocket Lambda ---

resource "aws_lambda_function" "client_websocket" {
  depends_on = [terraform_data.lambda_build]

  function_name    = "${var.service_name}-${var.stage}-clientWebsocket"
  filename         = "${path.module}/.build/clientWebsocket.zip"
  source_code_hash = local.source_hash
  handler          = "index.clientWebsocket"
  runtime          = "nodejs22.x"
  role             = aws_iam_role.client_websocket.arn

  environment {
    variables = {
      NAME_PREFIX       = "${var.service_name}-${var.stage}-"
      CONNECTIONS_TABLE = aws_dynamodb_table.connections.name
    }
  }
}
