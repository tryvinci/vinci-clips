# 🛠️ Installation Guide - Vinci Clips

Complete setup guide for running Vinci Clips locally or deploying to production.

## 📋 Prerequisites

### System Requirements
- **Node.js**: v18.0.0 or later
- **npm**: v8.0.0 or later
- **FFmpeg**: Required for video processing
- **Git**: For cloning the repository

### Required Services
- **MongoDB**: Database for storing video metadata and transcripts
- **Google Cloud Platform**: For storage and AI services
  - Google Cloud Storage bucket
  - Service account with appropriate permissions
  - Gemini API access

---

## 🚀 Quick Start (5 minutes)

### 1. Clone and Install
```bash
# Clone the repository
git clone https://github.com/tryvinci/vinci-clips.git
cd vinci-clips

# Install all dependencies
npm run install:all
```

### 2. Environment Setup
```bash
# Copy environment template
cp backend/.env.example backend/.env

# Edit with your actual values
nano backend/.env
```

### 3. Start Development
```bash
# Start both frontend and backend
npm start
```

**Access your application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080

---

## 🔧 Detailed Setup

### FFmpeg Installation

#### macOS (using Homebrew)
```bash
brew install ffmpeg
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install ffmpeg
```

#### Windows
1. Download from [FFmpeg.org](https://ffmpeg.org/download.html)
2. Extract to `C:\ffmpeg`
3. Add `C:\ffmpeg\bin` to your PATH

#### Verify Installation
```bash
ffmpeg -version
```

### MongoDB Setup

#### Option 1: Local MongoDB
```bash
# macOS
brew install mongodb-community
brew services start mongodb-community

# Ubuntu
sudo apt install mongodb
sudo systemctl start mongodb
```

#### Option 2: MongoDB Atlas (Recommended)
1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create new cluster
3. Get connection string
4. Add to `.env` as `DB_URL`

### Google Cloud Platform Setup

#### 1. Create GCP Project
```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash
gcloud init

# Create new project
gcloud projects create vinci-clips-[unique-id]
gcloud config set project vinci-clips-[unique-id]
```

#### 2. Enable Required APIs
```bash
gcloud services enable storage-api.googleapis.com
gcloud services enable aiplatform.googleapis.com
```

#### 3. Create Service Account
```bash
gcloud iam service-accounts create vinci-clips-sa \
    --display-name="Vinci Clips Service Account"

# Download key file
gcloud iam service-accounts keys create ./backend/src/vinci-service-account.json \
    --iam-account=vinci-clips-sa@vinci-clips-[unique-id].iam.gserviceaccount.com
```

#### 4. Create Storage Bucket
```bash
gsutil mb gs://vinci-clips-[unique-id]
gsutil iam ch serviceAccount:vinci-clips-sa@vinci-clips-[unique-id].iam.gserviceaccount.com:objectAdmin gs://vinci-clips-[unique-id]
```

#### 5. Get Gemini API Key
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Create new API key
3. Copy key to `.env` file

### Environment Configuration

Create `backend/.env` with your values:

```bash
# Server
PORT=8080
NODE_ENV=development

# Database
DB_URL=mongodb://localhost:27017/vinci-clips
# OR for Atlas: mongodb+srv://username:password@cluster.mongodb.net/vinci-clips

# Google Cloud
GCP_BUCKET_NAME=vinci-clips-your-unique-id
GCP_SERVICE_ACCOUNT_PATH=./src/vinci-service-account.json

# AI Services
GEMINI_API_KEY=your-gemini-api-key-here
LLM_MODEL=gemini-1.5-flash

# Optional Settings
LOG_LEVEL=info
MAX_FILE_SIZE=2000000000
TRANSCRIPTION_TIMEOUT=300000
```

---

## 🧪 Testing Your Setup

### 1. Verify Backend
```bash
cd backend
npm run dev

# Test API endpoint
curl http://localhost:8080/clips/transcripts
```

### 2. Verify Frontend
```bash
cd frontend
npm run dev

# Open http://localhost:3000
```

### 3. Test File Upload
1. Go to http://localhost:3000
2. Drag and drop a small video file
3. Check processing status
4. Verify transcription completes

---

## 🚨 Troubleshooting

### Common Issues

#### "FFmpeg not found"
```bash
# Check if FFmpeg is in PATH
which ffmpeg

# If not found, reinstall or add to PATH
export PATH="$PATH:/usr/local/bin"
```

#### "Cannot connect to MongoDB"
```bash
# Check MongoDB status
sudo systemctl status mongodb

# Start if stopped
sudo systemctl start mongodb

# Check connection string in .env
```

#### "Google Cloud authentication failed"
```bash
# Verify service account file exists
ls -la backend/src/vinci-service-account.json

# Test authentication
gcloud auth activate-service-account --key-file=backend/src/vinci-service-account.json
```

#### "Gemini API quota exceeded"
- Check your API usage in Google AI Studio
- Verify API key is correct
- Check if billing is enabled

### Debug Mode
```bash
# Enable debug logging
echo "LOG_LEVEL=debug" >> backend/.env

# Check logs
tail -f backend/logs/application-$(date +%Y-%m-%d).log
```

### Port Conflicts
```bash
# Check what's using port 8080
lsof -i :8080

# Kill process if needed
kill -9 [PID]

# Or change port in .env
echo "PORT=8081" >> backend/.env
```

---

## 📦 Development Commands

```bash
# Install dependencies
npm run install:all

# Start development (both frontend + backend)
npm start

# Start only backend
npm run start:backend

# Start only frontend
npm run start:frontend

# Run tests
npm run test

# Lint code
npm run lint

# Build for production
npm run build

# Clean node_modules
npm run clean
```

---

## 🔐 Security Considerations

### Environment Variables
- Never commit `.env` files to git
- Use strong, unique API keys
- Rotate keys regularly

### Service Account
- Use least-privilege access
- Store JSON key securely
- Never expose in client-side code

### Database
- Use authentication in production
- Enable SSL/TLS connections
- Regular backups

### File Uploads
- Current limit: 2GB per file
- Only accepts video formats
- Files stored in cloud, not locally

---

## 🆘 Need Help?

1. **Documentation**: Check the main [README.md](./README.md)
2. **Issues**: [GitHub Issues](https://github.com/tryvinci/vinci-clips/issues)
3. **Community**: [Discussions](https://github.com/tryvinci/vinci-clips/discussions)
4. **Commercial Support**: contact@tryvinci.com

### Before Opening an Issue
- Check existing issues
- Include your OS and Node.js version
- Provide error logs from `backend/logs/`
- Include steps to reproduce

---

## ✅ Next Steps

Once installed:
1. Upload your first video
2. Review the generated transcript
3. Generate clips using AI suggestions
4. Explore the [Contributing Guide](./CONTRIBUTING.md)
5. Check out advanced features in the roadmap

**Ready to deploy?** See [DEPLOYMENT.md](./DEPLOYMENT.md) for production setup.