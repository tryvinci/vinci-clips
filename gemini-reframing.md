# Gemini's Project Brain: Vinci Clips

This document outlines my understanding of the Vinci Clips project, its architecture, and the implementation details of its core features.

## Project Overview

Vinci Clips is a web-based video editor designed to automate the process of reframing landscape videos into vertical formats (like 9:16 for TikTok/Shorts). The key feature is the "AI Smart Frame," which intelligently crops the video to follow the main subject or speaker.

## Key Technologies

- **Frontend:** React, Next.js, TypeScript
- **Backend:** Node.js, Express.js
- **Video Processing:** FFmpeg (via `fluent-ffmpeg`)
- **AI / Machine Learning:**
    - **`face-api.js` (Frontend):** Used for client-side face detection and tracking directly in the browser.
    - **`@mediapipe/tasks-vision` (Previous):** Was previously used for face and pose detection but has been replaced by `face-api.js` for more robust tracking.

## Core Feature: AI Smart Cropping Workflow

The smart cropping is a multi-step process that spans both the frontend and backend.

### 1. Frontend: Face Detection & Tracking (`frontend/src/components/SubjectDetection.tsx`)

- **Models:** This component uses `face-api.js`. The required pre-trained models (`tinyFaceDetector`, `faceLandmark68Net`, `faceRecognitionNet`) must be located in the `frontend/public/models/` directory to be accessible by the browser.
- **Process:**
    1.  When the user initiates "Detect Subjects," the component loads the video into an HTML `<video>` element.
    2.  It processes the video frame-by-frame (at a sample rate of every 0.5 seconds).
    3.  For each frame, it uses `face-api.js` to detect all faces and compute their unique descriptors.
    4.  **Face Tracking:** A simple tracking mechanism is implemented. It maintains a list of `trackedFaces`. For each new detection, it compares the face descriptor to the known faces.
        - If a match is found (based on Euclidean distance), the existing face's data is updated.
        - If no match is found, a new face with a new, incrementing ID is added to the `trackedFaces` list.
    5.  **Output:** The component calls the `onDetectionComplete` prop, passing a complete array of *all* detections across the entire video. Each detection object includes the face's `id`, its `boundingBox`, and the `time` it was seen.

### 2. Frontend: UI & Orchestration (`frontend/src/components/ReframeModal.tsx`)

- This component acts as the user interface for the reframing feature.
- It receives the full array of tracked detections from `SubjectDetection.tsx`.
- It sends this detection data to the backend's `/generate` endpoint when the user clicks "Generate Clip."

### 3. Backend: Visual Director Logic (`backend/src/routes/reframe.js`)

- This is the core of the intelligent cropping logic. It no longer relies on a static crop or simple transcript mapping.
- **`generateVisualDirectorFilter` Function:**
    1.  **Protagonist Identification:** It groups all incoming detections by timestamp. For each moment, it identifies the "protagonist" by finding the face that is geometrically closest to the center of the video frame.
    2.  **Scene Creation:** It creates "scenes" by identifying continuous time segments where the protagonist (the central face ID) does not change.
    3.  **Stable Crop Calculation:** For each scene, it calculates the *average* position and size of the protagonist's face. This creates a stable target for the crop window, preventing shaky or jittery movements.
    4.  **Smooth Panning:** When the protagonist changes from one scene to the next, the function generates a dynamic FFmpeg filter string. This string uses FFmpeg's expression capabilities to create a linear interpolation (a smooth pan) between the crop position of the last scene and the crop position of the new scene.
    5.  **Configurable Transition:** The duration of this pan is controlled by the `TRANSITION_DURATION` constant (currently set to `0.5` seconds), which can be easily adjusted.

- **`/generate` Endpoint:**
    - Receives the full detection timeline from the frontend.
    - Calls `generateVisualDirectorFilter` to build the complex filter string.
    - Executes FFmpeg with this filter to render the final, smoothly cropped 9:16 video, preserving the original audio.
