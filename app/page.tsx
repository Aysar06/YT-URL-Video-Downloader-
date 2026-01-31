'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Download, Loader2, AlertCircle } from 'lucide-react'
import { isValidYouTubeUrl } from '@/lib/utils'

export default function Home() {
  const [url, setUrl] = useState('')
  const [quality, setQuality] = useState('1080p')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async () => {
    setError(null)
    
    if (!url.trim()) {
      setError('Please enter a YouTube URL')
      return
    }

    if (!isValidYouTubeUrl(url)) {
      setError('Please enter a valid YouTube URL')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, quality }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to download video')
      }

      // Get the blob from response
      const blob = await response.blob()
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'video.mp4'
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '')
          // Decode URI component if needed
          try {
            filename = decodeURIComponent(filename)
          } catch (e) {
            // If decoding fails, use as is
          }
        }
      }

      // Create a temporary link and trigger download
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)

      setUrl('') // Clear URL after successful download
    } catch (err: any) {
      setError(err.message || 'An error occurred while downloading the video')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              YouTube Video Downloader
            </h1>
            <p className="text-muted-foreground">
              Download YouTube videos in high quality MP4 format with audio
            </p>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Download Video</CardTitle>
              <CardDescription>
                Paste a YouTube URL and select your preferred quality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="url" className="text-sm font-medium">
                  YouTube URL
                </label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading) {
                      handleDownload()
                    }
                  }}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="quality" className="text-sm font-medium">
                  Video Quality
                </label>
                <Select value={quality} onValueChange={setQuality} disabled={loading}>
                  <SelectTrigger id="quality">
                    <SelectValue placeholder="Select quality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                    <SelectItem value="1440p">1440p (2K)</SelectItem>
                    <SelectItem value="2160p">2160p (4K UHD)</SelectItem>
                    <SelectItem value="4320p">4320p (8K)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                onClick={handleDownload}
                disabled={loading || !url.trim()}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Download Video
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>
              Note: Downloads are limited to 10 requests per minute per IP address.
              Videos are downloaded in MP4 format with audio included.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
