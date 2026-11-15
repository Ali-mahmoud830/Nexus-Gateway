# ═══════════════════════════════════════════════════════════════════════════════
#   NEXUS GATEWAY — AUTOMATED SWEEPER RUNNER
#   Runs every 5 minutes via Windows Task Scheduler.
#   Logs all output to: D:\projects\crypto\backend\logs\sweeper-auto.log
# ═══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Continue"

# ── Paths ────────────────────────────────────────────────────────────────────
$NodePath    = "C:\Program Files\nodejs"
$ProjectDir  = "D:\projects\crypto\backend"
$LogDir      = "$ProjectDir\logs"
$LogFile     = "$LogDir\sweeper-auto.log"
$MaxLogBytes = 10MB   # Rotate when log exceeds 10 MB

# ── Ensure log directory exists ───────────────────────────────────────────────
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# ── Log rotation (keep last 10 MB) ───────────────────────────────────────────
if (Test-Path $LogFile) {
    $logSize = (Get-Item $LogFile).Length
    if ($logSize -gt $MaxLogBytes) {
        $archive = "$LogDir\sweeper-auto.$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
        Move-Item $LogFile $archive
        # Keep only last 5 archives
        Get-ChildItem "$LogDir\sweeper-auto.*.log" |
            Sort-Object LastWriteTime -Descending |
            Select-Object -Skip 5 |
            Remove-Item -Force
    }
}

# ── Add Node.js to PATH for this session ─────────────────────────────────────
$env:Path = "$NodePath;" + $env:Path

# ── Verify Node.js is available ───────────────────────────────────────────────
$nodeVersion = & node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    $msg = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [FATAL] Node.js not found at $NodePath. Install Node.js v20+ and update the path in this script."
    Add-Content -Path $LogFile -Value $msg
    Write-Error $msg
    exit 1
}

# ── Run header ────────────────────────────────────────────────────────────────
$header = @"

══════════════════════════════════════════════════════════════════════════════
  NEXUS SWEEPER — AUTO RUN @ $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
  Node: $nodeVersion
══════════════════════════════════════════════════════════════════════════════
"@
Add-Content -Path $LogFile -Value $header

# ── Execute the sweeper ───────────────────────────────────────────────────────
Set-Location $ProjectDir

# Flags:
#   --live        → broadcast real transactions when funds are found
#   --scan 20     → audit the first 20 HD-wallet indices per chain
#   --concurrency 8 → 8 parallel balance queries for speed
#   --sync-db     → mark MongoDB invoices as FORWARDED after sweep
#   --network both → scan BSC and TRON simultaneously
$output = & npx tsx tools/sweeper/sweep.ts `
    --live `
    --scan 50 `
    --concurrency 8 `
    --sync-db `
    --network both 2>&1

# ── Write output to log ───────────────────────────────────────────────────────
$output | Add-Content -Path $LogFile

# ── Exit status ───────────────────────────────────────────────────────────────
$exitMsg = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [EXIT] Process exited with code: $LASTEXITCODE"
Add-Content -Path $LogFile -Value $exitMsg
Add-Content -Path $LogFile -Value ""

exit $LASTEXITCODE
