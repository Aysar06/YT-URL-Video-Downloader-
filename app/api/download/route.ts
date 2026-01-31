import { NextRequest, NextResponse } from 'next/server'
import ytdl from 'ytdl-core'
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
      videoInfo = await ytdl.getInfo(videoId)
    } catch (error: any) {
      if (error.message?.includes('Private video') || error.message?.includes('Video unavailable')) {
        return NextResponse.json(
          { error: 'Video is unavailable or private' },
          { status: 404 }
        )
      }
      throw error
    }

    // Get available formats
    const formats = ytdl.filterFormats(videoInfo.formats, 'videoandaudio')
    
    if (formats.length === 0) {
      return NextResponse.json(
        { error: 'No video formats with audio available' },
        { status: 400 }
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

    // Find the best format matching the requested quality
    let selectedFormat = formats.find(
      (format) => format.height === targetHeight && format.hasAudio && format.hasVideo
    )

    // If exact quality not found, find the closest available quality
    if (!selectedFormat) {
      // Try to find formats with audio and video
      const videoAudioFormats = formats.filter(f => f.hasAudio && f.hasVideo)
      
      if (videoAudioFormats.length === 0) {
        return NextResponse.json(
          { error: 'No suitable format with audio and video found' },
          { status: 400 }
        )
      }

      // Sort by height and find closest to target
      videoAudioFormats.sort((a, b) => (b.height || 0) - (a.height || 0))
      
      // Find format >= target height, or use highest available
      selectedFormat = videoAudioFormats.find(f => (f.height || 0) >= targetHeight) 
        || videoAudioFormats[0]
    }

    if (!selectedFormat) {
      return NextResponse.json(
        { error: 'Could not find suitable video format' },
        { status: 400 }
      )
    }

    // Get video stream
    const stream = ytdl(url, {
      format: selectedFormat,
      quality: 'highest',
      filter: 'videoandaudio',
    })

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
    return NextResponse.json(
      { error: error.message || 'Failed to download video' },
      { status: 500 }
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
