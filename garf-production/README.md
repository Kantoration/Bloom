# 🌟 GARF Production System

**Intelligent Group Formation with Email Verification**

A complete, production-ready web application for creating optimal groups from survey responses using advanced algorithms, with built-in email verification and modern web interface.

[![GitHub](https://img.shields.io/badge/GitHub-Kantoration%2FBloom-blue?style=flat-square&logo=github)](https://github.com/Kantoration/Bloom)
[![Python](https://img.shields.io/badge/Python-3.11+-blue?style=flat-square&logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue?style=flat-square&logo=docker)](https://docker.com)

## 🚀 Features

### ✨ Core Functionality
- **Intelligent Group Formation**: Advanced algorithm for optimal group creation
- **Survey Management**: Complete survey creation and response collection system
- **Email Verification**: Multi-language email verification system (Hebrew & English)
- **Real-time Processing**: Background task processing with Redis
- **Admin Dashboard**: Complete administrative control system

### 🏗️ Technical Features
- **Modern Architecture**: Microservices design with FastAPI backend
- **Responsive Frontend**: Next.js with TypeScript and Tailwind CSS
- **Database**: PostgreSQL with proper schema and migrations
- **Containerization**: Docker Compose for easy deployment
- **API Documentation**: Auto-generated Swagger/OpenAPI docs
- **Background Jobs**: Redis Queue for async processing
- **Health Monitoring**: Built-in health checks and monitoring

### 🌍 Multi-language Support
- **Hebrew & English**: Complete localization support
- **RTL Support**: Right-to-left text support for Hebrew
- **Professional Email Templates**: Beautiful HTML email templates

## 📁 Project Structure

```
garf-production/
├── api/                    # FastAPI backend
│   ├── app/
│   │   ├── core/          # Configuration and database
│   │   ├── models/        # Database models
│   │   ├── routers/       # API endpoints
│   │   ├── schemas/       # Pydantic schemas
│   │   └── services/      # Business logic
│   ├── migrations/        # Database migrations
│   └── requirements.txt   # Python dependencies
│
├── frontend/              # Next.js frontend
│   ├── src/
│   │   ├── app/          # Next.js app router
│   │   ├── components/   # React components
│   │   ├── lib/          # Utilities and API client
│   │   └── types/        # TypeScript types
│   └── package.json      # Node.js dependencies
│
├── worker/               # Background task worker
│   ├── app/tasks/       # Task definitions
│   └── requirements.txt # Worker dependencies
│
├── infra/               # Infrastructure
│   ├── database_schema.sql
│   └── nginx/          # Reverse proxy config
│
├── docs/               # Documentation
│   ├── EMAIL_VERIFICATION.md
│   ├── SYSTEM_DEMO.md
│   └── WORKSPACE_ORGANIZATION.md
│
├── docker-compose.yml  # Container orchestration
├── start-system.ps1   # Windows startup script
└── README.md          # This file
```

## 🚀 Quick Start

### Prerequisites
- **Docker & Docker Compose** (Recommended)
- **Python 3.11+** (for local development)
- **Node.js 18+** (for frontend development)
- **PostgreSQL** (if running locally)

### Option 1: Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/Kantoration/Bloom.git
   cd Bloom/garf-production
   ```

2. **Start the system**
   ```bash
   docker-compose up -d
   ```

3. **Access the application**
   - **Frontend**: http://localhost:3000
   - **API**: http://localhost:8000
   - **API Docs**: http://localhost:8000/api/v1/docs
   - **Database**: localhost:5432

### Option 2: Local Development

1. **Backend Setup**
   ```bash
   cd api
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

2. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Database Setup**
   ```bash
   # Create PostgreSQL database
   createdb garf_db
   
   # Run migrations
   psql -d garf_db -f infra/database_schema.sql
   ```

## 📧 Email Verification Setup

The system includes a complete email verification system:

### 1. Configure Email Settings
Create a `.env` file in `garf-production/`:
```bash
# Email Configuration
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM=noreply@garf.com
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
MAIL_FROM_NAME="GARF System"
EMAIL_VERIFICATION_BASE_URL=http://localhost:3000
```

### 2. Gmail Setup (Recommended)
1. Enable 2-factor authentication
2. Generate an App Password
3. Use the app password as `MAIL_PASSWORD`

### 3. Run Database Migration
```bash
psql -d garf_db -f api/migrations/add_email_verification.sql
```

## 🔧 Configuration

### Environment Variables
Copy `env.template` to `.env` and configure:

```bash
# Application
DEBUG=true
SECRET_KEY=your-secret-key-here

# Database
POSTGRES_SERVER=localhost
POSTGRES_USER=garf
POSTGRES_PASSWORD=garf_password
POSTGRES_DB=garf_db

# Redis
REDIS_URL=redis://localhost:6379/0

# Email (see Email Verification Setup)
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM=noreply@garf.com

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## 📊 API Documentation

### Core Endpoints

#### Surveys
- `GET /api/v1/surveys` - List all surveys
- `POST /api/v1/surveys` - Create new survey
- `GET /api/v1/surveys/{id}` - Get survey details

#### Responses
- `POST /api/v1/responses/{survey_id}/submit` - Submit response
- `GET /api/v1/responses/{id}` - Get response details

#### Email Verification
- `POST /api/v1/email-verification/send` - Send verification email
- `GET /api/v1/email-verification/verify?token={token}` - Verify email
- `GET /api/v1/email-verification/status/{participant_id}` - Check status

#### Grouping
- `POST /api/v1/grouping/{survey_id}/run` - Run grouping algorithm
- `GET /api/v1/grouping/{survey_id}/results` - Get grouping results

#### Admin
- `GET /api/v1/admin/surveys` - Admin survey management
- `POST /api/v1/admin/surveys/{id}/activate` - Activate survey

### Interactive Documentation
Visit http://localhost:8000/api/v1/docs for complete API documentation with interactive testing.

## 🧪 Testing

### Test Email Verification
```bash
cd api
python test_email_verification.py
```

### Test System Integration
```bash
python test_system.py
```

### Run Frontend Tests
```bash
cd frontend
npm test
```

## 🚀 Deployment

### Production Deployment

1. **Configure Production Environment**
   ```bash
   # Set production environment variables
   export DEBUG=false
   export SECRET_KEY=your-production-secret-key
   export DATABASE_URL=postgresql://user:pass@host:port/db
   ```

2. **Deploy with Docker**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Set up Reverse Proxy**
   - Configure Nginx for SSL termination
   - Set up domain name and certificates

### Cloud Deployment

The system is ready for deployment on:
- **AWS**: ECS, EKS, or EC2
- **Google Cloud**: Cloud Run, GKE
- **Azure**: Container Instances, AKS
- **DigitalOcean**: App Platform, Droplets
- **Heroku**: Container deployment

## 🔍 Monitoring

### Health Checks
- **API Health**: `GET /api/v1/health`
- **Database**: Automatic connection monitoring
- **Redis**: Queue health monitoring

### Logging
- Structured logging with configurable levels
- Request/response logging
- Error tracking and alerting

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Algorithm**: Based on existing SOTRIM implementation
- **System Design**: Production-ready architecture
- **Frontend**: Next.js with TypeScript
- **Backend**: FastAPI with SQLAlchemy
- **Email System**: Multi-language verification system

## 📞 Support

For issues or questions:
- **GitHub Issues**: [Create an issue](https://github.com/Kantoration/Bloom/issues)
- **Documentation**: Check the `docs/` folder
- **API Docs**: http://localhost:8000/api/v1/docs

## 🎯 Roadmap

### Upcoming Features
- [ ] Advanced analytics dashboard
- [ ] Real-time group formation updates
- [ ] Mobile app (React Native)
- [ ] Advanced email templates
- [ ] Multi-tenant support
- [ ] Advanced reporting
- [ ] Integration with external survey tools

### Recent Updates
- ✅ Complete email verification system
- ✅ Multi-language support (Hebrew & English)
- ✅ Docker containerization
- ✅ Production-ready architecture
- ✅ Comprehensive API documentation
- ✅ Admin control system

---

**Built with ❤️ for intelligent group formation**

*Transform your survey responses into optimal groups with the power of advanced algorithms and modern web technology.*