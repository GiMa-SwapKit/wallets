locals {
  labels = {
    environment = var.environment
    managed-by  = "terraform"
    project     = "swapkit"
  }
}

# --- Cloud Storage Bucket ---

resource "google_storage_bucket" "widget_cdn" {
  name          = var.bucket_name
  location      = var.region
  storage_class = "STANDARD"

  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type", "Cache-Control", "Content-Length"]
    max_age_seconds = 3600
  }

  labels = local.labels
}

resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.widget_cdn.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# --- Cloud CDN Backend Bucket ---

resource "google_compute_backend_bucket" "widget_cdn" {
  name        = "swapkit-widget-cdn-backend-${var.environment}"
  bucket_name = google_storage_bucket.widget_cdn.name
  enable_cdn  = true

  cdn_policy {
    cache_mode        = "CACHE_ALL_STATIC"
    default_ttl       = 3600
    max_ttl           = 86400
    client_ttl        = 3600
    negative_caching  = true
    serve_while_stale = 86400
  }
}

# --- Studio Backend (Cloud Run) ---

data "google_compute_backend_service" "widget" {
  count   = var.enable_studio ? 1 : 0
  name    = var.studio_backend_service
  project = var.project_id
}

# --- URL Map ---

resource "google_compute_url_map" "widget_cdn" {
  name            = "swapkit-widget-cdn-url-map-${var.environment}"
  default_service = google_compute_backend_bucket.widget_cdn.id

  host_rule {
    hosts        = [var.cdn_domain]
    path_matcher = "widget-paths"
  }

  dynamic "host_rule" {
    for_each = var.enable_studio ? [1] : []
    content {
      hosts        = [var.studio_domain]
      path_matcher = "studio-paths"
    }
  }

  path_matcher {
    name            = "widget-paths"
    default_service = google_compute_backend_bucket.widget_cdn.id

    path_rule {
      paths   = ["/widget/*"]
      service = google_compute_backend_bucket.widget_cdn.id
    }
  }

  dynamic "path_matcher" {
    for_each = var.enable_studio ? [1] : []
    content {
      name            = "studio-paths"
      default_service = google_compute_backend_bucket.widget_cdn.id

      route_rules {
        priority = 1
        service  = data.google_compute_backend_service.widget[0].id

        match_rules {
          prefix_match = "/studio"
        }

        route_action {
          url_rewrite {
            path_prefix_rewrite = "/"
          }
        }
      }
    }
  }
}

# --- Global External IP ---

resource "google_compute_global_address" "widget_cdn" {
  name         = "swapkit-widget-cdn-ip-${var.environment}"
  address_type = "EXTERNAL"
}

# --- Google-managed SSL Certificate ---

resource "google_compute_managed_ssl_certificate" "widget_cdn" {
  name = "swapkit-widget-cdn-cert-v5-${var.environment}"

  managed {
    domains = compact([var.cdn_direct_domain, var.studio_direct_domain])
  }

  lifecycle {
    create_before_destroy = true
  }
}

# --- HTTPS Proxy ---

resource "google_compute_target_https_proxy" "widget_cdn" {
  name             = "swapkit-widget-cdn-https-proxy-${var.environment}"
  url_map          = google_compute_url_map.widget_cdn.id
  ssl_certificates = [google_compute_managed_ssl_certificate.widget_cdn.id]
}

# --- HTTP → HTTPS Redirect ---

resource "google_compute_url_map" "http_redirect" {
  name = "swapkit-widget-cdn-http-redirect-${var.environment}"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "widget_cdn" {
  name    = "swapkit-widget-cdn-http-proxy-${var.environment}"
  url_map = google_compute_url_map.http_redirect.id
}

# --- Global Forwarding Rules ---

resource "google_compute_global_forwarding_rule" "https" {
  name                  = "swapkit-widget-cdn-https-${var.environment}"
  target                = google_compute_target_https_proxy.widget_cdn.id
  ip_address            = google_compute_global_address.widget_cdn.address
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL"
  labels                = local.labels
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "swapkit-widget-cdn-http-${var.environment}"
  target                = google_compute_target_http_proxy.widget_cdn.id
  ip_address            = google_compute_global_address.widget_cdn.address
  port_range            = "80"
  load_balancing_scheme = "EXTERNAL"
  labels                = local.labels
}
