variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "sk-ui-dev"
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "cdn_domain" {
  description = "Domain name for the CDN"
  type        = string
  default     = "cdn-dev.swapkit.dev"
}

variable "cdn_direct_domain" {
  description = "Direct (non-proxied) domain name for SSL cert validation"
  type        = string
  default     = "cdn-dev-direct.swapkit.dev"
}

variable "bucket_name" {
  description = "Name of the GCS bucket for CDN storage"
  type        = string
  default     = "swapkit-widget-cdn-dev"
}

variable "environment" {
  description = "Deployment environment (dev, staging, production)"
  type        = string
  default     = "dev"
}

# --- Studio (Cloud Run widget app) ---

variable "enable_studio" {
  description = "Enable /studio routing to Cloud Run backend service"
  type        = bool
  default     = true
}

variable "studio_domain" {
  description = "Proxied domain for the studio app"
  type        = string
  default     = "widget-dev.swapkit.dev"
}

variable "studio_direct_domain" {
  description = "Direct (non-proxied) domain for SSL cert validation"
  type        = string
  default     = "widget-dev-direct.swapkit.dev"
}

variable "studio_backend_service" {
  description = "Name of the existing Cloud Run backend service"
  type        = string
  default     = "widget-backend-default"
}
