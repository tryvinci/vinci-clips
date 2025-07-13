import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export default function VideoUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Basic validation
    if (file.size > 2 * 1024 * 1024 * 1024) { // 2GB
        setError('File size must not exceed 2GB.');
        return;
    }

    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('video', file);

    try {
      const response = await fetch('http://localhost:8080/clips/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      console.log('Upload successful:', data);
      // Handle successful upload
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'video/mov': ['.mov'],
      'video/avi': ['.avi'],
    },
    multiple: false,
  });

  return (
    <div className="p-8 border-2 border-dashed rounded-lg text-center cursor-pointer">
      <div {...getRootProps()}>
        <input {...getInputProps()} />
        {
          isDragActive ?
            <p>Drop the video here ...</p> :
            <p>Drag 'n' drop a video here, or click to select one</p>
        }
        <p className="text-xs text-gray-500 mt-2">MP4, MOV, AVI supported, up to 2GB</p>
      </div>
      {uploading && <p className="mt-4">Uploading...</p>}
      {error && <p className="mt-4 text-red-500">{error}</p>}
    </div>
  );
} 