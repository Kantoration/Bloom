# Docker Debugging Script for GARF
# Run this script to diagnose Docker Compose issues

Write-Host "=== GARF Docker Debugging Script ===" -ForegroundColor Green
Write-Host ""

# Check if .env file exists
Write-Host "1. Checking .env file..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✓ .env file exists" -ForegroundColor Green
} else {
    Write-Host "✗ .env file missing - copying from template" -ForegroundColor Red
    Copy-Item "env.template" ".env"
    Write-Host "✓ Created .env file from template" -ForegroundColor Green
}

Write-Host ""

# Check if required files exist
Write-Host "2. Checking required files..." -ForegroundColor Yellow
$requiredFiles = @(
    "api/Dockerfile",
    "worker/Dockerfile", 
    "api/requirements.txt",
    "worker/requirements.txt",
    "../garf-legacy/sotrim_algo.py"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✓ $file exists" -ForegroundColor Green
    } else {
        Write-Host "✗ $file missing" -ForegroundColor Red
    }
}

Write-Host ""

# Check for port conflicts
Write-Host "3. Checking for port conflicts..." -ForegroundColor Yellow
$ports = @(5432, 6379, 8000, 3000, 80, 5050)
foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        Write-Host "⚠ Port $port is in use by PID $($connection.OwningProcess)" -ForegroundColor Yellow
    } else {
        Write-Host "✓ Port $port is available" -ForegroundColor Green
    }
}

Write-Host ""

# Validate docker-compose.yml
Write-Host "4. Validating docker-compose.yml..." -ForegroundColor Yellow
try {
    $output = docker-compose config 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ docker-compose.yml is valid" -ForegroundColor Green
    } else {
        Write-Host "✗ docker-compose.yml has errors:" -ForegroundColor Red
        Write-Host $output -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Error running docker-compose config: $_" -ForegroundColor Red
}

Write-Host ""

# Show Docker system info
Write-Host "5. Docker system info..." -ForegroundColor Yellow
try {
    docker system info --format "table {{.Name}}: {{.Value}}" | Select-String -Pattern "Server Version|Storage Driver|Kernel Version"
} catch {
    Write-Host "✗ Error getting Docker info: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Debugging Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps to try:" -ForegroundColor Cyan
Write-Host "1. docker-compose down --volumes" -ForegroundColor White
Write-Host "2. docker-compose build --no-cache" -ForegroundColor White  
Write-Host "3. docker-compose up -d" -ForegroundColor White
Write-Host "4. docker-compose logs -f" -ForegroundColor White
