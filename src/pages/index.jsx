import Head from 'next/head';
import VideoUpload from '@/components/VideoUpload';

export default function HomePage() {
  return (
    <>
      <Head>
        <title>Create a New Clip - Clips</title>
        <meta name="description" content="Upload a video to automatically generate engaging clips using AI." />
      </Head>
      <div className="container mx-auto flex items-center justify-center flex-grow py-12">
        <VideoUpload />
      </div>
    </>
  );
} 