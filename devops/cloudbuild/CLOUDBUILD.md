# Cloud Build Pipelines

All CI/CD for the SwapKit UI runs on Google Cloud Build. Each environment has its own triggers in its own GCP project.

## Pipelines

### 1. Widget Image Build (`buildchangedapps.yaml`)

Detects changed files, builds the widget Docker image via Kaniko, pushes to Artifact Registry.

- **Watches**: `services/**`, triggered on `develop`, `main` (and active feature branches)
- **Output**: `us-docker.pkg.dev/<project>/widget/widget:<SHA>`

### 2. Widget Cloud Run Deploy (`deploy.yaml`)

Terraform-based deployment of the widget to Cloud Run. Triggered by Pub/Sub on new image push to Artifact Registry.

- **Terraform**: `playgrounds/vite-lite/terraform/<project>/`
- **Deploys to**: Cloud Run (multi-region: us-central1, europe-west1)

### 3. Widget CDN Asset Deploy (`widget-cdn-deploy.yaml`)

Builds the widget JS bundle and uploads to the CDN GCS bucket.

- **Watches**: `packages/ui/**`
- **Steps**: `bun install` → `bun run build` → `bun build:widget` → `gsutil rsync` to bucket
- **Uploads**:
  - `/widget/latest/` — mutable, `Cache-Control: public, max-age=0, must-revalidate`
  - `/widget/v{version}/` — immutable, `Cache-Control: public, immutable, max-age=31536000` (skips if version already exists)
- **Resulting URLs** (prod example):
  - `https://cdn.swapkit.dev/widget/latest/swapkit-widget.js` — always latest
  - `https://cdn.swapkit.dev/widget/v1.2.3/swapkit-widget.js` — pinned version

### 4. CDN Infrastructure (`terraform/cdn/cloudbuild.yaml`)

Terraform auto-apply for CDN infrastructure (GCS bucket, Cloud CDN, load balancer, SSL).

- **Watches**: `devops/terraform/cdn/<project>/**`
- **Steps**: `terraform init` → `apply -refresh-only` → `apply -auto-approve`

## Trigger Matrix

### CDN Asset Deploy Triggers

| Trigger | Project | Branch | Bucket |
|---|---|---|---|
| `widget-cdn-deploy-dev` | `sk-ui-dev` | `develop` | `swapkit-widget-cdn-dev` |
| `widget-cdn-deploy-stage` | `sk-ui-stage` | `staging` | `swapkit-widget-cdn-stage` |
| `widget-cdn-deploy-prod` | `sk-ui-prod` | `main` | `swapkit-widget-cdn-prod` |

### CDN Infrastructure Triggers

| Trigger | Project | Branch | Watches |
|---|---|---|---|
| `widget-cdn-infrastructure-dev` | `sk-ui-dev` | `develop` | `devops/terraform/cdn/sk-ui-dev/**` |
| `widget-cdn-infrastructure-stage` | `sk-ui-stage` | `staging` | `devops/terraform/cdn/sk-ui-stage/**` |
| `widget-cdn-infrastructure-prod` | `sk-ui-prod` | `main` | `devops/terraform/cdn/sk-ui-prod/**` |

## Trigger Config Files

All trigger configs are YAML files that can be imported/updated via:
```bash
gcloud builds triggers import --source=<trigger-config.yaml> \
  --project=<PROJECT_ID> --region=us-central1
```

| File | Purpose |
|---|---|
| `cloudbuild/trigger-widget-cdn-deploy-dev.yaml` | Widget asset deploy (dev) |
| `cloudbuild/trigger-widget-cdn-deploy-stage.yaml` | Widget asset deploy (stage) |
| `cloudbuild/trigger-widget-cdn-deploy-prod.yaml` | Widget asset deploy (prod) |
| `terraform/cdn/trigger-config-dev.yaml` | CDN infra auto-apply (dev) |
| `terraform/cdn/trigger-config-stage.yaml` | CDN infra auto-apply (stage) |
| `terraform/cdn/trigger-config-prod.yaml` | CDN infra auto-apply (prod) |

## GitHub Connections

Each project has its own Cloud Build connection. All link to repo `swapkit-wallets` (`swapkit/wallets` on GitHub).

| Project | Connection | Repository |
|---|---|---|
| `swapkit-devops` | `swapkit` | `swapkit-wallets` |
| `sk-ui-dev` | `swapkit-org` | `swapkit-wallets` |
| `sk-ui-stage` | `sk` | `swapkit-wallets` |
| `sk-ui-prod` | `sk` | `swapkit-wallets` |

## Service Accounts

Each project uses `cloudbuild@<project>.iam.gserviceaccount.com`. Required IAM roles:

| Role | Purpose |
|---|---|
| `roles/storage.admin` | GCS bucket creation, IAM, and CDN asset uploads |
| `roles/compute.loadBalancerAdmin` | Forwarding rules, URL maps, proxies, backend buckets |
| `roles/compute.networkAdmin` | Global static IP addresses |
| `roles/certificatemanager.owner` | Google-managed SSL certificates |
| `roles/run.admin` | Cloud Run service deployment (widget image build pipeline) |
| `roles/artifactregistry.writer` | Push container images |

## Manual Trigger Run

```bash
# Run widget CDN deploy manually (e.g., for dev)
gcloud builds submit \
  --config=devops/cloudbuild/widget-cdn-deploy.yaml \
  --project=sk-ui-dev --region=us-central1 \
  --service-account="projects/sk-ui-dev/serviceAccounts/cloudbuild@sk-ui-dev.iam.gserviceaccount.com" \
  --substitutions=_BUCKET_NAME=swapkit-widget-cdn-dev .
```
