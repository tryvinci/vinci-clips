"use client";

import React, { useRef, useEffect } from 'react';

interface CaptionPreviewProps {
  videoUrl: string;
}

export const CaptionPreview: React.FC<CaptionPreviewProps> = ({ videoUrl }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [videoUrl]);

  return (
    <div className="space-y-4">
      <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          controls
          className="w-full h-full object-cover"
          poster="/placeholder-video.png"
        >
          <source src={`${process.env.NEXT_PUBLIC_API_URL}${videoUrl}`} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
      
      <div className="text-center">
        <p className="text-sm text-gray-400">
          Your captioned video is ready! Preview it above and download when you're satisfied.
        </p>
      </div>
    </div>
  );
};