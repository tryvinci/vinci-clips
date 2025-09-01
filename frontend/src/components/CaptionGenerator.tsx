"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Wand2, Video, Eye, Play } from 'lucide-react';
const API_URL = process.env.NEXT_PUBLIC_API_URL;
interface CaptionStyle {
    id: string;
    name: string;
    description: string;
}

interface CaptionGeneratorProps {
    transcriptId: string;
    videoUrl: string;
}

export default function CaptionGenerator({ transcriptId, videoUrl }: CaptionGeneratorProps) {
    const [styles, setStyles] = useState<CaptionStyle[]>([]);
    const [selectedStyle, setSelectedStyle] = useState<string>('');
    const [generating, setGenerating] = useState(false);
    const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [previewText, setPreviewText] = useState('Hello world! This is a preview of your captions.');

    useEffect(() => {
        fetchCaptionStyles();
    }, []);

    const fetchCaptionStyles = async () => {
        try {
            const response = await axios.get(`${API_URL}/clips/captions/styles`);
            setStyles(response.data.styles);
            if (response.data.styles.length > 0) {
                setSelectedStyle(response.data.styles[0].id);
            }
        } catch (error) {
            console.error('Failed to fetch caption styles:', error);
            setError('Failed to load caption styles');
        }
    };

    const generateCaptionedVideo = async () => {
        if (!selectedStyle) {
            setError('Please select a caption style');
            return;
        }

        setGenerating(true);
        setError('');
        setGeneratedVideo(null);

        try {
            const response = await axios.post(
                `${API_URL}/clips/captions/generate/${transcriptId}`,
                { style: selectedStyle }
            );

            if (response.data.success) {
                const fullUrl = `${API_URL}${response.data.captionedVideoUrl}`;
                setGeneratedVideo(fullUrl);
            } else {
                setError(response.data.error || 'Failed to generate captioned video');
            }
        } catch (error: any) {
            console.error('Caption generation failed:', error);
            setError(error.response?.data?.error || 'Failed to generate captioned video');
        } finally {
            setGenerating(false);
        }
    };

    const downloadVideo = () => {
        if (generatedVideo) {
            const link = document.createElement('a');
            link.href = generatedVideo;
            link.download = `captioned-video-${selectedStyle}.mp4`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const getCaptionStyleCSS = (styleId: string) => {
        const baseStyle = {
            position: 'absolute' as const,
            bottom: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center' as const,
            fontSize: '24px',
            fontWeight: 'bold' as const,
            padding: '8px 16px',
            borderRadius: '8px',
            maxWidth: '80%',
            wordWrap: 'break-word' as const,
            zIndex: 10,
        };

        switch (styleId) {
            case 'bold-center':
                return {
                    ...baseStyle,
                    color: 'white',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8)',
                    fontFamily: 'Arial, sans-serif',
                };
            case 'neon-pop':
                return {
                    ...baseStyle,
                    color: '#FF6B9D',
                    textShadow: '0 0 10px #FFD93D, 2px 2px 4px rgba(0,0,0,0.8)',
                    fontFamily: 'Arial, sans-serif',
                    background: 'rgba(0,0,0,0.3)',
                };
            case 'typewriter':
                return {
                    ...baseStyle,
                    color: 'white',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                    fontFamily: 'Courier New, monospace',
                    background: 'rgba(0,0,0,0.5)',
                };
            case 'bubble':
                return {
                    ...baseStyle,
                    color: 'white',
                    background: 'rgba(76, 205, 196, 0.9)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                };
            case 'minimal-clean':
                return {
                    ...baseStyle,
                    color: 'white',
                    background: 'rgba(0,0,0,0.4)',
                    fontFamily: 'Arial, sans-serif',
                    fontWeight: 'normal' as const,
                    border: '1px solid rgba(255,255,255,0.2)',
                };
            default:
                return baseStyle;
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Video className="h-5 w-5" />
                    TikTok/Reels Caption Generator
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {error && (
                    <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded">
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium mb-2">Caption Style</label>
                    <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a caption style" />
                        </SelectTrigger>
                        <SelectContent>
                            {styles.map((style) => (
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

                <div className="flex gap-2">
                    <Button 
                        onClick={() => setShowPreview(!showPreview)}
                        disabled={!selectedStyle}
                        variant="outline"
                        className="flex-1"
                    >
                        <Eye className="h-4 w-4 mr-2" />
                        {showPreview ? 'Hide Preview' : 'Preview Style'}
                    </Button>
                    
                    <Button 
                        onClick={generateCaptionedVideo}
                        disabled={generating || !selectedStyle}
                        className="flex-1"
                    >
                        <Wand2 className="h-4 w-4 mr-2" />
                        {generating ? 'Generating Captions...' : 'Generate Captioned Video'}
                    </Button>
                </div>

                {showPreview && selectedStyle && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Preview Text</label>
                            <input
                                type="text"
                                value={previewText}
                                onChange={(e) => setPreviewText(e.target.value)}
                                className="w-full p-2 border rounded-md"
                                placeholder="Enter text to preview..."
                            />
                        </div>
                        
                        <div className="relative">
                            <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ aspectRatio: '9/16', height: '300px' }}>
                                <video 
                                    src={videoUrl} 
                                    className="w-full h-full object-cover"
                                    muted
                                    poster="/api/placeholder/200/356"
                                />
                                
                                <div style={getCaptionStyleCSS(selectedStyle)}>
                                    {previewText}
                                </div>
                                
                                <div className="absolute top-2 left-2">
                                    <Badge variant="secondary" className="text-xs">
                                        Preview: {styles.find(s => s.id === selectedStyle)?.name}
                                    </Badge>
                                </div>
                            </div>
                            
                            <div className="mt-2 text-center">
                                <p className="text-sm text-muted-foreground">
                                    Preview shows how captions will appear on your video
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {generatedVideo && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                                ✓ Captioned video generated successfully
                            </Badge>
                            <Button 
                                onClick={downloadVideo}
                                variant="outline"
                                size="sm"
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                            </Button>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-2">Preview</label>
                            <video 
                                controls 
                                src={generatedVideo} 
                                className="w-full rounded-lg shadow-lg max-h-96"
                            >
                                Your browser does not support the video tag.
                            </video>
                        </div>
                    </div>
                )}

                {styles.length > 0 && (
                    <div className="mt-6">
                        <h4 className="text-sm font-medium mb-3">Available Styles</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                            {styles.map((style) => (
                                <div 
                                    key={style.id}
                                    className={`p-2 border rounded transition-colors cursor-pointer ${
                                        selectedStyle === style.id 
                                            ? 'border-primary bg-primary/10' 
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                    onClick={() => setSelectedStyle(style.id)}
                                >
                                    <div className="font-medium">{style.name}</div>
                                    <div className="text-muted-foreground">{style.description}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}