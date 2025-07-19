# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vinci Clips is an AI-powered video clipping tool that automatically generates short, engaging video clips from longer videos. The application uses AI to transcribe videos, analyze transcripts, and suggest the best moments to turn into clips.

**Architecture:**
- **Frontend:** Next.js application with React, TypeScript, and Tailwind CSS
- **Backend:** Node.js/Express REST API server
- **Database:** MongoDB with Mongoose ODM
- **AI Services:** Google Gemini API for transcription and analysis
- **Cloud Storage:** Google Cloud Storage for video/audio files
- **Video Processing:** FFmpeg for video-to-audio conversion

## Development Commands

### Root Level Commands
```bash
# Install dependencies for both frontend and backend
npm run install:all

# Start both frontend and backend concurrently
npm start

# Start only backend (runs on port 8080)
npm run start:backend

# Start only frontend (runs on port 3000)
npm run start:frontend
```

### Backend Commands (from /backend directory)
```bash
# Start production server
npm start

# Start development server with auto-reload
npm run dev

# Run tests
npm test
```

### Frontend Commands (from /frontend directory)
```bash
# Start development server with Turbopack
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run ESLint
npm run lint
```

## Key Architecture Patterns

### Backend Structure
- **Entry point:** `src/index.js` - Express server setup with CORS and route mounting
- **Database:** `src/db.js` - MongoDB connection using Mongoose
- **Routes:** `src/routes/` - Modular route handlers mounted under `/clips` prefix
  - `upload.js` - File upload and processing
  - `transcripts.js` - Transcript CRUD operations
  - `analyze.js` - AI analysis endpoints
  - `clips.js` - Clip management
- **Models:** `src/models/` - Mongoose schemas (e.g., `Transcript.js`)
- **File Processing:** Uses `fluent-ffmpeg` for video-to-MP3 conversion
- **Cloud Integration:** Google Cloud Storage and Gemini API integration

### Frontend Structure
- **App Router:** Uses Next.js 13+ app directory structure
- **Main Pages:**
  - `/` - Video upload interface with drag-and-drop
  - `/clips/transcripts` - List all processed videos
  - `/clips/transcripts/[id]` - Individual transcript detail with video player
- **Components:** Shadcn/ui components in `src/components/ui/`
- **Styling:** Tailwind CSS with custom configuration
- **API Integration:** Axios for HTTP requests to backend

### Core Workflow
1. User uploads video via drag-and-drop interface
2. Backend converts video to MP3 using FFmpeg
3. Files uploaded to Google Cloud Storage in parallel
4. Gemini API transcribes audio with speaker diarization
5. Transcript data saved to MongoDB
6. Frontend displays transcript with video playback

## Environment Setup

### Required Environment Variables (backend/.env)
```
PORT=8080
DB_URL=<mongodb-connection-string>
GCP_BUCKET_NAME=<gcs-bucket-name>
GCP_SERVICE_ACCOUNT_PATH=<path-to-service-account.json>
GEMINI_API_KEY=<gemini-api-key>
```

### Prerequisites
- Node.js v18+
- FFmpeg in system PATH
- Google Cloud Platform account with service account
- MongoDB database
- Gemini API key

## Development Guidelines

### File Path Conventions
- Frontend imports use `@/` alias pointing to `frontend/src/`
- All API endpoints prefixed with `/clips/`
- Backend hardcoded to `http://localhost:8080` in frontend

### Code Style
- ESLint with Next.js configuration for frontend
- TypeScript for frontend components and interfaces
- JavaScript for backend with JSDoc comments
- Consistent error handling with try-catch blocks

### Testing Approach
- Backend: Jest for unit tests, Supertest for API tests
- Frontend: React Testing Library (configured)
- File upload limit: 2GB with client-side validation

## Current Development Status

### Completed Features
- Video file upload with progress tracking and status management
- Video-to-MP3 conversion and cloud storage with thumbnail generation
- Gemini API transcription with speaker diarization
- Transcript storage and retrieval with status tracking
- AI-powered clip analysis and generation
- Frontend interfaces for upload, transcript viewing, and clip management
- Homepage with recent videos and status indicators
- Comprehensive status management system (uploading → converting → transcribing → completed/failed)

### Next Development Priorities
#### Phase 1: Core Platform Enhancements (High Priority)
- URL video import from YouTube, Instagram, LinkedIn, Vimeo, TikTok
- Fix clip generation routing issues and improve error handling
- Enhanced UI/UX with responsive design and mobile optimization
- Performance optimization with background job processing

#### Phase 2: Advanced Content Features (Medium Priority)
- Auto-reframing for social media aspect ratios (9:16, 1:1, 16:9) with AI subject detection
- Advanced captioning system with style customization and SRT export
- AI-generated B-roll integration for enhanced clip engagement
- Timeline-based clip preview and editing functionality

#### Phase 3: Social Media & Publishing (Lower Priority)
- Direct publishing to social media platforms (YouTube, TikTok, Instagram, Facebook, LinkedIn, X)
- Content scheduling calendar with optimal posting time suggestions
- AI-generated metadata (captions, hashtags, descriptions) for social posts
- Analytics dashboard for performance tracking and engagement metrics

## Important Notes

- Service account JSON file should be in `backend/src/` directory
- MongoDB connection includes custom database name support
- Frontend uses Turbopack for faster development builds
- All API responses follow consistent JSON format
- File uploads handled via multer middleware
- When planning ensure we commit changes to git time to time to ensure progress
- When any issues are identified which may be longer, log them as issues on git
- in commits remove any presence of Claude including any mentions in the commit message