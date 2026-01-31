import { NextRequest, NextResponse } from 'next/server'
import ytdl from '@distube/ytdl-core'
import { rateLimit } from '@/lib/rate-limit'
import { isValidYouTubeUrl, extractVideoId } from '@/lib/utils'

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

    // Validate video availability
    let videoInfo
    try {
      videoInfo = await ytdl.getInfo(videoId, {
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        },
      })
    } catch (error: any) {
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

    // Get available formats - prefer combined video+audio formats
    let formats = ytdl.filterFormats(videoInfo.formats, 'videoandaudio')
    
    // Map quality string to height
    const qualityMap: { [key: string]: number } = {
      '1080p': 1080,
      '1440p': 1440,
      '2160p': 2160,
      '4320p': 4320,
    }

    const targetHeight = qualityMap[quality] || 1080

    // Find the best format matching the requested quality
    let selectedFormat = formats.find(
      (format) => format.height === targetHeight && format.hasAudio && format.hasVideo
    )

    // If exact quality not found, find the closest available quality
    if (!selectedFormat && formats.length > 0) {
      // Sort by height and find closest to target
      formats.sort((a, b) => (b.height || 0) - (a.height || 0))
      
      // Find format >= target height, or use highest available
      selectedFormat = formats.find(f => (f.height || 0) >= targetHeight) 
        || formats[0]
    }

    // If no combined formats available, we'll let ytdl handle merging video+audio
    const hasCombinedFormat = selectedFormat && selectedFormat.hasAudio && selectedFormat.hasVideo

    // Get video stream with better error handling
    let stream
    try {
      const requestOptions = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      }

      // If we have a combined format, use it
      if (hasCombinedFormat && selectedFormat) {
        stream = ytdl(url, {
          format: selectedFormat,
          requestOptions,
        })
      } else {
        // Use filter to let ytdl automatically merge video and audio
        // Try to match quality if possible
        const qualityOption = quality === '1080p' ? 'highest' : 
                             quality === '1440p' ? 'highest' :
                             quality === '2160p' ? 'highest' : 'highest'
        
        stream = ytdl(url, {
          quality: qualityOption,
          filter: 'videoandaudio',
          requestOptions,
        })
      }
    } catch (streamError: any) {
      if (streamError.statusCode === 410) {
        return NextResponse.json(
          { error: 'Video format is no longer available. Please try again or select a different quality.' },
          { status: 410 }
        )
      }
      throw streamError
    }

    // Create a readable stream for the response
    const readableStream = new ReadableStream({
      async start(controller) {
        const startTime = Date.now()
        
        stream.on('data', (chunk: Buffer) => {
          // Check timeout
          if (Date.now() - startTime > MAX_DOWNLOAD_TIME) {
            stream.destroy()
            controller.error(new Error('Download timeout'))
            return
          }
          controller.enqueue(chunk)
        })

        stream.on('end', () => {
          controller.close()
        })

        stream.on('error', (error: Error) => {
          controller.error(new Error(`Stream error: ${error.message}`))
        })
      },
    })

    const title = videoInfo.videoDetails.title.replace(/[^\w\s-]/g, '').trim()
    const filename = `${title}.mp4`

    return new NextResponse(readableStream, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error: any) {
    console.error('Download error:', error)
    
    // Handle specific HTTP status codes
    if (error.statusCode === 410) {
      return NextResponse.json(
        { error: 'Video is no longer available. YouTube may have removed it or changed access permissions.' },
        { status: 410 }
      )
    }
    if (error.statusCode === 403) {
      return NextResponse.json(
        { error: 'Access to this video is restricted. It may be private or region-locked.' },
        { status: 403 }
      )
    }
    if (error.statusCode === 404) {
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
