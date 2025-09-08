'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Crop, Wand2, Download, Loader2, AlertCircle, CheckCircle, Info, RotateCcw } from 'lucide-react';
import axios from 'axios';


const API_URL = process.env.NEXT_PUBLIC_API_URL;

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

// The core component logic is moved here. It will be re-mounted when the key changes.
function StreamerGameplayCropComponent({ transcriptId, videoUrl, onRestart }: StreamerGameplayCropProps & { onRestart: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  
  const [webcamArea, setWebcamArea] = useState<CropArea | null>(null);
  const [gameplayArea, setGameplayArea] = useState<CropArea | null>(null);
  const [currentSelection, setCurrentSelection] = useState<'webcam' | 'gameplay'>('webcam');
  
  const [interaction, setInteraction] = useState({
    mode: 'idle' as 'idle' | 'drawing' | 'moving' | 'resizing',
    target: null as 'webcam' | 'gameplay' | null,
    resizeHandle: null as string | null,
    startPoint: { x: 0, y: 0 },
    dragOffset: { x: 0, y: 0 },
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [processedVideo, setProcessedVideo] = useState<string | null>(null);
  
  const [currentTab, setCurrentTab] = useState('select');
  const [webcamScale, setWebcamScale] = useState(30);
  const [webcamPosition, setWebcamPosition] = useState(0);

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const getHandlesForArea = (area: CropArea) => {
        const { x, y, width, height } = area;
        return {
          topLeft: { x, y }, 
          topRight: { x: x + width, y }, 
          bottomLeft: { x, y: y + height }, 
          bottomRight: { x: x + width, y: y + height },
        };
    };

    const drawArea = (area: CropArea | null, color: string, label: string, isActive: boolean) => {
      if (!area) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = isActive ? 4 : 2;
      ctx.fillStyle = `${color}33`;
      ctx.fillRect(area.x, area.y, area.width, area.height);
      ctx.strokeRect(area.x, area.y, area.width, area.height);
      
      ctx.fillStyle = color;
      ctx.font = 'bold 16px Arial';
      ctx.fillText(label, area.x + 8, area.y + 22);

      if (isActive) {
        ctx.fillStyle = '#ffffff';
        const handles = getHandlesForArea(area);
        const HANDLE_SIZE = 4;
        for (const name in handles) {
          const handle = handles[name as keyof typeof handles];
          ctx.strokeRect(handle.x - HANDLE_SIZE / 2, handle.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
          ctx.fillRect(handle.x - HANDLE_SIZE / 2, handle.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        }
      }
    };

    drawArea(webcamArea, '#3b82f6', 'Webcam', currentSelection === 'webcam');
    drawArea(gameplayArea, '#f97316', 'Gameplay', currentSelection === 'gameplay');
  }, [webcamArea, gameplayArea, currentSelection]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const setupCanvas = () => {
      if (video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        if (video.duration) video.currentTime = video.duration / 2;
      }
    };
    
    const handleSeeked = () => drawOverlay();

    video.addEventListener('loadedmetadata', setupCanvas);
    video.addEventListener('seeked', handleSeeked);

    return () => {
      video.removeEventListener('loadedmetadata', setupCanvas);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, [drawOverlay]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const isPointInArea = (point: { x: number; y: number }, area: CropArea | null) => {
    if (!area) return false;
    return point.x >= area.x && point.x <= area.x + area.width && point.y >= area.y && point.y <= area.y + area.height;
  };

  const getHandleAtPoint = (point: { x: number; y: number }, area: CropArea) => {
    const HANDLE_SIZE = 8;
    const handles = {
        topLeft: { x: area.x, y: area.y }, 
        topRight: { x: area.x + area.width, y: area.y },
        bottomLeft: { x: area.x, y: area.y + area.height }, 
        bottomRight: { x: area.x + area.width, y: area.y + area.height },
    };
    for (const name in handles) {
      const handle = handles[name as keyof typeof handles];
      if (Math.abs(point.x - handle.x) < HANDLE_SIZE && Math.abs(point.y - handle.y) < HANDLE_SIZE) return name;
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasCoords(e);
    const activeArea = currentSelection === 'webcam' ? webcamArea : gameplayArea;
    if (activeArea) {
      const handle = getHandleAtPoint(point, activeArea);
      if (handle) {
        setInteraction({ mode: 'resizing', target: currentSelection, resizeHandle: handle, startPoint: point, dragOffset: { x: 0, y: 0 } });
        return;
      }
      if (isPointInArea(point, activeArea)) {
        setInteraction({ mode: 'moving', target: currentSelection, resizeHandle: null, startPoint: point, dragOffset: { x: point.x - activeArea.x, y: point.y - activeArea.y } });
        return;
      }
    }
    setInteraction({ mode: 'drawing', target: currentSelection, resizeHandle: null, startPoint: point, dragOffset: { x: 0, y: 0 } });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasCoords(e);
    const canvas = canvasRef.current!;
    if (interaction.mode === 'idle') {
      const activeArea = currentSelection === 'webcam' ? webcamArea : gameplayArea;
      let cursor = 'crosshair';
      if (activeArea) {
        const handle = getHandleAtPoint(point, activeArea);
        if (handle) {
          if (handle === 'topLeft' || handle === 'bottomRight') cursor = 'nwse-resize';
          else if (handle === 'topRight' || handle === 'bottomLeft') cursor = 'nesw-resize';
        } else if (isPointInArea(point, activeArea)) {
          cursor = 'move';
        }
      }
      canvas.style.cursor = cursor;
      return;
    }

    let newArea: CropArea | null = null;
    const { mode, target, resizeHandle, startPoint, dragOffset } = interaction;
    const area = target === 'webcam' ? webcamArea : gameplayArea;

    if (mode === 'drawing') {
      newArea = {
        x: Math.min(point.x, startPoint.x),
        y: Math.min(point.y, startPoint.y),
        width: Math.abs(point.x - startPoint.x),
        height: Math.abs(point.y - startPoint.y),
      };
    } else if (mode === 'moving' && area) {
      newArea = { ...area, x: point.x - dragOffset.x, y: point.y - dragOffset.y };
    } else if (mode === 'resizing' && area && resizeHandle) {
      let { x, y, width, height } = area;
      const originalRight = x + width;
      const originalBottom = y + height;

      switch (resizeHandle) {
        case 'topLeft':
          x = point.x;
          y = point.y;
          width = originalRight - point.x;
          height = originalBottom - point.y;
          break;
        case 'topRight':
          y = point.y;
          width = point.x - x;
          height = originalBottom - point.y;
          break;
        case 'bottomLeft':
          x = point.x;
          width = originalRight - point.x;
          height = point.y - y;
          break;
        case 'bottomRight':
          width = point.x - x;
          height = point.y - y;
          break;
      }
      
      if (width < 0) {
        x = x + width;
        width = Math.abs(width);
      }
      if (height < 0) {
        y = y + height;
        height = Math.abs(height);
      }

      newArea = { x, y, width, height };
    }

    if (newArea) {
      if (target === 'webcam') setWebcamArea(newArea);
      else setGameplayArea(newArea);
      requestAnimationFrame(drawOverlay);
    }
  };

  const handleMouseUp = () => {
    setInteraction({ mode: 'idle', target: null, resizeHandle: null, startPoint: { x: 0, y: 0 }, dragOffset: { x: 0, y: 0 } });
    requestAnimationFrame(drawOverlay);
  };

  const processVideo = async () => {
    if (!webcamArea || !gameplayArea) {
      setError('Please select both webcam and gameplay areas');
      return;
    }
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    try {
      const progressInterval = setInterval(() => setProgress(prev => Math.min(prev + Math.random() * 8, 90)), 500);
      const response = await axios.post(`${API_URL}/clips/streamer/streamer-gameplay`, {
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
        const fullUrl = `${API_URL}${response.data.processedVideoUrl}`;
        setProcessedVideo(fullUrl);
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

  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const previewBox = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!previewBox) return;
    
    const newY = e.clientY - previewBox.top;
    const newBoundary = (newY / previewBox.height) * 100;
    
    const newScale = newBoundary - webcamPosition;
    
    const constrainedScale = Math.max(20, Math.min(60, newScale));
    setWebcamScale(constrainedScale);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const renderPreview = () => {
    if (!webcamArea || !gameplayArea) return null;
    const previewWidth = 270;
    const previewHeight = 480;
    const boundaryPosition = webcamPosition + webcamScale;

    return (
      <div 
        className="relative bg-gray-900 rounded-lg overflow-hidden select-none" 
        style={{ width: previewWidth, height: previewHeight }}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        <div className="absolute bg-blue-100 border-2 border-blue-500" style={{ width: '100%', height: `${webcamScale}%`, top: `${webcamPosition}%` }}>
          <div className="flex items-center justify-center h-full text-blue-500"><span>Webcam</span></div>
        </div>
        
        <div 
          className="absolute w-full h-2 bg-gray-500 hover:bg-yellow-400 cursor-ns-resize z-10"
          style={{ top: `calc(${boundaryPosition}% - 4px)` }}
          onMouseDown={handleDragStart}
        />

        <div className="absolute bg-orange-100 border-2 border-orange-500" style={{ width: '100%', height: `${100 - boundaryPosition}%`, top: `${boundaryPosition}%` }}>
          <div className="flex items-center justify-center h-full text-orange-500"><span>Gameplay</span></div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Crop className="h-5 w-5" />Streamer + Gameplay Crop</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="p-3 bg-red-100 border-red-300 text-red-700 rounded flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</div>}
        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="select">Select Areas</TabsTrigger>
            <TabsTrigger value="adjust" disabled={!webcamArea || !gameplayArea}>Adjust Layout</TabsTrigger>
            <TabsTrigger value="result" disabled={!processedVideo}>Result</TabsTrigger>
          </TabsList>
          <TabsContent value="select" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Current Selection:</span>
                  <div className="flex gap-2">
                    <Badge variant={currentSelection === 'webcam' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setCurrentSelection('webcam')}>Webcam</Badge>
                    <Badge variant={currentSelection === 'gameplay' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setCurrentSelection('gameplay')}>Gameplay</Badge>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  if (currentSelection === 'webcam') setWebcamArea(null); else setGameplayArea(null);
                  drawOverlay();
                }}>Clear Selection</Button>
              </div>
              <div className="text-sm text-gray-600">{currentSelection === 'webcam' ? "click and drag to select the streamer's webcam area (blue)" : "Select the gameplay area (orange)"}</div>
            </div>
            <div className="relative">
              <video ref={videoRef} src={videoUrl} className="w-full h-auto rounded-lg" preload="metadata" crossOrigin="anonymous" />
              <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-auto rounded-lg" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} />
            </div>
            <div className="flex justify-end"><Button onClick={() => setCurrentTab('adjust')} disabled={!webcamArea || !gameplayArea}>Next: Adjust Layout</Button></div>
          </TabsContent>
          <TabsContent value="adjust" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                 <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg">
                  <Info className="h-5 w-5 flex-shrink-0" />
                  <p className="text-sm">Tip: The default 30% webcam size is optimized for most platforms, but feel free to adjust!</p>
                </div>
                <p className="text-sm text-muted-foreground pt-2">Adjust layout with the sliders, or drag the divider on the preview.</p>
                <div className="space-y-2">
                  <Label>Webcam Size (% of video height)</Label>
                  <div className="flex items-center gap-4">
                    <Slider value={[webcamScale]} onValueChange={(v) => setWebcamScale(v[0])} min={20} max={60} step={1} className="flex-1" />
                    <span className="text-sm font-medium w-8">{webcamScale}%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Webcam Position (% from top)</Label>
                  <div className="flex items-center gap-4">
                    <Slider value={[webcamPosition]} onValueChange={(v) => setWebcamPosition(v[0])} min={0} max={20} step={1} className="flex-1" />
                    <span className="text-sm font-medium w-8">{webcamPosition}%</span>
                  </div>
                </div>
                <div className="pt-4">
                  <Button onClick={processVideo} disabled={isProcessing} className="w-full">{isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing... {Math.round(progress)}%</> : <><Wand2 className="w-4 h-4 mr-2" />Process Video</>}</Button>
                  {isProcessing && <div className="mt-2 space-y-1"><Progress value={progress} className="w-full" /><p className="text-xs text-center text-gray-500">This may take a few minutes</p></div>}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <h3 className="text-sm font-medium mb-3">Preview Layout</h3>
                {renderPreview()}
                <p className="text-xs text-gray-500 mt-2">Final output will be 9:16</p>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="result" className="space-y-4">
            {processedVideo && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="bg-green-100 text-green-800 flex items-center gap-1"><CheckCircle className="w-4 h-4" />Video processed</Badge>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={onRestart}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restart
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={processedVideo} download>
                        <Download className="h-4 h-4 mr-2" />
                        Download
                      </a>
                    </Button>
                  </div>
                </div>
                <div className="flex justify-center"><div className="relative" style={{ width: '270px', height: '480px' }}><video src={processedVideo} controls className="w-full h-full rounded-lg" preload="metadata" /></div></div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// This is the new stateful wrapper component that will be exported.
export default function StreamerGameplayCrop(props: StreamerGameplayCropProps) {
  const [key, setKey] = useState(0);

  const handleRestart = () => {
    setKey(prevKey => prevKey + 1);
  };

  return <StreamerGameplayCropComponent {...props} key={key} onRestart={handleRestart} />;
}