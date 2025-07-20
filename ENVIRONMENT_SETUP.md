# Environment Variables Setup Guide

This document clarifies the different environment files used in Vinci Clips and when to use each one.

## Overview

Vinci Clips uses different environment configurations depending on how you run the application:

```
vinci-clips/
├── .env.example              # For Docker Compose deployment (project root)
├── backend/.env.example      # For local backend development
└── ENVIRONMENT_SETUP.md      # This guide
```

## Environment File Locations

### 1. Project Root: `.env` (Docker Compose)

**Location**: `/vinci-clips/.env`
**Used by**: Docker Compose (`docker-compose.yml` and `docker-compose.prod.yml`)
**Purpose**: Configure containerized services

```bash
# Copy template and configure
cp .env.example .env
```

**Key characteristics**:
- Database URL points to Docker container: `mongodb://admin:password123@mongodb:27017/vinci-clips`
- Redis host points to Docker container: `redis`
- Service account path relative to project root: `./backend/gcp-service-account.json`

### 2. Backend Folder: `backend/.env` (Local Development)

**Location**: `/vinci-clips/backend/.env`
**Used by**: Direct Node.js execution (`npm run dev`, `npm start`)
**Purpose**: Configure backend when running outside Docker

```bash
# Copy template and configure
cd backend
cp .env.example .env
```

**Key characteristics**:
- Database URL points to local MongoDB: `mongodb://localhost:27017/vinci-clips`
- Redis host points to localhost: `localhost`
- Service account path relative to backend folder: `./gcp-service-account.json`

## Setup Instructions

### Option 1: Docker Development (Recommended)

1. **Configure project root environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

2. **Place GCP service account file**:
   ```bash
   # Put your service account JSON in the backend folder
   cp /path/to/your/service-account.json backend/gcp-service-account.json
   ```

3. **Start with Docker Compose**:
   ```bash
   docker-compose up --build
   ```

### Option 2: Local Development (Manual Setup)

1. **Set up local services**:
   ```bash
   # Install and start MongoDB locally
   brew install mongodb-community
   brew services start mongodb-community
   
   # Install and start Redis (optional)
   brew install redis
   brew services start redis
   ```

2. **Configure backend environment**:
   ```bash
   cd backend
   cp .env.example .env
   # Edit backend/.env with your actual values
   ```

3. **Place GCP service account file**:
   ```bash
   # Put your service account JSON in the backend folder
   cp /path/to/your/service-account.json backend/gcp-service-account.json
   ```

4. **Start services manually**:
   ```bash
   # Terminal 1: Start backend
   cd backend && npm run dev
   
   # Terminal 2: Start frontend
   cd frontend && npm run dev
   ```

## Environment Variables Reference

### Backend Configuration

| Variable | Docker Value | Local Value | Description |
|----------|--------------|-------------|-------------|
| `PORT` | `8080` | `8080` | Backend server port |
| `DB_URL` | `mongodb://admin:password123@mongodb:27017/vinci-clips` | `mongodb://localhost:27017/vinci-clips` | MongoDB connection |
| `REDIS_HOST` | `redis` | `localhost` | Redis server host |
| `GCP_SERVICE_ACCOUNT_PATH` | `./backend/gcp-service-account.json` | `./gcp-service-account.json` | Service account file path |

### Required External Services

These values are the same for both Docker and local development:

| Variable | Description | How to get |
|----------|-------------|------------|
| `GCP_BUCKET_NAME` | Google Cloud Storage bucket | Create in GCP Console |
| `GEMINI_API_KEY` | Google Gemini API key | Get from Google AI Studio |

## Common Issues

### 1. Wrong Environment File Used

**Symptom**: "Connection refused" or "File not found" errors

**Solution**: Make sure you're using the right environment file:
- Docker: Use project root `.env`
- Local: Use `backend/.env`

### 2. Service Account Path Issues

**Symptom**: "Service account file not found"

**Solutions**:
```bash
# For Docker deployment
ls -la backend/gcp-service-account.json

# For local development  
cd backend && ls -la gcp-service-account.json
```

### 3. Database Connection Issues

**Symptom**: "MongoDB connection failed"

**Solutions**:
```bash
# Docker: Check if MongoDB container is running
docker-compose ps mongodb

# Local: Check if MongoDB is installed and running
brew services list | grep mongodb
```

## Verification

### Docker Deployment
```bash
# Check all services are running
docker-compose ps

# Test backend connection
curl http://localhost:8080/health

# Test frontend connection
curl http://localhost:3000
```

### Local Development
```bash
# Test backend connection
curl http://localhost:8080/health

# Test frontend connection  
curl http://localhost:3000

# Test database connection
mongosh vinci-clips --eval "db.stats()"
```

## Migration Guide

### From Local to Docker
1. Copy your `backend/.env` values to project root `.env`
2. Update database and Redis hosts to use container names
3. Ensure service account file is in `backend/` folder

### From Docker to Local
1. Copy your project root `.env` values to `backend/.env`
2. Update database and Redis hosts to use localhost
3. Install MongoDB and Redis locally
4. Ensure service account file path is relative to backend folder

## Security Notes

- Never commit `.env` files to version control
- Keep service account JSON files secure and outside of version control
- Use strong passwords for production MongoDB instances
- Rotate API keys regularly in production environments