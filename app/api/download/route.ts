import { NextRequest, NextResponse } from 'next/server'
import ytdl from '@distube/ytdl-core'
import { rateLimit } from '@/lib/rate-limit'
import { isValidYouTubeUrl, extractVideoId } from '@/lib/utils'
import { Readable } from 'stream'

// Vercel serverless function timeout is 60s for Hobby, 300s for Pro
// We'll set a max timeout of 50s to be safe
const MAX_DOWNLOAD_TIME = 50000

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown'
    
    const rateLimitResult = rateLimit(ip)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please try again later.',
          resetTime: rateLimitResult.resetTime 
        },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { url, quality } = body

    // Validate URL
    if (!url || !isValidYouTubeUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      )
    }

    const videoId = extractVideoId(url)
    if (!videoId) {
      return NextResponse.json(
        { error: 'Could not extract video ID from URL' },
        { status: 400 }
      )
    }

    // Enhanced request options with latest headers
    const requestOptions = {
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.youtube.com/',
          'Origin': 'https://www.youtube.com',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
        },
      },
    }

    // Get video info with retry logic
    let videoInfo
    let retryCount = 0
    const maxRetries = 3

    while (retryCount < maxRetries) {
      try {
        videoInfo = await ytdl.getInfo(videoId, requestOptions)
        break // Success, exit retry loop
      } catch (error: any) {
        retryCount++
        
        if (retryCount >= maxRetries) {
          // Handle specific error codes
          if (error.statusCode === 410) {
            return NextResponse.json(
              { error: 'Video is no longer available. YouTube may have removed it or changed access permissions.' },
              { status: 410 }
            )
          }
          if (error.statusCode === 403 || error.statusCode === 401) {
            return NextResponse.json(
              { error: 'Access to this video is restricted. It may be private or region-locked.' },
              { status: 403 }
            )
          }
          if (error.message?.includes('Private video') || error.message?.includes('Video unavailable') || error.message?.includes('not found')) {
            return NextResponse.json(
              { error: 'Video is unavailable or private' },
              { status: 404 }
            )
          }
          if (error.message?.includes('Sign in to confirm your age')) {
            return NextResponse.json(
              { error: 'This video requires age verification and cannot be downloaded.' },
              { status: 403 }
            )
          }
          throw error
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
      }
    }

    if (!videoInfo) {
      return NextResponse.json(
        { error: 'Failed to retrieve video information after multiple attempts' },
        { status: 500 }
      )
    }

    // Map quality string to height
    const qualityMap: { [key: string]: number } = {
      '1080p': 1080,
      '1440p': 1440,
      '2160p': 2160,
      '4320p': 4320,
    }

    const targetHeight = qualityMap[quality] || 1080

    // Get available formats with multiple strategies
    let formats = ytdl.filterFormats(videoInfo.formats, 'videoandaudio')
    
    // Strategy 1: Try combined video+audio formats first
    let selectedFormat = formats.find(
      (format) => format.height === targetHeight && format.hasAudio && format.hasVideo
    )

    // Strategy 2: Find closest quality >= target
    if (!selectedFormat && formats.length > 0) {
      formats.sort((a, b) => (b.height || 0) - (a.height || 0))
      selectedFormat = formats.find(f => (f.height || 0) >= targetHeight) || formats[0]
    }

    // Strategy 3: If no combined formats, try separate video and audio (ytdl will merge)
    if (!selectedFormat) {
      const videoFormats = ytdl.filterFormats(videoInfo.formats, 'videoonly')
      const audioFormats = ytdl.filterFormats(videoInfo.formats, 'audioonly')
      
      if (videoFormats.length > 0 && audioFormats.length > 0) {
        // ytdl will automatically merge these
        videoFormats.sort((a, b) => (b.height || 0) - (a.height || 0))
        const bestVideo = videoFormats.find(f => (f.height || 0) >= targetHeight) || videoFormats[0]
        selectedFormat = bestVideo
      }
    }

    if (!selectedFormat) {
      return NextResponse.json(
        { error: 'No suitable video format available. The video may be restricted or unavailable.' },
        { status: 400 }
      )
    }

    // Try to create stream with multiple fallback strategies
    let stream: NodeJS.ReadableStream
    let streamCreated = false
    const streamStrategies = [
      // Strategy 1: Use selected format directly
      () => {
        if (selectedFormat && selectedFormat.hasAudio && selectedFormat.hasVideo) {
          return ytdl(url, {
            format: selectedFormat,
            ...requestOptions,
          })
        }
        return null
      },
      // Strategy 2: Use quality filter
      () => {
        return ytdl(url, {
          quality: 'highest',
          filter: 'videoandaudio',
          ...requestOptions,
        })
      },
      // Strategy 3: Use any available format
      () => {
        return ytdl(url, {
          quality: 'lowest',
          filter: 'videoandaudio',
          ...requestOptions,
        })
      },
    ]

    for (const strategy of streamStrategies) {
      try {
        const testStream = strategy()
        if (testStream) {
          stream = testStream
          streamCreated = true
          break
        }
      } catch (err) {
        // Try next strategy
        continue
      }
    }

    if (!streamCreated || !stream) {
      return NextResponse.json(
        { error: 'Failed to create video stream. The video may be restricted or unavailable.' },
        { status: 500 }
      )
    }

    // Create a streaming response using ReadableStream
    const readableStream = new ReadableStream({
      async start(controller) {
        const startTime = Date.now()
        let hasError = false

        stream.on('data', (chunk: Buffer) => {
          if (hasError) return
          
          // Check timeout
          if (Date.now() - startTime > MAX_DOWNLOAD_TIME) {
            stream.destroy()
            controller.error(new Error('Download timeout'))
            hasError = true
            return
          }
          
          try {
            controller.enqueue(chunk)
          } catch (err) {
            hasError = true
            stream.destroy()
          }
        })

        stream.on('end', () => {
          if (!hasError) {
            controller.close()
          }
        })

        stream.on('error', (error: Error) => {
          hasError = true
          // Check if it's a 410 error
          if (error.message?.includes('410') || (error as any).statusCode === 410) {
            controller.error(new Error('Video format is no longer available. Please try again or select a different quality.'))
          } else {
            controller.error(new Error(`Stream error: ${error.message}`))
          }
        })
      },
      cancel() {
        stream.destroy()
      },
    })

    const title = videoInfo.videoDetails.title.replace(/[^\w\s-]/g, '').trim()
    const filename = `${title}.mp4`

    return new NextResponse(readableStream, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error: any) {
    console.error('Download error:', error)
    
    // Handle specific HTTP status codes
    if (error.statusCode === 410 || error.message?.includes('410')) {
      return NextResponse.json(
        { error: 'Video format is no longer available. YouTube may have expired the download link. Please try again or select a different quality.' },
        { status: 410 }
      )
    }
    if (error.statusCode === 403 || error.message?.includes('403')) {
      return NextResponse.json(
        { error: 'Access to this video is restricted. It may be private or region-locked.' },
        { status: 403 }
      )
    }
    if (error.statusCode === 404 || error.message?.includes('404')) {
      return NextResponse.json(
        { error: 'Video not found. Please check the URL and try again.' },
        { status: 404 }
      )
    }
    
    // Generic error message
    const errorMessage = error.message || 'Failed to download video'
    return NextResponse.json(
      { error: errorMessage },
      { status: error.statusCode || 500 }
    )
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
