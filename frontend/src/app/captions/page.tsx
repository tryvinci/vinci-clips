"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, Clock, Film, Sparkles } from 'lucide-react';
import { VideoSelector } from '@/components/VideoSelector';
import { CaptionStyleSelector } from '@/components/CaptionStyleSelector';
import { CaptionPreview } from '@/components/CaptionPreview';

interface Video {
  id: string;
  title: string;
  duration: number;
  videoUrl: string;
  thumbnailUrl?: string;
  createdAt: string;
  hasTranscript: boolean;
}

interface CaptionStyle {
  name: string;
  description: string;
  preview: string;
}

export default function RemotionCaptionsPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [captionStyles, setCaptionStyles] = useState<Record<string, CaptionStyle>>({});
  const [selectedStyle, setSelectedStyle] = useState<string>('modern');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch available videos on component mount
  useEffect(() => {
    fetchVideos();
    fetchCaptionStyles();
  }, []);

  const fetchVideos = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/clips/remotion-captions/videos`);
      const data = await response.json();
      
      if (data.success) {
        setVideos(data.videos);
      } else {
        setError(data.error || 'Failed to fetch videos');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Error fetching videos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCaptionStyles = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/clips/remotion-captions/styles`);
      const data = await response.json();
      
      if (data.success) {
        setCaptionStyles(data.styles);
      }
    } catch (err) {
      console.error('Error fetching caption styles:', err);
    }
  };

  const generateCaptionedVideo = async () => {
    if (!selectedVideo) return;

    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/clips/remotion-captions/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcriptId: selectedVideo.id,
          style: selectedStyle,
          captionSettings: {
            fontSize: 48,
            fontFamily: 'Arial',
            color: '#FFFFFF',
            position: 'bottom'
          }
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setGeneratedVideoUrl(data.captionedVideoUrl);
      } else {
        setError(data.error || 'Failed to generate captioned video');
      }
    } catch (err) {
      setError('Failed to generate captioned video');
      console.error('Error generating captions:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-purple-400" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Remotion Captions
            </h1>
          </div>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Create stunning, AI-powered captions with advanced animations and effects using Remotion technology
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-600 rounded-lg text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Video Selection */}
          <div className="lg:col-span-2">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Film className="h-5 w-5" />
                  Select Video to Caption
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2">Loading videos...</span>
                  </div>
                ) : (
                  <VideoSelector
                    videos={videos}
                    selectedVideo={selectedVideo}
                    onVideoSelect={setSelectedVideo}
                  />
                )}
              </CardContent>
            </Card>

            {/* Caption Style Selection */}
            {selectedVideo && (
              <Card className="bg-gray-800/50 border-gray-700 mt-6">
                <CardHeader>
                  <CardTitle>Choose Caption Style</CardTitle>
                </CardHeader>
                <CardContent>
                  <CaptionStyleSelector
                    styles={captionStyles}
                    selectedStyle={selectedStyle}
                    onStyleSelect={setSelectedStyle}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Preview and Generation */}
          <div>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle>Preview & Generate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedVideo ? (
                  <>
                    <div className="space-y-2">
                      <h3 className="font-semibold">{selectedVideo.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Clock className="h-4 w-4" />
                        {Math.floor(selectedVideo.duration / 60)}:{Math.floor(selectedVideo.duration % 60).toString().padStart(2, '0')}
                      </div>
                      <Badge variant={selectedVideo.hasTranscript ? "default" : "destructive"}>
                        {selectedVideo.hasTranscript ? "Transcript Available" : "No Transcript"}
                      </Badge>
                    </div>

                    {selectedVideo.hasTranscript && (
                      <Button
                        onClick={generateCaptionedVideo}
                        disabled={isGenerating}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Generating Captions...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate Captioned Video
                          </>
                        )}
                      </Button>
                    )}

                    {!selectedVideo.hasTranscript && (
                      <p className="text-sm text-gray-400">
                        This video needs to be transcribed before captions can be generated.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-gray-400">Select a video to get started</p>
                )}
              </CardContent>
            </Card>

            {/* Generated Video Preview */}
            {generatedVideoUrl && (
              <Card className="bg-gray-800/50 border-gray-700 mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="h-5 w-5" />
                    Generated Video
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CaptionPreview videoUrl={generatedVideoUrl} />
                  <Button
                    className="w-full mt-4"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = `${process.env.NEXT_PUBLIC_API_URL}${generatedVideoUrl}`;
                      link.download = 'captioned-video.mp4';
                      link.click();
                    }}
                  >
                    Download Video
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}