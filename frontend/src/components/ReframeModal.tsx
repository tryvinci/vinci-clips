'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Smartphone, 
  Square, 
  Monitor, 
  Download, 
  Loader2, 
  Wand2, 
  Settings, 
  Eye,
  AlertCircle,
  CheckCircle,
  Type
} from 'lucide-react';
import SubjectDetection from './SubjectDetection';
import axios from 'axios';

interface Platform {
  id: string;
  name: string;
  aspectRatio: string;
  width: number;
  height: number;
  icon: React.ReactNode;
  description: string;
}

interface CropParameters {
  width: number;
  height: number;
  x: number;
  y: number;
  centerX: number;
  centerY: number;
}

interface ReframedVideo {
  filename: string;
  url: string;
  platform: string;
  platformName: string;
  aspectRatio: string;
  cropParameters: CropParameters;
}

interface CaptionStyle {
  id: string;
  name: string;
  description: string;
}

interface ReframeModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcriptId: string;
  videoUrl: string;
  originalFilename: string;
  videoDimensions?: { width: number; height: number };
  generatedClipUrl?: string;
}

const PLATFORMS: Platform[] = [
  {
    id: 'tiktok',
    name: 'TikTok/Shorts',
    aspectRatio: '9:16',
    width: 9,
    height: 16,
    icon: <Smartphone className="w-5 h-5" />,
    description: 'Vertical format for TikTok, YouTube Shorts, Instagram Reels'
  },
  {
    id: 'instagram',
    name: 'Instagram Square',
    aspectRatio: '1:1',
    width: 1,
    height: 1,
    icon: <Square className="w-5 h-5" />,
    description: 'Square format for Instagram feed posts'
  },
  {
    id: 'youtube',
    name: 'YouTube Landscape',
    aspectRatio: '16:9',
    width: 16,
    height: 9,
    icon: <Monitor className="w-5 h-5" />,
    description: 'Widescreen format for YouTube, Facebook, LinkedIn'
  },
  {
    id: 'story',
    name: 'Stories',
    aspectRatio: '9:16',
    width: 9,
    height: 16,
    icon: <Smartphone className="w-5 h-5" />,
    description: 'Vertical format for Instagram/Facebook Stories'
  }
];

