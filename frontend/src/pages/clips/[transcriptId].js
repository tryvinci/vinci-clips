import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function ClipDetails() {
    const [clipData, setClipData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const router = useRouter();
    const { transcriptId } = router.query;

    useEffect(() => {
        if (!transcriptId) return;

        async function fetchClips() {
            try {
                const response = await fetch(`http://localhost:8080/clips/clips/${transcriptId}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch clips');
                }
                const data = await response.json();
                setClipData(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchClips();
    }, [transcriptId]);

    // Function to format seconds into HH:MM:SS.ms
    const formatTime = (seconds) => {
        if (seconds == null) return "N/A";
        return new Date(seconds * 1000).toISOString().substr(11, 12);
    };

    return (
        <div className="container mx-auto p-4">
            <Head>
                <title>Generated Clips - Clips</title>
            </Head>
            <h1 className="text-4xl font-bold mb-4">Generated Clips</h1>
            {loading && <p>Loading...</p>}
            {error && <p className="text-red-500">{error}</p>}
            {clipData && (
                <div className="space-y-4">
                    <p><span className="font-semibold">Transcript ID:</span> {clipData.transcriptId}</p>
                    <p><span className="font-semibold">Created At:</span> {new Date(clipData.createdAt).toLocaleString()}</p>
                    <h2 className="text-2xl font-bold mt-4">Suggested Clips:</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {clipData.clips.map((clip, index) => (
                            <div key={index} className="p-4 border rounded-lg">
                                <p><span className="font-semibold">Start:</span> {formatTime(clip.start)}</p>
                                <p><span className="font-semibold">End:</span> {formatTime(clip.end)}</p>
                                <div className="mt-2">
                                    <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 w-full">
                                        Create this Clip
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
} 