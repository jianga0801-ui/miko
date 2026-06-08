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

function Test-Avx2 {
  try {
    try {
      $Kernel32 = [Win32.Kernel32]
    } catch {
      $Kernel32 = Add-Type -MemberDefinition '[DllImport("kernel32.dll")] public static extern bool IsProcessorFeaturePresent(int ProcessorFeature);' -Name Kernel32 -Namespace Win32 -PassThru
    }
    return [bool]$Kernel32::IsProcessorFeaturePresent(40)
  } catch {
    return $false
  }
}

function Remove-InstallTempDir {
  param([string]$Path)

  if ([string]::IsNullOrWhiteSpace($Path)) { return }

  $TempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  $Resolved = [IO.Path]::GetFullPath($Path)
  if (-not $Resolved.StartsWith($TempRoot, [StringComparison]::OrdinalIgnoreCase)) {
    Write-Warning "Skipping cleanup outside temp directory: $Resolved"
    return
  }
  if (-not (Test-Path -LiteralPath $Resolved)) { return }

  try {
    [IO.Directory]::Delete($Resolved, $true)
  } catch {
    Write-Warning "Failed to clean temporary install directory: $Resolved"
  }
}

if ([string]::IsNullOrWhiteSpace($Version)) {
  $Release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
  $Tag = $Release.tag_name
} else {
  $Tag = if ($Version.StartsWith("v")) { $Version } else { "v$Version" }
}

$Variant = if ($Arch -eq "x64" -and -not (Test-Avx2)) { "-baseline" } else { "" }
$Name = "miko-windows-$Arch$Variant.zip"
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
  $PayloadFiles = @("miko.exe", "ffmpeg.exe", "snoretoast-x64.exe")
  foreach ($File in $PayloadFiles) {
    $Source = Join-Path $Temp $File
    if (Test-Path $Source) {
      Copy-Item -Force $Source (Join-Path $InstallDir $File)
    }
  }
  if (Test-Path (Join-Path $Temp "builtin")) {
    Copy-Item -Force -Recurse (Join-Path $Temp "builtin") $InstallDir
  }

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

  $e = [char]27
  $Muted = "$e[0;2m"
  $Gray = "$e[90m"
  $Mask1 = "$e[48;5;235m" # shadow block inside M
  $Mask2 = "$e[48;5;238m" # shadow block inside O
  $Nc = "$e[0m"
  $Bar = "$Muted$('░' * 48)$Nc"

  Write-Host ""
  Write-Host $Bar
  Write-Host " ${Gray}█▀▄▀█${Nc} █ ${Gray}█ █ ${Nc}█▀▀█ "
  Write-Host " ${Gray}█${Mask1} ${Nc}${Gray}▀${Mask1} ${Nc}${Gray}█${Nc} █ ${Gray}█▀▄${Nc} █${Mask2}  ${Nc}█ "
  Write-Host " ${Gray}▀   ▀${Nc} ▀ ${Gray}▀  ▀${Nc}▀▀▀▀ "
  Write-Host $Bar
  Write-Host ""
  Write-Host ""
  Write-Host "${Muted}Miko includes free models, to start:${Nc}"
  Write-Host ""
  Write-Host "cd <project>  ${Muted}# Open directory${Nc}"
  Write-Host "miko          ${Muted}# Run command${Nc}"
  Write-Host ""
  Write-Host "${Muted}For more information visit ${Nc}https://github.com/$Repo"
  Write-Host ""
} finally {
  if (Test-Path $Archive) { Remove-Item $Archive }
  if (Test-Path $Checksums) { Remove-Item $Checksums }
  if (Test-Path (Join-Path $Temp "miko.exe")) { Remove-Item (Join-Path $Temp "miko.exe") }
  if (Test-Path (Join-Path $Temp "ffmpeg.exe")) { Remove-Item (Join-Path $Temp "ffmpeg.exe") }
  if (Test-Path (Join-Path $Temp "snoretoast-x64.exe")) { Remove-Item (Join-Path $Temp "snoretoast-x64.exe") }
  Remove-InstallTempDir $Temp
}
