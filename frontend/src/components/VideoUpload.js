import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/router';
import axios from 'axios';
import { UploadCloud, FileCheck, AlertTriangle, Loader } from 'lucide-react';

export default function VideoUpload() {
  const [status, setStatus] = useState('idle'); // idle, uploading, analyzing, success, error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const router = useRouter();

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024 * 1024) { // 2GB
        setError('File size cannot exceed 2GB.');
        setStatus('error');
        return;
    }

    const formData = new FormData();
    formData.append('video', file);
    setError(null);
    setProgress(0);
    setStatus('uploading');

    try {
      const uploadResponse = await axios.post('http://localhost:8080/clips/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
        },
      });

      if (uploadResponse.status !== 200) throw new Error('Upload and transcription failed.');

      setStatus('analyzing');
      const { transcriptId } = uploadResponse.data;
      const analyzeResponse = await axios.post('http://localhost:8080/clips/analyze', { transcriptId });

      if (analyzeResponse.status !== 200) throw new Error('Analysis failed.');
      
      setStatus('success');
      router.push(`/clips/${transcriptId}`);

    } catch (err) {
      setError(err.response ? err.response.data.message : 'An unexpected error occurred.');
      setStatus('error');
      console.error(err);
    }
  }, [router]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mov', '.avi', '.mkv'] },
    multiple: false,
    noClick: true, // We'll trigger the click manually
    disabled: status !== 'idle' && status !== 'error',
  });

  const renderStatus = () => {
    switch (status) {
      case 'uploading':
        return (
            <>
                <Loader className="animate-spin h-12 w-12 text-gray-500 mx-auto mb-4" />
                <p className="text-lg font-semibold">Uploading...</p>
                <p className="text-sm text-gray-500">{progress}%</p>
            </>
        );
      case 'analyzing':
        return (
            <>
                <Loader className="animate-spin h-12 w-12 text-indigo-500 mx-auto mb-4" />
                <p className="text-lg font-semibold">Analyzing Video</p>
                <p className="text-sm text-gray-500">Our AI is finding the best moments...</p>
            </>
        );
      case 'success':
        return (
            <>
                <FileCheck className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-semibold">Success!</p>
                <p className="text-sm text-gray-500">Redirecting to your clips...</p>
            </>
        );
      case 'error':
        return (
            <>
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-lg font-semibold">Upload Failed</p>
                <p className="text-sm text-red-600">{error}</p>
            </>
        );
      default: // idle
        return (
            <>
                <UploadCloud className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg text-gray-600">Drag & drop a video file here</p>
                <p className="text-sm text-gray-500 mt-1">or</p>
            </>
        );
    }
  };


  return (
    <div className="flex flex-col items-center justify-center space-y-4">
        <div 
            {...getRootProps()} 
            className={`w-full p-10 border-2 border-dashed rounded-lg text-center transition-colors duration-300 flex flex-col items-center justify-center
                ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'} 
                ${(status !== 'idle' && status !== 'error') ? 'cursor-not-allowed bg-gray-100' : 'cursor-pointer hover:border-gray-400'}`}
        >
            <input {...getInputProps()} />
            {renderStatus()}
        </div>

        {status === 'idle' || status === 'error' ? (
            <button 
                type="button"
                onClick={open}
                className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
                Select Video File
            </button>
        ) : null}

        {status === 'uploading' && (
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
            <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
        )}
    </div>
  );
} 