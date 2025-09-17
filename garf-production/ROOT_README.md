# 🌟 GARF - Intelligent Group Formation System

**Complete Survey-to-Group Formation Platform with Email Verification**

A comprehensive system that transforms survey responses into optimal groups using advanced algorithms, featuring a modern web interface, email verification, and production-ready architecture.

[![GitHub](https://img.shields.io/badge/GitHub-Kantoration%2FBloom-blue?style=flat-square&logo=github)](https://github.com/Kantoration/Bloom)
[![Python](https://img.shields.io/badge/Python-3.11+-blue?style=flat-square&logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue?style=flat-square&logo=docker)](https://docker.com)

## 🎯 What is GARF?

GARF (Group Algorithm for Response Formation) is an intelligent system that:

1. **Collects survey responses** through a modern web interface
2. **Verifies participant emails** with multi-language support
3. **Processes responses** using advanced algorithms
4. **Forms optimal groups** based on participant characteristics
5. **Provides admin controls** for survey management

## 📁 Project Structure

```
Bloom/
├── garf-legacy/                 # Original algorithm and research
│   ├── sotrim_algo.py          # Core grouping algorithm
│   ├── genrate_respond.py      # Response generator
│   ├── group_formation_config.json
│   ├── group_formation_results.csv
│   └── test and debug scripts/ # Testing utilities
│
└── garf-production/            # Complete production system
    ├── api/                    # FastAPI backend
    ├── frontend/              # Next.js frontend
    ├── worker/                # Background task worker
    ├── infra/                 # Infrastructure configs
    ├── docs/                  # Documentation
    ├── docker-compose.yml     # Container orchestration
    └── README.md              # Production system docs
```

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/Kantoration/Bloom.git
cd Bloom/garf-production

# Start the complete system
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# API: http://localhost:8000
# API Docs: http://localhost:8000/api/v1/docs
```

### Option 2: Local Development

```bash
# Backend
cd garf-production/api
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd garf-production/frontend
npm install
npm run dev
```

## ✨ Key Features

### 🧠 Intelligent Group Formation
- **Advanced Algorithm**: Based on SOTRIM research
- **Multi-criteria Optimization**: Considers multiple participant characteristics
- **Flexible Grouping**: Configurable group sizes and constraints
- **Real-time Processing**: Background algorithm execution

### 📧 Email Verification System
- **Multi-language Support**: Hebrew & English templates
- **Professional Design**: Beautiful HTML email templates
- **Secure Tokens**: UUID-based verification with expiration
- **Background Processing**: Non-blocking email sending

### 🎨 Modern Web Interface
- **Responsive Design**: Works on desktop and mobile
- **TypeScript**: Type-safe frontend development
- **Tailwind CSS**: Modern, utility-first styling
- **RTL Support**: Right-to-left text for Hebrew

### 🏗️ Production Architecture
- **Microservices**: Scalable, maintainable design
- **Docker**: Easy deployment and scaling
- **PostgreSQL**: Robust data storage
- **Redis**: Background job processing
- **API Documentation**: Auto-generated Swagger docs

## 📊 System Components

### Backend (FastAPI)
- **Survey Management**: Create and manage surveys
- **Response Collection**: Handle participant responses
- **Email Verification**: Send and verify emails
- **Group Formation**: Run grouping algorithms
- **Admin Controls**: Administrative functions

### Frontend (Next.js)
- **Survey Interface**: User-friendly response collection
- **Admin Dashboard**: Survey and group management
- **Email Verification**: Token verification interface
- **Results Display**: Group formation results

### Worker (Background Tasks)
- **Feature Extraction**: Process response data
- **Email Sending**: Background email operations
- **Algorithm Execution**: Group formation processing
- **Data Normalization**: Clean and prepare data

## 🔧 Configuration

### Environment Setup
```bash
# Copy template and configure
cp garf-production/env.template garf-production/.env

# Configure email settings
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM=noreply@garf.com
```

### Database Setup
```bash
# Create database
createdb garf_db

# Run schema
psql -d garf_db -f garf-production/infra/database_schema.sql

# Run email verification migration
psql -d garf_db -f garf-production/api/migrations/add_email_verification.sql
```

## 📚 Documentation

- **[Production System README](garf-production/README.md)** - Complete production system documentation
- **[Email Verification Guide](garf-production/docs/EMAIL_VERIFICATION.md)** - Email system setup and usage
- **[System Demo](garf-production/docs/SYSTEM_DEMO.md)** - How to use the system
- **[API Documentation](http://localhost:8000/api/v1/docs)** - Interactive API docs

## 🧪 Testing

### Test Email Verification
```bash
cd garf-production/api
python test_email_verification.py
```

### Test System Integration
```bash
cd garf-production
python test_system.py
```

### Test Legacy Algorithm
```bash
cd garf-legacy/test\ and\ debug\ scripts
python test_algo.py
```

## 🚀 Deployment

### Production Deployment
```bash
# Configure production environment
export DEBUG=false
export SECRET_KEY=your-production-secret

# Deploy with Docker
docker-compose -f docker-compose.prod.yml up -d
```

### Cloud Platforms
Ready for deployment on:
- **AWS** (ECS, EKS, EC2)
- **Google Cloud** (Cloud Run, GKE)
- **Azure** (Container Instances, AKS)
- **DigitalOcean** (App Platform)
- **Heroku** (Container deployment)

## 🔍 Monitoring & Health

- **API Health**: `GET /api/v1/health`
- **Database Monitoring**: Automatic connection checks
- **Redis Monitoring**: Queue health monitoring
- **Structured Logging**: Configurable log levels

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 👥 Team & Credits

- **Algorithm**: Based on SOTRIM research implementation
- **System Architecture**: Production-ready microservices design
- **Frontend**: Modern React/Next.js application
- **Backend**: FastAPI with comprehensive API design
- **Email System**: Multi-language verification system

## 📞 Support

- **GitHub Issues**: [Create an issue](https://github.com/Kantoration/Bloom/issues)
- **Documentation**: Check the `docs/` folders
- **API Docs**: http://localhost:8000/api/v1/docs

## 🎯 Roadmap

### Recent Achievements ✅
- Complete email verification system
- Multi-language support (Hebrew & English)
- Docker containerization
- Production-ready architecture
- Comprehensive API documentation
- Admin control system

### Upcoming Features 🚧
- Advanced analytics dashboard
- Real-time group formation updates
- Mobile application
- Advanced email templates
- Multi-tenant support
- Integration with external tools

---

**Built with ❤️ for intelligent group formation**

*Transform survey responses into optimal groups with advanced algorithms and modern web technology.*

## 🔗 Links

- **GitHub Repository**: [Kantoration/Bloom](https://github.com/Kantoration/Bloom)
- **Production System**: [garf-production/README.md](garf-production/README.md)
- **Email Verification**: [garf-production/docs/EMAIL_VERIFICATION.md](garf-production/docs/EMAIL_VERIFICATION.md)
- **API Documentation**: http://localhost:8000/api/v1/docs
