# Docker Setup for Vinci Clips

This guide explains how to run Vinci Clips using Docker for both development and production environments.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Google Cloud Platform service account key
- Gemini API key

## Development Setup

### 1. Environment Configuration

Copy the example environment file and configure your settings:

```bash
# Copy the Docker environment template (project root)
cp .env.example .env
```

Edit `.env` and fill in your actual values:
- `GCP_BUCKET_NAME`: Your Google Cloud Storage bucket name
- `GCP_SERVICE_ACCOUNT_PATH`: Path to your GCP service account JSON file (relative to project root)
- `GEMINI_API_KEY`: Your Google Gemini API key

**Important**: This `.env` file in the project root is specifically for Docker Compose. For local development without Docker, see `ENVIRONMENT_SETUP.md`.

### 2. Start Development Environment

```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

This will start:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379

### 3. View Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
```

### 4. Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (destroys database data)
docker-compose down -v
```

## Production Setup

### 1. Environment Configuration

Create a production environment file:

```bash
cp .env.example .env.prod
```

Configure production-specific values in `.env.prod`:
- Set strong passwords for `MONGO_ROOT_PASSWORD`
- Set your production domain for `CORS_ORIGIN`
- Set your API URL for `NEXT_PUBLIC_API_URL`

### 2. SSL Certificate Setup (Recommended)

Place your SSL certificates in the `nginx/ssl/` directory:
- `certificate.crt`
- `private.key`

Uncomment the HTTPS server block in `nginx/nginx.conf`.

### 3. Start Production Environment

```bash
# Load environment variables and start
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

This will start:
- **Frontend + Backend**: http://localhost (proxied through Nginx)
- **HTTPS**: https://localhost (if SSL configured)

### 4. Production Monitoring

```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Monitor resource usage
docker stats
```

## Service Architecture

```
┌─────────────────┐
│     Nginx       │ :80, :443 (Production only)
│  Reverse Proxy  │
└─────────────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐ ┌───▼──┐
│Frontend│ │Backend│ :3000, :8080
│Next.js │ │Express│
└───┬──┘ └───┬──┘
    │        │
    │    ┌───▼──┐
    │    │Redis │ :6379
    │    │Cache │
    │    └──────┘
    │        │
    │    ┌───▼──┐
    │    │MongoDB│ :27017
    │    │Database│
    │    └──────┘
    │
┌───▼────────────┐
│ Google Cloud   │
│ Storage + AI   │
└────────────────┘
```

## Troubleshooting

### Common Issues

**1. Permission denied for GCP service account**
```bash
# Ensure the service account file has correct permissions
chmod 600 /path/to/service-account.json
```

**2. FFmpeg not found**
```bash
# Rebuild the backend container
docker-compose build --no-cache backend
```

**3. MongoDB connection failed**
```bash
# Check if MongoDB is running
docker-compose ps mongodb

# View MongoDB logs
docker-compose logs mongodb
```

**4. Out of disk space**
```bash
# Clean up unused Docker resources
docker system prune -a

# Remove old volumes
docker volume prune
```

### Health Checks

Each service includes health checks that can be monitored:

```bash
# Check health status
docker-compose ps

# Manual health check
curl http://localhost:8080/health  # Backend
curl http://localhost:3000/api/health  # Frontend
```

### Development vs Production

| Feature | Development | Production |
|---------|-------------|------------|
| **Nginx** | Not used | Reverse proxy + SSL |
| **Volumes** | Source code mounted | No source mounting |
| **Logging** | Console output | Structured JSON logs |
| **Health Checks** | Basic | Full monitoring |
| **Security** | Basic | Headers + rate limiting |
| **Ports** | Exposed directly | Proxied through Nginx |

## Maintenance

### Backup Database

```bash
# Create backup
docker exec vinci-clips-mongodb-prod mongodump --uri="mongodb://admin:password@localhost:27017/vinci-clips?authSource=admin" --out=/backup

# Copy backup from container
docker cp vinci-clips-mongodb-prod:/backup ./mongodb-backup
```

### Update Application

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart services
docker-compose -f docker-compose.prod.yml up -d --build
```

### Scale Services

```bash
# Scale backend to 3 instances
docker-compose -f docker-compose.prod.yml up -d --scale backend=3
```

For more advanced deployment scenarios, consider using Docker Swarm or Kubernetes.