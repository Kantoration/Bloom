# GARF System Startup Script
# This script will start your Docker containers in the correct order

Write-Host "=== Starting GARF System ===" -ForegroundColor Green
Write-Host ""

# Step 1: Clean up any existing containers
Write-Host "Step 1: Cleaning up existing containers..." -ForegroundColor Yellow
docker-compose down --volumes --remove-orphans
Write-Host ""

# Step 2: Build images
Write-Host "Step 2: Building Docker images..." -ForegroundColor Yellow
docker-compose build --no-cache
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Build failed! Check the output above for errors." -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Start core services first (postgres, redis)
Write-Host "Step 3: Starting core services (PostgreSQL, Redis)..." -ForegroundColor Yellow
docker-compose up -d postgres redis
Start-Sleep -Seconds 10
Write-Host ""

# Step 4: Check core services health
Write-Host "Step 4: Checking core services health..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0

do {
    $attempt++
    $postgresHealthy = docker-compose ps postgres | Select-String "healthy"
    $redisHealthy = docker-compose ps redis | Select-String "healthy"
    
    if ($postgresHealthy -and $redisHealthy) {
        Write-Host "✓ Core services are healthy" -ForegroundColor Green
        break
    }
    
    Write-Host "Waiting for services to be healthy... ($attempt/$maxAttempts)" -ForegroundColor Yellow
    Start-Sleep -Seconds 2
} while ($attempt -lt $maxAttempts)

if ($attempt -eq $maxAttempts) {
    Write-Host "✗ Core services failed to become healthy" -ForegroundColor Red
    docker-compose logs postgres redis
    exit 1
}
Write-Host ""

# Step 5: Start application services
Write-Host "Step 5: Starting application services..." -ForegroundColor Yellow
docker-compose up -d api worker
Start-Sleep -Seconds 5
Write-Host ""

# Step 6: Show status
Write-Host "Step 6: System status..." -ForegroundColor Yellow
docker-compose ps
Write-Host ""

Write-Host "=== Startup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Services should be available at:" -ForegroundColor Cyan
Write-Host "• API: http://localhost:8000" -ForegroundColor White
Write-Host "• API Health: http://localhost:8000/api/v1/health" -ForegroundColor White
Write-Host "• PostgreSQL: localhost:5432" -ForegroundColor White
Write-Host "• Redis: localhost:6379" -ForegroundColor White
Write-Host ""
Write-Host "To view logs: docker-compose logs -f" -ForegroundColor Cyan
Write-Host "To stop system: docker-compose down" -ForegroundColor Cyan