const ReframeModal: React.FC<ReframeModalProps> = ({
  isOpen,
  onClose,
  transcriptId,
  videoUrl,
  originalFilename,
  videoDimensions,
  generatedClipUrl
}) => {
  // Convert GCS URL to proxied URL for CORS
  const getProxiedVideoUrl = (originalUrl: string) => {
    if (originalUrl.includes('storage.googleapis.com')) {
      const filename = originalUrl.split('/').pop()?.split('?')[0];
      return `http://localhost:8080/clips/video-proxy/${filename}`;
    }
    return originalUrl;
  };
  
  const proxiedVideoUrl = getProxiedVideoUrl(videoUrl);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('tiktok');
  const [currentTab, setCurrentTab] = useState<string>('detect');
  const [detections, setDetections] = useState<any[]>([]);
  const [cropParameters, setCropParameters] = useState<CropParameters | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [reframedVideo, setReframedVideo] = useState<ReframedVideo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outputName, setOutputName] = useState<string>('');
  
  // Caption-related state
  const [captionStyles, setCaptionStyles] = useState<CaptionStyle[]>([]);
  const [selectedCaptionStyle, setSelectedCaptionStyle] = useState<string>('');
  const [addCaptions, setAddCaptions] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);

  // Initialize output name when modal opens
  useEffect(() => {
    if (isOpen && originalFilename) {
      const platform = PLATFORMS.find(p => p.id === selectedPlatform);
      const baseName = originalFilename.replace(/\.[^.]+$/, '');
      setOutputName(`${baseName}_${platform?.name.replace(/\s+/g, '_').toLowerCase()}_reframed.mp4`);
      
      // Reset timing for generated clips (they are already the final duration)
      setStartTime(0);
      setEndTime(0);
    }
  }, [isOpen, originalFilename, selectedPlatform]);

  // Fetch caption styles when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCaptionStyles();
    }
  }, [isOpen]);

  const fetchCaptionStyles = async () => {
    try {
      const response = await axios.get('http://localhost:8080/clips/captions/styles');
      setCaptionStyles(response.data.styles);
      if (response.data.styles.length > 0) {
        setSelectedCaptionStyle(response.data.styles[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch caption styles:', error);
    }
  };

  // Handle subject detection completion
  const handleDetectionComplete = async (detectionResults: any[]) => {
    setDetections(detectionResults);
    setError(null);
    
    // Limit to top 20 most confident detections to avoid backend overload
    const limitedDetections = detectionResults
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20);
    
    try {
      setIsAnalyzing(true);
      
      const response = await axios.post('http://localhost:8080/clips/reframe/analyze', {
        transcriptId,
        targetPlatform: selectedPlatform,
        detections: JSON.stringify(limitedDetections),
        generatedClipUrl: generatedClipUrl // Use the generated clip URL instead of timing
      });
      
      if (response.data.success) {
        setCropParameters(response.data.analysis.cropParameters);
        setPreviewUrl(response.data.analysis.previewUrl);
        setCurrentTab('preview');
      } else {
        setError('Failed to analyze video for reframing');
      }
      
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.response?.data?.error || 'Failed to analyze video');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle detection error
  const handleDetectionError = (errorMessage: string) => {
    setError(errorMessage);
  };

  // Generate reframed video
  const handleGenerate = async () => {
    if (!cropParameters) {
      setError('No crop parameters available. Please analyze the video first.');
      return;
    }
    
    try {
      setIsGenerating(true);
      setGenerationProgress(0);
      setError(null);
      
      // Simulate progress (since we don't have real-time progress from backend)
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 500);
      
      const response = await axios.post('http://localhost:8080/clips/reframe/generate', {
        transcriptId,
        targetPlatform: selectedPlatform,
        cropParameters,
        detections: detections, // Pass detections through
        outputName: outputName,
        generatedClipUrl: generatedClipUrl, // Use generated clip instead of timing
        captions: addCaptions ? {
          enabled: true,
          style: selectedCaptionStyle
        } : { enabled: false }
      });
      
      clearInterval(progressInterval);
      setGenerationProgress(100);
      
      if (response.data.success) {
        setReframedVideo(response.data.reframedVideo);
        setCurrentTab('result');
      } else {
        setError('Failed to generate reframed video');
      }
      
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.response?.data?.error || 'Failed to generate reframed video');
    } finally {
      setIsGenerating(false);
    }
  };

  // Manual crop adjustment
  const handleCropAdjustment = async (newCrop: Partial<CropParameters>) => {
    if (!cropParameters) return;
    
    const updatedCrop = { ...cropParameters, ...newCrop };
    setCropParameters(updatedCrop);
    
    try {
      const response = await axios.post('http://localhost:8080/clips/reframe/adjust', {
        transcriptId,
        targetPlatform: selectedPlatform,
        cropParameters: updatedCrop
      });
      
      if (response.data.success) {
        setPreviewUrl(response.data.preview.url);
      }
    } catch (err) {
      console.error('Crop adjustment error:', err);
    }
  };

  // Reset modal state
  const resetModal = () => {
    setCurrentTab('detect');
    setDetections([]);
    setCropParameters(null);
    setPreviewUrl(null);
    setReframedVideo(null);
    setError(null);
    setIsAnalyzing(false);
    setIsGenerating(false);
    setGenerationProgress(0);
  };

  // Handle modal close
  const handleClose = () => {
    resetModal();
    onClose();
  };

  const selectedPlatformData = PLATFORMS.find(p => p.id === selectedPlatform);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            AI Video Reframing
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Platform Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Select Target Platform</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {PLATFORMS.map((platform) => (
                <Card 
                  key={platform.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedPlatform === platform.id 
                      ? 'ring-2 ring-blue-500 bg-blue-50' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedPlatform(platform.id)}
                >
                  <CardContent className="p-4 text-center">
                    <div className="flex flex-col items-center gap-2">
                      {platform.icon}
                      <div className="font-medium text-sm">{platform.name}</div>
                      <Badge variant="outline" className="text-xs">
                        {platform.aspectRatio}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {selectedPlatformData && (
              <p className="text-sm text-gray-600">
                {selectedPlatformData.description}
              </p>
            )}
          </div>

          {/* Main Content Tabs */}
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="detect" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Detect
              </TabsTrigger>
              <TabsTrigger value="preview" disabled={!cropParameters}>
                Preview
              </TabsTrigger>
              <TabsTrigger value="captions" className="flex items-center gap-2">
                <Type className="w-4 h-4" />
                Captions
              </TabsTrigger>
              <TabsTrigger value="settings" disabled={!cropParameters}>
                <Settings className="w-4 h-4" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="result" disabled={!reframedVideo}>
                Result
              </TabsTrigger>
            </TabsList>

            {/* Subject Detection Tab */}
            <TabsContent value="detect" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    AI Subject Detection
                  </CardTitle>
                  <CardDescription>
                    Our AI will analyze your video to detect faces and poses for optimal framing.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SubjectDetection
                    videoUrl={proxiedVideoUrl}
                    onDetectionComplete={handleDetectionComplete}
                    onError={handleDetectionError}
                  />
                  
                  {isAnalyzing && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="font-medium">Calculating optimal crop...</span>
                      </div>
                      <Progress value={75} className="w-full" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="space-y-4">
              {previewUrl && cropParameters && (
                <Card>
                  <CardHeader>
                    <CardTitle>Reframing Preview</CardTitle>
                    <CardDescription>
                      Preview how your video will look after reframing to {selectedPlatformData?.aspectRatio}.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Reframed Preview</Label>
                        <img 
                          src={previewUrl} 
                          alt="Reframed preview" 
                          className="w-full rounded-lg border"
                        />
                      </div>
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium">Crop Information</Label>
                          <div className="text-sm text-gray-600 space-y-1 mt-1">
                            <div>Size: {cropParameters.width} × {cropParameters.height}</div>
                            <div>Position: ({cropParameters.x}, {cropParameters.y})</div>
                            <div>Center: ({cropParameters.centerX}, {cropParameters.centerY})</div>
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Detections</Label>
                          <div className="text-sm text-gray-600 mt-1">
                            {detections.length > 0 ? (
                              <div className="space-y-1">
                                <div>Faces: {detections.filter(d => d.type === 'face').length}</div>
                                <div>Poses: {detections.filter(d => d.type === 'pose').length}</div>
                              </div>
                            ) : (
                              'Using center crop (no subjects detected)'
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Captions Tab */}
            <TabsContent value="captions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Type className="w-5 h-5" />
                    TikTok/Reels Style Captions
                  </CardTitle>
                  <CardDescription>
                    Add word-level synchronized captions to your reframed video for maximum engagement.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="addCaptions"
                      checked={addCaptions}
                      onChange={(e) => setAddCaptions(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="addCaptions" className="text-sm font-medium">
                      Add captions to reframed video
                    </Label>
                  </div>

                  {addCaptions && (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Caption Style</Label>
                        <Select value={selectedCaptionStyle} onValueChange={setSelectedCaptionStyle}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select caption style" />
                          </SelectTrigger>
                          <SelectContent>
                            {captionStyles.map((style) => (
                              <SelectItem key={style.id} value={style.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{style.name}</span>
                                  <span className="text-xs text-muted-foreground">{style.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {captionStyles.map((style) => (
                          <div
                            key={style.id}
                            className={`p-3 border rounded cursor-pointer transition-colors ${
                              selectedCaptionStyle === style.id
                                ? 'border-primary bg-primary/10'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => setSelectedCaptionStyle(style.id)}
                          >
                            <div className="font-medium text-sm">{style.name}</div>
                            <div className="text-xs text-muted-foreground mt-1">{style.description}</div>
                          </div>
                        ))}
                      </div>

                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-blue-900">Caption Features:</p>
                            <ul className="text-blue-700 mt-1 space-y-1">
                              <li>• Word-level synchronization for perfect timing</li>
                              <li>• TikTok/Reels optimized styles and positioning</li>
                              <li>• Automatic speaker detection and labeling</li>
                              <li>• Burned-in captions that work on all platforms</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Generation Settings</CardTitle>
                  <CardDescription>
                    Configure output settings for your reframed video.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="outputName">Output Filename</Label>
                    <Input
                      id="outputName"
                      value={outputName}
                      onChange={(e) => setOutputName(e.target.value)}
                      placeholder="Enter filename..."
                      className="mt-1"
                    />
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startTime">Start Time (seconds)</Label>
                      <Input
                        id="startTime"
                        type="number"
                        min="0"
                        max={videoDuration || undefined}
                        value={startTime}
                        onChange={(e) => setStartTime(Number(e.target.value))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="endTime">End Time (seconds)</Label>
                      <Input
                        id="endTime"
                        type="number"
                        min={startTime}
                        max={videoDuration || undefined}
                        value={endTime}
                        onChange={(e) => setEndTime(Number(e.target.value))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    Leave time fields empty to process the entire video.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Result Tab */}
            <TabsContent value="result" className="space-y-4">
              {reframedVideo && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Reframing Complete!
                    </CardTitle>
                    <CardDescription>
                      Your video has been successfully reframed for {reframedVideo.platformName}.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <video 
                          src={reframedVideo.url} 
                          controls 
                          className="w-full rounded-lg"
                          style={{ aspectRatio: reframedVideo.aspectRatio.replace(':', '/') }}
                        />
                      </div>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-medium">Video Details</Label>
                          <div className="text-sm text-gray-600 space-y-1 mt-1">
                            <div>Platform: {reframedVideo.platformName}</div>
                            <div>Aspect Ratio: {reframedVideo.aspectRatio}</div>
                            <div>Filename: {reframedVideo.filename}</div>
                          </div>
                        </div>
                        
                        <Button asChild className="w-full">
                          <a href={reframedVideo.url} download={reframedVideo.filename}>
                            <Download className="w-4 h-4 mr-2" />
                            Download Video
                          </a>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            
            <div className="flex items-center gap-3">
              {currentTab === 'preview' && cropParameters && (
                <Button onClick={() => setCurrentTab('settings')}>
                  Configure Settings
                </Button>
              )}
              
              {(currentTab === 'settings' || (currentTab === 'preview' && cropParameters)) && (
                <Button onClick={handleGenerate} disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating... {Math.round(generationProgress)}%
                    </>
                  ) : (
                    'Generate Reframed Video'
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Generation Progress */}
          {isGenerating && (
            <div className="space-y-2">
              <Progress value={generationProgress} className="w-full" />
              <div className="text-sm text-center text-gray-600">
                Processing video... This may take a few minutes for large files.
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReframeModal;