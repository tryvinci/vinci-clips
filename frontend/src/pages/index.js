import Head from 'next/head';
import Link from 'next/link';
import VideoUpload from '../components/VideoUpload';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <Head>
        <title>Clips</title>
        <meta name="description" content="AI-Powered Video Clipping Tool" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        <h1 className="text-6xl font-bold mb-2">
          Welcome to Clips
        </h1>
        <p className="text-lg mb-8">
            <Link href="/transcripts" className="text-blue-500 hover:underline">
                View Transcripts
            </Link>
        </p>

        <div className="w-full max-w-xl">
          <VideoUpload />
        </div>
      </main>
    </div>
  );
} 