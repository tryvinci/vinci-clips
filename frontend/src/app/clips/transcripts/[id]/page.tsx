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

interface Clip {
    start: number;
    end: number;
    title: string;
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

    if (loading) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }

    if (error) {
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
                            <h3 className="text-2xl font-bold">Generated Clips</h3>
                            {transcript.clips && transcript.clips.length > 0 ? (
                                <ul className="mt-4 space-y-2">
                                    {transcript.clips.map((clip, index) => (
                                        <li key={index} className="p-4 bg-muted rounded-lg">{clip.title} ({clip.start}s - {clip.end}s)</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="mt-4 text-muted-foreground">No clips generated yet.</p>
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