output "api_endpoint" {
  description = "Invoke URL of the HTTP API Gateway."
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "lambda_function_name" {
  description = "Name of the backend Lambda function."
  value       = aws_lambda_function.backend.function_name
}
