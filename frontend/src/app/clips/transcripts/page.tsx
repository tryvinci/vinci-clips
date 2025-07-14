"use client";

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface Transcript {
    _id: string;
    originalFilename: string;
    createdAt: string;
}

export default function TranscriptsPage() {
    const [transcripts, setTranscripts] = useState<Transcript[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchTranscripts = async () => {
            try {
                const response = await axios.get('http://localhost:8080/clips/transcripts');
                setTranscripts(response.data);
            } catch (err) {
                setError('Failed to fetch transcripts. Please try again later.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchTranscripts();
    }, []);

    if (loading) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }

    if (error) {
        return <div className="flex justify-center items-center h-screen">{error}</div>;
    }

    return (
        <main className="container mx-auto p-8">
            <h1 className="text-4xl font-bold mb-8">All Transcripts</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {transcripts.map((transcript) => (
                    <Card key={transcript._id}>
                        <CardHeader>
                            <CardTitle className="truncate">{transcript.originalFilename}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Created: {new Date(transcript.createdAt).toLocaleDateString()}
                            </p>
                            <Button asChild className="mt-4">
                                <Link href={`/clips/transcripts/${transcript._id}`}>View Details</Link>
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </main>
    );
} 