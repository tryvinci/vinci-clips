import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';

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
                setError('Failed to fetch transcripts.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchTranscripts();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
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

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-4xl font-bold">All Processed Videos</h1>
                <Link href="/" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
                    Upload New Video
                </Link>
            </div>
            <div className="bg-white shadow-md rounded-lg">
                <ul className="divide-y divide-gray-200">
                    {transcripts.length > 0 ? (
                        transcripts.map((transcript) => (
                            <li key={transcript._id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                                <div>
                                    <p className="font-semibold text-lg">{transcript.gcsUri.split('/').pop()}</p>
                                    <p className="text-sm text-gray-500">
                                        Processed on: {new Date(transcript.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <Link href={`/clips/${transcript._id}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                                    View Clips →
                                </Link>
                            </li>
                        ))
                    ) : (
                        <p className="p-4 text-center text-gray-500">You haven't processed any videos yet.</p>
                    )}
                </ul>
            </div>
        </div>
    );
} 