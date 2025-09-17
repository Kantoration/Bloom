# 🗂️ Workspace Configuration

## 📁 **Directory Structure**

```
C:\Users\User\Desktop\garf\
├── 📁 garf-legacy/              # Original algorithm & data
│   ├── sotrim_algo.py           # Main algorithm
│   ├── group_formation_config.json
│   ├── synthetic_survey_responses.csv
│   ├── group_formation_results.csv
│   ├── genrate_respond.py
│   └── test and debug scripts/
│       ├── run_algo.py
│       └── test_algo.py
│
├── 📁 garf-production/          # New web application
│   ├── api/                     # FastAPI backend
│   ├── frontend/                # Next.js frontend
│   ├── worker/                  # Background tasks
│   ├── infra/                   # Docker & config
│   └── docker-compose.yml
│
├── 📁 tools/                    # Development tools
├── 📁 docs/                     # Documentation
└── 📁 node_modules/             # Node.js dependencies
```

## 🔧 **Code Changes Made**

### **1. Algorithm Import Paths**
- **Fixed**: `garf-production/api/app/services/grouping_engine.py`
- **Changed**: Import path from `../../../../..` to `../../../../../garf-legacy`

### **2. Docker Configuration**
- **Fixed**: `garf-production/api/Dockerfile`
- **Changed**: Copy path from `../../sotrim_algo.py` to `../../garf-legacy/sotrim_algo.py`

### **3. Docker Compose**
- **Fixed**: `garf-production/docker-compose.yml`
- **Changed**: Volume mount from `../sotrim_algo.py` to `../garf-legacy/sotrim_algo.py`

### **4. Worker Algorithm**
- **Updated**: `garf-production/worker/sotrim_algo.py`
- **Added**: Comment explaining it's a copy for worker processes

## 🚀 **How to Use**

### **Run Original Algorithm**
```powershell
cd garf-legacy
py "test and debug scripts/run_algo.py"
```

### **Start Production System**
```powershell
cd garf-production
docker-compose up -d
```

### **Access Web Application**
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/api/v1/docs

## ✅ **All Paths Updated**

The codebase now correctly references:
- ✅ Algorithm from `garf-legacy/sotrim_algo.py`
- ✅ Docker volumes from `../garf-legacy/`
- ✅ Import paths updated for new structure
- ✅ Worker has its own copy of the algorithm

## 🎯 **Ready to Use**

The system is now configured for the organized workspace structure!
