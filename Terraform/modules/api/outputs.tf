output "api_endpoint" {
  description = "Invoke URL of the HTTP API Gateway."
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "lambda_function_name" {
  description = "Name of the API Lambda function."
  value       = aws_lambda_function.api.function_name
}

output "custom_domain_target" {
  description = "Target domain name for the API's custom domain - point domain_name's DNS record (CNAME/ALIAS) at this."
  value       = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
}
