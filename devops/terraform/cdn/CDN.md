# Widget CDN Infrastructure

Serves the SwapKit widget (`<swapkit-widget>`) as static JS from Google Cloud CDN behind Cloudflare, and routes `/studio` to the Cloud Run widget app.

## Architecture

```
Client → Cloudflare (SSL + proxy) → Google Cloud CDN LB
                                         ↓
                    cdn-*.swapkit.dev:    /widget/latest/   → GCS Bucket (always-fresh)
                                         /widget/v1.2.3/   → GCS Bucket (immutable, 1-year cache)

                    widget-*.swapkit.dev: /studio/*         → Cloud Run (url_rewrite: /studio → /)
```

## Per-Environment Resources

Each environment is identical and fully isolated in its own GCP project.

| Resource | Dev (`sk-ui-dev`) | Stage (`sk-ui-stage`) | Prod (`sk-ui-prod`) |
|---|---|---|---|
| GCS Bucket | `swapkit-widget-cdn-dev` | `swapkit-widget-cdn-stage` | `swapkit-widget-cdn-prod` |
| Static IP | `34.50.157.176` | `136.110.188.26` | `34.49.56.104` |
| SSL Cert Domains | `cdn-dev-direct`, `widget-dev-direct` | `cdn-stage-direct`, `widget-stage-direct` | `cdn-direct`, `widget-direct` |
| CDN Domain (proxied) | `cdn-dev.swapkit.dev` | `cdn-stage.swapkit.dev` | `cdn.swapkit.dev` |
| CDN Direct Domain | `cdn-dev-direct.swapkit.dev` | `cdn-stage-direct.swapkit.dev` | `cdn-direct.swapkit.dev` |
| Studio Domain (proxied) | `widget-dev.swapkit.dev` | `widget-stage.swapkit.dev` | `widget.swapkit.dev` |
| Studio Direct Domain | `widget-dev-direct.swapkit.dev` | `widget-stage-direct.swapkit.dev` | `widget-direct.swapkit.dev` |
| Studio Enabled | Yes | Yes | Yes |

## Terraform Structure

```
devops/terraform/cdn/
├── cloudbuild.yaml              # Parameterized: init → refresh → apply
├── trigger-config-dev.yaml      # develop branch → sk-ui-dev
├── trigger-config-stage.yaml    # staging branch → sk-ui-stage
├── trigger-config-prod.yaml     # main branch → sk-ui-prod
├── sk-ui-dev/                   # Dev terraform (project_id=sk-ui-dev)
├── sk-ui-stage/                 # Stage terraform (project_id=sk-ui-stage)
└── sk-ui-prod/                  # Prod terraform (project_id=sk-ui-prod)
```

Each project directory contains identical `main.tf`, `versions.tf`, `outputs.tf` with environment-specific `variables.tf` and `backend.tf`.

### Terraform Resources (per environment)

- `google_storage_bucket` — public GCS bucket with CORS
- `google_compute_backend_bucket` — Cloud CDN with CACHE_ALL_STATIC policy
- `google_compute_url_map` — routes `cdn-*` host to `/widget/*`, and (when `enable_studio=true`) `widget-*` host to `/studio/*` via Cloud Run
- `data.google_compute_backend_service` — references existing Cloud Run backend (conditional on `enable_studio`)
- `google_compute_global_address` — static external IP
- `google_compute_managed_ssl_certificate` — covers both CDN and studio `-direct` domains
- `google_compute_target_https_proxy` + `target_http_proxy` — HTTPS + HTTP→HTTPS redirect
- `google_compute_global_forwarding_rule` (x2) — port 80 + 443

### Studio Routing

The `enable_studio` variable (bool) controls whether `/studio` routing is active. When enabled:

1. A `data` source reads the existing `widget-backend-default` backend service (created by `playgrounds/vite-lite/terraform/`)
2. A dynamic `host_rule` matches the `studio_domain` and routes to a `studio-paths` path matcher
3. The path matcher uses `route_rules` with `prefix_match = "/studio"` and `path_prefix_rewrite = "/"` to strip the prefix before forwarding to Cloud Run

To enable studio in stage/prod, deploy the Cloud Run widget service first (via `playgrounds/vite-lite/terraform/<project>/`), then set `enable_studio = true` in the CDN terraform variables.

### State Backend

All environments use `gs://sk-frontend-terraform-be` with prefixes:
- Dev: `cdn`
- Stage: `cdn/stage`
- Prod: `cdn/prod`

## DNS Pattern

Each domain served by this LB uses **two** Cloudflare DNS records (CDN domains and studio domains both follow this pattern):

1. **Direct A record** (`*-direct.swapkit.dev`, not proxied) — points to the Google LB IP. Used for Google-managed SSL cert validation.
2. **Proxied CNAME** (`*.swapkit.dev`, proxied) — points to the direct record. Cloudflare terminates SSL and proxies to origin.

