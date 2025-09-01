# Gemini Agent Knowledge Base for Vinci Clips

This document summarizes the key architectural points and fixes implemented for the Vinci Clips application.

## Core Architecture

- **Frontend:** A Next.js application located in the `frontend/` directory.
- **Backend:** A Node.js/Express application located in the `backend/` directory.
- **Database:** A local flat-file database is used, managed by a custom module.
  - **Location:** `backend/storage/db.json`
  - **Data Access:** All database operations are handled by the custom module at `backend/src/localdb.js`. It exposes a Mongoose-like API.
  - **IMPORTANT:** The data models do **not** have a `.save()` method. All updates to existing documents must use `Transcript.findByIdAndUpdate(id, updates)`. New documents should be created with `Transcript.create(data)`.

## File Storage & Pathing

This has been the source of most bugs and is now standardized.

- **Canonical Storage Directory:** All user-accessible media files (original videos, generated clips, thumbnails, mp3s, etc.) are stored in the `/home/samyak/vinci-clips/backend/uploads/` directory.
- **Web-Accessible URL Path:** The backend serves the `backend/uploads/` directory under the `/uploads` URL path (e.g., `http://localhost:8080/uploads/...`). This is configured in `backend/src/index.js`.
- **Backend vs. Frontend Paths:**
  - **Backend (`ffmpeg`, `fs`):** Requires absolute filesystem paths (e.g., `/home/samyak/vinci-clips/backend/uploads/clip.mp4`). These must be constructed using `path.join(__dirname, '..', '..', 'uploads', ...)`.
  - **Frontend (Video Players, Links):** Requires full, web-accessible URLs. It must prepend the `API_URL` (e.g., `http://localhost:8080`) to the relative paths returned by the backend (e.g., `/uploads/clip.mp4`).

## Key Workflows & Fixes Implemented

### 1. Video Upload & Import

- **File Upload (`/upload/file`):**
  - Temporary files are now correctly saved to `backend/uploads/temp/`.
  - After processing (`ffmpeg` for mp3/thumbnail), the final assets are moved to the main `backend/uploads/` directory.
  - The database record is updated with the correct `/uploads/...` URL.
  - Faulty logic that deleted the final files after upload has been removed.
- **YouTube Import (`/import/url`):**
  - Was missing transcription logic entirely. This has been added, mirroring the logic from the file upload route.
  - File paths were corrected to save the imported video and its assets to the `backend/uploads/` directory.
  - All `.save()` calls were replaced with the correct `Transcript.create` and `Transcript.findByIdAndUpdate` methods.

### 2. Clip Generation (`/clips/generate/:id`)

- **Persistence:** Generated clips are no longer lost on page reload.
  - The backend (`/transcripts/:id` route) now checks for existing clip files in `backend/uploads/clips/` when a transcript is loaded and includes their URLs in the response.
  - The frontend uses this data to populate the "Generated Clips" section on page load.
- **Re-generation:** The backend now checks if a clip file already exists before running `ffmpeg`. If it does, it immediately returns the URL to the existing file, preventing the process from getting stuck.
- **Pathing:** `ffmpeg` commands were updated to use absolute filesystem paths for both input and output, resolving silent failures.

### 3. Captioning & Reframing

- **Caption Generation (`/captions/generate/:id`):**
  - The input video path was corrected to point to the `uploads` directory.
  - The output path for the captioned video was corrected to `backend/uploads/captioned/`, and the returned URL was updated to `/uploads/captioned/...`.
- **Streamer+Gameplay Crop (`/reframe/streamer-gameplay`):**
  - The input video path was corrected to use the local filesystem path instead of attempting to download from a URL.
  - The output path was corrected to save the final video to `backend/uploads/temp/` and return the correct `/uploads/temp/...` URL.
- **Reframe Modal (`ReframeModal.tsx`):**
  - The modal was failing to generate a preview because of an incorrect video path passed to the `/reframe/analyze` route.
  - The logic was fixed to correctly handle two types of URLs: original videos (`/uploads/video.mp4`) and generated clips (`/uploads/clips/clip_1.mp4`), constructing the correct absolute filesystem path for the backend in both cases.
  - The final "Generate" step was failing because the backend was deleting the clip after analysis. This deletion logic was removed.
  - All video URLs displayed in the modal are now correctly prefixed with the `API_URL`.

### 4. Frontend Polling (`upload/page.tsx`)

- **Issue:** The page was polling for transcript status updates far too rapidly, causing log spam.
- **Fix:** The `useEffect` hook was corrected to poll at a steady interval. The logic was also improved to stop polling automatically once all recent videos have a "completed" or "failed" status.
