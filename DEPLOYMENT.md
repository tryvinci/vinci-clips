# 🚀 Deployment Guide - Vinci Clips

Production deployment options for Vinci Clips, from simple cloud hosting to enterprise-scale infrastructure.

## 🔗 Quick Deploy Options

### 🌐 Hosted Solution (Recommended)
**Skip the deployment complexity entirely:**
👉 **[Try Vinci at tryvinci.com](https://tryvinci.com)** - Production-ready, managed service

### 📦 Docker Deployment (Coming Soon)
```bash
# One-command deployment
docker-compose up -d
```

---

## 🏗️ Production Architecture

```mermaid
graph TB
    A[Load Balancer] --> B[Frontend - Next.js]
    A --> C[Backend - Express API]
    C --> D[MongoDB Atlas]
    C --> E[Google Cloud Storage]
    C --> F[Redis Queue]
    C --> G[Gemini AI API]
    H[CDN] --> E
    I[Monitoring] --> C
```

---

## 🔧 Manual Production Setup

### Prerequisites
- Ubuntu 20.04+ or similar Linux distribution
- Node.js v18+ installed
- Domain name and SSL certificate
- Production databases and cloud services

### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js v18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install FFmpeg
sudo apt install -y ffmpeg

# Install PM2 for process management
npm install -g pm2

# Install Nginx for reverse proxy
sudo apt install -y nginx
```

### 2. Application Deployment

```bash
# Clone repository
git clone https://github.com/tryvinci/vinci-clips.git
cd vinci-clips

# Install dependencies
npm run install:all

# Build frontend
cd frontend
npm run build
cd ..

# Setup production environment
cp backend/.env.example backend/.env
# Edit backend/.env with production values
```

### 3. Environment Configuration

**Production `.env`:**
```bash
# Server
PORT=8080
NODE_ENV=production

# Database (use MongoDB Atlas for production)
DB_URL=mongodb+srv://user:pass@cluster.mongodb.net/vinci-clips-prod

# Google Cloud (production bucket)
GCP_BUCKET_NAME=vinci-clips-prod
GCP_SERVICE_ACCOUNT_PATH=./src/service-account-prod.json

# AI Services
GEMINI_API_KEY=your-production-gemini-key

# Security
JWT_SECRET=your-super-secure-random-string
CORS_ORIGIN=https://yourdomain.com

# Logging
LOG_LEVEL=info
LOG_TO_FILE=true

# Performance
MAX_FILE_SIZE=5000000000  # 5GB for production
WORKER_PROCESSES=4
```

### 4. Process Management with PM2

**Create `ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [
    {
      name: 'vinci-backend',
      script: './backend/src/index.js',
      cwd: './backend',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 8080
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    },
    {
      name: 'vinci-frontend',
      script: 'npm',
      args: 'start',
      cwd: './frontend',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
```

**Start applications:**
```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup auto-restart on boot
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### 5. Nginx Configuration

**Create `/etc/nginx/sites-available/vinci-clips`:**
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # File upload size
    client_max_body_size 5G;

    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /clips/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout settings for long video processing
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;
    }

    # Static files
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Enable the site:**
```bash
sudo ln -s /etc/nginx/sites-available/vinci-clips /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## ☁️ Cloud Platform Deployments

### Vercel + Railway (Recommended)

**Frontend on Vercel:**
1. Connect GitHub repository to Vercel
2. Set build command: `cd frontend && npm run build`
3. Set output directory: `frontend/.next`
4. Deploy automatically on git push

**Backend on Railway:**
1. Connect repository to Railway
2. Set start command: `cd backend && npm start`
3. Add environment variables
4. Deploy with automatic scaling

### DigitalOcean App Platform

**Create `app.yaml`:**
```yaml
name: vinci-clips
services:
- name: backend
  source_dir: backend
  github:
    repo: your-username/vinci-clips
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 2
  instance_size_slug: professional-xs
  envs:
  - key: NODE_ENV
    value: production
  - key: DB_URL
    value: your-mongodb-url
    type: SECRET
  
- name: frontend
  source_dir: frontend
  github:
    repo: your-username/vinci-clips
    branch: main
  build_command: npm run build
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  routes:
  - path: /
```

### AWS Deployment

**Using AWS Elastic Beanstalk:**
```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init vinci-clips

# Create environment
eb create production

# Deploy
eb deploy
```

---

## 🔒 Production Security

### SSL/TLS Certificate

**Using Let's Encrypt (Free):**
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Firewall Configuration
```bash
# UFW firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 8080  # Backend port
```

### Environment Security
- Use environment variables for all secrets
- Enable 2FA on all cloud services
- Regularly rotate API keys
- Monitor access logs
- Use VPC/private networks where possible

---

## 📊 Monitoring & Logging

### Application Monitoring

**PM2 Monitoring:**
```bash
# Real-time monitoring
pm2 monit

# Logs
pm2 logs

# Status
pm2 status
```

**Log Rotation:**
```bash
# Install logrotate
sudo apt install logrotate

# Create /etc/logrotate.d/vinci-clips
sudo tee /etc/logrotate.d/vinci-clips <<EOF
/path/to/vinci-clips/backend/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

### Health Checks

**Create health check endpoint** in `backend/src/routes/health.js`:
```javascript
const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

module.exports = router;
```

### External Monitoring
- **Uptime Robot**: Website monitoring
- **New Relic**: Application performance
- **DataDog**: Infrastructure monitoring
- **Sentry**: Error tracking

---

## 🚑 Backup Strategy

### Database Backups
```bash
# MongoDB Atlas automatic backups (recommended)
# Or manual backup:
mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/vinci-clips-prod" --out ./backup/$(date +%Y%m%d)
```

### File Backups
```bash
# Google Cloud Storage versioning (enable in console)
# Or manual sync:
gsutil -m rsync -r -d gs://vinci-clips-prod gs://vinci-clips-backup
```

### Code Backups
- Git repository (already handled)
- Environment variables (store securely)
- SSL certificates
- Configuration files

---

## 💯 Performance Optimization

### Backend Optimization
- Enable gzip compression
- Use Redis for session storage
- Implement API rate limiting
- Add database indexes
- Use CDN for static assets

### Frontend Optimization
- Enable Next.js image optimization
- Implement code splitting
- Use service workers for caching
- Optimize bundle size

### Infrastructure Scaling
- Horizontal scaling with load balancers
- Auto-scaling groups
- Background job queues (Redis + Bull)
- Database read replicas

---

## 🚑 Troubleshooting Production

### Common Issues

**High memory usage:**
```bash
# Check memory
free -h

# PM2 memory usage
pm2 status

# Restart if needed
pm2 restart all
```

**Database connection issues:**
```bash
# Check connectivity
mongo "mongodb+srv://cluster.mongodb.net/test" --username user

# Check logs
pm2 logs vinci-backend --lines 100
```

**File upload failures:**
```bash
# Check disk space
df -h

# Check GCS permissions
gsutil ls gs://your-bucket
```

### Emergency Procedures
1. **Service down**: Check PM2 status, restart if needed
2. **High load**: Scale horizontally, check for DDoS
3. **Data corruption**: Restore from backup
4. **Security breach**: Rotate all keys, check logs

---

## 📞 Support

### Production Support
- **Critical issues**: contact@tryvinci.com
- **Enterprise support**: Available with commercial license
- **Community**: GitHub Issues for open source version

### Maintenance Windows
- Schedule updates during low traffic
- Use blue-green deployments
- Test in staging environment first
- Have rollback plan ready

---

## ✅ Production Checklist

Before going live:

- [ ] SSL certificate installed and tested
- [ ] Environment variables configured
- [ ] Database backups automated
- [ ] Monitoring and alerting setup
- [ ] Health checks working
- [ ] Load testing completed
- [ ] Security scan passed
- [ ] Error tracking configured
- [ ] DNS properly configured
- [ ] CDN configured for static assets
- [ ] Rate limiting implemented
- [ ] Log rotation configured

**Need help with deployment?** Consider our [hosted solution at tryvinci.com](https://tryvinci.com) for enterprise-grade infrastructure without the operational overhead.