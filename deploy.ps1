# TradeSim Deployment Script
# Run this after setting up your .env.local and .firebaserc

param(
    [string]$Target = "all"  # Options: all, hosting, functions, firestore
)

Write-Host "=== TradeSim Deploy ===" -ForegroundColor Cyan

# Check .env.local
if (-not (Test-Path ".env.local")) {
    Write-Host "ERROR: .env.local not found! Copy .env.example to .env.local and fill in values." -ForegroundColor Red
    exit 1
}

# Check .firebaserc
$firebaserc = Get-Content .firebaserc | ConvertFrom-Json
if ($firebaserc.projects.default -eq "your-firebase-project-id") {
    Write-Host "ERROR: Update .firebaserc with your actual Firebase project ID!" -ForegroundColor Red
    exit 1
}

Write-Host "Building frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Build successful!" -ForegroundColor Green

Write-Host "Deploying to Firebase..." -ForegroundColor Yellow
switch ($Target) {
    "hosting"   { firebase deploy --only hosting }
    "functions" { firebase deploy --only functions }
    "firestore" { firebase deploy --only firestore }
    default     { firebase deploy }
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "=== Deployment successful! ===" -ForegroundColor Green
    Write-Host "Your site is live at: https://$($firebaserc.projects.default).web.app" -ForegroundColor Cyan
} else {
    Write-Host "Deployment failed. Check the error messages above." -ForegroundColor Red
}
