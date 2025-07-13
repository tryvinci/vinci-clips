import Head from 'next/head';
import VideoUpload from '../components/VideoUpload';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Create New Clip - Clips</title>
        <meta name="description" content="Upload a video to automatically generate engaging clips using AI." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="w-full max-w-2xl space-y-8">
        <div>
          <h1 className="text-center text-4xl font-extrabold text-gray-900">
            Create a New Clip
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Upload your video, and our AI will find the best moments.
          </p>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-lg">
          <VideoUpload />
        </div>

        <div className="text-center">
            <Link href="/transcripts" className="font-medium text-indigo-600 hover:text-indigo-500">
                Or, view all processed videos
            </Link>
        </div>
      </div>
    </div>
  );
} 