'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import * as faceapi from 'face-api.js';

interface Detection {
  boundingBox: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  confidence: number;
  type: 'face';
  id?: number; // Add ID for tracking
}

interface SubjectDetectionProps {
  videoUrl: string;
  onDetectionComplete: (detections: Detection[]) => void;
  onError: (error: string) => void;
  className?: string;
}

const SubjectDetection: React.FC<SubjectDetectionProps> = ({
  videoUrl,
  onDetectionComplete,
  onError,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [showOverlay, setShowOverlay] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFaceApiLoaded, setIsFaceApiLoaded] = useState(false);
  
  const trackedFaces = useRef<{ id: number; descriptor: Float32Array; lastSeen: number }[]>([]).current;
  let nextFaceId = useRef(0).current;

  useEffect(() => {
    const loadFaceApiModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        setIsFaceApiLoaded(true);
      } catch (err) {
        console.error('Failed to load face-api.js models:', err);
        setError('Failed to load AI models. Please check your internet connection.');
        onError('Failed to load AI models.');
      }
    };
    loadFaceApiModels();
  }, [onError]);

  const drawDetections = useCallback((detections: Detection[], videoElement: HTMLVideoElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!showOverlay) return;

    detections.forEach((detection) => {
      const { left, top, width, height } = detection.boundingBox;
      const x = left * canvas.width;
      const y = top * canvas.height;
      const w = width * canvas.width;
      const h = height * canvas.height;

      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = '#00ff00';
      ctx.font = '14px Arial';
      ctx.fillText(`ID: ${detection.id} (${Math.round(detection.confidence * 100)}%)`, x, y - 5);
    });
  }, [showOverlay]);

  const processFrame = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!isFaceApiLoaded) return [];

    const results = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
    const newDetections: Detection[] = [];

    for (const result of results) {
      const { detection, descriptor } = result;
      const box = detection.box;
      
      let bestMatch = { distance: 0.6, id: -1 };
      for (const face of trackedFaces) {
        const distance = faceapi.euclideanDistance(descriptor, face.descriptor);
        if (distance < bestMatch.distance) {
          bestMatch = { distance, id: face.id };
        }
      }

      let finalId = bestMatch.id;
      if (bestMatch.id !== -1) {
        const trackedFace = trackedFaces.find(f => f.id === bestMatch.id);
        if (trackedFace) {
            trackedFace.descriptor = descriptor; // Update descriptor
            trackedFace.lastSeen = Date.now();
        }
      } else {
        finalId = nextFaceId++;
        trackedFaces.push({ id: finalId, descriptor, lastSeen: Date.now() });
      }

      newDetections.push({
        boundingBox: {
          left: box.x / videoElement.videoWidth,
          top: box.y / videoElement.videoHeight,
          width: box.width / videoElement.videoWidth,
          height: box.height / videoElement.videoHeight,
        },
        confidence: detection.score,
        type: 'face',
        id: finalId,
      });
    }
    
    // Prune old faces
    const now = Date.now();
    for (let i = trackedFaces.length - 1; i >= 0; i--) {
        if (now - trackedFaces[i].lastSeen > 2000) { // 2 seconds
            trackedFaces.splice(i, 1);
        }
    }

    return newDetections;
  }, [isFaceApiLoaded, trackedFaces, nextFaceId]);

  const startDetection = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !isFaceApiLoaded) {
      setError('Video or AI models not ready.');
      return;
    }

    setIsDetecting(true);
    setError(null);
    setProgress(0);
    setDetections([]);
    trackedFaces.length = 0;
    nextFaceId = 0;

    try {
      const allDetections: Detection[] = [];
      const sampleRate = 0.5; // Sample every 0.5 seconds
      const duration = video.duration;
      const samples = Math.ceil(duration / sampleRate);

      for (let i = 0; i < samples; i++) {
        const currentTime = i * sampleRate;
        video.currentTime = currentTime;
        await new Promise(resolve => { video.onseeked = resolve; });
        await new Promise(resolve => setTimeout(resolve, 100));

        const frameDetections = await processFrame(video);
        allDetections.push(...frameDetections.map(d => ({...d, time: currentTime})));
        
        const progressPercent = ((i + 1) / samples) * 100;
        setProgress(progressPercent);

        if (frameDetections.length > 0) {
          setDetections(frameDetections);
          drawDetections(frameDetections, video);
        }
      }
      
      onDetectionComplete(allDetections);

    } catch (err) {
      console.error('Detection failed:', err);
      setError('Detection failed. Please try again.');
      onError('Detection process failed');
    } finally {
      setIsDetecting(false);
      setProgress(100);
    }
  }, [isFaceApiLoaded, processFrame, drawDetections, onDetectionComplete, onError, trackedFaces]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && detections.length > 0) {
      drawDetections(detections, video);
    }
  }, [detections, drawDetections]);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-auto max-h-96 rounded-lg"
          controls
          preload="metadata"
          crossOrigin="anonymous"
          onLoadedData={() => {
            const video = videoRef.current;
            if (video && canvasRef.current) {
              canvasRef.current.width = video.videoWidth;
              canvasRef.current.height = video.videoHeight;
            }
          }}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none rounded-lg"
          style={{ opacity: showOverlay ? 1 : 0 }}
        />
        <Button
          variant="outline"
          size="sm"
          className="absolute top-2 right-2 bg-black/50 text-white border-white/20"
          onClick={() => setShowOverlay(!showOverlay)}
        >
          {showOverlay ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </Button>
      </div>
      
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-3">
          <Button
            onClick={startDetection}
            disabled={isDetecting || !isFaceApiLoaded}
            className="flex-1"
          >
            {isDetecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing Subjects...
              </>
            ) : (
              'Detect Subjects'
            )}
          </Button>
          
          {detections.length > 0 && (
            <div className="text-sm text-green-600">
              Found {new Set(detections.map(d => d.id)).size} unique faces.
            </div>
          )}
        </div>
        
        {isDetecting && (
          <div className="space-y-1">
            <Progress value={progress} className="w-full" />
            <div className="text-sm text-gray-600 text-center">
              Analyzing video frames... {Math.round(progress)}%
            </div>
          </div>
        )}
        
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        
        {!isFaceApiLoaded && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading AI detection models...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubjectDetection;