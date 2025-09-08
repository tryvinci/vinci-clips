'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
const API_URL = process.env.NEXT_PUBLIC_API_URL;
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
  Type,
  Sparkles
} from 'lucide-react';
import SubjectDetection from './SubjectDetection';
import axios from 'axios';

// --- Interfaces (no changes) ---
interface Platform {
  id: string;
  name: string;
  aspectRatio: string;
  width: number;
  height: number;
  icon: React.ReactNode;
  description: string;
}
interface CropParameters { width: number; height: number; x: number; y: number; centerX: number; centerY: number; }
interface ReframedVideo { filename: string; url: string; platform: string; platformName: string; aspectRatio: string; cropParameters: CropParameters; }
interface CaptionStyle { id: string; name: string; description: string; }
interface ReframeModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcriptId: string;
  videoUrl: string;
  originalFilename: string;
  videoDimensions?: { width: number; height: number };
  generatedClipUrl?: string;
  transcriptData?: any[]; // Pass transcript data for active speaker detection
}

// --- Constants & Helper Functions (with additions) ---
const PLATFORMS: Platform[] = [
  { id: 'tiktok', name: 'TikTok/Shorts', aspectRatio: '9:16', width: 9, height: 16, icon: <Smartphone className="w-5 h-5" />, description: 'Vertical format for TikTok, YouTube Shorts, Instagram Reels' },
  { id: 'instagram', name: 'Instagram Square', aspectRatio: '1:1', width: 1, height: 1, icon: <Square className="w-5 h-5" />, description: 'Square format for Instagram feed posts' },
  { id: 'youtube', name: 'YouTube Landscape', aspectRatio: '16:9', width: 16, height: 9, icon: <Monitor className="w-5 h-5" />, description: 'Widescreen format for YouTube, Facebook, LinkedIn' },
];

// NEW: Helper to generate CSS for caption style previews
const getCaptionStyleCSS = (styleId: string): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
        position: 'absolute', bottom: '15%', left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold', padding: '0.2em 0.5em',
        borderRadius: '8px', width: '90%', lineHeight: '1.3',
    };
    switch (styleId) {
        case 'bold-center': return { ...baseStyle, color: 'white', textShadow: '2px 2px 4px #000' };
        case 'neon-pop': return { ...baseStyle, color: '#FF6B9D', textShadow: '0 0 8px #FFD93D, 2px 2px 4px #000', fontFamily: "'Comic Sans MS', cursive, sans-serif" };
        case 'typewriter': return { ...baseStyle, color: 'white', backgroundColor: 'rgba(0,0,0,0.6)', fontFamily: "'Courier New', monospace" };
        case 'bubble': return { ...baseStyle, color: 'black', backgroundColor: '#fff', border: '2px solid #000' };
        case 'minimal-clean': return { ...baseStyle, color: 'white', backgroundColor: 'rgba(0,0,0,0.5)', fontWeight: 'normal' };
        default: return baseStyle;
    }
};

