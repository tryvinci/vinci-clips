import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import Head from 'next/head';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, Play } from 'lucide-react';

export default function ClipsPage() {
    const router = useRouter();
    const { transcriptId } = router.query;
    const [clips, setClips] = useState(null);
    const [transcript, setTranscript] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const videoRef = useRef(null);
    const [activeClip, setActiveClip] = useState(null);

    useEffect(() => {
        if (!transcriptId) return;

        const fetchClipsAndTranscript = async () => {
            try {
                setLoading(true);
                const [clipsRes, transcriptRes] = await Promise.all([
                    axios.get(`http://localhost:8080/clips/clips/${transcriptId}`),
                    axios.get(`http://localhost:8080/clips/transcripts/${transcriptId}`)
                ]);
                
                setClips(clipsRes.data);
                setTranscript(transcriptRes.data);

            } catch (err) {
                setError('Failed to load clips. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchClipsAndTranscript();
    }, [transcriptId]);

    const handleClipClick = (clip) => {
        if (videoRef.current) {
            videoRef.current.currentTime = clip.start;
            videoRef.current.play();
            setActiveClip(clip);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center flex-grow">
                <Loader2 className="animate-spin h-16 w-16 text-primary" />
                <p className="mt-4 text-muted-foreground">Loading your clips...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col justify-center items-center flex-grow">
                <AlertTriangle className="h-16 w-16 text-destructive" />
                <p className="mt-4 text-destructive">{error}</p>
            </div>
        );
    }
    
    const formatTime = (seconds) => new Date(seconds * 1000).toISOString().substr(14, 5);
    const videoTitle = transcript?.gcsUri.split('/').pop() || 'Video';

    return (
        <>
            <Head>
                <title>Clips for {videoTitle}</title>
            </Head>
            <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>{videoTitle}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <video ref={videoRef} src={transcript?.gcsUri.replace('gs://', 'https://storage.googleapis.com/')} controls className="w-full rounded-lg">
                                    Your browser does not support the video tag.
                                </video>
                            </CardContent>
                        </Card>
                    </div>

                    <div>
                        <Card>
                            <CardHeader>
                                <CardTitle>Suggested Clips</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {clips?.clips.map((clip, index) => (
                                    <Button 
                                        key={index}
                                        variant={activeClip === clip ? "secondary" : "ghost"}
                                        onClick={() => handleClipClick(clip)}
                                        className="w-full justify-start h-auto"
                                    >
                                        <Play className="h-4 w-4 mr-3" />
                                        <div className="text-left">
                                            <p className="font-semibold">Clip {index + 1}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {formatTime(clip.start)} - {formatTime(clip.end)}
                                            </p>
                                        </div>
                                    </Button>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
} 