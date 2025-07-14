# 1. Overview

Vinci Clips is a web application that automatically generates short, engaging video clips from longer videos. It uses AI to transcribe the video, analyze the transcript, and suggest the best segments to use as clips.

# 2. High-Level Architecture

The application is built with a modern, full-stack architecture:

-   **Frontend:** A Next.js application built with React and TypeScript.
-   **Backend:** A Node.js server built with Express.
-   **Database:** MongoDB.
-   **AI Services:** Google's Gemini API and the Groq API.

## 2.1. Core Workflow

1.  **Upload:** The user uploads a video file.
2.  **Conversion:** The backend converts the video to an MP3 file.
3.  **Cloud Storage:** Both the video and the MP3 are uploaded to Google Cloud Storage.
4.  **Transcription:** The backend uses the Gemini API to transcribe the MP3.
5.  **Analysis:** The backend uses either the Gemini or Groq API to analyze the transcript and generate up to 5 suggested clips.
6.  **Database:** All data is stored in a MongoDB database.
7.  **Display:** The frontend displays the transcript and the suggested clips.

# 3. Non-Functional Requirements

-   **Scalability:** The application should be able to handle a large number of concurrent users and video uploads.
-   **Reliability:** The application should be highly available and resilient to failures.
-   **Security:** The application should be secure and protect user data.
-   **Performance:** The application should be fast and responsive.