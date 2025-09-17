# GARF Production Survey & Grouping System

A comprehensive web-based system that replaces Google Forms with a production-ready survey platform featuring intelligent group formation algorithms, wildcard normalization, age bands, and full explainability.

## 🚀 Features

### Core Functionality
- **Dynamic Survey Builder**: Schema-driven forms with validation
- **Smart Grouping Algorithm**: Integration with existing SOTRIM algorithm
- **Wildcard Normalization**: Handles flexible answers like "לא משנה לי", "גם וגם"
- **Age Bands**: Configurable age-based grouping with overlapping bands
- **Subspace Partitioning**: Efficient grouping within categorical constraints
- **Full Explainability**: Detailed explanations for every group formation

### Technical Features
- **RTL/i18n Support**: Hebrew and English interfaces
- **Real-time Validation**: Client and server-side validation
- **Background Processing**: Async feature extraction and grouping
- **CSV Export**: Export responses, features, groups, and audit logs
- **Docker Ready**: Full containerization for easy deployment
- **API Documentation**: OpenAPI/Swagger documentation

## 📋 System Requirements

- Docker & Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for local development)
- PostgreSQL 15+
- Redis 7+

## 🛠️ Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd garf-production

# Copy environment template
cp env.template .env
# Edit .env with your configuration
```

### 2. Start with Docker

```bash
# Build and start all services
docker-compose up --build

# Run in detached mode
docker-compose up -d
```

The system will be available at:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/api/v1/docs
- **pgAdmin**: http://localhost:5050 (development profile)

### 3. Initialize Database

```bash
# Run database migrations
docker-compose exec api alembic upgrade head

# Create initial survey (optional)
docker-compose exec api python scripts/create_initial_survey.py
```

## 🏗️ Architecture

```
garf-production/
├── frontend/          # Next.js 14 with TypeScript
│   ├── src/
│   │   ├── app/      # App router pages
│   │   ├── components/
│   │   ├── lib/      # API client and utilities
│   │   ├── hooks/    # Custom React hooks
│   │   └── styles/   # Global styles
│   └── Dockerfile
│
├── api/              # FastAPI backend
│   ├── app/
│   │   ├── routers/  # API endpoints
│   │   ├── models/   # SQLAlchemy models
│   │   ├── schemas/  # Pydantic schemas
│   │   ├── services/ # Business logic
│   │   └── core/     # Configuration
│   ├── migrations/   # Alembic migrations
│   └── Dockerfile
│
├── worker/           # Background task worker
│   └── app/
│       └── tasks/    # Async tasks
│
├── infra/           # Infrastructure configuration
│   ├── nginx/       # Reverse proxy config
│   ├── docker/      # Docker configurations
│   └── database_schema.sql
│
└── docker-compose.yml
```

## 📊 Database Schema

Key tables:
- `participants`: User information
- `surveys`: Survey definitions with JSON schemas
- `responses`: Raw survey responses
- `features`: Extracted and normalized features
- `grouping_policies`: Grouping configuration
- `grouping_runs`: Execution history
- `groups`: Formed groups with explanations
- `group_members`: Group assignments

## 🔧 Configuration

### Survey Schema

Surveys are defined using a typed JSON schema:

```json
{
  "fields": [
    {
      "name": "meeting_language",
      "label": {"he": "שפת המפגש", "en": "Meeting language"},
      "type": "single_select",
      "options": ["עברית", "אנגלית", "גם וגם"],
      "required": true,
      "role": "hard_constraint",
      "normalization": {
        "wildcards": ["גם וגם"],
        "expansion": ["עברית", "אנגלית"]
      }
    }
  ]
}
```

### Grouping Policy

```json
{
  "group_size": 6,
  "subspaces": [["meeting_language"], ["area"]],
  "hard": {
    "categorical_equal": ["meeting_language"],
    "multi_overlap": ["availability_days"],
    "numeric_tol": {"energy_level": 2}
  },
  "age_rules": {
    "field": "age",
    "bands": [
      {"name": "20s", "min": 20, "max": 29, "max_spread": 8}
    ]
  },
  "soft": {
    "numeric_features": ["introversion", "creativity"],
    "weights": {
      "diversity_numeric": 1.0,
      "similarity_bonus": 0.2
    }
  }
}
```

## 🚀 API Endpoints

### Public Endpoints
- `GET /api/v1/surveys/{name}` - Get survey schema
- `POST /api/v1/responses/{id}/submit` - Submit response

### Admin Endpoints
- `POST /api/v1/grouping/policies` - Create/update policy
- `POST /api/v1/grouping/runs` - Trigger grouping
- `GET /api/v1/admin/export/{table}.csv` - Export data

## 🧪 Testing

```bash
# Run API tests
docker-compose exec api pytest

# Run frontend tests
docker-compose exec frontend npm test

# Test grouping algorithm
docker-compose exec api python -m pytest tests/test_grouping.py
```

## 📈 Performance

- Handles 10,000+ participants
- Subspace partitioning reduces O(n²) to O(k×n²/k)
- Vectorized compatibility checks
- Cached feature extraction
- p95 grouping time < 60s for 10k participants

## 🔒 Security

- HTTPS with TLS (production)
- CSRF protection on forms
- Rate limiting (10 req/s API, 1 req/s submissions)
- SQL injection protection via ORM
- XSS protection headers
- Input validation at all layers

## 🌍 Deployment

### Production Setup

1. Update `.env` with production values
2. Configure SSL certificates in nginx
3. Set up database backups
4. Configure monitoring (Prometheus/Grafana)
5. Set up log aggregation

### Scaling

- Horizontal scaling via Docker Swarm/Kubernetes
- Database read replicas for reports
- Redis clustering for worker queues
- CDN for static assets

## 📝 Development

### Local Development

```bash
# Backend
cd api
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev

# Worker
cd api
rq worker --url redis://localhost:6379/0
```

### Adding New Survey Fields

1. Update survey schema in database
2. Add field type handling in `SurveyField.tsx`
3. Update validation in `app/services/validation.py`
4. Add normalization rules if needed

## 🐛 Troubleshooting

### Common Issues

1. **Database connection failed**
   - Check PostgreSQL is running
   - Verify credentials in `.env`

2. **Frontend not loading**
   - Check API_URL in frontend env
   - Verify CORS settings

3. **Grouping fails**
   - Check feature extraction completed
   - Verify policy configuration
   - Check algorithm logs

## 📚 Documentation

- API Documentation: http://localhost:8000/api/v1/docs
- Algorithm Details: See `sotrim_algo.py`
- Database Schema: `infra/database_schema.sql`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

[Your License Here]

## 👥 Team

- Algorithm: Based on existing SOTRIM implementation
- System Design: Production-ready architecture
- Frontend: Next.js with TypeScript
- Backend: FastAPI with SQLAlchemy

## 📞 Support

For issues or questions:
- GitHub Issues: [Link]
- Email: [support@example.com]

---

Built with ❤️ for intelligent group formation