const ReframeModal: React.FC<ReframeModalProps> = ({
  isOpen, onClose, transcriptId, videoUrl, originalFilename, generatedClipUrl, transcriptData
}) => {
  // --- State Management (no major changes, `currentTab` removed) ---
  const [selectedPlatform, setSelectedPlatform] = useState<string>('tiktok');
  const [detections, setDetections] = useState<any[]>([]);
  const [cropParameters, setCropParameters] = useState<CropParameters | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [reframedVideo, setReframedVideo] = useState<ReframedVideo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outputName, setOutputName] = useState<string>('');
  const [captionStyles, setCaptionStyles] = useState<CaptionStyle[]>([]);
  const [selectedCaptionStyle, setSelectedCaptionStyle] = useState<string>('');
  const [addCaptions, setAddCaptions] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);
  const [activeSpeakerFace, setActiveSpeakerFace] = useState<any | null>(null);
  // NEW: State to manage the visibility of advanced settings
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false);

  // --- Hooks and Handlers (no major changes to logic) ---
  useEffect(() => {
    if (isOpen && originalFilename) {
      const platform = PLATFORMS.find(p => p.id === selectedPlatform);
      const baseName = originalFilename.replace(/\.[^.]+$/, '');
      setOutputName(`${baseName}_${platform?.id}_reframed.mp4`);
      setStartTime(0);
      setEndTime(0);
    }
  }, [isOpen, originalFilename, selectedPlatform]);

  useEffect(() => {
    if (isOpen) fetchCaptionStyles();
  }, [isOpen]);

  const fetchCaptionStyles = async () => {
    try {
      const response = await axios.get(`${API_URL}/clips/captions/styles`);
      setCaptionStyles(response.data.styles);
      if (response.data.styles.length > 0) {
        setSelectedCaptionStyle(response.data.styles[0].id);
      }
    } catch (error) { console.error('Failed to fetch caption styles:', error); }
  };

  const handleDetectionComplete = async (detectionResults: any[]) => {
    setDetections(detectionResults);
    setError(null);

    // Simple active speaker detection: assume the first face is the speaker
    if (detectionResults.length > 0) {
        setActiveSpeakerFace(detectionResults[0].boundingBox);
    }

    try {
      setIsAnalyzing(true);
      const response = await axios.post(`${API_URL}/clips/reframe/analyze`, {
        transcriptId, 
        targetPlatform: selectedPlatform, 
        detections: detectionResults, 
        generatedClipUrl,
        activeSpeakerFace
      });
      if (response.data.success) {
        setCropParameters(response.data.analysis.cropParameters);
        setPreviewUrl(response.data.analysis.previewUrl);
      } else { setError('Failed to analyze video for reframing'); }
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to analyze video');
    } finally { setIsAnalyzing(false); }
  };

  const handleGenerate = async () => {
    if (!cropParameters) { setError('No crop parameters. Please analyze first.'); return; }
    try {
      setIsGenerating(true); setGenerationProgress(0); setError(null);
      const progressInterval = setInterval(() => setGenerationProgress(prev => Math.min(prev + Math.random() * 10, 90)), 500);
      const response = await axios.post(`${API_URL}/clips/reframe/generate`, {
        transcriptId, 
        targetPlatform: selectedPlatform, 
        cropParameters, 
        detections, 
        outputName, 
        generatedClipUrl,
        captions: addCaptions ? { enabled: true, style: selectedCaptionStyle } : { enabled: false },
        activeSpeakerFace
      });
      clearInterval(progressInterval); setGenerationProgress(100);
      if (response.data.success) { setReframedVideo(response.data.reframedVideo);
      } else { setError('Failed to generate reframed video'); }
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to generate reframed video');
    } finally { setIsGenerating(false); }
  };

  const resetModal = () => {
    setDetections([]); setCropParameters(null); setPreviewUrl(null); setReframedVideo(null);
    setError(null); setIsAnalyzing(false); setIsGenerating(false); setGenerationProgress(0);
  };

  const handleClose = () => { resetModal(); onClose(); };

  // --- NEW: Redesigned JSX Structure ---
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-6 h-6 text-blue-500" />
            AI Clip Generator
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-8">
          {reframedVideo ? (
            // --- RESULT VIEW ---
            <div className="space-y-4 text-center">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                    Clip Generated Successfully!
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <video src={`${API_URL}${reframedVideo.url}`} controls className="w-full rounded-lg mx-auto max-w-sm" />
                  <Button asChild size="lg" className="w-full max-w-sm">
                    <a href={`${API_URL}${reframedVideo.url}`} download={reframedVideo.filename}>
                      <Download className="w-4 h-4 mr-2" />
                      Download Video
                    </a>
                  </Button>
                </CardContent>
              </Card>
              <Button variant="outline" onClick={handleClose}>Close</Button>
            </div>
          ) : (
            // --- SETTINGS VIEW ---
            <>
              {/* Aspect Ratio Selection */}
              <div className="space-y-3">
                <Label className="text-base font-medium">1. Aspect Ratio</Label>
                <div className="grid grid-cols-3 gap-3">
                  {PLATFORMS.map((platform) => (
                    <Card key={platform.id} onClick={() => setSelectedPlatform(platform.id)}
                      className={`cursor-pointer transition-all text-center p-4 ${selectedPlatform === platform.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <div className="flex flex-col items-center gap-2">
                        {platform.icon}
                        <div className="font-medium text-sm">{platform.name}</div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* AI Subject Detection & Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Eye className="w-5 h-5" />2. AI Smart Frame</CardTitle>
                  <CardDescription>Our AI finds the best shot. Click the video to start.</CardDescription>
                </CardHeader>
                <CardContent>
                  {previewUrl && cropParameters ? (
                    <div className="grid md:grid-cols-2 gap-6 items-center">
                      <img src={`${API_URL}${previewUrl}`} alt="Reframed preview" className="w-full rounded-lg border" />
                      <div className="space-y-4">
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <h4 className="font-semibold text-green-800">Analysis Complete</h4>
                          <p className="text-sm text-green-700 mt-1">Optimal crop found for {PLATFORMS.find(p=>p.id===selectedPlatform)?.name}.</p>
                        </div>
                        <Button variant="outline" onClick={() => setPreviewUrl(null)}>Re-analyze</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <SubjectDetection videoUrl={`${API_URL}${videoUrl}`} onDetectionComplete={handleDetectionComplete} onError={setError} />
                      {isAnalyzing && <div className="mt-4 flex items-center gap-2 text-blue-600"><Loader2 className="w-4 h-4 animate-spin" /><span>Calculating optimal crop...</span></div>}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Captions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Type className="w-5 h-5" />3. Captions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* REPLACED: Switch with a styled checkbox */}
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="addCaptions"
                      checked={addCaptions}
                      onChange={(e) => setAddCaptions(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Label htmlFor="addCaptions" className="text-base cursor-pointer">Add Animated Captions</Label>
                  </div>
                  {addCaptions && (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">Select a style for your burned-in captions.</p>
                      <div className="flex gap-3 overflow-x-auto pb-3">
                        {captionStyles.map(style => (
                          <div key={style.id} onClick={() => setSelectedCaptionStyle(style.id)}
                            className={`relative flex-shrink-0 w-32 h-48 bg-gray-800 rounded-lg cursor-pointer transition-all overflow-hidden ${selectedCaptionStyle === style.id ? 'ring-2 ring-blue-500' : ''}`}>
                            <div style={getCaptionStyleCSS(style.id)}>Sample Text</div>
                            <div className="absolute bottom-0 w-full p-2 bg-black/50">
                              <p className="text-white text-xs font-medium truncate">{style.name}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* REPLACED: Accordion with a Button toggle */}
              <div className="space-y-4">
                <Button variant="outline" onClick={() => setIsAdvancedSettingsOpen(!isAdvancedSettingsOpen)} className="w-full justify-start">
                  <Settings className="w-4 h-4 mr-2" />
                  Advanced Settings
                </Button>
                {isAdvancedSettingsOpen && (
                  <div className="p-4 border rounded-lg space-y-4">
                    <div>
                      <Label htmlFor="outputName">Output Filename</Label>
                      <Input id="outputName" value={outputName} onChange={(e) => setOutputName(e.target.value)} className="mt-1" />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div><Label htmlFor="startTime">Start Time (sec)</Label><Input id="startTime" type="number" min="0" value={startTime} onChange={(e) => setStartTime(Number(e.target.value))} className="mt-1" /></div>
                      <div><Label htmlFor="endTime">End Time (sec)</Label><Input id="endTime" type="number" min={startTime} value={endTime} onChange={(e) => setEndTime(Number(e.target.value))} className="mt-1" /></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Display */}
              {error && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg"><AlertCircle className="w-5 h-5" /><span>{error}</span></div>}

              {/* Action Buttons */}
              <div className="pt-6 border-t flex justify-between items-center">
                <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                <Button size="lg" onClick={handleGenerate} disabled={isGenerating || !cropParameters}>
                  {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating... {Math.round(generationProgress)}%</> : 'Generate Clip'}
                </Button>
              </div>
              {isGenerating && <Progress value={generationProgress} className="w-full" />}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReframeModal;