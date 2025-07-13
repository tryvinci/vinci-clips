# Clips: AI-Powered Video Clipping Tool

Welcome to the Clips project! We're excited you're here. This tool is designed to revolutionize how content creators, marketers, and podcasters repurpose long-form video content into engaging, social-media-ready short clips.

## About This Project
Clips automates the entire process of video clipping—from transcription and analysis to editing and formatting. By leveraging a powerful stack including Google Cloud Platform (GCP), AI-driven analysis from OpenAI and Google, and a modern web framework, we aim to build a scalable, intuitive, and powerful tool.

This project is currently in the initial development phase. We welcome contributors of all levels to help us build something amazing.

## Core Features
- **Video Upload & Processing**: Seamlessly upload various video formats with real-time feedback.
- **AI-Powered Transcription**: Generate highly accurate, timestamped transcriptions in multiple languages.
- **Intelligent Clipping**: Let our AI analyze the transcript and identify the most engaging, viral-worthy moments.
- **Auto-Reframing & Formatting**: Automatically adjust clips for various social media aspect ratios (e.g., 9:16, 1:1).
- **AI-Generated B-roll & Captions**: Enhance clips with contextually relevant B-roll and stylized, synchronized captions.
- **Social Media Integration**: Schedule and post clips directly to your favorite platforms.

## Technical Stack
Our technology choices are guided by scalability, performance, and developer experience.
-   **Frontend**: **Next.js** with **React** & **Tailwind CSS** for a modern, responsive, and fast user interface.
-   **Backend**: **Node.js** with **Express.js** for a robust and scalable REST API.
-   **Database**: **MongoDB** for its flexible, JSON-like document model that maps perfectly to our application data.
-   **Cloud Platform**: **Google Cloud Platform (GCP)** for its scalable infrastructure, including Cloud Storage and Cloud Run.
-   **AI/ML**:
    -   **OpenAI Whisper**: For state-of-the-art speech-to-text transcription.
    -   **Google Gemini API (Flash 2.0)**: For advanced LLM-based analysis to identify key moments.
-   **Video Processing**: **FFmpeg** as the industry-standard tool for video manipulation.

## Project Structure
This project follows a monorepo structure to keep the frontend, backend, and scripts organized yet integrated.
```
/clips
  ├── .github/            # CI/CD workflows
  ├── backend/            # Node.js/Express REST API
  │   ├── src/
  │   ├── package.json
  │   └── ...
  ├── frontend/           # Next.js web application
  │   ├── src/
  │   ├── package.json
  │   └── ...
  ├── scripts/            # Python scripts (Whisper, FFmpeg automation)
  │   ├── transcription/
  │   └── clipping/
  └── README.md
```

## Getting Started
Follow these steps to set up the project on your local machine.

### Prerequisites
-   Node.js (v18+) & npm/yarn
-   Python (v3.8+) & pip
-   MongoDB Atlas account or a local MongoDB instance
-   Google Cloud Platform (GCP) account with Cloud Storage and Gemini API enabled
-   FFmpeg installed on your system

### Installation
1.  **Clone the repository**:
    ```bash
    git clone <repository-url> clips
    cd clips
    ```
2.  **Set up the Backend**:
    ```bash
    cd backend
    npm install
    cp .env.example .env # Create your environment file
    ```
    Now, fill in your credentials (MongoDB URI, GCP keys, etc.) in the `.env` file.

3.  **Set up the Frontend**:
    ```bash
    cd ../frontend
    npm install
    ```
4.  **Set up Python Scripts**:
    ```bash
    cd ../scripts
    pip install -r requirements.txt # A requirements file will be created
    ```

### Running the Application
-   **Start the Backend Server**: `cd backend && npm start`
-   **Start the Frontend App**: `cd frontend && npm run dev`

The frontend will be accessible at `http://localhost:3000`.

## How to Contribute
We welcome contributions! Please follow our feature-branch Git workflow (`feature/`, `bugfix/`).

1.  Fork the repository and create your branch from `main`.
2.  Make your changes, adhering to our coding standards (ESLint/Prettier for JS/TS, Black/Flake8 for Python).
3.  Submit a pull request with a clear description of your changes, linking to any relevant issues.

## Current Roadmap (Phase 1)
Our immediate focus is on building the core functionality as outlined in our [Product Requirements Document](@PRD.md).

-   **Milestone 1: Video Upload & Storage**
    -   Develop the `VideoUpload` frontend component.
    -   Implement the `/clips/upload` backend endpoint.
    -   Integrate with GCP Cloud Storage for secure uploads.

-   **Milestone 2: Transcription Integration**
    -   Create a Python script for Whisper transcription.
    -   Connect the script to the backend for processing.
    -   Store and display transcripts in the UI.

-   **Milestone 3: AI Clipping & Preview**
    -   Integrate the Gemini API for content analysis.
    -   Develop logic to identify and generate clips.
    -   Build a UI to preview clips and allow adjustments.

## Important Note on Integration
This project is being developed as a standalone service intended for integration into a larger, existing web application.
-   The **frontend** serves as a testing and demonstration interface.
-   All **backend API endpoints** are prefixed with `/backend/` to ensure they are properly namespaced.

## License
This project is licensed under the MIT License. See the `LICENSE` file for details. 