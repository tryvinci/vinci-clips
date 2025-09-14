"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

interface Video {
  id: string;
  title: string;
  duration: number;
  videoUrl: string;
  thumbnailUrl?: string;
  createdAt: string;
  hasTranscript: boolean;
}

interface VideoSelectorProps {
  videos: Video[];
  selectedVideo: Video | null;
  onVideoSelect: (video: Video) => void;
}

export const VideoSelector: React.FC<VideoSelectorProps> = ({
  videos,
  selectedVideo,
  onVideoSelect,
}) => {
  if (videos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No videos available for captioning.</p>
        <p className="text-sm mt-2">Upload and process videos first to see them here.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
      {videos.map((video) => (
        <Card
          key={video.id}
          className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
            selectedVideo?.id === video.id
              ? 'bg-purple-900/50 border-purple-500'
              : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50'
          }`}
          onClick={() => onVideoSelect(video)}
        >
          <CardContent className="p-4">
            {/* Video Thumbnail or Placeholder */}
            <div className="aspect-video bg-gray-800 rounded-lg mb-3 flex items-center justify-center">
              {video.thumbnailUrl ? (
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <div className="text-gray-500 text-center">
                  <div className="w-12 h-12 mx-auto mb-2 bg-gray-600 rounded-lg flex items-center justify-center">
                    🎬
                  </div>
                  <span className="text-sm">No Thumbnail</span>
                </div>
              )}
            </div>

            {/* Video Info */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm line-clamp-2" title={video.title}>
                {video.title}
              </h3>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="h-3 w-3" />
                  {Math.floor(video.duration / 60)}:{Math.floor(video.duration % 60).toString().padStart(2, '0')}
                </div>
                
                <Badge
                  variant={video.hasTranscript ? "default" : "destructive"}
                  className="text-xs"
                >
                  {video.hasTranscript ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Ready
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 mr-1" />
                      No Transcript
                    </>
                  )}
                </Badge>
              </div>

              <p className="text-xs text-gray-500">
                {new Date(video.createdAt).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};