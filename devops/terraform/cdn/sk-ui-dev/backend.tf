terraform {
  backend "gcs" {
    bucket = "sk-frontend-terraform-be"
    prefix = "cdn"
  }
}
