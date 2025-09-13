# Copilot Instructions for Vinci Clips

## Project Overview

Vinci Clips is an AI-powered video clipping platform that automatically generates short, engaging clips from longer videos. The system uses AI to transcribe videos, analyze transcripts, and suggest optimal moments for clip creation.

**Technology Stack:**
- **Frontend:** Next.js 15.3.5 with React 19, TypeScript, Tailwind CSS 4.0
- **Backend:** Node.js 20+ with Express.js REST API server  
- **Database:** MongoDB with Mongoose ODM
- **AI Services:** Google Gemini API for transcription and analysis
- **Storage:** Google Cloud Storage for video/audio files
- **Video Processing:** FFmpeg 6.1+ for video-to-audio conversion and caption burning
- **Development:** npm 10+, concurrently for service orchestration

## Project Structure

```
vinci-clips/
├── package.json           # Root package with orchestration scripts
├── backend/               # Node.js Express API server (port 8080)
│   ├── src/
│   │   ├── index.js      # Main server entry point
│   │   ├── models/       # Mongoose schemas (Transcript.js, etc.)
│   │   └── routes/       # API endpoints (/clips prefix)
│   └── package.json      # Backend dependencies (express, mongoose, etc.)
├── frontend/             # Next.js React application (port 3000)
│   ├── src/
│   │   ├── app/          # Next.js app router pages
│   │   ├── components/   # React components (UI library: shadcn/ui)
│   │   └── lib/          # Utility functions
│   └── package.json      # Frontend dependencies (next, react, etc.)
└── .github/
    └── copilot-instructions.md  # This file
```

## Prerequisites & Installation

### System Requirements
- **Node.js:** 18.0.0+ (tested with 20.19.5)
- **npm:** 8.0.0+ (tested with 10.8.2)  
- **FFmpeg:** 6.1+ with full codec support
- **MongoDB:** Database instance (local or cloud)

Install FFmpeg on Ubuntu/Debian:
```bash
sudo apt-get update && sudo apt-get install -y ffmpeg
```

### Dependency Installation

**ALWAYS** run this command first in any fresh environment:
```bash
npm run install:all
```
- **Expected duration:** 35-40 seconds
- **Network requirements:** Downloads ~1GB of dependencies
- **Dependencies installed:** Backend (~555 packages), Frontend (~417 packages)
- **Known warnings:** Deprecation warnings for fluent-ffmpeg and supertest (non-blocking)

## Development Commands

### Root Level Commands (Use These First)
```bash
# Install all dependencies for both services
npm run install:all          # ~38s, installs backend + frontend deps

# Start both services concurrently (RECOMMENDED)
npm start                    # Starts backend:8080 + frontend:3000

# Start individual services
npm run start:backend        # Express server on port 8080, starts in <1s
npm run start:frontend       # Next.js with Turbopack on port 3000, ready in ~1s

# Build production frontend
npm run build               # WARNING: Fails in restricted networks (Google Fonts)

# Run linting (frontend only - backend has no lint script)
npm run lint                # ~3s, shows TypeScript/ESLint issues

# Run tests (currently no test files exist)
npm test                    # Exits with code 1 (no tests found)
```

### Backend-Specific Commands (from /backend directory)
```bash
cd backend

# Production server
npm start                   # node src/index.js, starts immediately

# Development with auto-reload  
npm run dev                 # nodemon src/index.js, watches file changes

# Run tests (Jest configured but no test files)
npm test                    # Exits with "No tests found"
```

### Frontend-Specific Commands (from /frontend directory)
```bash
cd frontend

# Development server with Turbopack
npm run dev                 # localhost:3000, ready in ~1s

# Production build
npm run build              # Next.js build, may fail on restricted networks

# Production server
npm start                  # Serves built application

# Linting
npm run lint               # ESLint + TypeScript checking, ~3s
```

## Environment Configuration

### Required Environment Files

**Backend (.env):**
```bash
# Copy from backend/.env.example
PORT=8080
DB_URL=mongodb://localhost:27017/vinci-clips
GCP_BUCKET_NAME=your-gcs-bucket-name
GCP_SERVICE_ACCOUNT_PATH=src/service-account.json
GEMINI_API_KEY=your-gemini-api-key
```

