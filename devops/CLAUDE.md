# DevOps - SwapKit UI

Infrastructure, CI/CD, and deployment configuration for the SwapKit UI.

## Quick Reference

- **GCP Projects**: `sk-ui-dev`, `sk-ui-stage`, `sk-ui-prod`
- **Terraform State**: `gs://sk-frontend-terraform-be`
- **DNS**: Cloudflare (zone: `swapkit.dev`, creds in repo root `.env`)
- **Build System**: Google Cloud Build (region: `us-central1`)
- **Package Manager**: Bun (not npm)
- **GitHub**: `swapkit/wallets` via Cloud Build connection `swapkit`

## Documentation

- **[CDN Infrastructure](terraform/cdn/CDN.md)** — CDN + Studio routing, Terraform, DNS, SSL certs, operational runbooks
- **[Cloud Build Pipelines](cloudbuild/CLOUDBUILD.md)** — Build triggers, deploy pipelines, trigger config files

## Environment Matrix

| Environment | GCP Project | Branch | CDN Domain | Studio Domain |
|---|---|---|---|---|
| Dev | `sk-ui-dev` | `develop` | `cdn-dev.swapkit.dev` | `widget-dev.swapkit.dev/studio` |
| Staging | `sk-ui-stage` | `staging` | `cdn-stage.swapkit.dev` | `widget-stage.swapkit.dev/studio` |
| Production | `sk-ui-prod` | `main` | `cdn.swapkit.dev` | `widget.swapkit.dev/studio` |

Studio routing is enabled per-environment via `enable_studio` in the CDN terraform. All environments are active.

## Key Conventions

- Each GCP project is **fully isolated** — own service accounts, triggers, and resources. **No cross-project IAM.**
- GitHub connections vary by project: `swapkit` (swapkit-devops), `swapkit-org` (sk-ui-dev), `sk` (sk-ui-stage/prod). All link to repo `swapkit-wallets`
- DNS pattern: `<name>-direct.swapkit.dev` (A record, not proxied) + `<name>.swapkit.dev` (CNAME, Cloudflare proxied)
- Google-managed SSL certs only cover the `-direct` domains; Cloudflare handles SSL on proxied domains
- Terraform auto-applies on push to the environment's branch when files in the relevant path change
- Build service account: `cloudbuild@<project>.iam.gserviceaccount.com`

## Infrastructure Locations

| Component | Path | Manages |
|---|---|---|
| CDN + Studio LB | `devops/terraform/cdn/<project>/` | GCS bucket, Cloud CDN, URL map, SSL, forwarding rules |
| Widget Cloud Run | `playgrounds/vite-lite/terraform/<project>/` | Cloud Run services, serverless NEGs, backend service |
| CI/CD Pipelines | `devops/cloudbuild/` | Build and deploy YAML + trigger configs |
| Build/Deploy Triggers (TF) | `devops/bootstrap/` | Cloud Build trigger + Artifact Registry definitions |
