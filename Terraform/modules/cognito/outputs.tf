output "user_pool_id" {
  description = "Cognito User Pool id."
  value       = aws_cognito_user_pool.this.id
}

output "authority" {
  description = "OIDC issuer URL for the User Pool - the Api's CognitoSettings:Authority (also the JWKS discovery base)."
  value       = "https://cognito-idp.${data.aws_region.current.region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
}

output "app_client_id" {
  description = "App Client id - the Api's CognitoSettings:AppClientId, and the FrontEnd's client_id for the Hosted UI/token endpoint."
  value       = aws_cognito_user_pool_client.this.id
}

output "hosted_ui_domain" {
  description = "Full Hosted UI domain the FrontEnd builds /oauth2/authorize and /oauth2/token URLs against."
  value       = "${aws_cognito_user_pool_domain.this.domain}.auth.${data.aws_region.current.region}.amazoncognito.com"
}
