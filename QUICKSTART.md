# Quick Start Guide

Get your YouTube Downloader up and running in minutes!

## Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

### 3. Open in Browser

Navigate to [http://localhost:3000](http://localhost:3000)

## Testing the Application

1. **Find a YouTube Video**: Copy any public YouTube video URL
2. **Paste URL**: Enter the URL in the input field
3. **Select Quality**: Choose your preferred quality (1080p, 1440p, 2160p, or 4320p)
4. **Download**: Click "Download Video"
5. **Save Location**: Your browser's file explorer will open - choose where to save

## Example URLs to Test

- Short video: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- Music video: `https://www.youtube.com/watch?v=9bZkp7q19f0`
- Educational: `https://www.youtube.com/watch?v=kBdfcR-8hEY`

## Common Issues

### "Invalid YouTube URL"
- Make sure you're using a full YouTube URL
- Format should be: `https://www.youtube.com/watch?v=VIDEO_ID` or `https://youtu.be/VIDEO_ID`

### "Video is unavailable or private"
- The video must be publicly accessible
- Some videos have download restrictions

### "Rate limit exceeded"
- You've made too many requests (10 per minute)
- Wait 1 minute and try again

### Download takes too long
- Very long videos may timeout
- Try downloading shorter videos first
- Check your internet connection

## Building for Production

```bash
npm run build
npm start
```

## Next Steps

- Read [README.md](./README.md) for full documentation
- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel deployment
- Customize the UI in `app/page.tsx`
- Adjust rate limits in `lib/rate-limit.ts`

## Need Help?

- Check the main [README.md](./README.md) for detailed information
- Review [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment issues
- Check browser console for error messages
