# Vinci Clips

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.3.5-black)](https://nextjs.org/)

> AI-powered video clipping platform that automatically transforms long-form videos into engaging short clips optimized for social media platforms.

Vinci Clips is an open-source platform that leverages artificial intelligence to analyze video content, generate accurate transcriptions, and automatically identify the most engaging segments for creating viral short-form content. The platform streamlines the content creation workflow for creators, marketers, and businesses looking to maximize their video content's reach across multiple social media platforms.
### Watch the Demo Loom On Youtube
[![Youtube Video](https://github.com/user-attachments/assets/67fafcd0-f0e7-4f29-9a67-b22672c4f6b4)](https://www.youtube.com/watch?v=j6Jo_rcyURE)
### Demo of one of the Features: Segregate Clips via AI
<video src="https://github.com/user-attachments/assets/cddfc8f3-b476-4548-adae-00482ba2436f" controls loop></video>

## Key Features

### Core Functionality
- **Intelligent Video Analysis**: AI-powered content analysis using Google Gemini API
- **Automatic Transcription**: Speaker diarization with precise timestamp alignment
- **Smart Clip Generation**: AI suggests optimal clip segments based on content analysis
- **Multi-Format Support**: Support for major video formats with automatic conversion


### Content Processing
- **Video-to-Audio Conversion**: High-quality audio extraction using FFmpeg
- **Thumbnail Generation**: Automatic video thumbnail creation for quick preview
- **Status Tracking**: Real-time processing status with comprehensive error handling
- **Batch Processing**: Support for multiple video uploads with queue management

### User Interface
- **Intuitive Dashboard**: Clean, responsive interface built with Next.js and Tailwind CSS
- **Drag-and-Drop Upload**: Simple file upload with progress tracking (up to 2GB)
- **Video Playback**: Integrated video player with transcript synchronization
- **Mobile Responsive**: Optimized experience across desktop and mobile devices

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   External      │
│   Next.js       │◄──►│   Express API   │◄──►│   Services      │
│   React/TS      │    │   Node.js       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         │                        ▼                        │
         │              ┌─────────────────┐                │
         │              │   Database      │                │
         │              │   LocalDB       │                │
         │              └─────────────────┘                │
         │                                                 │
         │              ┌─────────────────┐                │
         └──────────────│   File Storage  │                │
                        │   Local system  │                │
                        └─────────────────┘                │
                                                           │
                        ┌─────────────────┐                │
                        │   AI Services   │◄───────────────┘
                        │   Gemini API    │
                        └─────────────────┘
```

**Technology Stack:**
- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS, Shadcn/ui
- **Backend**: Node.js, Express.js, JSON file database (`backend/storage/db.json`)
- **AI/ML**: Google Gemini API (default) with optional OpenAI-compatible providers — see [LLM_PROVIDERS.md](LLM_PROVIDERS.md)
- **Media Processing**: FFmpeg for video/audio conversion and caption burning
- **Storage**: Local filesystem (`backend/uploads/`)
- **Infrastructure**: Docker-ready with environment-based configuration

## Getting Started

### Prerequisites

Before running Vinci Clips, ensure you have the following installed:

- **Node.js** (version 18.0.0 or higher)
- **FFmpeg** (installed and available in your system PATH)

Additionally, you'll need API keys for:
- **Google Gemini API** (required for transcription; also used for analysis by default)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/tryvinci/vinci-clips.git
   cd vinci-clips
   ```

2. **Install dependencies**
   ```bash
   # Install dependencies for both frontend and backend
   npm run install:all
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the `backend` directory:
   ```bash
   cd backend
   cp .env.example .env
   ```
   
   Edit `backend/.env` with your actual values:
   ```env
   PORT=8080
   GEMINI_API_KEY=your-gemini-api-key
   ```

   Configure the frontend:
   ```bash
   cd frontend
   cp env.example .env.local
   ```
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8080
   ```
   
   **Note**: For Docker deployment, copy the root `.env.example` to `.env` and see `docker-setup.md`.


4. **Start the application (install concurrently)**
   ```bash
   # Start both frontend and backend
   npm start
   
   # Or start individually:
   npm run start:backend  # Backend on port 8080
   npm run start:frontend # Frontend on port 3000
   ```

5. **Access the application**
   
   Open your browser and navigate to `http://localhost:3000`

## Usage

### Basic Workflow

1. **Upload Video**: Drag and drop a video file (up to 2GB) onto the upload interface
2. **Processing**: The system automatically:
   - Converts video to audio format
   - Stores files locally in `backend/uploads/`
   - Generates video thumbnails
   - Creates AI-powered transcription with speaker identification
3. **Review Transcript**: View the generated transcript with timestamp alignment
4. **Generate Clips**: Use AI-suggested segments or manually select time ranges for clip creation
5. **Download Results**: Access generated clips from the transcript detail page

### API Usage

All endpoints are prefixed with `/clips`. Example:

```javascript
// Upload a video
POST /clips/upload/file
Content-Type: multipart/form-data

// Get transcript
GET /clips/transcripts/:id

// Generate clip
POST /clips/clips/generate/:transcriptId
{ "clipIndex": 0 }

// Health check
GET /clips/health
```

## Development

### Project Structure

```
vinci-clips/
├── backend/                 # Express.js API server
│   ├── src/
│   │   ├── localdb.js      # JSON file database
│   │   ├── models/         # Transcript model wrapper
│   │   ├── routes/         # API endpoints (mounted at /clips)
│   │   ├── services/       # LLM service
│   │   └── index.js        # Server entry point
│   ├── storage/db.json     # Transcript data (created at runtime)
│   ├── uploads/            # Videos, clips, captioned output
│   └── package.json
├── frontend/               # Next.js application
│   ├── src/
│   │   ├── app/           # App router pages
│   │   ├── components/    # React components
│   │   └── lib/           # Utilities (e.g. getApiUrl)
│   └── package.json
├── .env.example           # Docker Compose environment template
├── docker-compose.yml     # Local-first backend + frontend
└── package.json           # Root scripts
```

### Development Commands

```bash
# Development
npm run dev              # Start both services in development mode
npm run start:backend    # Start backend only
npm run start:frontend   # Start frontend only

# Production
npm run build           # Build both applications
npm start              # Start both services in production mode

# Testing
npm test               # Run test suites
npm run lint           # Run ESLint checks
```

### Testing

```bash
# Backend (no tests yet — exits with code 1 until tests are added)
cd backend && npm test

# Frontend lint
cd frontend && npm run lint
```

## Deployment

### Docker Deployment

```bash
# Copy environment template and set GEMINI_API_KEY
cp .env.example .env

# Build and run
docker-compose up --build
```

### Environment Variables

For local deployment, ensure all environment variables are properly configured:

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Backend server port | No (default: 8080) |
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `NEXT_PUBLIC_API_URL` | Frontend → backend URL | No (default: `http://localhost:8080`) |
| `LLM_PROVIDER` | Primary LLM provider (`gemini` or `openai`) | No |
| `OPENAI_API_KEY` | OpenAI API key (optional) | No |

See [LLM_PROVIDERS.md](LLM_PROVIDERS.md) for multi-provider setup.

## Contributing

We welcome contributions to Vinci Clips! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on:

- Code of conduct
- Development workflow
- Pull request process
- Issue reporting guidelines

### Development Setup

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## Development Status

### Core Platform (Completed)
- Video upload with drag-and-drop interface (2GB limit)
- FFmpeg-based video processing and thumbnail generation
- Local file storage and JSON database persistence
- AI transcription using Google Gemini API with speaker diarization
- React/Next.js frontend with responsive design
- Clip generation from AI-suggested segments
- Streamer's webcam + gameplay to reel conversion
- OpenAI-compatible LLM providers (see LLM_PROVIDERS.md)

### Caption System (Recently Added)
- TikTok/Reels style caption generation with 5 popular styles
- SRT-based FFmpeg subtitle rendering
- Word-level timestamp conversion from segment data
- Caption preview integration in reframe workflow

### Planned Improvements

**High Priority**
- Enhanced word-level timestamp precision (Issue #19)
- Advanced caption styles based on social media research (Issue #20)
- Real-time caption preview with video overlay (Issue #21)

**Medium Priority**
- Intelligent reframing with subject detection (Issue #22)
- Smooth camera movement for reframed videos (Issue #23)
- Smart fallback mechanisms for complex scenarios (Issue #24)

**Future Enhancements**
- Speaker-aware caption positioning (Issue #25)
- LLM-enhanced clip suggestion engine (Issue #26)
- Performance caching for transcripts and ML models (Issue #27)
- Modular caption style plugin system (Issue #28)

See [GitHub Issues](https://github.com/tryvinci/vinci-clips/issues) for detailed technical specifications and implementation plans.

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). See the [LICENSE](LICENSE) file for details.

The AGPL-3.0 license ensures that any modifications or derivatives of this software, including those running on servers, must also be made available under the same license terms.

## Support

### Community Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/tryvinci/vinci-clips/issues)
- **Discussions**: [Join community discussions](https://github.com/tryvinci/vinci-clips/discussions)
- **Documentation**: [INSTALL.md](INSTALL.md) and [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md)

### Commercial Support

For enterprise deployments, custom development, or commercial licensing options, please contact us at [support@tryvinci.com](mailto:support@tryvinci.com).

## Acknowledgments

- **Google Gemini API** for powerful AI transcription capabilities
- **FFmpeg** for reliable video processing
- **Next.js** and **Vercel** for excellent development experience
- **Open Source Community** for inspiration and contributions

---

Built by the Vinci team. Made possible by the open source community.
