param([string]$CacheDistro='SylvanaRuntime')
$ErrorActionPreference='Stop'
$repo=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$private=Join-Path $repo '.supabase/desktop-poc'
$resources=Join-Path $repo 'desktop/resources'
New-Item -ItemType Directory -Force $resources | Out-Null
$cliArchive=Join-Path $private 'downloads/supabase-linux-amd64.tar.gz'
if((Get-FileHash $cliArchive -Algorithm SHA256).Hash.ToLower() -ne '4b481189efbdc57cf2d37bdee5f1a0d29574314398564b32a6dfb76c0fcf275f'){throw 'Supabase archive checksum mismatch'}
$rootfs=Join-Path $private 'downloads/ubuntu-24.04-rootfs.tar.gz'
$checksumLine=Get-Content (Join-Path $private 'downloads/SHA256SUMS') | Where-Object {$_ -match 'ubuntu-noble-wsl-amd64-24.04lts.rootfs.tar.gz$'}
$expectedUbuntu=($checksumLine -split '\s+')[0]
if((Get-FileHash $rootfs -Algorithm SHA256).Hash.ToLower() -ne $expectedUbuntu){throw 'Ubuntu archive checksum mismatch'}
function LinuxPath([string]$value){return '/mnt/'+$value.Substring(0,1).ToLower()+$value.Substring(2).Replace('\','/')}
$cache=Join-Path $private 'native-cache.tar'
wsl --distribution $CacheDistro --user sylvana --exec tar -cf (LinuxPath $cache) -C /home/sylvana/.supabase cache
if($LASTEXITCODE -ne 0){throw 'Native cache export failed'}
$name='SylvanaRuntime-Build'
$distros=(& wsl --list --quiet) -replace "`0",''
if($distros.Trim() -contains $name){throw 'Build distribution already exists. Inspect it before creating another template.'}
$buildPath=Join-Path $env:LOCALAPPDATA 'Sylvana/runtime-build'
wsl --import $name $buildPath $rootfs --version 2
if($LASTEXITCODE -ne 0){throw 'Clean template import failed'}
wsl --distribution $name --user root --exec bash (LinuxPath (Join-Path $repo 'desktop/runtime/prepare-template.sh')) (LinuxPath (Join-Path $repo 'desktop')) (LinuxPath $cache) (LinuxPath $cliArchive)
if($LASTEXITCODE -ne 0){throw 'Clean template provisioning failed'}
wsl --terminate $name
wsl --export $name (Join-Path $resources 'runtime.tar')
if($LASTEXITCODE -ne 0){throw 'Clean template export failed'}
$hash=(Get-FileHash (Join-Path $resources 'runtime.tar') -Algorithm SHA256).Hash.ToLower()
[IO.File]::WriteAllText((Join-Path $resources 'runtime.sha256'),$hash)
Write-Output "Runtime template exported and verified: $hash"
& node (Join-Path $repo 'scripts/desktop/compress-runtime.mjs')
if($LASTEXITCODE -ne 0){throw 'Runtime template compression failed'}
