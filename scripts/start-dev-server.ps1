$port = 4174

if ($args.Length -gt 0) {
  $parsed = 0
  if ([int]::TryParse($args[0], [ref]$parsed) -and $parsed -gt 0) {
    $port = $parsed
  }
}

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  Write-Host "Dev server already running on port $port, reusing existing process."
  exit 0
}

node server.js --port=$port
