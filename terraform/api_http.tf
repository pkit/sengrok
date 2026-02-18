# HTTP API Gateway for webhook listener (POST /{proxy+})

resource "aws_apigatewayv2_api" "http" {
  name          = "${var.service_name}-${var.stage}-http"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "http" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "webhook_listener" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.webhook_listener.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "webhook_listener" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.webhook_listener.id}"
}

resource "aws_lambda_permission" "http_api" {
  statement_id  = "AllowHTTPAPIInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.webhook_listener.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}
