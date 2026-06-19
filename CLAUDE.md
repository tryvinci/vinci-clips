# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vinci Clips is an AI-powered video clipping tool that automatically generates short, engaging video clips from longer videos. The application uses AI to transcribe videos, analyze transcripts, and suggest the best moments to turn into clips.

**Architecture:**
- **Frontend:** Next.js application with React, TypeScript, and Tailwind CSS
- **Backend:** Node.js/Express REST API server
- **Database:** JSON file database (`backend/src/localdb.js` → `backend/storage/db.json`)
- **AI Services:** Google Gemini API (default) with optional OpenAI-compatible providers via `llmService.js`
- **Storage:** Local filesystem (`backend/uploads/`)
- **Video Processing:** FFmpeg for video-to-audio conversion and caption burning

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
- **Database:** `src/localdb.js` - JSON file persistence in `storage/db.json`
- **Routes:** `src/routes/` - Modular route handlers mounted under `/clips` prefix
  - `upload.js` - File upload and processing
  - `transcripts.js` - Transcript CRUD operations
  - `analyze.js` - AI analysis endpoints
  - `clips.js` - Clip generation
  - `captions.js` - Caption generation and style presets
  - `health.js` - Health check endpoint
- **Models:** `src/models/Transcript.js` - Wrapper around localdb
- **Services:** `src/services/llmService.js` - Unified LLM interface (Gemini + OpenAI-compatible)
- **File Processing:** Uses `fluent-ffmpeg` for video-to-MP3 conversion and caption burning

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
3. Files saved to `backend/uploads/`
4. Gemini API transcribes audio with word-level timestamps and speaker diarization
5. Transcript data saved to JSON database with precise timing
6. Frontend displays transcript with video playback
7. **Caption Generation:** FFmpeg burns styled captions into video clips for social media

## Environment Setup

### Required Environment Variables (backend/.env)
```
PORT=8080
GEMINI_API_KEY=<gemini-api-key>
LLM_PROVIDER=gemini          # optional: gemini or openai
LLM_MODEL=gemini-2.5-flash   # optional
OPENAI_API_KEY=<optional>    # for OpenAI-compatible analysis
```

Frontend (`frontend/.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:8080
```

See `LLM_PROVIDERS.md` for multi-provider configuration.

### Prerequisites
- Node.js v18+
- FFmpeg in system PATH
- Gemini API key

## Development Guidelines

### File Path Conventions
- Frontend imports use `@/` alias pointing to `frontend/src/`
- All API endpoints prefixed with `/clips/`
- Backend API URL configured via `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8080` in `src/lib/api.ts`)

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
- Gemini API transcription with speaker diarization (segment-level timestamps)
- Transcript storage and retrieval with status tracking
- AI-powered clip analysis and generation
- Frontend interfaces for upload, transcript viewing, and clip management
- Homepage with recent videos and status indicators
- Comprehensive status management system (uploading → converting → transcribing → completed/failed)

### In Development: TikTok/Reels Caption System
- **Technical Requirements:**
  - Upgrade Gemini API integration to use `audioTimestamp: true` for word-level precision
  - Implement FFmpeg caption burning with popular social media styles
  - Create caption style presets (Bold Center, Neon Pop, Typewriter, Bubble, Minimal Clean)
  - Add popular fonts (Montserrat, Poppins, Bebas Neue, Oswald, Roboto) to system
- **Caption Styles Specification:**
  - **Bold Center**: Heavy sans-serif, center-aligned, white text with black outline, suitable for all content
  - **Neon Pop**: Bright gradient colors (yellow/pink/cyan), bold fonts, drop shadows, trending style
  - **Typewriter**: Monospace fonts, word-by-word appearance animation, vintage aesthetic
  - **Bubble Style**: Rounded text backgrounds, colorful overlays, soft shadows, friendly tone
  - **Minimal Clean**: Light fonts, subtle backgrounds, elegant spacing, professional look
- **Implementation Plan:**
  1. Modify Gemini API call to include word-level timestamps
  2. Create caption style engine with FFmpeg integration
  3. Build style preset selection UI with live preview
  4. Test word-timing accuracy and style rendering quality

### Next Development Priorities
#### Phase 1: Core Platform Enhancements (High Priority)
- URL video import from YouTube, Instagram, LinkedIn, Vimeo, TikTok
- Fix clip generation routing issues and improve error handling
- Enhanced UI/UX with responsive design and mobile optimization
- Performance optimization with background job processing

#### Phase 2: Advanced Content Features (Medium Priority)
- **TikTok/Reels Style Captions (HIGH PRIORITY)** - Burned-in captions with popular social media styles
  - Word-level timestamp precision using Gemini API `audioTimestamp: true`
  - Popular caption styles: Bold Center, Neon Pop, Typewriter, Bubble, Minimal Clean
  - Popular fonts: Montserrat Bold, Poppins SemiBold, Bebas Neue, Oswald, Roboto Black
  - FFmpeg integration for burning captions directly into video
  - Style preset selection UI with real-time preview
- Auto-reframing for social media aspect ratios (9:16, 1:1, 16:9) with AI subject detection
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