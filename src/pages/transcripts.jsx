import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import Head from 'next/head';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Video } from 'lucide-react';

export default function TranscriptsPage() {
    const [transcripts, setTranscripts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchTranscripts = async () => {
            try {
                setLoading(true);
                const response = await axios.get('http://localhost:8080/clips/transcripts');
                setTranscripts(response.data);
            } catch (err) {
                setError('Failed to fetch your library.');
            } finally {
                setLoading(false);
            }
        };
        fetchTranscripts();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center flex-grow">
                <Loader2 className="animate-spin h-16 w-16 text-primary" />
                <p className="mt-4 text-muted-foreground">Loading your library...</p>
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

    return (
        <>
            <Head>
                <title>My Library - Clips</title>
            </Head>
            <div className="container mx-auto px-4 py-8">
                <Card>
                    <CardHeader>
                        <CardTitle>My Library</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {transcripts.length > 0 ? (
                            <ul className="space-y-3">
                                {transcripts.map((transcript) => (
                                    <li key={transcript._id} className="p-4 border rounded-lg flex justify-between items-center hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center space-x-4">
                                            <Video className="h-6 w-6 text-muted-foreground" />
                                            <div>
                                                <p className="font-semibold">{transcript.gcsUri.split('/').pop()}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    Processed on: {new Date(transcript.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <Button asChild variant="secondary">
                                            <Link href={`/clips/${transcript._id}`}>View Clips</Link>
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-muted-foreground">You haven't processed any videos yet.</p>
                                <Button asChild className="mt-4">
                                    <Link href="/">Upload your first video</Link>
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
} 