# ProcessMind Backend

A powerful Node.js backend for video processing with AI-powered transcription and analysis.

## 🚀 Features

- **Video Processing**: Automatic compression and optimization using FFmpeg
- **AI Transcription**: OpenAI Whisper API integration for accurate transcriptions
- **Smart Analysis**: AI-generated tags, todo lists, and summaries
- **Multi-Tenant**: Full multi-tenant architecture for SaaS deployment
- **Real-time Updates**: WebSocket support for processing status
- **Scalable**: Redis queue system with BullMQ for background jobs
- **Secure**: JWT authentication with refresh tokens

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB 6+
- Redis 7+
- FFmpeg (with full codec support)
- Docker & Docker Compose (for containerized deployment)

## 🛠️ Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Cache/Queue**: Redis with BullMQ
- **Video Processing**: FFmpeg
- **AI Services**: OpenAI API (Whisper + GPT-3.5)
- **Authentication**: JWT
- **File Storage**: Local/AWS S3

## 🐳 Docker Deployment (Recommended)

### Quick Start with Docker Compose

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/processmind-backend.git
   cd processmind-backend
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start services**
   ```bash
   docker-compose up -d
   ```

The application will be available at `http://localhost:5000`

### Coolify Deployment

This project is optimized for deployment with Coolify:

1. Connect your GitHub repository to Coolify
2. Select "Docker Compose" as the build type
3. Set environment variables in Coolify's UI
4. Deploy!

Coolify will automatically:
- Build the Docker images
- Set up MongoDB and Redis
- Configure networking between services
- Handle SSL certificates (if configured)

## 🔧 Local Development Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Install FFmpeg**
   ```bash
   # Ubuntu/Debian
   sudo apt update && sudo apt install ffmpeg

   # macOS
   brew install ffmpeg

   # Check installation
   ffmpeg -version
   ```

3. **Set up databases**
   ```bash
   # MongoDB
   docker run -d -p 27017:27017 --name mongodb mongo:7

   # Redis
   docker run -d -p 6379:6379 --name redis redis:7-alpine
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

5. **Run the application**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## 🔑 Environment Configuration

Key environment variables:

```env
# Server
NODE_ENV=production
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/process-mind
REDIS_URL=redis://localhost:6379

# OpenAI
OPENAI_API_KEY=sk-your-api-key

# Security
JWT_SECRET=your-secret-key

# File Storage
MAX_FILE_SIZE=524288000  # 500MB
STORAGE_TYPE=local       # or 's3'
```

See `.env.example` for complete configuration options.

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Express middleware
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Helper functions
│   └── workers/         # Background job workers
├── uploads/             # File storage
├── logs/                # Application logs
├── scripts/             # Utility scripts
├── Dockerfile           # Docker configuration
├── docker-compose.yml   # Multi-container setup
└── package.json         # Dependencies
```

## 🚦 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh JWT token

### Processes
- `GET /api/v1/processes` - List all processes
- `POST /api/v1/processes` - Upload new video
- `GET /api/v1/processes/:id` - Get process details
- `DELETE /api/v1/processes/:id` - Delete process

### Health Check
- `GET /health` - Service health status

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test suites
npm run test:auth
npm run test:upload
```

## 📊 Monitoring

### Health Checks

The application includes built-in health checks:
- Docker health check endpoint: `/health`
- PM2 monitoring integration
- Structured JSON logging

### Logs

Logs are stored in the `logs/` directory:
- `combined.log` - All application logs
- `error.log` - Error logs only

## 🔒 Security

- JWT-based authentication with refresh tokens
- Rate limiting on all endpoints
- File upload validation and size limits
- CORS configuration
- Helmet.js for security headers
- Input validation with Joi

## 🚀 Production Deployment

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start application
npm run start:pm2

# Monitor
pm2 monit

# Logs
pm2 logs
```

### Using Docker

```bash
# Build image
docker build -t processmind-backend .

# Run container
docker run -d \
  -p 5000:5000 \
  --env-file .env \
  -v $(pwd)/uploads:/app/uploads \
  processmind-backend
```

## 🛠️ Maintenance

### Database Migrations

```bash
# Run migrations
npm run migrate

# Seed test data (development only)
npm run seed
```

### Cleanup Tasks

```bash
# Clear logs
npm run logs:clear

# Clear cache
npm run cache:clear
```

## 📈 Performance Optimization

- MongoDB connection pooling
- Redis caching layer
- Concurrent job processing
- Video streaming support
- Compression middleware
- Optimized Docker images

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Troubleshooting

### Common Issues

**MongoDB Connection Failed**
- Check if MongoDB is running: `docker ps`
- Verify MONGODB_URI in .env
- Check firewall settings

**Redis Connection Failed**
- Ensure Redis is running
- Check REDIS_URL configuration
- Verify Redis password (if set)

**FFmpeg Not Found**
- Install FFmpeg: `apt install ffmpeg`
- Verify installation: `ffmpeg -version`
- Check FFMPEG_PATH in .env

**Upload Errors**
- Check file permissions on upload directory
- Verify MAX_FILE_SIZE setting
- Ensure sufficient disk space

### Debug Mode

Enable debug logging:
```bash
DEBUG=true LOG_LEVEL=debug npm run dev
```

## 📞 Support

- GitHub Issues: [Report a bug](https://github.com/yourusername/processmind-backend/issues)
- Email: support@processmind.com