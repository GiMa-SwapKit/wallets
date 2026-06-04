output "cdn_ip_address" {
  description = "External IP address — point cdn.swapkit.dev DNS A record here"
  value       = google_compute_global_address.widget_cdn.address
}

output "cdn_url" {
  value = "https://${var.cdn_domain}"
}

output "bucket_name" {
  value = google_storage_bucket.widget_cdn.name
}

output "widget_latest_url" {
  value = "https://${var.cdn_domain}/widget/latest/swapkit-widget.js"
}
