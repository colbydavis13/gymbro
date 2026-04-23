# Gym Bro — Azure Deployment Guide

This guide walks through deploying Gym Bro to Microsoft Azure step by step.
The frontend (React) goes to **Azure Static Web Apps** and the backend (Express API) goes to **Azure App Service**.

---

## Prerequisites

- A [Microsoft Azure](https://portal.azure.com) account (free tier works)
- Your code pushed to a **GitHub repository**
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed (optional but helpful)

---

## Part 1 — Deploy the Frontend (Azure Static Web Apps)

### Step 1: Create a Static Web App resource

1. Go to [portal.azure.com](https://portal.azure.com)
2. Click **Create a resource** → search for **Static Web Apps** → click **Create**
3. Fill in the basics:
   - **Subscription**: your subscription
   - **Resource Group**: create new, e.g. `gym-bro-rg`
   - **Name**: `gym-bro` (or any name you like)
   - **Plan type**: Free
   - **Region**: East US (or closest to you)
4. Under **Deployment details**:
   - **Source**: GitHub
   - Click **Sign in with GitHub** and authorize Azure
   - Select your **Organization**, **Repository**, and **Branch** (`main`)
5. Under **Build Details**:
   - **Build Preset**: Custom
   - **App location**: `artifacts/gym-bro/dist/public`
   - **Api location**: (leave blank)
   - **Output location**: (leave blank)
   - Check **Skip build** — the GitHub Actions workflow handles building
6. Click **Review + create** → **Create**

Azure will add a deployment token secret to your GitHub repository automatically.

### Step 2: Set environment variables for the frontend build

In GitHub, go to your repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Add these secrets:

| Secret Name | Value | Description |
|---|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | (auto-added by Azure) | Azure deployment token |
| `VITE_GA_MEASUREMENT_ID` | `G-NEFQLYL8YJ` | Google Analytics 4 Measurement ID |
| `VITE_API_BASE_URL` | `https://<your-api-app-name>.azurewebsites.net` | URL of your deployed API (set after Part 2) |

### Step 3: Trigger the first deployment

Push any change to `main` (or run the workflow manually from the **Actions** tab in GitHub). The GitHub Actions workflow will build and deploy the frontend automatically.

---

## Part 2 — Deploy the API (Azure App Service)

### Step 1: Create an App Service resource

1. In the Azure portal, click **Create a resource** → search for **Web App** → **Create**
2. Fill in the basics:
   - **Subscription**: same subscription
   - **Resource Group**: `gym-bro-rg` (same as above)
   - **Name**: `gym-bro-api` (must be unique — this becomes `gym-bro-api.azurewebsites.net`)
   - **Publish**: Code
   - **Runtime stack**: Node 22 LTS
   - **Operating System**: Linux
   - **Region**: same region as Static Web App
   - **Pricing plan**: Free F1 (or Basic B1 for always-on)
3. Click **Review + create** → **Create**

### Step 2: Set environment variables for the API

In the Azure portal, go to your App Service → **Settings** → **Environment variables** → **App settings**. Add each variable:

| Variable | Value | Required |
|---|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Yes — from Supabase project settings |
| `SUPABASE_ANON_KEY` | `eyJ...` | Yes — from Supabase project API keys |
| `RESEND_API_KEY` | `re_...` | Yes — from resend.com dashboard |
| `TARGET_EMAIL` | `you@example.com` | Yes — email address to receive daily reminders |
| `VAPID_PUBLIC_KEY` | `BF...` | Yes — your VAPID public key |
| `VAPID_PRIVATE_KEY` | `...` | Yes — your VAPID private key (keep secret!) |
| `NODE_ENV` | `production` | Yes |
| `PORT` | `8080` | Yes — Azure App Service uses 8080 by default |
| `WEBSITE_RUN_FROM_PACKAGE` | `1` | Yes — required for zip deployment |

Click **Apply** after adding all variables.

### Step 3: Get the publish profile

1. In your App Service, click **Overview** → **Download publish profile**
2. Open the downloaded `.PublishSettings` file in a text editor and copy all of its contents

In GitHub, add another repository secret:

| Secret Name | Value |
|---|---|
| `AZURE_APP_SERVICE_NAME` | `gym-bro-api` (your App Service name) |
| `AZURE_APP_SERVICE_PUBLISH_PROFILE` | (paste the full contents of the .PublishSettings file) |

### Step 4: Update the Static Web Apps proxy

In `artifacts/gym-bro/staticwebapp.config.json`, the `/api/*` route proxies to your backend. Azure Static Web Apps does not support external proxy routing out of the box on the Free tier. Instead, set `VITE_API_BASE_URL` as a GitHub secret (Part 1, Step 2) to the full API URL so the frontend can call your App Service directly.

Update `artifacts/gym-bro/src/App.tsx` to call `setBaseUrl` with the API URL:

```tsx
import { setBaseUrl } from "@workspace/api-client-react";

// At the top of App() component or in main.tsx:
setBaseUrl(import.meta.env.VITE_API_BASE_URL ?? "");
```

Then in your Vite config or `.env.production` file:
```
VITE_API_BASE_URL=https://gym-bro-api.azurewebsites.net
```

### Step 5: Enable CORS on the API

In the Azure portal, go to your App Service → **API** → **CORS**. Add the URL of your Static Web App (e.g. `https://gym-bro.azurestaticapps.net`) to the Allowed Origins list.

---

## Part 3 — Connect a Custom Domain

### Step 1: Add a custom domain in Azure Static Web Apps

1. In the Azure portal, open your Static Web App → **Custom domains** → **Add**
2. Select **Custom domain on other DNS** (or Azure DNS if you have a zone)
3. Enter your domain name (e.g. `gymbro.yourdomain.com`)
4. Azure will show you a **CNAME value** to add — copy it

### Step 2: Configure DNS on Namecheap

1. Log in to [namecheap.com](https://www.namecheap.com) → **Domain List** → click **Manage** next to your domain
2. Go to the **Advanced DNS** tab
3. Add a new **CNAME Record**:
   - **Host**: `gymbro` (or `www` for root)
   - **Value**: paste the CNAME value Azure gave you
   - **TTL**: Automatic
4. Click the checkmark to save

DNS propagation takes 5–30 minutes. Return to Azure and click **Validate** once DNS has propagated. Azure will automatically provision a free TLS certificate.

---

## Part 4 — Verify the Deployment

Once deployed, check the following:

- [ ] Visit your Static Web App URL — the Today's Check-in page loads
- [ ] Navigate to `/schedule` and `/settings` — no 404 errors (SPA routing works)
- [ ] Open browser DevTools → Network tab → confirm API calls to `/api/*` return 200
- [ ] Check Google Analytics Real-time report — page views appear
- [ ] Submit a check-in (attend/skip) — it persists after page refresh
- [ ] Change the schedule time → verify the change is saved
- [ ] Enable push notifications → confirm the browser prompts for permission

---

## Environment Variables Reference

| Variable | Where Used | Description |
|---|---|---|
| `SUPABASE_URL` | API server | Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | API server | Supabase anonymous API key |
| `RESEND_API_KEY` | API server | Resend API key for sending daily reminder emails |
| `TARGET_EMAIL` | API server | Email address to receive daily reminder emails |
| `VAPID_PUBLIC_KEY` | API server | VAPID public key for Web Push (base64url encoded) |
| `VAPID_PRIVATE_KEY` | API server | VAPID private key for Web Push — **keep secret** |
| `NODE_ENV` | API server | Set to `production` in Azure |
| `PORT` | API server | HTTP port — Azure App Service uses `8080` |
| `VITE_GA_MEASUREMENT_ID` | Frontend build (GitHub secret) | Google Analytics 4 Measurement ID |
| `VITE_API_BASE_URL` | Frontend build (GitHub secret) | Full URL of the deployed API server |
| `BASE_PATH` | Frontend build (set in CI) | Base path for the app — set to `/` automatically by the workflow |

---

## Using the Dockerfile (Optional)

A `Dockerfile` is provided at `artifacts/api-server/Dockerfile` for containerized deployment to Azure Container Apps or any Docker host:

```bash
docker build -f artifacts/api-server/Dockerfile -t gym-bro-api .
docker run -p 8080:8080 \
  -e SUPABASE_URL=... \
  -e SUPABASE_ANON_KEY=... \
  -e RESEND_API_KEY=... \
  -e VAPID_PUBLIC_KEY=... \
  -e VAPID_PRIVATE_KEY=... \
  -e NODE_ENV=production \
  gym-bro-api
```

To deploy the container to Azure Container Apps instead of App Service, push the image to Azure Container Registry and create a Container Apps resource pointing to it.

---

*Built by Colby Davis*