**Frontend (.env.local):**
```bash
# Copy from frontend/env.example  
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### External Service Setup
- **Google Cloud Storage:** Bucket for video/audio file storage
- **Google Gemini API:** API key for transcription/analysis
- **MongoDB:** Database connection (local or Atlas)
- **Service Account:** JSON key file in `backend/src/`

## Development Workflow

### Typical Development Session
1. **Start services:** `npm start` (both backend + frontend)
2. **Access application:** http://localhost:3000
3. **API endpoint:** http://localhost:8080/clips/*
4. **Make changes:** Files auto-reload via nodemon/Turbopack
5. **Lint frequently:** `npm run lint` before commits

### Core Application Flow
1. **Upload video:** Drag-and-drop interface on homepage
2. **File processing:** FFmpeg converts video → MP3 (parallel GCS upload)
3. **Transcription:** Gemini API generates transcript with timestamps
4. **Analysis:** AI suggests optimal clip moments
5. **Clip creation:** User selects clips, downloads processed videos

## API Structure

### Backend Routes (All prefixed with `/clips`)
- **POST** `/clips/upload` - Video file upload & processing
- **GET** `/clips/transcripts` - List all transcripts
- **GET** `/clips/transcripts/:id` - Individual transcript details
- **POST** `/clips/analyze` - AI analysis for clip suggestions  
- **POST** `/clips/clips` - Generate video clips
- **POST** `/clips/captions` - Caption generation (in development)

### Key Models
- **Transcript:** Video metadata, transcription data, processing status
- **Status tracking:** uploading → converting → transcribing → completed/failed

## Testing & Quality

### Current Test Status
- **Backend:** Jest configured with supertest, **no test files exist**
- **Frontend:** Standard Next.js test setup, **no test files exist**
- **Linting:** Frontend ESLint active (errors present), backend has no lint script

### Known Issues
- **Build fails:** Google Fonts blocked in restricted networks
- **Lint errors:** Multiple TypeScript `any` types, unused variables
- **No tests:** Test infrastructure exists but no tests written
- **Deprecated deps:** fluent-ffmpeg, supertest (warnings only)

### Adding Tests (Recommended Structure)
```bash
# Backend tests
backend/
├── __tests__/
│   ├── routes/
│   │   ├── upload.test.js
│   │   └── transcripts.test.js
│   └── models/
│       └── Transcript.test.js

# Frontend tests  
frontend/
├── __tests__/
│   ├── components/
│   └── pages/
```

## Performance & Timeouts

### Expected Operation Durations
- **Dependency installation:** 35-40 seconds
- **Backend startup:** <1 second (immediate)
- **Frontend startup:** ~1 second (Turbopack)
- **Frontend linting:** ~3 seconds
- **Video upload:** Varies by file size (2GB limit)
- **Transcription:** 2-10 minutes depending on video length
- **Clip generation:** 30-120 seconds per clip

### Timeout Recommendations for CI/CD
- **Install dependencies:** 300 seconds
- **Backend tests:** 120 seconds  
- **Frontend build:** 300 seconds (if network access available)
- **Linting:** 60 seconds
- **Server startup verification:** 30 seconds

## Development Best Practices

### Code Style & Standards
- **TypeScript:** Use proper types, avoid `any` (current violations exist)
- **Error handling:** Consistent try-catch blocks in backend
- **API responses:** Standardized JSON format across all endpoints
- **Imports:** Frontend uses `@/` alias for `frontend/src/`

### Security Considerations
- **File uploads:** 2GB limit with client-side validation
- **Environment variables:** Never commit .env files
- **Service accounts:** Keep JSON keys in `backend/src/`, add to .gitignore
- **CORS:** Configured for localhost development

### Performance Optimization
- **Video processing:** Parallel upload while converting
- **Transcription:** Chunked processing for large files
- **Frontend:** Turbopack for fast development builds
- **Caching:** No build cache configured (Next.js warning)

## Common Issues & Solutions

### Network Restrictions
- **Google Fonts failure:** Build breaks, requires network access
- **GCS upload fails:** Check service account credentials
- **Gemini API errors:** Verify API key and quota

### Development Environment
- **Port conflicts:** Backend 8080, Frontend 3000 must be available
- **FFmpeg missing:** Install system-wide, not npm package
- **MongoDB connection:** Ensure database running and accessible

### Build/Runtime Errors
- **Lint failures:** Multiple TypeScript violations (non-blocking)
- **Missing tests:** Jest exits with code 1 (expected)
- **Turbopack warnings:** Development-only, safe to ignore

## Advanced Features (In Development)

### TikTok/Reels Caption System
- **Word-level timestamps:** Gemini API `audioTimestamp: true`
- **Caption styles:** Bold Center, Neon Pop, Typewriter, Bubble, Minimal Clean
- **Fonts:** Montserrat, Poppins, Bebas Neue, Oswald, Roboto
- **FFmpeg integration:** Burn captions directly into video

### Planned Enhancements
- **URL import:** YouTube, Instagram, LinkedIn, Vimeo, TikTok
- **Auto-reframing:** AI subject detection for social media aspect ratios
- **Publishing:** Direct social media platform integration
- **Analytics:** Performance tracking and engagement metrics

## Contributing Guidelines

### Before Making Changes
1. **Run `npm run install:all`** in fresh environment
2. **Start development servers:** `npm start`
3. **Check linting:** `npm run lint` (fix critical errors)
4. **Verify functionality:** Test upload → transcription flow

### Commit Standards
- **Small, focused changes:** Single feature/bugfix per commit
- **Test impact:** Verify no breaking changes to existing workflow
- **Documentation:** Update relevant .md files for new features

### Pull Request Checklist
- [ ] Dependencies install cleanly (`npm run install:all`)
- [ ] Services start successfully (`npm start`)
- [ ] Linting passes or only shows expected warnings
- [ ] Core workflow tested (if applicable)
- [ ] Environment setup documented (if changed)

---

**Last Updated:** September 2025 | **Version:** 1.0.0  
**Environment Tested:** Ubuntu 24.04, Node.js 20.19.5, npm 10.8.2