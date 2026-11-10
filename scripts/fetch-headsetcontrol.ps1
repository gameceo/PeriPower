$ErrorActionPreference = 'Stop'
$destination = Join-Path $PSScriptRoot '../external/headsetcontrol'
New-Item -ItemType Directory -Force $destination | Out-Null
$binary = Join-Path $destination 'headsetcontrol.exe'
Invoke-WebRequest 'https://github.com/Sapd/HeadsetControl/releases/download/4.2.0/headsetcontrol-windows-x86_64.exe' -OutFile $binary
$expected = '81ACAE4C083AAA40A2E9C1BCE7B3DD9625E74B9D9EE96384BB43B2DFF7FF0FA5'
if ((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash -ne $expected) {
    throw 'HeadsetControl checksum mismatch; do not run the downloaded binary.'
}
Invoke-WebRequest 'https://github.com/Sapd/HeadsetControl/releases/download/4.2.0/headsetcontrol-4.2.0.tar.gz' -OutFile (Join-Path $destination 'headsetcontrol-4.2.0-source.tar.gz')
Invoke-WebRequest 'https://raw.githubusercontent.com/Sapd/HeadsetControl/4.2.0/license' -OutFile (Join-Path $destination 'LICENSE-HeadsetControl.txt')
@'
HeadsetControl 4.2.0, Copyright its contributors, GNU GPL version 3.
Separate executable invoked only for battery queries, not linked into PeriPower.
Source: https://github.com/Sapd/HeadsetControl/releases/tag/4.2.0
Corresponding release source and license are included alongside this executable.
'@ | Set-Content (Join-Path $destination 'NOTICE.txt') -Encoding utf8
