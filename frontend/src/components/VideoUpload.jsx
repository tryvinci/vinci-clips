import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/router';
import axios from 'axios';
import { UploadCloud, FileCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

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
    noClick: true,
    disabled: status !== 'idle' && status !== 'error',
  });

  const renderStatus = () => {
    switch (status) {
      case 'uploading':
        return (
            <div className="text-center">
                <Loader2 className="animate-spin h-12 w-12 text-primary mx-auto mb-4" />
                <p className="font-semibold">Uploading...</p>
                <Progress value={progress} className="w-full mt-4" />
            </div>
        );
      case 'analyzing':
        return (
            <div className="text-center">
                <Loader2 className="animate-spin h-12 w-12 text-primary mx-auto mb-4" />
                <p className="font-semibold">Analyzing Video</p>
                <p className="text-sm text-muted-foreground">Our AI is finding the best moments...</p>
            </div>
        );
      case 'success':
        return (
            <div className="text-center">
                <FileCheck className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="font-semibold">Success!</p>
                <p className="text-sm text-muted-foreground">Redirecting to your clips...</p>
            </div>
        );
      case 'error':
        return (
            <div className="text-center">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="font-semibold">Upload Failed</p>
                <p className="text-sm text-destructive">{error}</p>
            </div>
        );
      default: // idle
        return (
          <div {...getRootProps({ className: `flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : ''}` })}>
            <input {...getInputProps()} />
            <UploadCloud className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Drag & drop a video file here, or click the button below</p>
          </div>
        );
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
            <CardTitle>Create a New Clip</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            {renderStatus()}
            {(status === 'idle' || status === 'error') && (
                <Button onClick={open} className="w-full">
                    Select Video File
                </Button>
            )}
        </CardContent>
    </Card>
  );
} 