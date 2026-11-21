# No $ErrorActionPreference = "Stop": in Windows PowerShell 5.1 it turns a redirected native
# stderr line (docker rm on a missing container) into a fatal error. Exit codes are checked instead.
Set-Location (Join-Path $PSScriptRoot "..")
docker build -t pm-app .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker rm -f pm-app 2>$null | Out-Null
$envArgs = @()
if (Test-Path .env) { $envArgs = @("--env-file", ".env") }
docker run -d --name pm-app -p 127.0.0.1:8000:8000 @envArgs -v "${PWD}/backend/data:/app/data" pm-app
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output "Running at http://localhost:8000"
