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

## 3. upload.js is a Node.js module that uses the Express framework to handle video uploads. Here's a breakdown of its functionality:

  Key Technologies:

   * Express.js: A web framework for Node.js, used to define the API routes.
   * Multer: Middleware for handling multipart/form-data, which is primarily used for uploading files.
   * @google-cloud/storage: Google Cloud Storage client library for uploading files to a GCS bucket.
   * @google/generative-ai: Google's Generative AI SDK for interacting with the Gemini API for transcription.
   * ffmpeg: A command-line tool for handling multimedia files. It's used here to extract audio and generate thumbnails.
   * Mongoose: An ODM (Object Data Modeling) library for MongoDB, used to interact with the Transcript model.

  Workflow:

   1. Initialization: The module sets up an Express router, configures Multer for file uploads (with a 2GB limit), and initializes the
      Google Cloud Storage client.

   2. Server-Sent Events (SSE) Connection (`GET /`):
       * A GET endpoint is defined to establish a Server-Sent Events (SSE) connection with the client.
       * This is likely intended for sending real-time progress updates to the frontend, although the code doesn't currently send any
         specific events.

   3. File Upload and Processing (`POST /file`):
       * This is the core of the module, handling the actual file upload and processing.
       * Authentication: It first verifies that a userId is present in the request; otherwise, it returns an "Unauthorized" error.
       * Database Record: A new Transcript record is immediately created in the database with a status of "uploading".
       * Video Processing:
           * The video's duration is extracted using ffprobe.
           * The status is updated to "converting".
           * ffmpeg is used to generate a thumbnail from the first frame of the video and to convert the video into an MP3 audio file.
       * Cloud Storage: The original video, the MP3, and the thumbnail are uploaded to a Google Cloud Storage bucket.
       * Transcription:
           * The status is updated to "transcribing".
           * The MP3 file is sent to the Google Gemini AI API for transcription. The API is specifically instructed to provide
             word-level timestamps and speaker identification, returning the result in JSON format.
       * Finalization:
           * The transcript data, along with the URLs of the stored video, audio, and thumbnail, is saved to the database.
           * The status is updated to "completed".
           * The temporary local files are deleted.
           * A success response containing the completed transcript is sent to the client.

  Error Handling:

   * The entire process is wrapped in try...catch blocks to handle potential errors.
   * If any step fails (e.g., video conversion, cloud upload, or transcription), the transcript's status is updated to "failed" in the
     database, and an appropriate error response is sent. The local files are also cleaned up on failure.


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
