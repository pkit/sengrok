output "websocket_url" {
  description = "WebSocket URL for sengrok client connections"
  value       = "${aws_apigatewayv2_api.websocket.api_endpoint}/${var.stage}"
}

output "http_api_url" {
  description = "HTTP API URL for webhook events (POST)"
  value       = aws_apigatewayv2_stage.http.invoke_url
}
