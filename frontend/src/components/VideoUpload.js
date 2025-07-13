import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/router';
import axios from 'axios';

export default function VideoUpload() {
  const [status, setStatus] = useState('idle'); // idle, uploading, processing, analyzing, success, error
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
    setStatus('uploading');

    try {
      // Step 1: Upload the file
      const uploadResponse = await axios.post('http://localhost:8080/clips/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
        },
      });

      if (uploadResponse.status !== 200) {
        throw new Error('Upload and transcription failed.');
      }

      const { transcriptId } = uploadResponse.data;

      // Step 2: Trigger analysis
      setStatus('analyzing');
      const analyzeResponse = await axios.post('http://localhost:8080/clips/analyze', { transcriptId });

      if (analyzeResponse.status !== 200) {
        throw new Error('Analysis failed.');
      }
      
      setStatus('success');
      // Redirect to the clips page
      router.push(`/clips/${transcriptId}`);

    } catch (err) {
      setError(err.response ? err.response.data.message : err.message);
      setStatus('error');
      console.error(err);
    }
  }, [router]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mov', '.avi', '.mkv'] },
    multiple: false,
    disabled: status !== 'idle' && status !== 'error',
  });

  const getStatusMessage = () => {
    switch (status) {
      case 'uploading':
        return `Uploading... ${progress}%`;
      case 'analyzing':
        return 'Analyzing your video with AI...';
      case 'success':
        return 'Done! Redirecting...';
      case 'error':
        return `Error: ${error}`;
      default:
        return "Drag 'n' drop a video here, or click to select one";
    }
  };

  return (
    <div className={`w-full p-8 border-2 border-dashed rounded-lg text-center transition-colors duration-300 ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'} ${(status !== 'idle' && status !== 'error') ? 'cursor-not-allowed bg-gray-100' : 'cursor-pointer hover:border-gray-400'}`}>
      <div {...getRootProps()}>
        <input {...getInputProps()} />
        <p className="text-lg">{getStatusMessage()}</p>
        {status === 'idle' && <p className="text-sm text-gray-500 mt-2">MP4, MOV, AVI, MKV supported, up to 2GB</p>}
      </div>
      {status === 'uploading' && (
        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
          <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
      )}
    </div>
  );
} 