param(
  [string]$Version = $env:VERSION,
  [string]$InstallDir = "$env:LOCALAPPDATA\Programs\Miko\bin",
  [switch]$NoModifyPath
)

$ErrorActionPreference = "Stop"
$Repo = if ($env:MIKO_INSTALL_REPO) { $env:MIKO_INSTALL_REPO } else { "jianga0801-ui/miko" }

if (-not [Environment]::Is64BitOperatingSystem) {
  throw "Miko requires a 64-bit Windows installation."
}

$Arch = switch ((Get-CimInstance Win32_Processor | Select-Object -First 1).Architecture) {
  12 { "arm64" }
  9 { "x64" }
  default { throw "Unsupported Windows CPU architecture." }
}

if ([string]::IsNullOrWhiteSpace($Version)) {
  $Release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
  $Tag = $Release.tag_name
} else {
  $Tag = if ($Version.StartsWith("v")) { $Version } else { "v$Version" }
}

$Name = "miko-windows-$Arch.zip"
$Base = "https://github.com/$Repo/releases/download/$Tag"
$Temp = Join-Path ([IO.Path]::GetTempPath()) "miko-install-$PID"
$Archive = Join-Path $Temp $Name
$Checksums = Join-Path $Temp "checksums.txt"

New-Item -ItemType Directory -Force -Path $Temp | Out-Null
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

try {
  Invoke-WebRequest "$Base/$Name" -OutFile $Archive
  Invoke-WebRequest "$Base/checksums.txt" -OutFile $Checksums

  $Line = Get-Content $Checksums | Where-Object { $_ -match "\s$([regex]::Escape($Name))$" } | Select-Object -First 1
  $Expected = ($Line -split "\s+")[0]
  if ([string]::IsNullOrWhiteSpace($Expected)) {
    throw "No checksum entry found for $Name."
  }

  $Actual = (Get-FileHash -Algorithm SHA256 $Archive).Hash.ToLowerInvariant()
  if ($Actual -ne $Expected.ToLowerInvariant()) {
    throw "Checksum mismatch for $Name."
  }

  Expand-Archive -Force -Path $Archive -DestinationPath $Temp
  Copy-Item -Force (Join-Path $Temp "miko.exe") (Join-Path $InstallDir "miko.exe")

  if (-not $NoModifyPath) {
    $Path = [Environment]::GetEnvironmentVariable("Path", "User")
    $PathParts = if ([string]::IsNullOrWhiteSpace($Path)) { @() } else { $Path.Split(";") }
    if (-not ($PathParts -contains $InstallDir)) {
      $NewPath = if ([string]::IsNullOrWhiteSpace($Path)) { $InstallDir } else { "$InstallDir;$Path" }
      [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
      $env:Path = "$InstallDir;$env:Path"
    }
  }

  & (Join-Path $InstallDir "miko.exe") --version
  Write-Host "Miko installed to $InstallDir"
} finally {
  if (Test-Path $Archive) { Remove-Item $Archive }
  if (Test-Path $Checksums) { Remove-Item $Checksums }
  if (Test-Path (Join-Path $Temp "miko.exe")) { Remove-Item (Join-Path $Temp "miko.exe") }
  if (Test-Path $Temp) { Remove-Item $Temp }
}
