$ErrorActionPreference = 'Stop'

$profile = Join-Path (Get-Location) '.1688-browser-profile'
$urls = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)

$browser = $urls | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $browser) {
  Write-Host '[1688 Browser] Chrome or Edge was not found.' -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Force -Path $profile | Out-Null
Write-Host "[1688 Browser] Launching: $browser" -ForegroundColor Cyan
Write-Host "[1688 Browser] Profile: $profile" -ForegroundColor Cyan
Write-Host '[1688 Browser] Remote debugging: http://127.0.0.1:9222' -ForegroundColor Cyan
Write-Host '[1688 Browser] Dedicated collector browser is ready.' -ForegroundColor Green
Write-Host '[1688 Browser] Paste a working 1688 product URL in this window and log in if 1688 asks.' -ForegroundColor Yellow
Write-Host '[1688 Browser] Keep this window open while collecting from Seller OS.' -ForegroundColor Yellow

Start-Process -FilePath $browser -ArgumentList @(
  '--remote-debugging-port=9222',
  "--user-data-dir=$profile",
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank'
)
