"use client";

import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Transcript {
    _id: string;
    originalFilename: string;
    createdAt: string;
}

export default function TranscriptsPage() {
    const [transcripts, setTranscripts] = useState<Transcript[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { getToken } = useAuth();

    const fetchTranscripts = useCallback(async () => {
        setLoading(true);
        try {
            const token = await getToken();
            const response = await axios.get(`${API_URL}/api/transcripts`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setTranscripts(response.data);
        } catch (err) {
            setError('Failed to fetch transcripts. Please try again later.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [getToken]);

    useEffect(() => {
        fetchTranscripts();
    }, [fetchTranscripts]);

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
            try {
                const token = await getToken();
                await axios.delete(`${API_URL}/api/transcripts/${id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setTranscripts(prev => prev.filter(t => t._id !== id));
            } catch (error) {
                console.error('Error deleting video:', error);
                setError('Failed to delete video');
            }
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }

    if (error) {
        return <div className="flex justify-center items-center h-screen">{error}</div>;
    }

    return (
        <main className="container mx-auto p-8">
            <h1 className="text-4xl font-bold mb-8">All Videos</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {transcripts.map((transcript) => (
                    <Card key={transcript._id}>
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <CardTitle className="truncate pr-2 flex-1 w-0">{transcript.originalFilename}</CardTitle>
                                <Trash2
                                    className="h-4 w-4 text-red-500 cursor-pointer hover:text-red-700 flex-shrink-0"
                                    onClick={(e) => handleDelete(transcript._id, e)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Created: {new Date(transcript.createdAt).toLocaleDateString()}
                            </p>
                            <Button asChild className="mt-4 w-full">
                                <Link href={`/clips/transcripts/${transcript._id}`}>View Details</Link>
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </main>
    );
}