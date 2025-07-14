# Vinci Clips

Vinci Clips is a web application that automatically generates short, engaging video clips from longer videos. It uses AI to transcribe the video, analyze the transcript, and suggest the best moments to turn into clips.

## High-Level Architecture

The application is built with a modern, full-stack architecture:

-   **Frontend:** A Next.js application built with React, TypeScript, and Tailwind CSS.
-   **Backend:** A Node.js server built with Express.
-   **Database:** MongoDB for storing transcripts and clip data.
-   **AI Services:** Google's Gemini API for transcription and clip analysis, used directly from Node.js.
-   **Cloud Storage:** Google Cloud Storage for storing video and audio files.

## Core Workflow

1.  **Upload:** A user uploads a video file (up to 2GB) through the web interface.
2.  **Conversion:** The backend converts the video to an MP3 file using `ffmpeg`.
3.  **Cloud Storage:** The original video and the new MP3 file are uploaded to Google Cloud Storage in parallel for efficiency.
4.  **Transcription:** The backend uses the Gemini API to transcribe the audio from the GCS link, including speaker diarization.
5.  **Analysis:** The system analyzes the transcript to suggest potential clips (this is the next step in our roadmap).
6.  **Database:** All transcript data, including speaker segments and cloud storage URLs, is saved to a MongoDB database.
7.  **Display:** The frontend displays the transcript, allows video playback, and will soon show the suggested clips.

## Getting Started

### Prerequisites

-   Node.js (v18 or later)
-   `ffmpeg` installed and available in your system's PATH.
-   A Google Cloud Platform account with a service account key and a GCS bucket.
-   A MongoDB database and connection string.
-   A Gemini API key.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd vinci-clips
    ```

2.  **Install dependencies for both frontend and backend:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the `backend` directory and add the following:
    ```
    PORT=8080
    DB_URL=<your-mongodb-connection-string>
    GCP_BUCKET_NAME=<your-gcs-bucket-name>
    GCP_SERVICE_ACCOUNT_PATH=<path-to-your-gcp-service-account.json>
    GEMINI_API_KEY=<your-gemini-api-key>
    ```

4.  **Run the application:**
    ```bash
    npm start
    ```
    This will start both the backend and frontend servers. The frontend will be available at `http://localhost:3000`.

---

## Roadmap & Test Cases

This section outlines the future development plans and the test cases for the existing and upcoming features.

### Backend Test Cases

| Feature                 | Test Case                                                                                                    | Status      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | ----------- |
| **File Upload**         | Upload a video file (e.g., `.mp4`, `.mov`).                                                                  | **Passed**  |
|                         | Upload a file larger than 2GB and verify it's rejected.                                                      | **Passed**  |
|                         | Attempt to upload a non-video file and verify it's handled gracefully.                                       | *To Do*     |
| **Video Conversion**    | Verify that the uploaded video is correctly converted to an MP3 file.                                        | **Passed**  |
| **Cloud Storage**       | Confirm that both the video and MP3 files are successfully uploaded to Google Cloud Storage.                   | **Passed**  |
| **Transcription**       | Verify that the audio is transcribed accurately.                                                             | **Passed**  |
|                         | Check that the transcript includes correct start and end times for each segment.                             | **Passed**  |
|                         | Confirm that speaker diarization correctly identifies and labels different speakers.                         | **Passed**  |
| **API Endpoints**       | `POST /clips/upload/file`: Test with a valid video file.                                                     | **Passed**  |
|                         | `GET /clips/transcripts`: Verify it returns a list of all transcripts.                                       | **Passed**  |
|                         | `GET /clips/transcripts/:id`: Verify it returns the correct transcript for a given ID.                       | **Passed**  |
| **Clip Analysis**       | **(Next Up)** `POST /clips/analyze/:id`: Send a transcript ID and receive a list of suggested clips.         | *To Do*     |

### Frontend Test Cases

| Feature                  | Test Case                                                                                                     | Status      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- | ----------- |
| **Upload Page**          | The main upload component renders correctly.                                                                  | **Passed**  |
|                          | A user can select a file by clicking or dragging and dropping.                                                | **Passed**  |
|                          | The upload progress bar and percentage update accurately.                                                     | **Passed**  |
|                          | The progress text shows the correct MB/GB uploaded.                                                           | **Passed**  |
|                          | A friendly error message is shown for files larger than 2GB.                                                  | **Passed**  |
| **Transcripts List**     | `/clips/transcripts` page loads and displays a list of all processed videos.                                  | **Passed**  |
|                          | Each item in the list links to the correct transcript detail page.                                            | **Passed**  |
| **Transcript Detail**    | `/clips/transcripts/:id` page loads the correct transcript.                                                   | **Passed**  |
|                          | The video player loads and plays the correct video.                                                           | **Passed**  |
|                          | The transcript is displayed with speaker labels and timestamps.                                               | **Passed**  |
| **Clip Display**         | **(Next Up)** Display the list of suggested clips from the analysis endpoint.                                 | *To Do*     |
|                          | **(Next Up)** Allow the user to play a clip by clicking on it (seek video to start/end).                        | *To Do*     |

---

This README will be updated as the project evolves. 