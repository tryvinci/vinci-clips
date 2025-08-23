# Project Context: Vinci Clips (for Gemini)

This document outlines the architecture, authentication flow, and key features of the Vinci Clips project. It is intended to provide a comprehensive context snapshot for a Gemini instance to quickly get up to speed with the codebase.

## 1. High-Level Architecture

Vinci Clips is a full-stack web application for uploading, analyzing, and generating short-form video clips.

-   **Frontend:** A **Next.js (React)** application responsible for all user interactions.
-   **Backend:** A **Node.js (Express)** API that handles business logic, video processing, and database interactions.
-   **Database:** **MongoDB** is used for storing application data, primarily video transcript information.
-   **Authentication:** **Clerk** is used for end-to-end user authentication and management.
-   **File Storage:** **Google Cloud Storage (GCS)** is used for storing all user-uploaded videos, thumbnails, and generated clips.
-   **Video Processing:** **FFmpeg** is used for all video manipulation tasks.
-   **Transcription:** **Google Gemini AI** (specifically the `gemini-1.5-flash` model) provides the core transcription and speaker diarization functionality.

---

## 2. Backend Deep Dive (`/backend`)

The backend is a standard Node.js Express API with a focus on user-specific data management and asynchronous video processing.

### Key Technologies

-   `express`: Web server framework.
-   `mongoose`: MongoDB object data modeling (ODM).
-   `@clerk/clerk-sdk-node`: Server-side authentication verification.
-   `@google-cloud/storage`: Interacting with GCS.
-   `@google/generative-ai`: Interacting with the Gemini AI for transcription.
-   `@distube/ytdl-core`: For downloading video content from YouTube.
-   `multer`: For handling direct file uploads.

### Authentication Flow

Authentication is a critical security feature.

1.  **Middleware:** The `backend/src/middleware/auth.js` file uses `ClerkExpressRequireAuth` to inspect the `Authorization: Bearer <token>` header of incoming API requests.
2.  **User ID Injection:** If the JWT is valid, Clerk injects an `auth` object into the request (`req.auth`), which contains the `userId`.
3.  **Route Protection:** In `backend/src/routes/index.js`, this `authenticate` middleware is applied to all sensitive routes (`/upload`, `/import`, `/transcripts`, etc.), ensuring that only authenticated users can access them.

### Data Model (`Transcript.js`)

The central data model is the `Transcript`.

-   **`userId: { type: String, required: true, index: true }`**: This field links every transcript to a specific user, ensuring multi-tenancy. It is indexed for efficient querying.
-   **`status: { type: String, enum: ['uploading', 'converting', 'transcribing', 'completed', 'failed'] }`**: This field tracks the current state of the video processing pipeline. The strict `enum` was a key factor in debugging the import feature.
-   **User-Specific Queries:** All database queries in the route handlers have been updated to use `req.auth.userId` to filter results, ensuring users can only access their own data.

---

## 3. Core Processing Pipeline (`videoProcessor.js`)

A significant refactoring effort led to the creation of a centralized utility, `backend/src/utils/videoProcessor.js`. This module contains the entire, shared pipeline for processing a video file after it has been downloaded or uploaded to the server. Both the `/upload` and `/import` routes now delegate to this processor, ensuring consistent and reliable behavior.

The pipeline executes the following steps asynchronously:

1.  **Status Update (`converting`):** The corresponding `Transcript` document in MongoDB is immediately updated to a status of `converting`.
2.  **Thumbnail Generation:** `ffmpeg` is executed to extract the first frame of the video into a JPEG thumbnail.
3.  **Audio Extraction:** `ffmpeg` is executed again to strip the video track and convert the audio into an MP3 file.
4.  **Cloud Storage Upload:** The original video file, the generated thumbnail, and the new MP3 audio file are all uploaded in parallel to a user-specific folder in the Google Cloud Storage (GCS) bucket (e.g., `users/USER_ID/...`).
5.  **Status Update (`transcribing`):** The `Transcript` status is updated to `transcribing`.
6.  **Gemini File Upload:** The local MP3 file is uploaded to the Gemini File API, which prepares it for AI processing.
7.  **Gemini Transcription:** A detailed prompt is sent to the Gemini generative model. This prompt specifically requests a JSON output containing a word-by-word transcript with precise start/end timestamps and speaker identification for each word.
8.  **Final Database Update (`completed`):** The `Transcript` record is updated a final time with the completed JSON transcript, the public URLs for the video/audio/thumbnail in GCS, the video duration, and the status is changed to `completed`.
9.  **Cleanup:** The temporary video, MP3, and thumbnail files are deleted from the local server filesystem.
10. **Error Handling:** If any step in this pipeline fails, the `Transcript` status is set to `failed`, and the local files are still cleaned up.

---

## 4. Key API Routes & Logic

-   **`/upload/file`**: Handles direct video uploads from a user's computer. It uses `multer` to save the file locally, creates an initial `Transcript` record with a status of `uploading`, and then immediately calls the `processVideo` utility to handle the file in the background. It responds to the client with a `202 Accepted` status right away, letting the frontend know that the long-running process has begun.
-   **`/import/url`**: Handles video imports from a YouTube URL. It uses `@distube/ytdl-core` to download the video to a temporary local directory. Similar to the upload route, it creates a `Transcript` record and then calls the same `processVideo` utility to manage the processing pipeline.
-   **`/transcripts`**:
    -   `GET /`: Fetches transcripts only for the currently authenticated user.
    -   `DELETE /:id`: Deletes a transcript and removes all associated files (video, audio, thumbnail) from GCS.

---

## 5. Debugging & Refactoring History

The YouTube import feature was recently fixed after a multi-step debugging process.

1.  **Initial Problem:** Imported videos were successfully downloaded but never transcribed. The process would get stuck or silently fail.
2.  **Investigation:** Analysis revealed that the transcription logic from the working `/upload` route was missing from the `/import` route. Early attempts to copy-paste the logic failed due to subtle bugs related to database schema validation (`status` enum), filename sanitization (special characters in YouTube titles), and incorrect file path handling.
3.  **Solution:** The core issue was resolved by refactoring the entire processing pipeline into the shared `backend/src/utils/videoProcessor.js` module. This eliminated code duplication and ensured that both uploaded and imported videos go through the exact same, proven processing logic, which fixed all outstanding bugs.

---

## 6. Identified Inefficiencies & Potential Improvements

The current processing pipeline, while functional, has a significant inefficiency:

-   **Redundant File Upload:** The MP3 audio file is uploaded twice during every job. First, it is uploaded to Google Cloud Storage for long-term storage. Second, it is uploaded to the Gemini File API for transcription.

This double-upload adds significant time to the transcription process, especially for large files.

**Proposed Improvement:**
The process can be made much faster by uploading the MP3 file **only once** to Google Cloud Storage. After the GCS upload is complete, the application should pass the GCS URL of the file directly to the Gemini API, which supports processing files from remote URLs. This would eliminate the second, redundant upload and cut down the processing time.