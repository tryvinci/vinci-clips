"use client";

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { useParams, useRouter } from 'next/navigation';

interface TranscriptSegment {
    start: string;
    end: string;
    text: string;
    speaker?: string;
}

interface ClipSegment {
    start: number;
    end: number;
}

interface Clip {
    title: string;
    start?: number; // For single segment clips
    end?: number;   // For single segment clips
    segments?: ClipSegment[]; // For multi-segment clips
    totalDuration?: number;
}

interface Transcript {
    _id: string;
    originalFilename: string;
    transcript: TranscriptSegment[];
    videoUrl: string;
    mp3Url: string;
    clips: Clip[];
    createdAt: string;
}

export default function TranscriptDetailPage() {
    const [transcript, setTranscript] = useState<Transcript | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [generatingClips, setGeneratingClips] = useState(false);
    const [generatedClips, setGeneratedClips] = useState<any[]>([]);
    const params = useParams();
    const router = useRouter();
    const id = params.id;

    useEffect(() => {
        if (id) {
            const fetchTranscript = async () => {
                try {
                    const response = await axios.get(`http://localhost:8080/clips/transcripts/${id}`);
                    setTranscript(response.data);
                } catch (err) {
                    setError('Failed to fetch transcript details.');
                    console.error(err);
                } finally {
                    setLoading(false);
                }
            };
            fetchTranscript();
        }
    }, [id]);

    const generateClips = async () => {
        if (!transcript) return;
        
        setAnalyzing(true);
        setError('');
        
        try {
            const response = await axios.post(`http://localhost:8080/clips/analyze/${transcript._id}`);
            setTranscript(response.data);
        } catch (err) {
            setError('Failed to generate clips. Please try again.');
            console.error(err);
        } finally {
            setAnalyzing(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const seekToClip = (clip: Clip) => {
        const video = document.querySelector('video') as HTMLVideoElement;
        if (video) {
            const startTime = clip.start || (clip.segments && clip.segments[0]?.start) || 0;
            video.currentTime = startTime;
            video.play();
        }
    };

    const generateVideoClip = async (clipIndex: number) => {
        if (!transcript) return;
        
        setGeneratingClips(true);
        setError('');
        
        try {
            const response = await axios.post(`http://localhost:8080/clips/clips/generate/${transcript._id}`, {
                clipIndex: clipIndex
            });
            
            // Add the new generated clip to the list
            setGeneratedClips(prev => [...prev, ...response.data.clips]);
        } catch (err) {
            setError(`Failed to generate clip ${clipIndex + 1}. Please try again.`);
            console.error(err);
        } finally {
            setGeneratingClips(false);
        }
    };

    const clearAnalyzedClips = async () => {
        if (!transcript) return;
        
        try {
            // Update transcript to remove clips
            const updatedTranscript = { ...transcript, clips: [] };
            await axios.put(`http://localhost:8080/clips/transcripts/${transcript._id}`, {
                clips: []
            });
            setTranscript(updatedTranscript);
            setGeneratedClips([]);
        } catch (err) {
            setError('Failed to clear clips. Please try again.');
            console.error(err);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }

    if (error && !transcript) {
        return <div className="flex justify-center items-center h-screen">{error}</div>;
    }

    if (!transcript) {
        return <div className="flex justify-center items-center h-screen">Transcript not found.</div>;
    }

    return (
        <main className="container mx-auto p-8">
            <Button onClick={() => router.back()} className="mb-8">Back to Transcripts</Button>
            <Card>
                <CardHeader>
                    <CardTitle className="text-3xl">{transcript.originalFilename}</CardTitle>
                    <CardDescription>
                        Processed on {new Date(transcript.createdAt).toLocaleString()}
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2">
                        <video controls src={transcript.videoUrl} className="w-full rounded-lg shadow-lg"></video>
                        <div className="mt-8">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-2xl font-bold">Clip Analysis & Generation</h3>
                                <div className="flex gap-2">
                                    <Button 
                                        onClick={generateClips} 
                                        disabled={analyzing}
                                        variant="outline"
                                    >
                                        {analyzing ? 'Analyzing...' : 'Analyze for Clips'}
                                    </Button>
                                    <Button 
                                        onClick={clearAnalyzedClips} 
                                        disabled={!transcript?.clips || transcript.clips.length === 0}
                                        variant="destructive"
                                        size="sm"
                                    >
                                        Clear Clips
                                    </Button>
                                </div>
                            </div>
                            {error && transcript && (
                                <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
                                    {error}
                                </div>
                            )}
                            {transcript.clips && transcript.clips.length > 0 ? (
                                <div className="mt-4 space-y-4">
                                    {transcript.clips.map((clip, index) => (
                                        <div key={index} className="p-4 bg-muted rounded-lg transition-colors">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="font-semibold flex-1">{clip.title}</div>
                                                <Button 
                                                    onClick={() => generateVideoClip(index)}
                                                    disabled={generatingClips}
                                                    size="sm"
                                                    className="ml-2"
                                                >
                                                    {generatingClips ? 'Generating...' : 'Generate Clip'}
                                                </Button>
                                            </div>
                                            <div 
                                                className="text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 p-2 rounded"
                                                onClick={() => seekToClip(clip)}
                                            >
                                                {clip.segments ? (
                                                    // Multi-segment clip
                                                    <div>
                                                        <div className="font-medium text-xs text-primary mb-1">MIXED SEGMENTS:</div>
                                                        {clip.segments.map((segment, segIndex) => (
                                                            <div key={segIndex} className="ml-2">
                                                                • {formatTime(segment.start)} - {formatTime(segment.end)}
                                                            </div>
                                                        ))}
                                                        <div className="mt-1 text-xs font-medium">
                                                            Total Duration: {clip.totalDuration ? formatTime(clip.totalDuration) : 'Unknown'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    // Single segment clip
                                                    <div>
                                                        <div>{formatTime(clip.start || 0)} - {formatTime(clip.end || 0)}</div>
                                                        <div className="text-xs">
                                                            Duration: {clip.totalDuration ? formatTime(clip.totalDuration) : formatTime((clip.end || 0) - (clip.start || 0))}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="mt-2 text-xs text-primary">
                                                    Click here to preview in video player
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-4 text-muted-foreground">No clips analyzed yet. Click "Analyze for Clips" to get clip suggestions.</p>
                            )}

                            {generatedClips.length > 0 && (
                                <div className="mt-8">
                                    <h4 className="text-xl font-bold mb-4">Generated Video Clips</h4>
                                    <div className="space-y-3">
                                        {generatedClips.map((generatedClip, index) => (
                                            <div key={index} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="font-semibold text-green-800">{generatedClip.title}</div>
                                                        <div className="text-sm text-green-600">Clip {generatedClip.index + 1}</div>
                                                    </div>
                                                    <Button asChild size="sm">
                                                        <a href={generatedClip.url} download target="_blank" rel="noopener noreferrer">
                                                            Download Clip
                                                        </a>
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold mb-4">Transcript</h3>
                        <div className="h-[600px] overflow-y-auto space-y-4 pr-4">
                            {transcript.transcript.map((segment, index) => (
                                <div key={index}>
                                    <p className="font-semibold text-primary">{segment.speaker || 'Unknown Speaker'}: {segment.start} - {segment.end}</p>
                                    <p>{segment.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
} 