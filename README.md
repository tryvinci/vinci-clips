# Vinci Clips

Vinci Clips is a web application that automatically generates short, engaging video clips from longer videos. It uses AI to transcribe the video, analyze the transcript, and suggest the best segments to use as clips.

## Architecture

The application is built with a modern, full-stack architecture:

-   **Frontend:** A Next.js application built with React and TypeScript. It uses `shadcn-ui` for components and Tailwind CSS for styling.
-   **Backend:** A Node.js server built with Express. It handles video uploads, processing, and communication with the database and AI services.
-   **Database:** MongoDB is used to store information about uploaded videos, transcripts, and generated clips.
-   **AI Services:**
    -   **Transcription:** Google's Gemini API is used directly from the Node.js backend to transcribe the audio from uploaded videos.
    -   **Analysis:** The Node.js backend can use either the Gemini or Groq API to analyze the transcript and suggest clips.

### High-Level Flow

1.  **Upload:** The user uploads a video file through the web interface.
2.  **Conversion:** The backend server converts the video to an MP3 file using `ffmpeg`.
3.  **Cloud Storage:** Both the original video and the MP3 are uploaded to Google Cloud Storage.
4.  **Transcription:** The backend directly calls the Gemini API to transcribe the MP3 file.
5.  **Analysis:** The backend directly calls either the Gemini or Groq API to analyze the transcript and generate up to 5 suggested clips.
6.  **Database:** All data, including file URLs, the transcript, and the suggested clips, is stored in a MongoDB database.
7.  **Display:** The frontend displays the transcript and the suggested clips to the user.

## Setup

To get the application running locally, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd vinci-clips
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Install `ffmpeg`:**
    If you don't have it, you can install it with Homebrew:
    ```bash
    brew install ffmpeg
    ```

4.  **Create a `.env` file:**
    Create a `.env` file in the root of the project and add the following environment variables:

    ```
    # Port for the backend server
    PORT=8080

    # MongoDB Connection URI
    DB_URL="your_mongodb_connection_uri"
    DB_NAME=vinci_dev

    # GCP Credentials
    GCP_PROJECT_ID="your_gcp_project_id"
    GCP_BUCKET_NAME="your_gcp_bucket_name"
    GCP_SERVICE_ACCOUNT_PATH="path/to/your/vinci-service-account.json"

    # Gemini API Key
    GEMINI_API_KEY="your_gemini_api_key"

    # Groq API Key
    GROQ_API_KEY="your_groq_api_key"

    # LLM Configuration
    LLM_PROVIDER="gemini" # or "groq"
    LLM_MODEL="gemini-1.5-flash" # or any other supported model
    ```

    Replace the placeholder values with your actual credentials.

5.  **Start the application:**
    ```bash
    npm start
    ```

    The frontend will be available at `http://localhost:3000` and the backend at `http://localhost:8080`.

## API

The backend exposes the following API endpoints under the `/clips` prefix:

-   **`POST /upload`**: Uploads a video file.
-   **`POST /analyze/:transcriptId`**: Analyzes a transcript and generates clips.
-   **`GET /`**: Retrieves all transcripts.
-   **`GET /:transcriptId`**: Retrieves a single transcript. 