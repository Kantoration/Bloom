# Spec Kit Tasks Command
# Generates tasks from specifications or defers to Spec Kit if installed

param(
    [string]$SpecDir = ".\specs",
    [string]$OutputFile = ".\tasks.json",
    [string]$ReportMd = ".\specs\tasks.md"
)

# Execution policy bypass and unblocking
try { Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue } catch {}
if (Test-Path ".\.specify") { Get-ChildItem ".\.specify" -Recurse -Filter "*.ps1" -ErrorAction SilentlyContinue | ForEach-Object { try { Unblock-File -Path $_.FullName -ErrorAction SilentlyContinue } catch {} } }

Write-Host "`nGARF Task Generation" -ForegroundColor Cyan
$sep = ('=' * 60)
Write-Host $sep -ForegroundColor Gray

# Prefer Spec Kit binary if installed locally
$cwd = Resolve-Path .
$specKitCmd = Join-Path $cwd "node_modules\\.bin\\spec-kit.cmd"
$specKitNix = Join-Path $cwd "node_modules/.bin/spec-kit"
$hasSpecKit = (Test-Path $specKitCmd) -or (Test-Path $specKitNix)

if ($hasSpecKit) {
    $bin = if (Test-Path $specKitCmd) { $specKitCmd } else { $specKitNix }
    & $bin tasks $SpecDir | Tee-Object -Variable specOutput | Out-Null
    if (!(Test-Path (Split-Path $ReportMd))) { New-Item -ItemType Directory -Path (Split-Path $ReportMd) | Out-Null }
    $specOutput | Out-File $ReportMd -Encoding UTF8
    Write-Host "✅ Tasks written to $ReportMd" -ForegroundColor Green
    exit $LASTEXITCODE
}

# Check if specs directory exists
if (!(Test-Path $SpecDir)) {
    Write-Host "❌ No specs directory found at $SpecDir" -ForegroundColor Red
    exit 1
}

# Get all spec files
$specFiles = Get-ChildItem -Path $SpecDir -Filter "*.spec.md" -ErrorAction SilentlyContinue

if ($specFiles.Count -eq 0) {
    Write-Host "❌ No specifications found in $SpecDir" -ForegroundColor Red
    exit 1
}

$allTasks = @()
$taskId = 1

foreach ($file in $specFiles) {
    Write-Host "`n📄 Processing: $($file.Name)" -ForegroundColor Yellow
    
    $content = Get-Content $file.FullName -Raw
    $specName = $file.BaseName
    
    # Extract requirements
    $requirements = @()
    if ($content -match '## Requirements\s+([\s\S]+?)(?=##|\z)') {
        $reqSection = $matches[1]
        $lines = $reqSection -split "`n"
        foreach ($line in $lines) {
            if ($line -match '^\d+\.\s*(.+)') { $requirements += $matches[1].Trim(); continue }
            if ($line -match '^[-•]\s*(.+)') { $requirements += $matches[1].Trim(); continue }
        }
    }
    
    # Extract success criteria
    $successCriteria = @()
    if ($content -match "## Success Criteria\s+(.+?)(?=##|\z)") {
        $criteriaSection = $matches[1]
        $lines = $criteriaSection -split "`n"
        foreach ($line in $lines) {
            if ($line -match "^[-•]\s*(.+)") { $successCriteria += $matches[1].Trim() }
        }
    }
    
    # Generate tasks from requirements
    foreach ($req in $requirements) {
        $priority = "medium"
        if ($req -match "critical|must|required") { $priority = "high" }
        elseif ($req -match "optional|nice to have|could") { $priority = "low" }
        
        $estimation = 3  # Default
        if ($req -match "complex|algorithm|integration") { $estimation = 8 }
        elseif ($req -match "simple|basic|minor") { $estimation = 2 }
        
        $task = [PSCustomObject]@{
            id = "TASK-$taskId"
            type = "requirement"
            spec = $specName
            title = "Implement: $($req.Substring(0, [Math]::Min(50, $req.Length)))"
            description = $req
            priority = $priority
            estimation = $estimation
            status = "todo"
            createdAt = (Get-Date).ToString("yyyy-MM-dd")
        }
        
        $allTasks += $task
        $taskId++
    }
    
    # Generate test tasks from success criteria
    foreach ($criteria in $successCriteria) {
        $task = [PSCustomObject]@{
            id = "TASK-$taskId"
            type = "test"
            spec = $specName
            title = "Test: $($criteria.Substring(0, [Math]::Min(50, $criteria.Length)))"
            description = "Verify: $criteria"
            priority = "medium"
            estimation = 2
            status = "todo"
            createdAt = (Get-Date).ToString("yyyy-MM-dd")
        }
        
        $allTasks += $task
        $taskId++
    }
    
    Write-Host "  ✅ Generated $($requirements.Count) requirement tasks" -ForegroundColor Green
    Write-Host "  ✅ Generated $($successCriteria.Count) test tasks" -ForegroundColor Green
}

# Save tasks to JSON
$allTasks | ConvertTo-Json -Depth 10 | Out-File $OutputFile -Encoding UTF8
Write-Host "`n💾 Saved $($allTasks.Count) tasks to $OutputFile" -ForegroundColor Green

# Display summary
$highPriority = ($allTasks | Where-Object { $_.priority -eq "high" }).Count
$mediumPriority = ($allTasks | Where-Object { $_.priority -eq "medium" }).Count
$lowPriority = ($allTasks | Where-Object { $_.priority -eq "low" }).Count
$totalPoints = ($allTasks | Measure-Object -Property estimation -Sum).Sum

Write-Host "`nTask Summary:" -ForegroundColor Yellow
Write-Host "  Total Tasks: $($allTasks.Count)" -ForegroundColor White
Write-Host "  High Priority: $highPriority" -ForegroundColor Red
Write-Host "  Medium Priority: $mediumPriority" -ForegroundColor Yellow
Write-Host "  Low Priority: $lowPriority" -ForegroundColor Green
Write-Host "  Total Story Points: $totalPoints" -ForegroundColor Cyan

# Persist quick report to specs/tasks.md
if (!(Test-Path (Split-Path $ReportMd))) { New-Item -ItemType Directory -Path (Split-Path $ReportMd) | Out-Null }
$report = @()
$report += '# Tasks Report'
$report += ''
$report += "- Total Tasks: $($allTasks.Count)"
$report += "- High: $highPriority, Medium: $mediumPriority, Low: $lowPriority"
$report += "- Total Story Points: $totalPoints"
$report -join "`n" | Out-File $ReportMd -Encoding UTF8

Write-Host $sep -ForegroundColor Gray
Write-Host "Tasks generated at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "Tasks report written to $ReportMd" -ForegroundColor Green
