import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';

export default function ClipsPage() {
    const router = useRouter();
    const { transcriptId } = router.query;
    const [clips, setClips] = useState(null);
    const [transcript, setTranscript] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const videoRef = useRef(null);

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
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchClipsAndTranscript();
    }, [transcriptId]);

    const handleClipClick = (startTime) => {
        if (videoRef.current) {
            videoRef.current.currentTime = startTime;
            videoRef.current.play();
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <p className="text-red-500 text-lg">{error}</p>
            </div>
        );
    }
    
    const formatTime = (seconds) => new Date(seconds * 1000).toISOString().substr(14, 5);

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold mb-6">Your AI-Generated Clips</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                    <video ref={videoRef} src={transcript?.gcsUri.replace('gs://', 'https://storage.googleapis.com/')} controls className="w-full rounded-lg shadow-lg">
                        Your browser does not support the video tag.
                    </video>
                </div>

                <div className="space-y-4">
                    <h2 className="text-2xl font-semibold">Suggested Clips</h2>
                    <ul className="bg-white p-4 rounded-lg shadow">
                        {clips?.clips.map((clip, index) => (
                            <li key={index} className="border-b last:border-b-0 py-3">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">Clip {index + 1}</p>
                                        <p className="text-sm text-gray-600">
                                            {formatTime(clip.start)} - {formatTime(clip.end)}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => handleClipClick(clip.start)}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                                    >
                                        Play
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
} 