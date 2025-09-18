# Spec Kit Plan Command
# Generates a development plan from specifications or defers to Spec Kit if installed

param(
    [string]$SpecDir = ".\specs",
    [int]$Velocity = 21,  # Story points per sprint
    [int]$SprintDays = 14,
    [string]$Output = ".\specs\plan.md"
)

# Execution policy bypass and unblocking
try { Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue } catch {}
if (Test-Path ".\.specify") { Get-ChildItem ".\.specify" -Recurse -Filter "*.ps1" -ErrorAction SilentlyContinue | ForEach-Object { try { Unblock-File -Path $_.FullName -ErrorAction SilentlyContinue } catch {} } }

Write-Host "`n📅 GARF Development Plan" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Gray

# Prefer Spec Kit binary if installed locally
$cwd = Resolve-Path .
$specKitCmd = Join-Path $cwd "node_modules\\.bin\\spec-kit.cmd"
$specKitNix = Join-Path $cwd "node_modules/.bin/spec-kit"
$hasSpecKit = (Test-Path $specKitCmd) -or (Test-Path $specKitNix)

if ($hasSpecKit) {
    $bin = if (Test-Path $specKitCmd) { $specKitCmd } else { $specKitNix }
    & $bin plan $SpecDir | Out-File $Output -Encoding UTF8
    Write-Host "✅ Plan written to $Output" -ForegroundColor Green
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

$totalPoints = 0
$specifications = @()

foreach ($file in $specFiles) {
    $content = Get-Content $file.FullName -Raw
    
    # Extract requirements
    $requirements = @()
    if ($content -match '## Requirements\s+([\s\S]+?)(?=##|\z)') {
        $reqSection = $matches[1]
        $requirements = @()
        foreach ($line in ($reqSection -split "`n")) {
            if ($line -match '^\d+\.') { $requirements += $line }
            elseif ($line -match '^[-•]') { $requirements += $line }
        }
    }
    
    # Estimate story points (simple heuristic)
    $points = $requirements.Count * 3  # 3 points per requirement average
    $totalPoints += $points
    
    $specifications += [PSCustomObject]@{
        Name = $file.BaseName
        Requirements = $requirements.Count
        EstimatedPoints = $points
    }
}

# Display plan
Write-Host "`n📊 Specifications Summary:" -ForegroundColor Green
Write-Host ""

foreach ($spec in $specifications) {
    Write-Host "  • $($spec.Name)" -ForegroundColor White
    Write-Host "    Requirements: $($spec.Requirements)" -ForegroundColor Gray
    Write-Host "    Estimated Points: $($spec.EstimatedPoints)" -ForegroundColor Gray
    Write-Host ""
}

# Sprint planning
$sprintsNeeded = [Math]::Ceiling($totalPoints / $Velocity)
$weeksNeeded = $sprintsNeeded * ($SprintDays / 7)

Write-Host ("=" * 60) -ForegroundColor Gray
Write-Host "`n⏱️  Timeline Estimation:" -ForegroundColor Yellow
Write-Host "  Total Story Points: $totalPoints" -ForegroundColor White
Write-Host "  Team Velocity: $Velocity points/sprint" -ForegroundColor White
Write-Host "  Sprint Duration: $SprintDays days" -ForegroundColor White
Write-Host "  Sprints Needed: $sprintsNeeded" -ForegroundColor Green
Write-Host "  Estimated Duration: $weeksNeeded weeks" -ForegroundColor Green

# Priority breakdown
Write-Host "`n🎯 Recommended Sprint Allocation:" -ForegroundColor Yellow

$currentSprint = 1
$remainingPoints = $totalPoints
$pointsPerSprint = @{}

foreach ($spec in $specifications | Sort-Object EstimatedPoints -Descending) {
    if ($pointsPerSprint[$currentSprint] -eq $null) {
        $pointsPerSprint[$currentSprint] = 0
    }
    
    if (($pointsPerSprint[$currentSprint] + $spec.EstimatedPoints) -le $Velocity) {
        $pointsPerSprint[$currentSprint] += $spec.EstimatedPoints
        Write-Host "  Sprint $currentSprint : $($spec.Name) ($($spec.EstimatedPoints) points)" -ForegroundColor Cyan
    } else {
        $currentSprint++
        $pointsPerSprint[$currentSprint] = $spec.EstimatedPoints
        Write-Host "  Sprint $currentSprint : $($spec.Name) ($($spec.EstimatedPoints) points)" -ForegroundColor Cyan
    }
}

# Persist to specs/plan.md
if (!(Test-Path (Split-Path $Output))) { New-Item -ItemType Directory -Path (Split-Path $Output) | Out-Null }

$sb = New-Object -TypeName System.Text.StringBuilder
[void]$sb.AppendLine("# Development Plan")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## Summary")
foreach ($spec in $specifications) {
    [void]$sb.AppendLine("- $($spec.Name): $($spec.EstimatedPoints) points ($($spec.Requirements) reqs)")
}
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## Timeline")
[void]$sb.AppendLine("- Total Points: $totalPoints")
[void]$sb.AppendLine("- Velocity: $Velocity points/sprint")
[void]$sb.AppendLine("- Sprints Needed: $sprintsNeeded")
[void]$sb.AppendLine("- Estimated Duration: $weeksNeeded weeks")

$sb.ToString() | Out-File $Output -Encoding UTF8

Write-Host ("=" * 60) -ForegroundColor Gray
Write-Host "Plan generated at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "✅ Plan written to $Output" -ForegroundColor Green
