# Automatic Deployment Setup Guide

This guide will help you enable automatic deployments on Vercel so that every push to your GitHub repository automatically triggers a new deployment.

## Quick Setup (5 minutes)

### Step 1: Verify GitHub Connection

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: **YT-URL-Video-Downloader-**
3. Click on **Settings** (gear icon in the top navigation)
4. Click on **Git** in the left sidebar

### Step 2: Enable Auto-Deploy

In the **Git** settings page, ensure:

1. **Production Branch**: Set to `main` (or `master` if that's your default branch)
   - This tells Vercel which branch to deploy to production

2. **Automatically deploy commits pushed to the Production Branch**: **ENABLED** ✅
   - This is the key setting for auto-deploy
   - When enabled, every push to `main` will trigger a deployment

3. **Automatically deploy Pull Requests**: Optional (recommended: **ENABLED**)
   - Creates preview deployments for PRs

### Step 3: Verify Repository Connection

Make sure you see:
- **Connected Git Repository**: `Aysar06/YT-URL-Video-Downloader-`
- **Repository URL**: `https://github.com/Aysar06/YT-URL-Video-Downloader-.git`

If the repository is not connected:
1. Click **"Connect Git Repository"**
2. Select **GitHub** as your Git provider
3. Find and select `YT-URL-Video-Downloader-`
4. Click **"Import"**

## Testing Auto-Deploy

### Method 1: Make a Test Commit

```bash
# Make a small change
echo "// Auto-deploy test" >> app/page.tsx

# Commit and push
git add app/page.tsx
git commit -m "Test auto-deploy"
git push origin main
```

### Method 2: Check Deployment Status

1. After pushing, go to Vercel Dashboard
2. Click on **Deployments** tab
3. You should see a new deployment appear within 10-30 seconds
4. The deployment will show:
   - Status: "Building" → "Ready"
   - Source: "GitHub" with commit message
   - Branch: "main"

## Troubleshooting

### Auto-Deploy Not Working?

**Problem**: Pushes to GitHub don't trigger deployments

**Solutions**:

1. **Check Branch Name**
   - Vercel Production Branch must match your GitHub default branch
   - If GitHub uses `main`, Vercel should be set to `main`
   - If GitHub uses `master`, Vercel should be set to `master`

2. **Verify Git Integration**
   - Go to **Settings** → **Git**
   - Ensure repository is connected
   - If disconnected, reconnect it

3. **Check Vercel Webhook**
   - Go to your GitHub repository
   - Navigate to **Settings** → **Webhooks**
   - You should see a Vercel webhook
   - If missing, Vercel will create it automatically when you reconnect

4. **Manual Trigger**
   - Go to Vercel Dashboard → **Deployments**
   - Click **"Redeploy"** on the latest deployment
   - This doesn't fix auto-deploy but confirms deployment works

5. **Check Deployment Logs**
   - If deployments are triggered but failing
   - Check the build logs in Vercel Dashboard
   - Look for error messages

### Common Issues

**Issue**: "Production Branch not found"
- **Fix**: Make sure you've pushed to the branch specified in Production Branch setting

**Issue**: "Repository not connected"
- **Fix**: Reconnect the repository in Settings → Git

**Issue**: "Deployments triggered but failing"
- **Fix**: Check build logs, ensure `package.json` and dependencies are correct

## Manual Deployment (Fallback)

If auto-deploy isn't working, you can manually trigger deployments:

### Via Vercel Dashboard
1. Go to **Deployments** tab
2. Click **"Redeploy"** on any previous deployment
3. Or click **"Create Deployment"** → Select branch → Deploy

### Via Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

## Best Practices

1. **Always push to main branch for production deployments**
2. **Use feature branches and PRs for testing** (creates preview deployments)
3. **Monitor deployment status** in Vercel Dashboard
4. **Check build logs** if deployments fail
5. **Keep dependencies updated** to avoid build failures

## Verification Checklist

After setup, verify:

- [ ] Repository is connected in Vercel Settings → Git
- [ ] Production Branch is set to `main` (or your default branch)
- [ ] "Automatically deploy commits" is **ENABLED**
- [ ] Test push triggers a new deployment
- [ ] Deployment completes successfully
- [ ] Changes are live on your Vercel URL

## Need Help?

- **Vercel Docs**: [vercel.com/docs/concepts/git](https://vercel.com/docs/concepts/git)
- **Vercel Support**: [vercel.com/support](https://vercel.com/support)
- **GitHub Integration**: [vercel.com/docs/concepts/git/github](https://vercel.com/docs/concepts/git/github)
