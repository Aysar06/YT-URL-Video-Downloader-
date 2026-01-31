# YouTube Video Downloader V3

A fully functional YouTube video downloader web application optimized for deployment on Vercel's serverless platform. Download YouTube videos in high quality MP4 format with audio included.

## Features

- 🎥 **High Quality Downloads**: Support for 1080p, 1440p, 2160p (4K), and 4320p (8K) when available
- 🎵 **Audio Included**: All downloads include audio tracks
- 📱 **Responsive Design**: Clean, modern UI that works on all devices
- ⚡ **Fast & Efficient**: Optimized for Vercel serverless functions
- 🛡️ **Rate Limiting**: Built-in protection against abuse (10 requests/minute per IP)
- ✅ **Error Handling**: Comprehensive error handling for invalid URLs and unavailable videos
- 💾 **Native Downloads**: Triggers browser's native file explorer dialog for save location

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **YouTube Library**: @distube/ytdl-core (maintained fork)
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd "Youtube URL Downloader V3"
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Paste a YouTube URL in the input field
2. Select your preferred video quality (1080p, 1440p, 2160p, or 4320p)
3. Click the "Download Video" button
4. The browser's native file explorer will open, allowing you to choose the save location
5. The video will download in MP4 format with audio included

## Deployment to Vercel

### Option 1: Deploy via Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Follow the prompts to complete deployment.

### Option 2: Deploy via GitHub

1. Push your code to a GitHub repository
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Import your GitHub repository
5. Vercel will automatically detect Next.js and configure the project
6. Click "Deploy"

### Vercel Configuration

The project includes `vercel.json` with optimized settings:

- **Function Timeout**: Set to 50 seconds (within Vercel's limits)
- **CORS Headers**: Configured for API routes
- **Serverless Optimization**: Optimized for cold starts

### Environment Variables

No environment variables are required for basic functionality. The application works out of the box.

### Vercel Plan Considerations

- **Hobby Plan**: 60-second function timeout limit (configured to 50s for safety)
- **Pro Plan**: 300-second function timeout (can be increased if needed)
- **Rate Limiting**: Uses in-memory storage (consider Vercel KV for production scaling)

## Project Structure

```
.
├── app/
│   ├── api/
│   │   └── download/
│   │       └── route.ts          # API endpoint for video downloads
│   ├── globals.css                # Global styles
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Main page component
├── components/
│   └── ui/                        # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       └── select.tsx
├── lib/
│   ├── rate-limit.ts              # Rate limiting implementation
│   └── utils.ts                   # Utility functions
├── vercel.json                    # Vercel configuration
├── next.config.js                 # Next.js configuration
├── tailwind.config.ts             # Tailwind CSS configuration
└── package.json                   # Dependencies
```

## API Endpoint

### POST `/api/download`

Downloads a YouTube video in the specified quality.

**Request Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "quality": "1080p"
}
```

**Response:**
- Success: Video file (MP4) with appropriate headers
- Error: JSON error message with status code

**Status Codes:**
- `200`: Success
- `400`: Invalid URL or format not available
- `404`: Video unavailable or private
- `429`: Rate limit exceeded
- `500`: Server error

## Rate Limiting

The application implements rate limiting to prevent abuse:
- **Limit**: 10 requests per minute per IP address
- **Storage**: In-memory (resets on serverless function restart)
- **Response**: 429 status code with reset time

For production scaling, consider using:
- Vercel KV (Redis)
- Upstash Redis
- Other persistent storage solutions

## Error Handling

The application handles various error scenarios:

1. **Invalid URLs**: Validates YouTube URL format
2. **Unavailable Videos**: Detects private or unavailable videos
3. **Format Issues**: Handles cases where requested quality isn't available
4. **Network Errors**: Graceful handling of network failures
5. **Timeout Errors**: Prevents function timeout with proper error messages

## Limitations

1. **Serverless Timeout**: 
   - Hobby plan: 60 seconds max
   - Large videos may timeout on slower connections
   
2. **Memory Limits**:
   - Vercel has memory limits for serverless functions
   - Very large videos may exceed memory limits

3. **Rate Limiting**:
   - In-memory rate limiting resets on function restart
   - For production, use persistent storage

## Troubleshooting

### Download Fails

1. Check if the video is publicly available
2. Verify the URL format is correct
3. Try a different quality option
4. Check browser console for errors

### Timeout Errors

1. Try downloading a shorter video first
2. Consider upgrading to Vercel Pro plan for longer timeouts
3. Check your internet connection speed

### Rate Limit Errors

1. Wait for the rate limit window to reset (1 minute)
2. The reset time is provided in the error response

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

## Disclaimer

This tool is for educational purposes. Please respect YouTube's Terms of Service and copyright laws. Only download videos you have permission to download.