Google-managed certs only cover the `-direct` domain because Cloudflare's proxy blocks Google's HTTP validation challenge on the proxied domain. Cloudflare provides its own SSL cert on the proxied endpoint.

Total DNS records: **12** (2 per domain x 2 services x 3 environments).

## Auto-Apply Triggers

Infrastructure triggers fire on push to the environment's branch when `devops/terraform/cdn/<project>/**` changes:

| Trigger | Project | Branch |
|---|---|---|
| `widget-cdn-infrastructure-dev` | `sk-ui-dev` | `develop` |
| `widget-cdn-infrastructure-stage` | `sk-ui-stage` | `staging` |
| `widget-cdn-infrastructure-prod` | `sk-ui-prod` | `main` |

The `cloudbuild.yaml` uses a `_PROJECT_ID` substitution to target the correct terraform directory.

## Manual Operations

### Apply terraform manually
```bash
gcloud builds submit \
  --config=devops/terraform/cdn/cloudbuild.yaml \
  --project=<PROJECT_ID> --region=us-central1 \
  --service-account="projects/<PROJECT_ID>/serviceAccounts/cloudbuild@<PROJECT_ID>.iam.gserviceaccount.com" \
  --substitutions=_PROJECT_ID=<PROJECT_ID> .
```

### Check cert status
```bash
# List all certs to find current name
gcloud compute ssl-certificates list --global --project=<PROJECT_ID> \
  --format="table(name,managed.status,managed.domainStatus)"
```

### Check static IP
```bash
gcloud compute addresses describe swapkit-widget-cdn-ip-<environment> \
  --global --project=<PROJECT_ID> --format="value(address)"
```

## Verification

### Test end-to-end serving
```bash
# Upload a test file
echo '{"status":"ok"}' | gcloud storage cp - gs://swapkit-widget-cdn-prod/widget/latest/health.json --content-type="application/json"

# Fetch through proxied CDN
curl -s https://cdn.swapkit.dev/widget/latest/health.json

# Fetch through direct CDN
curl -s https://cdn-direct.swapkit.dev/widget/latest/health.json

# Check response headers (CORS, caching)
curl -sI https://cdn.swapkit.dev/widget/latest/health.json

# Clean up
gcloud storage rm gs://swapkit-widget-cdn-prod/widget/latest/health.json
```

Expected: 200 OK, `access-control-allow-origin: *`, correct `content-type`.

### Verify DNS records
```bash
# All 12 records (6 CDN + 6 studio: direct A + proxied CNAME each)
curl -s -X GET "https://api.cloudflare.com/client/v4/zones/ZONE_ID/dns_records?per_page=100" \
  -H "X-Auth-Email: $CLOUDFLARE_EMAIL" -H "X-Auth-Key: $CLOUDFLARE_API_KEY" \
  | python3 -c "import sys,json; [print(f'{r[\"name\"]:40s} {r[\"type\"]:6s} {r[\"content\"]}') for r in sorted(json.load(sys.stdin)['result'], key=lambda x: x['name']) if 'cdn' in r['name'] or 'widget' in r['name']]"
```

### Test studio routing (dev)
```bash
curl -sI https://widget-dev.swapkit.dev/studio
# Expected: 200 OK, content-type: text/html
```

## SSL Certificate Lifecycle

Google-managed SSL certs are **immutable** — changing the domain list forces a destroy/recreate. Key gotchas:

1. **`create_before_destroy`** is set in terraform, but the new cert must have a **different name** (Google won't create a cert with the same name as an existing one)
2. When domains change, **bump the version in the cert name** (e.g., `v4` → `v5`) in `main.tf`
3. Cert provisioning takes **15-60 minutes** after DNS is live
4. If a cert shows `FAILED_NOT_VISIBLE`, recreate it by bumping the name — Google gave up on validation and won't retry

### CRITICAL: Cert Swap Causes HTTPS Downtime

When a cert is recreated (domain list change), **HTTPS will be unavailable** until the new cert fully provisions. This is because:
- Terraform creates the new cert (PROVISIONING state), then attaches it to the HTTPS proxy, then destroys the old cert
- While the new cert is provisioning, the HTTPS proxy cannot complete TLS handshakes
- Cloudflare will return **HTTP 525 (SSL Handshake Failed)** on proxied domains during this window

**Mitigation:** Schedule cert changes during low-traffic windows. The downtime is typically 5-15 minutes but can be up to 60 minutes. HTTP (port 80) redirects continue to work during this period.

## IAM Requirements

Each project's `cloudbuild@<project>.iam.gserviceaccount.com` needs:
- `roles/storage.admin` — GCS bucket creation and IAM
- `roles/compute.loadBalancerAdmin` — forwarding rules, URL maps, proxies, backend buckets
- `roles/compute.networkAdmin` — global static IP
- `roles/certificatemanager.owner` — Google-managed SSL certificates
