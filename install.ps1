[CmdletBinding(SupportsShouldProcess = $true, PositionalBinding = $false)]
param(
  [Parameter()]
  [ValidateNotNullOrEmpty()]
  [string]$RepoUrl = "https://github.com/Aysar06/YT-URL-Video-Downloader-.git",

  [Parameter()]
  [ValidateNotNullOrEmpty()]
  [string]$Branch = "main",

  [Parameter()]
  [ValidateSet("Zip", "Git")]
  [string]$SourceMethod = "Zip",

  [Parameter()]
  [ValidateNotNullOrEmpty()]
  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA "Programs\YouTube Video Downloader"),

  [Parameter()]
  [ValidateNotNullOrEmpty()]
  [string]$WorkDir = (Join-Path $env:TEMP "ytvd-install"),

  [Parameter()]
  [ValidateNotNullOrEmpty()]
  [string]$LogPath = (Join-Path $env:TEMP ("ytvd-install-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))),

  [Parameter()]
  [string]$GitHubToken,

  [Parameter()]
  [switch]$Silent,

  [Parameter()]
  [switch]$SkipBuild,

  [Parameter()]
  [switch]$SkipShortcuts,

  [Parameter()]
  [ValidateSet("CurrentUser", "Machine")]
  [string]$EnvScope = "CurrentUser"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$script:LogFilePath = $LogPath
$script:IsWindowsOS = $false
try {
  $script:IsWindowsOS = [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Windows)
} catch {
  $script:IsWindowsOS = ($env:OS -eq "Windows_NT")
}

function Write-Log {
  param(
    [Parameter(Mandatory)]
    [ValidateNotNullOrEmpty()]
    [string]$Message,
    [ValidateSet("INFO", "WARN", "ERROR")]
    [string]$Level = "INFO"
  )
  $line = "[{0:yyyy-MM-dd HH:mm:ss}] [{1}] {2}" -f (Get-Date), $Level, $Message
  Write-Host $line
  try {
    if ($script:LogFilePath) {
      Add-Content -LiteralPath $script:LogFilePath -Value $line -Encoding UTF8
    }
  } catch { }
}

function Fail {
  param([Parameter(Mandatory)][string]$Message, [int]$Code = 1)
  Write-Log -Level "ERROR" -Message $Message
  throw $Message
}

function Test-Command {
  param([Parameter(Mandatory)][string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Ensure-Directory {
  param([Parameter(Mandatory)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    if ($PSCmdlet.ShouldProcess($Path, "Create directory")) {
      New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
  }
}

function Get-RepoZipUrl {
  param(
    [Parameter(Mandatory)][string]$RepoUrl,
    [Parameter(Mandatory)][string]$Branch
  )

  if ($RepoUrl -match "github\.com[:/](?<owner>[^/]+)/(?<repo>[^/.]+)(\.git)?$") {
    $owner = $Matches.owner
    $repo = $Matches.repo
    return "https://github.com/$owner/$repo/archive/refs/heads/$Branch.zip"
  }

  Fail "RepoUrl must be a GitHub repo URL (https://github.com/<owner>/<repo>.git)."
}

function Get-RepoApiZipballUrl {
  param(
    [Parameter(Mandatory)][string]$RepoUrl,
    [Parameter(Mandatory)][string]$Ref
  )

  if ($RepoUrl -match "github\.com[:/](?<owner>[^/]+)/(?<repo>[^/.]+)(\.git)?$") {
    $owner = $Matches.owner
    $repo = $Matches.repo
    return "https://api.github.com/repos/$owner/$repo/zipball/$Ref"
  }

  Fail "RepoUrl must be a GitHub repo URL (https://github.com/<owner>/<repo>.git)."
}

function Get-GitHubDefaultBranch {
  param(
    [Parameter(Mandatory)][string]$RepoUrl,
    [string]$Token
  )

  if ($RepoUrl -match "github\.com[:/](?<owner>[^/]+)/(?<repo>[^/.]+)(\.git)?$") {
    $owner = $Matches.owner
    $repo = $Matches.repo
    $apiUrl = "https://api.github.com/repos/$owner/$repo"

    $headers = @{ "User-Agent" = "ytvd-installer" }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }

    try {
      $resp = Invoke-RestMethod -Uri $apiUrl -Headers $headers -Method Get
      if ($resp.default_branch) { return [string]$resp.default_branch }
    } catch { }
  }

  return $null
}

function Invoke-DownloadFile {
  param(
    [Parameter(Mandatory)][string]$Url,
    [Parameter(Mandatory)][string]$OutFile,
    [string]$Token
  )

  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
  } catch { }

  $headers = @{
    "User-Agent" = "ytvd-installer"
    "Accept" = "application/vnd.github+json"
  }
  if ($Token) {
    $headers["Authorization"] = "Bearer $Token"
    $headers["X-GitHub-Api-Version"] = "2022-11-28"
  }

  if ($PSCmdlet.ShouldProcess($Url, "Download")) {
    if ($PSVersionTable.PSVersion.Major -ge 6) {
      Invoke-WebRequest -Uri $Url -OutFile $OutFile -Headers $headers
    } else {
      Invoke-WebRequest -Uri $Url -OutFile $OutFile -Headers $headers -UseBasicParsing
    }
  }
}

function Invoke-External {
  param(
    [Parameter(Mandatory)][string]$FilePath,
    [Parameter(Mandatory)][string[]]$ArgumentList,
    [string]$WorkingDirectory
  )

  $display = "$FilePath " + ($ArgumentList -join " ")
  if (-not $PSCmdlet.ShouldProcess($display, "Execute")) { return }

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FilePath
  $psi.Arguments = ($ArgumentList -join " ")
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  if ($WorkingDirectory) { $psi.WorkingDirectory = $WorkingDirectory }

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  $null = $p.Start()
  $stdout = $p.StandardOutput.ReadToEnd()
  $stderr = $p.StandardError.ReadToEnd()
  $p.WaitForExit()

  if ($stdout) { $stdout.TrimEnd() | Write-Host }
  if ($stderr) { $stderr.TrimEnd() | Write-Host }
  if ($p.ExitCode -ne 0) {
    Fail "Command failed ($($p.ExitCode)): $display"
  }
}

function Set-EnvVar {
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][string]$Value,
    [ValidateSet("CurrentUser", "Machine")]
    [string]$Scope
  )

  if ($Scope -eq "Machine") {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
      Fail "EnvScope=Machine requires running PowerShell as Administrator."
    }
  }

  if ($PSCmdlet.ShouldProcess("$Scope env:$Name", "Set environment variable")) {
    [Environment]::SetEnvironmentVariable($Name, $Value, $Scope)
  }
}

function New-Shortcut {
  param(
    [Parameter(Mandatory)][string]$ShortcutPath,
    [Parameter(Mandatory)][string]$TargetPath,
    [string]$WorkingDirectory,
    [string]$Description
  )

  if (-not $PSCmdlet.ShouldProcess($ShortcutPath, "Create shortcut")) { return }
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($ShortcutPath)
  $shortcut.TargetPath = $TargetPath
  if ($WorkingDirectory) { $shortcut.WorkingDirectory = $WorkingDirectory }
  if ($Description) { $shortcut.Description = $Description }
  $shortcut.Save()
}

function Test-Prerequisites {
  Write-Log "Checking prerequisites..."

  if ($PSVersionTable.PSVersion.Major -lt 5) {
    Fail "PowerShell 5.1+ is required."
  }

  if (-not $script:IsWindowsOS) {
    Fail "This installer supports Windows only."
  }

  try {
    $pol = Get-ExecutionPolicy -Scope Process
    Write-Log "ExecutionPolicy (Process): $pol"
  } catch { }

  if (-not (Test-Command "node")) {
    Fail "Node.js is required. Install Node.js 20+ and re-run."
  }

  $nodeVersion = (& node -v) 2>$null
  Write-Log "Node version: $nodeVersion"

  if (-not (Test-Command "npm")) {
    Fail "npm is required (it should come with Node.js)."
  }

  if ($SourceMethod -eq "Git" -and -not (Test-Command "git")) {
    Fail "Git is required for SourceMethod=Git. Install Git or use SourceMethod=Zip."
  }

  if (-not (Test-Command "ffmpeg")) {
    Write-Log -Level "WARN" -Message "FFmpeg not found. Some higher-quality downloads may be unavailable."
  }

  if (Test-Command "dotnet") {
    $dotnetCmd = Get-Command dotnet -ErrorAction SilentlyContinue
    $dotnetPath = $dotnetCmd.Path
    Write-Log "dotnet host detected: $dotnetPath"

    $sdks = $null
    try {
      $sdks = & dotnet --list-sdks 2>$null
    } catch {
      $sdks = $null
    }

    if ($sdks) {
      Write-Log "dotnet SDKs:`n$sdks"
    } else {
      Write-Log -Level "WARN" -Message "No .NET SDK detected (not required for this app)."
    }
  } else {
    Write-Log -Level "WARN" -Message ".NET not detected (not required for this app)."
  }
}

function Get-Source {
  param(
    [Parameter(Mandatory)][string]$RepoUrl,
    [Parameter(Mandatory)][string]$Branch,
    [Parameter(Mandatory)][string]$WorkDir,
    [Parameter()][string]$Token
  )

  Ensure-Directory $WorkDir

  $srcDir = Join-Path $WorkDir "src"
  if (Test-Path -LiteralPath $srcDir) {
    if ($PSCmdlet.ShouldProcess($srcDir, "Remove previous work directory")) {
      Remove-Item -LiteralPath $srcDir -Recurse -Force
    }
  }

  if ($SourceMethod -eq "Git") {
    Write-Log "Cloning repository..."
    $cloneUrl = $RepoUrl
    if ($Token -and $RepoUrl -like "https://github.com/*") {
      $cloneUrl = $RepoUrl -replace "^https://github\.com/", ("https://$Token@github.com/")
    }
    Invoke-External -FilePath "git" -ArgumentList @("clone", "--depth", "1", "--branch", $Branch, $cloneUrl, $srcDir) -WorkingDirectory $WorkDir
    return $srcDir
  }

  Write-Log "Downloading repository zip..."
  $zipPath = Join-Path $WorkDir "repo.zip"
  $defaultBranch = $null
  $defaultBranch = Get-GitHubDefaultBranch -RepoUrl $RepoUrl -Token $Token

  $branchCandidates = @($Branch, $defaultBranch, "main", "master") | Where-Object { $_ } | Select-Object -Unique
  $downloaded = $false
  $lastDownloadError = $null

  foreach ($b in $branchCandidates) {
    $urls = @()
    $urls += (Get-RepoApiZipballUrl -RepoUrl $RepoUrl -Ref $b)
    $urls += (Get-RepoZipUrl -RepoUrl $RepoUrl -Branch $b)

    foreach ($u in $urls) {
      try {
        Invoke-DownloadFile -Url $u -OutFile $zipPath -Token $Token
        if (Test-Path -LiteralPath $zipPath) {
          $downloaded = $true
          break
        }
      } catch {
        $lastDownloadError = $_
        $statusCode = $null
        try { $statusCode = $_.Exception.Response.StatusCode.value__ } catch { }
        if ($statusCode -ne 404) { break }
      }
    }

    if ($downloaded) { break }
  }

  if (-not $downloaded) {
    if (-not $Token) {
      Fail "Failed to download repository source. If the repo is private, re-run with -GitHubToken or use -SourceMethod Git."
    }
    if ($lastDownloadError) { throw $lastDownloadError }
    Fail "Failed to download repository source."
  }

  Write-Log "Extracting..."
  if ($PSCmdlet.ShouldProcess($zipPath, "Expand archive")) {
    Expand-Archive -LiteralPath $zipPath -DestinationPath $WorkDir -Force
  }

  $expanded = Get-ChildItem -LiteralPath $WorkDir -Directory | Where-Object { $_.Name -like "*-*" } | Select-Object -First 1
  if (-not $expanded) {
    Fail "Could not locate extracted repository folder."
  }

  if ($PSCmdlet.ShouldProcess($expanded.FullName, "Move extracted source")) {
    Move-Item -LiteralPath $expanded.FullName -Destination $srcDir -Force
  }

  return $srcDir
}

function Install-App {
  param([Parameter(Mandatory)][string]$SourceDir, [Parameter(Mandatory)][string]$InstallDir)

  Write-Log "Installing dependencies..."
  Invoke-External -FilePath "npm" -ArgumentList @("install") -WorkingDirectory $SourceDir

  if (-not $SkipBuild) {
    Write-Log "Building installer..."
    Invoke-External -FilePath "npm" -ArgumentList @("run", "build:installer") -WorkingDirectory $SourceDir

    $distDir = Join-Path $SourceDir "dist"
    $installer = Get-ChildItem -LiteralPath $distDir -Filter "*Setup*.exe" -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $installer) {
      Fail "Installer .exe not found in dist/. Build may have failed."
    }

    Ensure-Directory $InstallDir
    $installerCopy = Join-Path $InstallDir $installer.Name
    if ($PSCmdlet.ShouldProcess($installerCopy, "Copy installer")) {
      Copy-Item -LiteralPath $installer.FullName -Destination $installerCopy -Force
    }

    Write-Log "Running installer..."
    if ($Silent) {
      Invoke-External -FilePath $installerCopy -ArgumentList @("/S", "/D=$InstallDir") -WorkingDirectory $InstallDir
    } else {
      Invoke-External -FilePath $installerCopy -ArgumentList @() -WorkingDirectory $InstallDir
    }
  } else {
    Write-Log -Level "WARN" -Message "SkipBuild enabled: only dependencies were installed in the work directory."
  }
}

function Configure-App {
  param([Parameter(Mandatory)][string]$InstallDir, [Parameter(Mandatory)][ValidateSet("CurrentUser", "Machine")][string]$Scope)

  Write-Log "Configuring environment..."
  Set-EnvVar -Name "YTVDDL_INSTALL_DIR" -Value $InstallDir -Scope $Scope
}

function Create-Shortcuts {
  param([Parameter(Mandatory)][string]$InstallDir)

  if ($SkipShortcuts) {
    Write-Log "Skipping shortcut creation."
    return
  }

  $exePath = Join-Path $InstallDir "YouTube Video Downloader.exe"
  if (-not (Test-Path -LiteralPath $exePath)) {
    Write-Log -Level "WARN" -Message "Installed executable not found at: $exePath (shortcut creation skipped)."
    return
  }

  $startMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\YouTube Video Downloader"
  Ensure-Directory $startMenuDir

  $shortcutPath = Join-Path $startMenuDir "YouTube Video Downloader.lnk"
  New-Shortcut -ShortcutPath $shortcutPath -TargetPath $exePath -WorkingDirectory $InstallDir -Description "YouTube Video Downloader"
}

try {
  Ensure-Directory (Split-Path -Parent $LogPath)
  try { Start-Transcript -LiteralPath $LogPath -Force | Out-Null } catch { }

  Write-Log "Starting installation..."
  Write-Log "Log file: $LogPath"

  Test-Prerequisites
  if ($WhatIfPreference) {
    Write-Log "WhatIf mode enabled: skipping download/build/install steps."
    exit 0
  }

  Write-Progress -Activity "Installing" -Status "Fetching source" -PercentComplete 10
  $sourceDir = Get-Source -RepoUrl $RepoUrl -Branch $Branch -WorkDir $WorkDir -Token $GitHubToken

  Write-Progress -Activity "Installing" -Status "Installing application" -PercentComplete 55
  Install-App -SourceDir $sourceDir -InstallDir $InstallDir

  Write-Progress -Activity "Installing" -Status "Configuring" -PercentComplete 80
  Configure-App -InstallDir $InstallDir -Scope $EnvScope

  Write-Progress -Activity "Installing" -Status "Creating shortcuts" -PercentComplete 90
  Create-Shortcuts -InstallDir $InstallDir

  Write-Progress -Activity "Installing" -Completed -Status "Done"
  Write-Log "Installation complete."
  Write-Log "You can run the app from Start Menu or: $InstallDir"
  exit 0
} catch {
  Write-Progress -Activity "Installing" -Completed -Status "Failed"
  Write-Log -Level "ERROR" -Message ("Installation failed: {0}" -f $_.Exception.Message)
  try {
    if ($_.ScriptStackTrace) { Write-Log -Level "ERROR" -Message ("Stack: {0}" -f $_.ScriptStackTrace) }
  } catch { }
  Write-Log -Level "ERROR" -Message "See log: $LogPath"
  exit 1
} finally {
  try { Stop-Transcript | Out-Null } catch { }
}
