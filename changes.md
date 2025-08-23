# Project Vinci Clips: Detailed Analysis of Code Modifications

This document provides a detailed, code-level analysis of recent changes to the Vinci Clips project, focusing on backend logic, authentication, and data model updates.

## Files Ready for Staging

The following files contain significant logic updates and are ready for staging:

### Backend

-   `backend/package-lock.json`
-   `backend/package.json`
-   `backend/src/index.js`
-   `backend/src/models/Transcript.js`
-   `backend/src/routes/clips.js`
-   `backend/src/routes/index.js`
-   `backend/src/routes/transcripts.js`
-   `backend/src/routes/upload.js`
-   `backend/src/middleware/auth.js` (New File)

### Frontend (Logic Changes)

-   `frontend/middleware.ts` (New File)
-   `frontend/src/app/clips/transcripts/[id]/page.tsx`
-   `frontend/src/app/clips/transcripts/page.tsx`
-   `frontend/src/app/upload/page.tsx`
-   `frontend/src/components/CaptionGenerator.tsx`
-   `frontend/src/components/ReframeModal.tsx`
-   `frontend/src/components/StreamerGameplayCrop.tsx`

---

## Detailed Backend Modifications

### 1. Authentication Middleware (`backend/src/middleware/auth.js`)

-   **New Middleware:** A new authentication middleware has been introduced to protect API routes.
-   **Logic:** It uses `@clerk/clerk-sdk-node` to verify the JWT token sent in the `Authorization` header of incoming requests.
-   **User ID Injection:** Upon successful verification, it injects the `auth` object, containing the `userId`, into the `req` object (`req.auth = { userId }`). This makes the user's ID available to all subsequent route handlers.
-   **Error Handling:** If the token is missing or invalid, it returns a `401 Unauthorized` error, preventing unauthorized access.

### 2. Main Router (`backend/src/routes/index.js`)

-   **Authentication Applied:** The new `authenticate` middleware is now applied to all critical API routes (`/upload`, `/import`, `/transcripts`, `/analyze`, `/clips`, etc.).
-   **Video Proxy Endpoint:** A new public endpoint `GET /video-proxy/:filename` has been added. This endpoint streams video files directly from Google Cloud Storage. This is a workaround for CORS issues that prevent the frontend from directly accessing GCS URLs. It does not use the `authenticate` middleware, allowing public access to the video files via a proxied URL.

### 3. Transcript Data Model (`backend/src/models/Transcript.js`)

-   **Schema Expansion:** The `TranscriptSchema` has been significantly expanded to store more detailed information.
    -   `speaker`: Added to the `transcript` array to support speaker diarization.
    -   `videoCloudPath`: A new string field to store the direct path to the video file in GCS (e.g., `users/USER_ID/videos/FILENAME.mp4`). This is crucial for backend processing tasks.
    -   `importUrl`, `platform`, `externalVideoId`: Fields added to support importing videos from external sources like YouTube, storing the original URL and platform-specific ID.
-   **User ID Indexing:** The `userId` field is now indexed (`index: true`) for faster querying of transcripts belonging to a specific user.

### 4. User-Specific Data Access (All Route Files)

-   **Authentication Logic:** Across all route files (`transcripts.js`, `clips.js`, `upload.js`), the logic has been updated to use `req.auth.userId` to ensure users can only access their own data.
-   **Database Queries:** Mongoose queries have been updated to include a `userId` filter.
-   **File Storage Path:** The upload logic in `upload.js` now saves files to user-specific paths in GCS to ensure data isolation.

### 5. Upload and Transcription Logic (`backend/src/routes/upload.js`)

-   **User-Specific Upload:** The `userId` from `req.auth.userId` is now used to create a user-specific folder in GCS for storing videos, audio files, and thumbnails.
-   **Gemini API Integration:** The transcription process now uses the `@google/generative-ai` SDK.
    -   It uploads the extracted MP3 file to the Gemini File API.
    -   It sends a detailed prompt to the `gemini-1.5-flash` model, requesting a JSON output with word-level timestamps and speaker identification.
    -   The model is configured with a specific `responseSchema` to enforce the JSON output format.
-   **Status Updates:** The `transcript.status` is now updated at each stage of the process (`uploading`, `converting`, `transcribing`, `completed`, `failed`), providing better real-time feedback to the frontend.

### 6. Clip and Transcript Deletion (`backend/src/routes/transcripts.js`)

-   **Cloud Storage Cleanup:** The `DELETE /:id` endpoint has been enhanced. When a transcript is deleted, it now also deletes the associated video, MP3, and thumbnail files from Google Cloud Storage using the `videoCloudPath`.
-   **Error Handling:** `Promise.all` is used to manage the deletion promises, and `catch` blocks are added to prevent the entire operation from failing if one file deletion fails.

---

## Detailed Frontend Modifications (Logic)

### 1. API Requests with Authentication Tokens

-   **`useAuth` Hook:** All components making API calls now use the `useAuth` hook from `@clerk/nextjs` to get a JWT token.
-   **Authorization Header:** The retrieved token is added to the `Authorization` header of every authenticated `axios` request.

### 2. Frontend Middleware (`frontend/middleware.ts`)

-   **New Middleware:** A new Next.js middleware has been created to protect frontend routes.
-   **Logic:** It uses `@clerk/nextjs`'s `authMiddleware` to define public and private routes. Any attempt to access a private route without being authenticated will result in a redirect to the sign-in page.

### 3. State Management and API Integration

-   **Data Fetching:** Pages like `upload/page.tsx` and `clips/transcripts/page.tsx` now fetch user-specific data by making authenticated API calls. The backend handles the filtering based on the `userId` from the token.
-   **Polling for Status:** The upload page (`upload/page.tsx`) now includes a polling mechanism. It periodically re-fetches the list of transcripts to update the status of videos that are still processing (`uploading`, `converting`, `transcribing`).
-   **Component API Calls:** Components like `CaptionGenerator.tsx`, `ReframeModal.tsx`, and `StreamerGameplayCrop.tsx` now make authenticated POST requests to their respective backend endpoints (`/api/captions/generate`, `/api/reframe/generate`, etc.), passing the `transcriptId` and other necessary parameters.