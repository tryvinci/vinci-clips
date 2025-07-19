'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface Detection {
  boundingBox?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  x?: number;
  y?: number;
  confidence: number;
  type: 'face' | 'pose';
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
  const [isMediaPipeLoaded, setIsMediaPipeLoaded] = useState(false);
  const [useBasicDetection, setUseBasicDetection] = useState(false);
  
  // MediaPipe instances
  const faceDetectorRef = useRef<any>(null);
  const poseLandmarkerRef = useRef<any>(null);
  
  // Load MediaPipe libraries
  useEffect(() => {
    // Only load on client side
    if (typeof window === 'undefined') return;
    
    const loadMediaPipe = async () => {
      try {
        // Dynamically import MediaPipe (client-side only)
        const { FaceDetector, PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        
        // Initialize MediaPipe with fallback CDN
        let vision;
        try {
          vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
          );
        } catch {
          // Fallback to different CDN
          vision = await FilesetResolver.forVisionTasks(
            'https://unpkg.com/@mediapipe/tasks-vision@latest/wasm'
          );
        }
        
        // Create face detector with CPU fallback
        try {
          faceDetectorRef.current = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
              delegate: 'GPU'
            },
            runningMode: 'VIDEO'
          });
        } catch {
          // Fallback to CPU
          faceDetectorRef.current = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
              delegate: 'CPU'
            },
            runningMode: 'VIDEO'
          });
        }
        
        // Create pose landmarker with CPU fallback
        try {
          poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
              delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numPoses: 1
          });
        } catch {
          // Fallback to CPU
          poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
              delegate: 'CPU'
            },
            runningMode: 'VIDEO',
            numPoses: 1
          });
        }
        
        setIsMediaPipeLoaded(true);
      } catch (err) {
        console.error('Failed to load MediaPipe:', err);
        setError(`Failed to load MediaPipe: ${err instanceof Error ? err.message : 'Unknown error'}. Please check your internet connection and browser compatibility.`);
        // Only use basic detection as a last resort
        setUseBasicDetection(true);
        setIsMediaPipeLoaded(true);
      }
    };
    
    // Add delay to ensure DOM is ready
    const timer = setTimeout(loadMediaPipe, 1000);
    return () => clearTimeout(timer);
  }, [onError]);
  
  // Draw detection overlays on canvas
  const drawDetections = useCallback((detections: Detection[], videoElement: HTMLVideoElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size to match video
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!showOverlay) return;
    
    // Draw detection boxes
    detections.forEach((detection) => {
      if (detection.boundingBox) {
        const { left, top, width, height } = detection.boundingBox;
        const x = left * canvas.width;
        const y = top * canvas.height;
        const w = width * canvas.width;
        const h = height * canvas.height;
        
        // Set style based on detection type
        ctx.strokeStyle = detection.type === 'face' ? '#00ff00' : '#ff6600';
        ctx.lineWidth = 3;
        ctx.fillStyle = detection.type === 'face' ? 'rgba(0,255,0,0.1)' : 'rgba(255,102,0,0.1)';
        
        // Draw bounding box
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        
        // Draw confidence label
        ctx.fillStyle = detection.type === 'face' ? '#00ff00' : '#ff6600';
        ctx.font = '14px Arial';
        ctx.fillText(
          `${detection.type} (${Math.round(detection.confidence * 100)}%)`,
          x,
          y - 5
        );
      } else if (detection.x !== undefined && detection.y !== undefined) {
        // Draw pose landmarks as points
        const x = detection.x * canvas.width;
        const y = detection.y * canvas.height;
        
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  }, [showOverlay]);
  
  // Basic detection fallback (center-focused)
  const basicDetection = useCallback(() => {
    // Create a simple center-focused detection for reframing
    const detections: Detection[] = [
      {
        boundingBox: {
          left: 0.25,
          top: 0.2,
          width: 0.5,
          height: 0.6
        },
        confidence: 0.8,
        type: 'face'
      }
    ];
    return detections;
  }, []);

  // Process video frame for detection
  const processFrame = useCallback(async (videoElement: HTMLVideoElement, timestamp: number) => {
    if (useBasicDetection) {
      return basicDetection();
    }
    
    if (!faceDetectorRef.current || !poseLandmarkerRef.current) return [];
    
    const detections: Detection[] = [];
    
    try {
      // Face detection
      const faceResults = await faceDetectorRef.current.detectForVideo(videoElement, timestamp);
      faceResults.detections?.forEach((detection: any) => {
        detections.push({
          boundingBox: {
            left: detection.boundingBox.originX,
            top: detection.boundingBox.originY,
            width: detection.boundingBox.width,
            height: detection.boundingBox.height
          },
          confidence: detection.categories[0]?.score || 0.5,
          type: 'face'
        });
      });
      
      // Pose detection using PoseLandmarker
      const poseResults = await poseLandmarkerRef.current.detectForVideo(videoElement, timestamp);
      if (poseResults.landmarks && poseResults.landmarks.length > 0) {
        const landmarks = poseResults.landmarks[0]; // Get first person's landmarks
        // Use key landmarks for pose detection (nose, shoulders, hips)
        const keyPoints = [0, 11, 12, 23, 24]; // nose, shoulders, hips
        keyPoints.forEach((index) => {
          if (landmarks[index]) {
            detections.push({
              x: landmarks[index].x,
              y: landmarks[index].y,
              confidence: landmarks[index].visibility || 0.5,
              type: 'pose'
            });
          }
        });
      }
      
    } catch (err) {
      console.error('Detection error:', err);
    }
    
    return detections;
  }, [useBasicDetection, basicDetection]);
  
  // Start subject detection
  const startDetection = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !isMediaPipeLoaded) {
      setError('Video not ready');
      return;
    }
    
    setIsDetecting(true);
    setError(null);
    setProgress(0);
    setDetections([]);
    
    try {
      if (useBasicDetection) {
        // Use basic center detection
        const basicDetections = basicDetection();
        setDetections(basicDetections);
        drawDetections(basicDetections, video);
        onDetectionComplete(basicDetections);
        setProgress(100);
      } else {
        // Use MediaPipe detection on the entire generated clip
        const allDetections: Detection[] = [];
        const sampleRate = 1; // Sample every 1 second for more accuracy
        
        // Process the entire generated clip video
        const duration = video.duration;
        const samples = Math.ceil(duration / sampleRate);
        
        for (let i = 0; i < samples; i++) {
          const currentTime = i * sampleRate;
          
          // Seek to timestamp
          video.currentTime = currentTime;
          await new Promise(resolve => {
            video.onseeked = resolve;
          });
          
          // Wait for video to be ready
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Process frame
          const frameDetections = await processFrame(video, performance.now());
          allDetections.push(...frameDetections);
          
          // Update progress
          const progressPercent = ((i + 1) / samples) * 100;
          setProgress(progressPercent);
          
          // Update visual overlay with current frame detections
          if (frameDetections.length > 0) {
            setDetections(frameDetections);
            drawDetections(frameDetections, video);
          }
        }
        
        // Filter high-confidence detections and prioritize central ones
        const filteredDetections = allDetections.filter(d => d.confidence > 0.6);
        
        // Score detections by centrality and confidence
        const scoredDetections = filteredDetections.map(detection => {
          let centerX = 0.5, centerY = 0.5;
          
          if (detection.boundingBox) {
            centerX = detection.boundingBox.left + detection.boundingBox.width / 2;
            centerY = detection.boundingBox.top + detection.boundingBox.height / 2;
          } else if (detection.x !== undefined && detection.y !== undefined) {
            centerX = detection.x;
            centerY = detection.y;
          }
          
          // Calculate distance from frame center (0.5, 0.5)
          const distanceFromCenter = Math.sqrt(
            Math.pow(centerX - 0.5, 2) + Math.pow(centerY - 0.5, 2)
          );
          
          // Higher score for closer to center and higher confidence
          const centralityScore = 1 - distanceFromCenter;
          const totalScore = (detection.confidence * 0.7) + (centralityScore * 0.3);
          
          return { ...detection, score: totalScore };
        });
        
        // Sort by score and take the best detections
        scoredDetections.sort((a, b) => b.score - a.score);
        
        // For pose detections, group by proximity to avoid duplicates
        const dedupedDetections: Detection[] = [];
        scoredDetections.forEach(detection => {
          if (detection.type === 'face') {
            dedupedDetections.push(detection);
          } else if (detection.type === 'pose') {
            // Only add if not too close to existing pose detection
            const isDuplicate = dedupedDetections.some(existing => 
              existing.type === 'pose' &&
              existing.x !== undefined && detection.x !== undefined &&
              existing.y !== undefined && detection.y !== undefined &&
              Math.abs(existing.x - detection.x) < 0.15 &&
              Math.abs(existing.y - detection.y) < 0.15
            );
            if (!isDuplicate) {
              dedupedDetections.push(detection);
            }
          }
        });
        
        // Limit to top 10 best detections for focused framing
        const finalDetections = dedupedDetections.slice(0, 10);
        
        setDetections(finalDetections);
        onDetectionComplete(finalDetections);
      }
      
    } catch (err) {
      console.error('Detection failed:', err);
      setError('Detection failed. Please try again.');
      onError('Detection process failed');
    } finally {
      setIsDetecting(false);
      setProgress(100);
    }
  }, [isMediaPipeLoaded, useBasicDetection, basicDetection, processFrame, drawDetections, onDetectionComplete, onError]);
  
  // Update canvas when detections change
  useEffect(() => {
    const video = videoRef.current;
    if (video && detections.length > 0) {
      drawDetections(detections, video);
    }
  }, [detections, drawDetections]);
  
  return (
    <div className={`relative ${className}`}>
      {/* Video Element */}
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
        
        {/* Detection Overlay Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none rounded-lg"
          style={{ opacity: showOverlay ? 1 : 0 }}
        />
        
        {/* Toggle Overlay Button */}
        <Button
          variant="outline"
          size="sm"
          className="absolute top-2 right-2 bg-black/50 text-white border-white/20"
          onClick={() => setShowOverlay(!showOverlay)}
        >
          {showOverlay ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </Button>
      </div>
      
      {/* Controls */}
      <div className="mt-4 space-y-3">
        {/* Detection Button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={startDetection}
            disabled={isDetecting || !isMediaPipeLoaded}
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
              Found {detections.filter(d => d.type === 'face').length} faces,{' '}
              {detections.filter(d => d.type === 'pose').length} poses
            </div>
          )}
        </div>
        
        {/* Progress Bar */}
        {isDetecting && (
          <div className="space-y-1">
            <Progress value={progress} className="w-full" />
            <div className="text-sm text-gray-600 text-center">
              Analyzing video frames... {Math.round(progress)}%
            </div>
          </div>
        )}
        
        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        
        {/* Detection Mode Info */}
        {!isMediaPipeLoaded && !useBasicDetection && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading AI detection models...</span>
          </div>
        )}
        
        {useBasicDetection && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 text-yellow-700 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Using basic center-crop detection. Subject will be positioned in center frame.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubjectDetection;