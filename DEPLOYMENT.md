# Gym Bro — Azure Deployment Guide

Both the frontend (React) and the backend (Express API) are deployed to **Azure App Service** as Node.js code running on **Node 22**.

- **Frontend App Service** — serves the built React app as static files via a lightweight Node.js server (`server.mjs`)
- **API App Service** — runs the Express API server

---

## Prerequisites

- A [Microsoft Azure](https://portal.azure.com) account (free tier works)
- Your code pushed to a **GitHub repository**
- Both secrets configured in GitHub (see each section below)

---

## Part 1 — Deploy the Frontend (Azure App Service)

### Step 1: Create the Frontend App Service

1. Go to [portal.azure.com](https://portal.azure.com)
2. Click **Create a resource** → search for **Web App** → **Create**
3. Fill in the basics:
   - **Subscription**: your subscription
   - **Resource Group**: create new, e.g. `gym-bro-rg`
   - **Name**: `gym-bro-web` (becomes `gym-bro-web.azurewebsites.net`)
   - **Publish**: Code
   - **Runtime stack**: Node 22 LTS
   - **Operating System**: Linux
   - **Region**: East US (or closest to you)
   - **Pricing plan**: Free F1
4. Click **Review + create** → **Create**

### Step 2: Configure the startup command

1. Go to your new App Service → **Settings** → **Configuration** → **General settings**
2. Set **Startup Command** to: `node server.mjs`
3. Click **Save**

### Step 3: Add GitHub secrets for the frontend

In your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret Name | How to get it |
|---|---|
| `AZURE_FRONTEND_APP_NAME` | The name you chose, e.g. `gym-bro-web` |
| `AZURE_FRONTEND_PUBLISH_PROFILE` | App Service → **Overview** → **Download publish profile** → paste file contents |
| `VITE_GA_MEASUREMENT_ID` | `G-NEFQLYL8YJ` — your Google Analytics Measurement ID |
| `VITE_API_BASE_URL` | `https://gym-bro-api.azurewebsites.net` — the API App Service URL (set after Part 2) |

### Step 4: Set environment variables for the frontend

In the Azure portal, go to your frontend App Service → **Settings** → **Environment variables** → **App settings**:

| Variable | Value |
|---|---|
| `PORT` | `8080` |
| `NODE_ENV` | `production` |

---

## Part 2 — Deploy the API (Azure App Service)

### Step 1: Create the API App Service

1. In the Azure portal, click **Create a resource** → search for **Web App** → **Create**
2. Fill in the basics:
   - **Resource Group**: `gym-bro-rg` (same as above)
   - **Name**: `gym-bro-api` (becomes `gym-bro-api.azurewebsites.net`)
   - **Publish**: Code
   - **Runtime stack**: Node 22 LTS
   - **Operating System**: Linux
   - **Region**: same region as the frontend
   - **Pricing plan**: Free F1
3. Click **Review + create** → **Create**

### Step 2: Set environment variables for the API

In the Azure portal, go to your API App Service → **Settings** → **Environment variables** → **App settings**:

| Variable | Value | Notes |
|---|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` | From Supabase project settings |
| `SUPABASE_ANON_KEY` | `eyJ...` | From Supabase project API keys |
| `RESEND_API_KEY` | `re_...` | From resend.com dashboard |
| `TARGET_EMAIL` | `you@example.com` | Email address for daily reminders |
| `VAPID_PUBLIC_KEY` | `BF...` | Your VAPID public key |
| `VAPID_PRIVATE_KEY` | `...` | Your VAPID private key — keep secret |
| `ALLOWED_ORIGIN` | `https://gym-bro-web.azurewebsites.net` | Your frontend App Service URL |
| `PORT` | `8080` | Azure App Service default |
| `NODE_ENV` | `production` | |
| `WEBSITE_RUN_FROM_PACKAGE` | `1` | Required for zip deployment |

Click **Apply** after adding all variables.

### Step 3: Configure the startup command

1. Go to your API App Service → **Settings** → **Configuration** → **General settings**
2. Set **Startup Command** to: `node --enable-source-maps ./dist/index.mjs`
3. Click **Save**

### Step 4: Add GitHub secrets for the API

In your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret Name | How to get it |
|---|---|
| `AZURE_API_APP_NAME` | The name you chose, e.g. `gym-bro-api` |
| `AZURE_API_PUBLISH_PROFILE` | App Service → **Overview** → **Download publish profile** → paste file contents |

### Step 5: Configure API health check

1. In the Azure portal, go to your API App Service → **Monitoring** → **Health check**
2. Enable health check and set the path to `/api/health`
3. Azure will probe this endpoint and restart the service if it stops responding

---

## Part 3 — Trigger the CI/CD Pipeline

1. Push any commit to the `main` branch (or go to **Actions** in GitHub and click **Run workflow**)
2. The workflow builds both services and deploys them to their respective App Services
3. Once complete, visit `https://gym-bro-web.azurewebsites.net` to see the live app

If the first deploy succeeds but the API URL is not yet set, go back to the frontend App Service environment variables and add `VITE_API_BASE_URL` with the API URL, then re-run the workflow.

---

## Part 4 — Connect a Custom Domain

### Step 1: Add a custom domain in Azure

1. In the Azure portal, open your frontend App Service → **Settings** → **Custom domains** → **Add custom domain**
2. Enter your domain name (e.g. `gymbro.yourdomain.com`)
3. Azure will show you a **CNAME value** to add in your DNS — copy it

### Step 2: Configure DNS on Namecheap

1. Log in to [namecheap.com](https://www.namecheap.com) → **Domain List** → **Manage** → **Advanced DNS**
2. Add a **CNAME Record**:
   - **Host**: `gymbro` (or `www`)
   - **Value**: paste the CNAME value Azure gave you
   - **TTL**: Automatic
3. Save and wait 5–30 minutes for DNS propagation
4. Return to Azure and click **Validate** — Azure will provision a free TLS certificate automatically

---

## Part 5 — Verify the Deployment

Once deployed, confirm:

- [ ] Frontend URL loads the Today's Check-in page
- [ ] `/schedule` and `/settings` routes work without 404 (SPA routing via `server.mjs`)
- [ ] API calls succeed — attend or skip today, confirm it saves after refresh
- [ ] Google Analytics Real-time report shows page views
- [ ] Push notifications prompt works and fires at the scheduled time
- [ ] Daily email arrives at `TARGET_EMAIL`

---

## Environment Variables Reference

| Variable | Used By | Description |
|---|---|---|
| `SUPABASE_URL` | API (Azure env var) | Supabase project URL |
| `SUPABASE_ANON_KEY` | API (Azure env var) | Supabase anonymous key |
| `RESEND_API_KEY` | API (Azure env var) | Resend key for email |
| `TARGET_EMAIL` | API (Azure env var) | Recipient of daily reminder emails |
| `VAPID_PUBLIC_KEY` | API (Azure env var) | Web Push public key |
| `VAPID_PRIVATE_KEY` | API (Azure env var) | Web Push private key — keep secret |
| `ALLOWED_ORIGIN` | API (Azure env var) | Frontend URL for CORS |
| `PORT` | Both (Azure env var) | HTTP port — Azure uses `8080` |
| `NODE_ENV` | Both (Azure env var) | Set to `production` |
| `WEBSITE_RUN_FROM_PACKAGE` | API (Azure env var) | Required for zip deploy |
| `VITE_GA_MEASUREMENT_ID` | Frontend (GitHub secret) | Google Analytics 4 ID |
| `VITE_API_BASE_URL` | Frontend (GitHub secret) | Full URL of the API App Service |
| `BASE_PATH` | Frontend (set by CI to `/`) | Vite base path — set automatically |

---

## Using the Dockerfile (Optional)

A `Dockerfile` is provided at `artifacts/api-server/Dockerfile` for containerized deployment.
To deploy via Docker instead of zip, push the image to Azure Container Registry and configure your App Service to use a container image.

```bash
docker build -f artifacts/api-server/Dockerfile -t gym-bro-api .
docker run -p 8080:8080 \
  -e SUPABASE_URL=... \
  -e SUPABASE_ANON_KEY=... \
  -e RESEND_API_KEY=... \
  -e VAPID_PUBLIC_KEY=... \
  -e VAPID_PRIVATE_KEY=... \
  -e ALLOWED_ORIGIN=https://gym-bro-web.azurewebsites.net \
  -e NODE_ENV=production \
  gym-bro-api
```

---

*Built by Colby Davis*
