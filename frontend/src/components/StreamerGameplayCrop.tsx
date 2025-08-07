'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Crop, Wand2, Video, Download, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import axios from 'axios';

interface StreamerGameplayCropProps {
  transcriptId: string;
  videoUrl: string;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function StreamerGameplayCrop({ transcriptId, videoUrl }: StreamerGameplayCropProps) {
  // Canvas and video refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State for crop areas
  const [webcamArea, setWebcamArea] = useState<CropArea | null>(null);
  const [gameplayArea, setGameplayArea] = useState<CropArea | null>(null);
  const [currentSelection, setCurrentSelection] = useState<'webcam' | 'gameplay'>('webcam');
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [processedVideo, setProcessedVideo] = useState<string | null>(null);
  
  // UI state
  const [currentTab, setCurrentTab] = useState('select');
  const [webcamScale, setWebcamScale] = useState(40); // Percentage of final video height
  const [webcamPosition, setWebcamPosition] = useState(5); // Percentage from top

  // Initialize canvas when video is loaded
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) return;
    
    const handleVideoLoad = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      drawOverlay();
    };
    
    video.addEventListener('loadedmetadata', handleVideoLoad);
    
    return () => {
      video.removeEventListener('loadedmetadata', handleVideoLoad);
    };
  }, []);

  // Draw the selection overlay on canvas
  const drawOverlay = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw webcam selection if exists
    if (webcamArea) {
      ctx.strokeStyle = '#3b82f6'; // Blue
      ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.fillRect(webcamArea.x, webcamArea.y, webcamArea.width, webcamArea.height);
      ctx.strokeRect(webcamArea.x, webcamArea.y, webcamArea.width, webcamArea.height);
      
      // Label
      ctx.fillStyle = '#3b82f6';
      ctx.font = '16px Arial';
      ctx.fillText('Webcam', webcamArea.x + 5, webcamArea.y + 20);
    }
    
    // Draw gameplay selection if exists
    if (gameplayArea) {
      ctx.strokeStyle = '#f97316'; // Orange
      ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(249, 115, 22, 0.3)';
      ctx.fillRect(gameplayArea.x, gameplayArea.y, gameplayArea.width, gameplayArea.height);
      ctx.strokeRect(gameplayArea.x, gameplayArea.y, gameplayArea.width, gameplayArea.height);
      
      // Label
      ctx.fillStyle = '#f97316';
      ctx.font = '16px Arial';
      ctx.fillText('Gameplay', gameplayArea.x + 5, gameplayArea.y + 20);
    }
  };

  // Handle mouse down for selection start
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    setStartPoint({ x, y });
    setIsSelecting(true);
  };

  // Handle mouse move during selection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // Calculate selection area
    const width = Math.abs(x - startPoint.x);
    const height = Math.abs(y - startPoint.y);
    const selX = Math.min(startPoint.x, x);
    const selY = Math.min(startPoint.y, y);
    
    // Update current selection
    const selectionArea = { x: selX, y: selY, width, height };
    
    if (currentSelection === 'webcam') {
      setWebcamArea(selectionArea);
    } else {
      setGameplayArea(selectionArea);
    }
    
    drawOverlay();
  };

  // Handle mouse up to complete selection
  const handleMouseUp = () => {
    setIsSelecting(false);
  };

  // Process the video with selected areas
  const processVideo = async () => {
    if (!webcamArea || !gameplayArea) {
      setError('Please select both webcam and gameplay areas');
      return;
    }
    
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    
    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 8;
        });
      }, 500);
      
      // Send request to backend
      const response = await axios.post('http://localhost:8080/clips/reframe/streamer-gameplay', {
        transcriptId,
        webcamArea,
        gameplayArea,
        webcamScale,
        webcamPosition,
        outputName: `streamer_gameplay_${Date.now()}.mp4`
      });
      
      clearInterval(progressInterval);
      setProgress(100);
      
      if (response.data.success) {
        setProcessedVideo(response.data.processedVideoUrl);
        setCurrentTab('result');
      } else {
        setError(response.data.error || 'Failed to process video');
      }
      
    } catch (error: any) {
      console.error('Video processing failed:', error);
      setError(error.response?.data?.error || 'Failed to process video');
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate a preview of the final layout
  const renderPreview = () => {
    if (!webcamArea || !gameplayArea) return null;
    
    // Calculate preview dimensions (9:16 aspect ratio)
    const previewWidth = 270;
    const previewHeight = 480;
    
    return (
      <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ width: previewWidth, height: previewHeight }}>
        {/* Webcam section */}
        <div 
          className="absolute bg-blue-100 border-2 border-blue-500"
          style={{ 
            width: '100%', 
            height: `${webcamScale}%`,
            top: `${webcamPosition}%`
          }}
        >
          <div className="flex items-center justify-center h-full text-blue-500">
            <span>Webcam Area</span>
          </div>
        </div>
        
        {/* Gameplay section */}
        <div 
          className="absolute bg-orange-100 border-2 border-orange-500"
          style={{ 
            width: '100%', 
            height: `${100 - webcamScale - webcamPosition}%`,
            top: `${webcamScale + webcamPosition}%`
          }}
        >
          <div className="flex items-center justify-center h-full text-orange-500">
            <span>Gameplay Area</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crop className="h-5 w-5" />
          Streamer + Gameplay Crop
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        
        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="select">Select Areas</TabsTrigger>
            <TabsTrigger value="adjust" disabled={!webcamArea || !gameplayArea}>Adjust Layout</TabsTrigger>
            <TabsTrigger value="result" disabled={!processedVideo}>Result</TabsTrigger>
          </TabsList>
          
          {/* Selection Tab */}
          <TabsContent value="select" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Current Selection:</span>
                  <div className="flex gap-2">
                    <Badge 
                      variant={currentSelection === 'webcam' ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setCurrentSelection('webcam')}
                    >
                      Webcam
                    </Badge>
                    <Badge 
                      variant={currentSelection === 'gameplay' ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setCurrentSelection('gameplay')}
                    >
                      Gameplay
                    </Badge>
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    if (currentSelection === 'webcam') setWebcamArea(null);
                    else setGameplayArea(null);
                    drawOverlay();
                  }}
                >
                  Clear Selection
                </Button>
              </div>
              
              <div className="text-sm text-gray-600">
                {currentSelection === 'webcam' 
                  ? "Select the streamer's webcam area (blue)" 
                  : "Select the gameplay area (orange)"}
              </div>
            </div>
            
            <div className="relative">
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-auto rounded-lg"
                controls
                preload="metadata"
                crossOrigin="anonymous"
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-auto rounded-lg"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            </div>
            
            <div className="flex justify-end">
              <Button 
                onClick={() => setCurrentTab('adjust')}
                disabled={!webcamArea || !gameplayArea}
              >
                Next: Adjust Layout
              </Button>
            </div>
          </TabsContent>
          
          {/* Adjustment Tab */}
          <TabsContent value="adjust" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Webcam Size (% of video height)</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[webcamScale]}
                      onValueChange={(values) => setWebcamScale(values[0])}
                      min={20}
                      max={60}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-8">{webcamScale}%</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Webcam Position (% from top)</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[webcamPosition]}
                      onValueChange={(values) => setWebcamPosition(values[0])}
                      min={0}
                      max={20}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-8">{webcamPosition}%</span>
                  </div>
                </div>
                
                <div className="pt-4">
                  <Button 
                    onClick={processVideo}
                    disabled={isProcessing}
                    className="w-full"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing... {Math.round(progress)}%
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        Process Video
                      </>
                    )}
                  </Button>
                  
                  {isProcessing && (
                    <div className="mt-2 space-y-1">
                      <Progress value={progress} className="w-full" />
                      <p className="text-xs text-center text-gray-500">
                        This may take a few minutes depending on video length
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-center">
                <h3 className="text-sm font-medium mb-3">Preview Layout</h3>
                {renderPreview()}
                <p className="text-xs text-gray-500 mt-2">
                  Final output will be in 9:16 aspect ratio
                </p>
              </div>
            </div>
          </TabsContent>
          
          {/* Result Tab */}
          <TabsContent value="result" className="space-y-4">
            {processedVideo && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="bg-green-100 text-green-800 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Video processed successfully
                  </Badge>
                  <Button 
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a 
                      href={processedVideo}
                      download
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                </div>
                
                <div className="flex justify-center">
                  <div className="relative" style={{ width: '270px', height: '480px' }}>
                    <video 
                      src={processedVideo}
                      controls
                      className="w-full h-full rounded-lg"
                      preload="metadata"
                    />
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}