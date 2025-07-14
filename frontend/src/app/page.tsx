"use client";

import React, { useState } from 'react';
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UploadCloud } from 'lucide-react';

export default function Home() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState('');

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
    setUploading(true);
    setUploadProgress(0);
    setMessage('Uploading...');

    const formData = new FormData();
    formData.append('video', file);

    try {
      const response = await axios.post('http://localhost:8080/upload', formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        },
      });
      setMessage('Upload successful! Analyzing video...');
      // You can handle the analysis response here
      console.log(response.data);
      setMessage('Analysis complete!');
    } catch (error) {
      console.error('Error uploading file:', error);
      setMessage('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-background">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Create a New Clip</CardTitle>
          <CardDescription>Upload your video, and our AI will find the best moments.</CardDescription>
        </CardHeader>
        <CardContent>
          <div 
            className="border-2 border-dashed border-muted rounded-lg p-12 text-center cursor-pointer"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Drag & drop a video file here, or click to select a file</p>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept="video/*"
            />
          </div>
          {uploading && (
            <div className="mt-4">
              <Progress value={uploadProgress} />
              <p className="mt-2 text-center text-muted-foreground">{message} ({uploadProgress}%)</p>
            </div>
          )}
          {!uploading && message && (
            <p className="mt-4 text-center text-muted-foreground">{message}</p>
          )}
          <div className="mt-6 text-center">
            <Button asChild variant="link">
              <a href="/transcripts">Or, view all processed videos</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
} 