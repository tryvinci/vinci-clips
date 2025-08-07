"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { UploadCloud, Clock, CheckCircle, AlertCircle, Loader2, Link as LinkIcon, Globe, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface Transcript {
  _id: string;
  originalFilename: string;
  createdAt: string;
  status?: 'uploading' | 'converting' | 'transcribing' | 'completed' | 'failed';
  duration?: number;
  thumbnailUrl?: string;
}

export default function Home() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [message, setMessage] = useState('');
  const [recentTranscripts, setRecentTranscripts] = useState<Transcript[]>([]);
  const [loadingTranscripts, setLoadingTranscripts] = useState(true);
  const [importUrl, setImportUrl] = useState('');
  const [importMode, setImportMode] = useState<'file' | 'url'>('file');

  useEffect(() => {
    const fetchRecentTranscripts = async () => {
      try {
        const response = await axios.get('http://localhost:8080/clips/transcripts');
        setRecentTranscripts(response.data.slice(0, 6)); // Show only 6 most recent
      } catch (err) {
        console.error('Failed to fetch recent transcripts:', err);
      } finally {
        setLoadingTranscripts(false);
      }
    };

    fetchRecentTranscripts();

    // Set up polling for status updates only if there are processing videos
    const checkForProcessingVideos = () => {
      return recentTranscripts.some(transcript => 
        transcript.status && !['completed', 'failed'].includes(transcript.status)
      );
    };

    let interval: NodeJS.Timeout | null = null;
    
    if (checkForProcessingVideos()) {
      interval = setInterval(fetchRecentTranscripts, 10000); // Poll every 10 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recentTranscripts]);

  const getStatusIcon = (status: string | undefined) => {
    // If status is undefined, assume it's a completed older record
    if (!status) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'uploading':
      case 'converting':
      case 'transcribing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    // If status is undefined, assume it's a completed older record
    if (!status) {
      return <Badge variant="default">Ready</Badge>;
    }
    
    const statusConfig = {
      uploading: { label: 'Uploading', variant: 'secondary' as const },
      converting: { label: 'Converting', variant: 'secondary' as const },
      transcribing: { label: 'Transcribing', variant: 'secondary' as const },
      completed: { label: 'Ready', variant: 'default' as const },
      failed: { label: 'Failed', variant: 'destructive' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { label: 'Unknown', variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      await handleUpload(files[0]);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      await handleUpload(files[0]);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };
  
  const handleUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024 * 1024) {
        setMessage('File is too large. Please upload a file smaller than 2GB.');
        return;
    }

    setUploading(true);
    setUploadProgress(0);
    setProgressText('');
    setMessage('Connecting to server...');

    const formData = new FormData();
    formData.append('video', file);

    // Remove EventSource logic for upload progress for now to simplify
    try {
      setMessage('Uploading and processing...');
      const response = await axios.post('http://localhost:8080/clips/upload/file', formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
            
            const loadedMB = (progressEvent.loaded / (1024 * 1024)).toFixed(2);
            const totalMB = (progressEvent.total / (1024 * 1024)).toFixed(2);
            setProgressText(`${loadedMB} MB / ${totalMB} MB`);

            if (percentCompleted < 100) {
              setMessage(`Uploading...`);
            } else {
              setMessage('Processing video... this may take a moment.');
            }
          }
        },
      });
      setMessage('Analysis complete!');
      console.log(response.data);
      // Refresh the recent transcripts list
      const refreshResponse = await axios.get('http://localhost:8080/clips/transcripts');
      setRecentTranscripts(refreshResponse.data.slice(0, 6));

    } catch (error) {
      console.error('Error uploading file:', error);
      setMessage('Upload failed. Please try again.');
    } finally {
        setUploading(false);
    }
  };

  const handleUrlImport = async () => {
    if (!importUrl.trim()) {
      setMessage('Please enter a valid URL.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setProgressText('');
    setMessage('Extracting video information...');

    try {
      const response = await axios.post('http://localhost:8080/clips/import/url', {
        url: importUrl.trim()
      });
      
      setMessage('Video imported successfully!');
      setImportUrl('');
      console.log(response.data);
      
      // Refresh the recent transcripts list
      const refreshResponse = await axios.get('http://localhost:8080/clips/transcripts');
      setRecentTranscripts(refreshResponse.data.slice(0, 6));

    } catch (error: any) {
      console.error('Error importing URL:', error);
      const errorMessage = error.response?.data?.error || 'Failed to import video from URL.';
      setMessage(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation(); // Prevent event bubbling
    
    if (confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      try {
        await axios.delete(`http://localhost:8080/clips/transcripts/${id}`);
        // Remove the deleted transcript from the state
        setRecentTranscripts(prev => prev.filter(t => t._id !== id));
        setMessage('Video deleted successfully');
      } catch (error) {
        console.error('Error deleting video:', error);
        setMessage('Failed to delete video');
      }
    }
  };

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <Card className="w-full max-w-2xl mx-auto mb-12">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Create a New Clip</CardTitle>
            <CardDescription>Upload your video or import from URL, and our AI will find the best moments.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Mode Selection */}
            <div className="flex gap-2 mb-6">
              <Button 
                variant={importMode === 'file' ? 'default' : 'outline'}
                onClick={() => setImportMode('file')}
                className="flex items-center gap-2"
              >
                <UploadCloud className="h-4 w-4" />
                Upload File
              </Button>
              <Button 
                variant={importMode === 'url' ? 'default' : 'outline'}
                onClick={() => setImportMode('url')}
                className="flex items-center gap-2"
              >
                <LinkIcon className="h-4 w-4" />
                Import URL
              </Button>
            </div>

            {importMode === 'file' ? (
              <div 
                className="border-2 border-dashed border-muted rounded-lg p-12 text-center cursor-pointer"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Drag & drop a video file here, or click to select a file</p>
                <p className="text-xs text-muted-foreground mt-2">Max file size: 2GB. Supported formats: MP4, MOV, AVI, etc.</p>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  accept="video/*"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                  <Globe className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-muted-foreground">Import video from URL</p>
                  <p className="text-xs text-muted-foreground mt-2">Supported platforms: YouTube, Vimeo</p>
                  <div className="mt-4 flex gap-2">
                    <input
                      type="url"
                      placeholder="Paste video URL here..."
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      className="flex-1 px-3 py-2 border border-input rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      disabled={uploading}
                    />
                    <Button 
                      onClick={handleUrlImport}
                      disabled={uploading || !importUrl.trim()}
                    >
                      Import
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {uploading && (
              <div className="mt-4">
                <Progress value={uploadProgress} />
                <p className="mt-2 text-center text-muted-foreground">{message} {progressText && `(${progressText})`}</p>
              </div>
            )}
            {!uploading && message && (
              <p className="mt-4 text-center text-muted-foreground">{message}</p>
            )}
          </CardContent>
        </Card>

        <div className="w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Recent Videos</h2>
            <Button asChild variant="outline">
              <Link href="/clips/transcripts">View All</Link>
            </Button>
          </div>
          
          {loadingTranscripts ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : recentTranscripts.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">No videos uploaded yet. Upload your first video above!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentTranscripts.map((transcript) => (
                <Card key={transcript._id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center">
                        <CardTitle className="text-lg truncate pr-2">{transcript.originalFilename}</CardTitle>
                        <Trash2 
                          className="h-4 w-4 text-red-500 cursor-pointer ml-2 hover:text-red-700" 
                          onClick={(e) => handleDelete(transcript._id, e)}
                        />
                      </div>
                      {getStatusIcon(transcript.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        {getStatusBadge(transcript.status)}
                        {transcript.duration && (
                          <span className="text-sm text-muted-foreground">
                            {Math.floor(transcript.duration / 60)}:{String(Math.floor(transcript.duration % 60)).padStart(2, '0')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Created: {new Date(transcript.createdAt).toLocaleDateString()}
                      </p>
                      <Button 
                        asChild 
                        className="w-full" 
                        variant={!transcript.status || transcript.status === 'completed' ? 'default' : 'secondary'}
                        disabled={transcript.status && transcript.status !== 'completed'}
                      >
                        <Link href={`/clips/transcripts/${transcript._id}`}>
                          {!transcript.status || transcript.status === 'completed' ? 'View Details' : 'Processing...'}
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
} 