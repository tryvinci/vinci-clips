import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function Transcripts() {
    const [transcripts, setTranscripts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const router = useRouter();

    useEffect(() => {
        async function fetchTranscripts() {
            try {
                const response = await fetch('http://localhost:8080/clips/transcripts');
                if (!response.ok) {
                    throw new Error('Failed to fetch transcripts');
                }
                const data = await response.json();
                setTranscripts(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchTranscripts();
    }, []);

    const handleAnalyze = async (transcriptId) => {
        try {
            const response = await fetch(`http://localhost:8080/clips/analyze/${transcriptId}`, {
                method: 'POST',
            });
            if (!response.ok) {
                throw new Error('Analysis failed');
            }
            // Navigate to a new page to view clips, passing the transcript ID
            router.push(`/clips/${transcriptId}`);
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="container mx-auto p-4">
            <Head>
                <title>Transcripts - Clips</title>
            </Head>
            <h1 className="text-4xl font-bold mb-4">Transcripts</h1>
            {loading && <p>Loading...</p>}
            {error && <p className="text-red-500">{error}</p>}
            <div className="space-y-4">
                {transcripts.map((transcript) => (
                    <div key={transcript._id} className="p-4 border rounded-lg">
                        <h2 className="text-xl font-semibold">{transcript.gcsUri}</h2>
                        <p className="text-sm text-gray-500">Created At: {new Date(transcript.createdAt).toLocaleString()}</p>
                        <div className="mt-4">
                            <button
                                onClick={() => handleAnalyze(transcript._id)}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                                Analyze and Generate Clips
                            </button>
                        </div>
                        <details className="mt-2">
                            <summary className="cursor-pointer">View Transcript</summary>
                            <pre className="mt-2 p-2 bg-gray-100 rounded text-sm overflow-auto">
                                {JSON.stringify(transcript.transcription, null, 2)}
                            </pre>
                        </details>
                    </div>
                ))}
            </div>
        </div>
    );
} 