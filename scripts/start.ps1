$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
docker build -t pm-app .
docker rm -f pm-app 2>$null | Out-Null
$envArgs = @()
if (Test-Path .env) { $envArgs = @("--env-file", ".env") }
docker run -d --name pm-app -p 8000:8000 @envArgs -v "${PWD}/backend/data:/app/data" pm-app
Write-Output "Running at http://localhost:8000"
