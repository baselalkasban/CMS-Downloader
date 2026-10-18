# Downloads the latest version of the extension from GitHub into the "extension" folder next to this script.
$ErrorActionPreference = 'Stop'
$repo = 'baselalkasban/CMS-Downloader'
$branch = 'claude/awesome-faraday-gfnufa'

$target = Join-Path $PSScriptRoot 'extension'
$tmp = Join-Path ([IO.Path]::GetTempPath()) ('cms-downloader-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null

function Get-Version($dir) {
  $manifest = Join-Path $dir 'manifest.json'
  if (Test-Path $manifest) { (Get-Content $manifest -Raw | ConvertFrom-Json).version } else { 'none' }
}

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $zip = Join-Path $tmp 'latest.zip'
  Write-Host 'Downloading the latest GUC CMS Downloader...'
  Invoke-WebRequest "https://github.com/$repo/archive/refs/heads/$branch.zip" -OutFile $zip -UseBasicParsing
  Expand-Archive -Path $zip -DestinationPath $tmp

  $root = Get-ChildItem $tmp -Directory | Select-Object -First 1
  $src = Join-Path $root.FullName 'extension'
  if (-not (Test-Path $src)) { throw 'The download has no extension folder.' }

  $old = Get-Version $target
  $new = Get-Version $src
  New-Item -ItemType Directory -Path $target -Force | Out-Null
  Copy-Item -Path (Join-Path $src '*') -Destination $target -Recurse -Force
  # Keep the updater and README current too.
  foreach ($f in 'update.ps1', 'update.bat', 'README.md') {
    $p = Join-Path $root.FullName $f
    if (Test-Path $p) { Copy-Item $p (Join-Path $PSScriptRoot $f) -Force }
  }

  Write-Host ''
  if ($old -eq $new) { Write-Host "Already up to date (version $new)." -ForegroundColor Green }
  else { Write-Host "Updated from version $old to $new." -ForegroundColor Green }
  Write-Host 'Last step: click the extension icon in Chrome and press "Reload extension".'
}
catch {
  Write-Host "Update failed: $_" -ForegroundColor Red
}
finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
