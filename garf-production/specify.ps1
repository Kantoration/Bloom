# Spec Kit Specify Command
# Lists specifications and supports Spec Kit binary when available

param(
    [string]$Target = "",
    [string]$SpecDir = ".\specs"
)

# Execution policy bypass and unblocking
try { Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue } catch {}
$toUnblock = @(".\specify.ps1", ".\plan.ps1", ".\tasks.ps1")
foreach ($p in $toUnblock) { if (Test-Path $p) { try { Unblock-File -Path $p -ErrorAction SilentlyContinue } catch {} } }
if (Test-Path ".\.specify") { Get-ChildItem ".\.specify" -Recurse -Filter "*.ps1" -ErrorAction SilentlyContinue | ForEach-Object { try { Unblock-File -Path $_.FullName -ErrorAction SilentlyContinue } catch {} } }

Write-Host "`nGARF Specifications" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Gray

# Prefer Spec Kit binary if installed locally
$cwd = Resolve-Path .
$specKitCmd = Join-Path $cwd "node_modules\\.bin\\spec-kit.cmd"
$specKitNix = Join-Path $cwd "node_modules/.bin/spec-kit"
$hasSpecKit = (Test-Path $specKitCmd) -or (Test-Path $specKitNix)

if ($hasSpecKit) {
    $bin = if (Test-Path $specKitCmd) { $specKitCmd } else { $specKitNix }
    if ($Target) {
        & $bin specify $Target
    } else {
        & $bin specify $SpecDir
    }
    exit $LASTEXITCODE
}

# Fallback: built-in simple lister
if (!(Test-Path $SpecDir)) {
    Write-Host "⚠️  No specs directory found. Creating one..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $SpecDir | Out-Null
    Write-Host "✅ Created $SpecDir directory" -ForegroundColor Green
}

if ($Target -and (Test-Path $Target)) {
    $file = Get-Item $Target
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $title = if ($content -match '^# (.+)$') { $matches[1] } else { $file.BaseName }
    $goal = if ($content -match '## Goal\s+([\s\S]+?)(?=##|\z)') { ($matches[1].Trim() -split "`n")[0] } else { "No goal specified" }
    Write-Host "📄 $($file.Name)" -ForegroundColor Cyan
    Write-Host "   Title: $title" -ForegroundColor White
    Write-Host "   Goal: $goal" -ForegroundColor Gray
    Write-Host ""
} else {
    $specFiles = Get-ChildItem -Path $SpecDir -Filter "*.spec.md" -ErrorAction SilentlyContinue
    if ($specFiles.Count -eq 0) {
        Write-Host "No specifications found in $SpecDir" -ForegroundColor Yellow
        Write-Host "`nTo create a new specification, create a file with .spec.md extension" -ForegroundColor Gray
    } else {
        Write-Host "`nFound $($specFiles.Count) specification(s):" -ForegroundColor Green
        Write-Host ""
        foreach ($file in $specFiles) {
            $content = Get-Content $file.FullName -Raw -Encoding UTF8
            $title = if ($content -match '^# (.+)$') { $matches[1] } else { $file.BaseName }
            $goal = if ($content -match '## Goal\s+([\s\S]+?)(?=##|\z)') { ($matches[1].Trim() -split "`n")[0] } else { "No goal specified" }
            Write-Host "📄 $($file.Name)" -ForegroundColor Cyan
            Write-Host "   Title: $title" -ForegroundColor White
            Write-Host "   Goal: $goal" -ForegroundColor Gray
            Write-Host ""
        }
    }
}

$sep = ('=' * 60)
Write-Host $sep -ForegroundColor Gray
Write-Host 'Run ''plan.ps1'' to generate a development plan' -ForegroundColor Gray
Write-Host 'Run ''tasks.ps1'' to generate tasks from specifications' -ForegroundColor Gray
