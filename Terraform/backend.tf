# Remote state, created by Terraform/bootstrap (run that first: it outputs
# state_bucket_name / lock_table_name). Terraform doesn't allow variables in
# a backend block, so these values are hardcoded - update them if the
# bootstrap config's naming or region ever changes.
#
# One shared config for every environment: select/create a Terraform
# workspace per environment (e.g. `terraform workspace new production`) and
# the S3 backend automatically isolates each workspace's state under
# `env:/<workspace>/...` beneath the key below.
terraform {
  backend "s3" {
    bucket         = "pim-terraform-state-<AWS_ACCOUNT_ID>" # replace with bootstrap's state_bucket_name output
    key            = "pim/terraform.tfstate"
    region         = "ap-southeast-2"
    dynamodb_table = "pim-terraform-lock"
    encrypt        = true
  }
}
