import { NextRequest, NextResponse } from 'next/server'
import ytdl from '@distube/ytdl-core'
import { rateLimit } from '@/lib/rate-limit'
import { isValidYouTubeUrl, extractVideoId } from '@/lib/utils'

// Vercel serverless function timeout is 60s for Hobby, 300s for Pro
// We'll set a max timeout of 50s to be safe
const MAX_DOWNLOAD_TIME = 50000

// Helper function to download from URL with proper headers
async function downloadFromUrl(url: string, headers: Record<string, string>): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      ...headers,
      'Referer': 'https://www.youtube.com/',
      'Origin': 'https://www.youtube.com',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

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

    // Enhanced request options with better headers
    const requestOptions = {
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.youtube.com/',
          'Origin': 'https://www.youtube.com',
        },
      },
    }

    // Validate video availability
    let videoInfo
    try {
      videoInfo = await ytdl.getInfo(videoId, requestOptions)
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

    // Map quality string to height
    const qualityMap: { [key: string]: number } = {
      '1080p': 1080,
      '1440p': 1440,
      '2160p': 2160,
      '4320p': 4320,
    }

    const targetHeight = qualityMap[quality] || 1080

    // Try multiple format strategies
    let selectedFormat = null
    let formats = ytdl.filterFormats(videoInfo.formats, 'videoandaudio')
    
    // Strategy 1: Try to find exact quality with video+audio
    if (formats.length > 0) {
      selectedFormat = formats.find(
        (format) => format.height === targetHeight && format.hasAudio && format.hasVideo
      )

      // Strategy 2: Find closest quality >= target
      if (!selectedFormat) {
        formats.sort((a, b) => (b.height || 0) - (a.height || 0))
        selectedFormat = formats.find(f => (f.height || 0) >= targetHeight) || formats[0]
      }
    }

    // Strategy 3: If no combined formats, try separate video and audio
    if (!selectedFormat || !selectedFormat.url) {
      const videoFormats = ytdl.filterFormats(videoInfo.formats, 'videoonly')
      const audioFormats = ytdl.filterFormats(videoInfo.formats, 'audioonly')
      
      if (videoFormats.length > 0 && audioFormats.length > 0) {
        // Use highest quality video and best audio
        videoFormats.sort((a, b) => (b.height || 0) - (a.height || 0))
        const bestVideo = videoFormats.find(f => (f.height || 0) >= targetHeight) || videoFormats[0]
        const bestAudio = audioFormats[0] // Usually only one audio format
        
        // Try to download and merge (simplified - in production you'd want proper merging)
        // For now, just use the video format
        selectedFormat = bestVideo
      }
    }

    if (!selectedFormat || !selectedFormat.url) {
      return NextResponse.json(
        { error: 'No suitable video format available. The video may be restricted or unavailable.' },
        { status: 400 }
      )
    }

    // Try to download the video using the format URL directly
    let videoBuffer: Buffer
    try {
      // First, try using ytdl stream (original method)
      const stream = ytdl(url, {
        format: selectedFormat,
        ...requestOptions,
      })

      // Collect stream data with timeout
      const chunks: Buffer[] = []
      const startTime = Date.now()
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          stream.destroy()
          reject(new Error('Download timeout'))
        }, MAX_DOWNLOAD_TIME)

        stream.on('data', (chunk: Buffer) => {
          chunks.push(chunk)
          if (Date.now() - startTime > MAX_DOWNLOAD_TIME) {
            clearTimeout(timeout)
            stream.destroy()
            reject(new Error('Download timeout'))
          }
        })

        stream.on('end', () => {
          clearTimeout(timeout)
          resolve()
        })

        stream.on('error', (error: Error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })

      videoBuffer = Buffer.concat(chunks)
    } catch (streamError: any) {
      // If stream fails with 410, try direct URL fetch as fallback
      if (streamError.statusCode === 410 || streamError.message?.includes('410')) {
        try {
          console.log('Stream failed, trying direct URL fetch...')
          videoBuffer = await downloadFromUrl(selectedFormat.url, requestOptions.requestOptions.headers)
        } catch (directError: any) {
          // If direct fetch also fails, try other formats
          if (formats.length > 1) {
            // Try the next best format
            const alternativeFormats = formats.filter(f => f !== selectedFormat)
            if (alternativeFormats.length > 0) {
              selectedFormat = alternativeFormats[0]
              try {
                videoBuffer = await downloadFromUrl(selectedFormat.url, requestOptions.requestOptions.headers)
              } catch {
                throw new Error('All download methods failed. The video may be restricted or the format URLs are expired.')
              }
            } else {
              throw new Error('Video format is no longer available. Please try again or select a different quality.')
            }
          } else {
            throw new Error('Video format is no longer available. Please try again or select a different quality.')
          }
        }
      } else {
        throw streamError
      }
    }

    const title = videoInfo.videoDetails.title.replace(/[^\w\s-]/g, '').trim()
    const filename = `${title}.mp4`

    return new NextResponse(videoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': videoBuffer.length.toString(),
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
