# Deployment Guide for Vercel

This guide provides step-by-step instructions for deploying the YouTube Downloader application to Vercel.

## Prerequisites

- A Vercel account (sign up at [vercel.com](https://vercel.com))
- A GitHub account (for Git-based deployment)
- Node.js 18+ installed locally (for testing)

## Deployment Steps

### Method 1: Deploy via Vercel Dashboard (Recommended)

1. **Prepare Your Repository**
   - Push your code to a GitHub repository
   - Ensure all files are committed and pushed

2. **Connect to Vercel**
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "Add New..." → "Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js

3. **Configure Project**
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

4. **Environment Variables**
   - No environment variables required for basic functionality
   - Click "Deploy" to proceed

5. **Deploy**
   - Vercel will build and deploy your application
   - Wait for deployment to complete (usually 2-3 minutes)
   - Your app will be live at `your-project.vercel.app`

### Method 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```
   
   Follow the prompts:
   - Set up and deploy? **Yes**
   - Which scope? Select your account
   - Link to existing project? **No** (for first deployment)
   - Project name? Enter a name or press Enter for default
   - Directory? `./` (default)
   - Override settings? **No** (default)

4. **Production Deployment**
   ```bash
   vercel --prod
   ```

## Vercel Configuration

The project includes `vercel.json` with the following optimizations:

```json
{
  "functions": {
    "app/api/download/route.ts": {
      "maxDuration": 50
    }
  }
}
```

This sets the maximum function duration to 50 seconds, which is within Vercel's Hobby plan limit of 60 seconds.

### Adjusting Timeout (Pro Plan)

If you're on Vercel Pro plan, you can increase the timeout:

```json
{
  "functions": {
    "app/api/download/route.ts": {
      "maxDuration": 300
    }
  }
}
```

## Post-Deployment

### 1. Test Your Deployment

- Visit your deployed URL
- Test downloading a short YouTube video
- Verify quality selection works
- Test error handling with invalid URLs

### 2. Custom Domain (Optional)

1. Go to your project settings in Vercel
2. Navigate to "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

### 3. Monitor Performance

- Check Vercel Analytics for usage metrics
- Monitor function logs for errors
- Review rate limiting effectiveness

## Troubleshooting

### Build Errors

**Issue**: Build fails with module not found errors
**Solution**: 
- Ensure all dependencies are in `package.json`
- Run `npm install` locally to verify
- Check Node.js version (should be 18+)

**Issue**: TypeScript errors during build
**Solution**:
- Run `npm run build` locally to identify errors
- Fix TypeScript errors before deploying
- Ensure `tsconfig.json` is properly configured

### Runtime Errors

**Issue**: Downloads timeout
**Solution**:
- Check video length (very long videos may timeout)
- Consider upgrading to Vercel Pro for longer timeouts
- Test with shorter videos first

**Issue**: Memory errors
**Solution**:
- Very large videos may exceed memory limits
- Consider implementing chunked downloads
- Monitor Vercel function logs

**Issue**: Rate limiting not working
**Solution**:
- In-memory rate limiting resets on function restart
- For production, consider using Vercel KV
- Check function logs for rate limit implementation

### Function Timeout

**Issue**: Functions timing out
**Solution**:
- Verify `vercel.json` configuration
- Check Vercel plan limits
- Optimize download logic
- Consider streaming responses

## Performance Optimization

### Cold Start Optimization

The application is optimized for Vercel's serverless functions:

1. **Minimal Dependencies**: Only essential packages included
2. **Efficient Imports**: Tree-shaking enabled
3. **Streaming**: Uses streaming for large downloads
4. **Error Handling**: Fast-fail on invalid requests

### Scaling Considerations

For high-traffic deployments:

1. **Use Vercel KV**: Replace in-memory rate limiting
2. **Enable Edge Caching**: For static assets
3. **Monitor Usage**: Use Vercel Analytics
4. **Upgrade Plan**: Consider Pro plan for higher limits

## Environment-Specific Configuration

### Development
- Local development server: `npm run dev`
- No special configuration needed

### Production
- Automatic optimization by Vercel
- CDN distribution
- Serverless function scaling

## Security Considerations

1. **Rate Limiting**: Implemented to prevent abuse
2. **Input Validation**: All URLs validated before processing
3. **Error Messages**: Don't expose sensitive information
4. **CORS**: Configured in `vercel.json`

## Monitoring and Logs

### View Logs

1. Go to Vercel Dashboard
2. Select your project
3. Navigate to "Functions" tab
4. View real-time logs

### Set Up Alerts

1. Go to project settings
2. Navigate to "Notifications"
3. Configure alerts for:
   - Function errors
   - High error rates
   - Timeout issues

## Rollback

If deployment has issues:

1. Go to Vercel Dashboard
2. Select your project
3. Navigate to "Deployments"
4. Find previous working deployment
5. Click "..." → "Promote to Production"

## Support

- **Vercel Documentation**: [vercel.com/docs](https://vercel.com/docs)
- **Vercel Support**: [vercel.com/support](https://vercel.com/support)
- **Next.js Documentation**: [nextjs.org/docs](https://nextjs.org/docs)

## Checklist

Before deploying, ensure:

- [ ] All dependencies are in `package.json`
- [ ] `vercel.json` is configured correctly
- [ ] TypeScript compiles without errors
- [ ] Local build succeeds (`npm run build`)
- [ ] Environment variables are set (if any)
- [ ] README.md is updated
- [ ] Code is committed and pushed to Git

After deployment:

- [ ] Application loads correctly
- [ ] Download functionality works
- [ ] Error handling works
- [ ] Rate limiting is active
- [ ] Logs are accessible
- [ ] Custom domain is configured (if applicable)
