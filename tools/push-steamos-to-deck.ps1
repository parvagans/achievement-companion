[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$Deck,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$RemoteDir,

  [switch]$AllowDirty,
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  throw $Message
}

function Assert-CommandAvailable([string]$Name) {
  if ($null -eq (Get-Command -Name $Name -ErrorAction SilentlyContinue)) {
    Fail "Required command '$Name' was not found in PATH."
  }
}

function Assert-RepoRoot {
  if (-not (Test-Path -LiteralPath ".git") -or -not (Test-Path -LiteralPath "package.json")) {
    Fail "Run this helper from the Achievement Companion repo root."
  }
}

function Assert-SafeRemoteArgument([string]$Name, [string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) {
    Fail "$Name is required."
  }

  if ($Value.Contains("'") -or $Value.Contains("`n") -or $Value.Contains("`r")) {
    Fail "$Name contains an unsafe character. Remove quotes and line breaks, then try again."
  }
}

function Assert-CleanWorkingTree([bool]$AllowDirtyTree) {
  $statusLines = & git status --porcelain=v1 --untracked-files=all
  if ($LASTEXITCODE -ne 0) {
    Fail "Could not read git status."
  }

  if ($statusLines.Count -gt 0 -and -not $AllowDirtyTree) {
    Fail "Working tree is dirty. Commit or stash changes first, or rerun with -AllowDirty if you intentionally want to push HEAD only."
  }

  if ($statusLines.Count -gt 0 -and $AllowDirtyTree) {
    Write-Warning "Working tree is dirty. This helper will still transfer git archive HEAD only, so local uncommitted or untracked changes will not be copied."
  }
}

function Invoke-CheckedCommand([scriptblock]$Command, [string]$FailureMessage) {
  & $Command
  if ($LASTEXITCODE -ne 0) {
    Fail $FailureMessage
  }
}

Assert-RepoRoot
Assert-SafeRemoteArgument -Name "Deck" -Value $Deck
Assert-SafeRemoteArgument -Name "RemoteDir" -Value $RemoteDir

Assert-CommandAvailable -Name "git"
Assert-CommandAvailable -Name "scp"
Assert-CommandAvailable -Name "ssh"

if (-not $SkipBuild) {
  Assert-CommandAvailable -Name "npm"
}

Assert-CleanWorkingTree -AllowDirtyTree $AllowDirty.IsPresent

$localBootstrapAsset = Join-Path -Path (Get-Location) -ChildPath "dist-steamos/steamos-bootstrap.js"

if (-not $SkipBuild) {
  Write-Host "Building SteamOS bootstrap asset..."
  Invoke-CheckedCommand -Command { npm run build:steamos } -FailureMessage "SteamOS build failed."
}

if (-not (Test-Path -LiteralPath $localBootstrapAsset)) {
  Fail "dist-steamos/steamos-bootstrap.js is missing. Run 'npm run build:steamos' first or omit -SkipBuild."
}

$sessionId = [Guid]::NewGuid().ToString("N")
$tempRoot = Join-Path -Path ([System.IO.Path]::GetTempPath()) -ChildPath "achievement-companion-steamos-$sessionId"
$localArchivePath = Join-Path -Path $tempRoot -ChildPath "achievement-companion-head.tar"
$remoteArchivePath = "/tmp/achievement-companion-head-$sessionId.tar"
$remoteBootstrapDir = "$RemoteDir/dist-steamos"
$remoteBootstrapAsset = "$remoteBootstrapDir/steamos-bootstrap.js"

New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

try {
  Write-Host "Creating clean tracked-source archive from git HEAD..."
  Invoke-CheckedCommand -Command {
    git archive --format=tar "--output=$localArchivePath" HEAD
  } -FailureMessage "git archive HEAD failed."

  if (-not (Test-Path -LiteralPath $localArchivePath)) {
    Fail "Local archive was not created."
  }

  Write-Host "Preparing remote directory..."
  Invoke-CheckedCommand -Command {
    ssh $Deck "mkdir -p '$RemoteDir' '$remoteBootstrapDir'"
  } -FailureMessage "Could not create the remote SteamOS validation directory."

  Write-Host "Copying tracked source archive to the Deck..."
  Invoke-CheckedCommand -Command {
    scp $localArchivePath "${Deck}:$remoteArchivePath"
  } -FailureMessage "Copying the tracked source archive to the Deck failed."

  Write-Host "Extracting tracked source archive on the Deck..."
  Invoke-CheckedCommand -Command {
    ssh $Deck "tar -xf '$remoteArchivePath' -C '$RemoteDir' && rm -f '$remoteArchivePath'"
  } -FailureMessage "Extracting the tracked source archive on the Deck failed."

  Write-Host "Copying built SteamOS bootstrap asset to the Deck..."
  Invoke-CheckedCommand -Command {
    scp $localBootstrapAsset "${Deck}:$remoteBootstrapAsset"
  } -FailureMessage "Copying the SteamOS bootstrap asset to the Deck failed."

  Write-Host ""
  Write-Host "SteamOS validation files copied successfully."
  Write-Host ""
  Write-Host "What this helper copied:"
  Write-Host "- committed tracked files from git archive HEAD"
  Write-Host "- dist-steamos/steamos-bootstrap.js from this machine"
  Write-Host ""
  Write-Host "What this helper did not copy:"
  Write-Host "- provider-config.json or provider-secrets.json"
  Write-Host "- .tmp-steamos* temp roots"
  Write-Host "- cache/state/runtime directories"
  Write-Host "- node_modules"
  Write-Host "- release artifacts or ZIPs"
  Write-Host "- untracked files or local-only working tree changes"
  Write-Host ""
  Write-Host "Next commands to run on the Deck:"
  Write-Host "cd $RemoteDir"
  Write-Host "python3 -m backend.steamos_doctor --xdg-root .tmp-steamos-deck"
  Write-Host "python3 -m backend.dev_shell --xdg-root .tmp-steamos-deck"
  Write-Host ""
  Write-Host "Review output before sharing it, and never paste API keys, runtime tokens, provider config, or provider secrets."
}
finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}
