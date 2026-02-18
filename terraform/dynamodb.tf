resource "aws_dynamodb_table" "connections" {
  name         = "${var.service_name}-connections-${var.stage}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "hook"
    type = "S"
  }

  global_secondary_index {
    name            = "HookIndex"
    hash_key        = "hook"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }
}
