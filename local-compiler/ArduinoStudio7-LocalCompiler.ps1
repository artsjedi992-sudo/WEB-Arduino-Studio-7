# Arduino Studio 7 Web - local Arduino CLI bridge
# Start with Start-LocalCompiler.bat. Administrator privileges are not required.
$ErrorActionPreference = "Stop"

$Port = 8765
$AllowedOrigin = "https://artsjedi992-sudo.github.io"
$DefaultCli = Join-Path $env:USERPROFILE "AndroidStudioProjects\Arduino-Studio-7\Arduino-Studio-7-Windows\tools\arduino-cli.exe"

Add-Type -AssemblyName System.Web.Extensions
$serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$serializer.MaxJsonLength = 12582912

function Send-Json($response, $status, $obj) {
    $json = $serializer.Serialize($obj)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $response.StatusCode = $status
    $response.ContentType = "application/json; charset=utf-8"
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
    $response.OutputStream.Close()
}

function Safe-RelativePath([string]$value) {
    $p = $value.Replace("\", "/")
    if ([string]::IsNullOrEmpty($p) -or $p.Trim().Length -eq 0 -or $p.StartsWith("/") -or $p -match "^[A-Za-z]:" -or $p -match "(^|/)\.\.(/|$)") {
        throw "Invalid file path: $value"
    }
    return $p
}

Write-Host ""
Write-Host "Arduino Studio 7 - Local Compiler" -ForegroundColor Cyan
Write-Host "Address: http://127.0.0.1:$Port"
Write-Host ""

$Cli = $DefaultCli
if (-not (Test-Path -LiteralPath $Cli)) {
    Write-Host "Arduino CLI was not found at the default location:" -ForegroundColor Yellow
    Write-Host $Cli
    $Cli = Read-Host "Enter the full path to arduino-cli.exe"
}
if (-not (Test-Path -LiteralPath $Cli)) {
    Write-Host "ERROR: arduino-cli.exe was not found." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
$Cli = (Resolve-Path -LiteralPath $Cli).Path
Write-Host "Arduino CLI: $Cli" -ForegroundColor Green

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
try { $listener.Start() } catch {
    Write-Host "Could not open local port $Port. It may already be in use." -ForegroundColor Red
    Write-Host $_.Exception.Message
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Ready. Keep this window open while using the IDE." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop."
Write-Host ""

while ($listener.IsListening) {
    $context = $null
    try {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response
        $origin = $req.Headers["Origin"]

        if ($origin -eq $AllowedOrigin) {
            $res.Headers.Add("Access-Control-Allow-Origin", $AllowedOrigin)
            $res.Headers.Add("Vary", "Origin")
            $res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
            $res.Headers.Add("Access-Control-Allow-Private-Network", "true")
        }

        if ($req.HttpMethod -eq "OPTIONS") {
            $res.StatusCode = 204
            $res.Close()
            continue
        }

        if ($req.Url.AbsolutePath -eq "/health" -and $req.HttpMethod -eq "GET") {
            Send-Json $res 200 @{ ok = $true; compiler = "local-arduino-cli"; upload = $false }
            continue
        }

        if ($req.Url.AbsolutePath -ne "/api/compile" -or $req.HttpMethod -ne "POST") {
            Send-Json $res 404 @{ success = $false; message = "Unknown endpoint." }
            continue
        }
        if ($origin -ne $AllowedOrigin) {
            Send-Json $res 403 @{ success = $false; message = "Request origin is not the authorized Arduino Studio 7 website." }
            continue
        }
        if ($req.ContentLength64 -gt 12582912) {
            Send-Json $res 413 @{ success = $false; message = "Project is larger than 12 MB." }
            continue
        }

        $reader = New-Object System.IO.StreamReader($req.InputStream, $req.ContentEncoding)
        $body = $reader.ReadToEnd()
        $reader.Close()
        $data = $serializer.DeserializeObject($body)
        $fqbn = [string]$data["fqbn"]
        $allowedBoards = @("arduino:avr:uno","arduino:avr:nano","arduino:avr:mega","arduino:avr:leonardo","arduino:avr:micro","arduino:megaavr:uno2018")
        if ($allowedBoards -notcontains $fqbn) {
            Send-Json $res 400 @{ success = $false; message = "Unsupported board: $fqbn" }
            continue
        }
        $files = $data["files"]
        if (-not $files -or $files.Count -gt 200) {
            Send-Json $res 400 @{ success = $false; message = "No files supplied or more than 200 files." }
            continue
        }
        $ino = $null
        foreach ($f in $files) { if ([string]$f["name"] -match "\.ino$") { $ino = $f; break } }
        if (-not $ino) {
            Send-Json $res 400 @{ success = $false; message = "Project does not contain an .ino file." }
            continue
        }

        $sketchName = [System.IO.Path]::GetFileNameWithoutExtension([string]$ino["name"])
        if ($sketchName -notmatch "^[A-Za-z0-9_-]+$") { $sketchName = "ArduinoSketch" }
        $inoPath = Safe-RelativePath([string]$ino["path"])
        $inoParent = ""
        if ($inoPath.Contains("/")) { $inoParent = $inoPath.Substring(0, $inoPath.LastIndexOf("/")) }

        $work = Join-Path ([System.IO.Path]::GetTempPath()) ("A7Compile_" + [Guid]::NewGuid().ToString("N"))
        $sketchDir = Join-Path $work $sketchName
        New-Item -ItemType Directory -Path $sketchDir -Force | Out-Null
        $logFile = Join-Path $work "compile.log"

        try {
            foreach ($f in $files) {
                $relative = Safe-RelativePath([string]$f["path"])
                if ($inoParent -and $relative.StartsWith($inoParent + "/")) {
                    $relative = $relative.Substring($inoParent.Length + 1)
                }
                $target = Join-Path $sketchDir ($relative.Replace("/", "\"))
                $parent = Split-Path -Parent $target
                if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
                $content = [string]$f["content"]
                [System.IO.File]::WriteAllText($target, $content, (New-Object System.Text.UTF8Encoding($false)))
            }

            $cliArgs = 'compile --fqbn "' + $fqbn + '" --export-binaries "' + $sketchDir + '"'
            $cmdLine = '/d /s /c ""' + $Cli + '" ' + $cliArgs + ' > "' + $logFile + '" 2>&1"'
            $proc = Start-Process -FilePath "$env:ComSpec" -ArgumentList $cmdLine -PassThru -WindowStyle Hidden
            if (-not $proc.WaitForExit(180000)) {
                try { $proc.Kill() } catch {}
                $log = "Compilation exceeded the 180-second time limit."
                Send-Json $res 504 @{ success = $false; message = $log; log = $log }
                continue
            }
            $log = ""
            if (Test-Path -LiteralPath $logFile) { $log = [System.IO.File]::ReadAllText($logFile) }
            $proc.Refresh()
            $exitCode = $proc.ExitCode
            if ($null -eq $exitCode) { $exitCode = -1 }
            $log += "`r`nArduino CLI process exit code: " + $exitCode
            if ([int]$exitCode -ne 0) {
                $generated = @((Get-ChildItem -LiteralPath $sketchDir -Filter "*.hex" -Recurse | ForEach-Object { $_.FullName })) + @((Get-ChildItem -LiteralPath $sketchDir -Filter "*.elf" -Recurse | ForEach-Object { $_.FullName }))
                if ($generated.Count -gt 0 -and $log -match "Sketch uses [0-9]+ bytes") {
                    $log += "`r`nA HEX/ELF artifact exists and the memory report was produced; treating this as a successful build despite the non-zero wrapper exit code."
                } else {
                    Send-Json $res 422 @{ success = $false; message = ("Arduino CLI returned exit code " + $exitCode + "."); log = $log }
                    continue
                }
            }

            $hexFile = Get-ChildItem -LiteralPath $sketchDir -Filter "*.hex" -Recurse | Select-Object -First 1
            if (-not $hexFile) {
                Send-Json $res 500 @{ success = $false; message = "Arduino CLI finished successfully, but no HEX file was found."; log = $log }
                continue
            }
            $hexBytes = [System.IO.File]::ReadAllBytes($hexFile.FullName)
            $hex = @{ name = $hexFile.Name; bytes = $hexBytes.Length; base64 = [Convert]::ToBase64String($hexBytes) }
            $elfFile = Get-ChildItem -LiteralPath $sketchDir -Filter "*.elf" -Recurse | Select-Object -First 1
            $elf = $null
            if ($elfFile) {
                $elfBytes = [System.IO.File]::ReadAllBytes($elfFile.FullName)
                $elf = @{ name = $elfFile.Name; bytes = $elfBytes.Length; base64 = [Convert]::ToBase64String($elfBytes) }
            }
            Send-Json $res 200 @{ success = $true; log = $log; hex = $hex; elf = $elf }
        } finally {
            if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue }
        }
    } catch {
        if ($context -and $context.Response) {
            try { Send-Json $context.Response 500 @{ success = $false; message = $_.Exception.Message; log = $_.Exception.ToString() } } catch {}
        } else {
            Write-Host $_.Exception.Message -ForegroundColor Red
        }
    }
}
