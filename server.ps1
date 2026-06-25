param(
  [switch]$Open,
  [int]$Port = 5173
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Address = [System.Net.IPAddress]::Parse("127.0.0.1")
$Prefix = "http://127.0.0.1:$Port/"

$MimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".gif" = "image/gif"
  ".ico" = "image/x-icon"
}

function Get-StatusText {
  param([int]$StatusCode)

  switch ($StatusCode) {
    200 { "OK" }
    403 { "Forbidden" }
    404 { "Not Found" }
    default { "OK" }
  }
}

function Write-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$ContentType,
    [byte[]]$Body
  )

  $Header = "HTTP/1.1 $StatusCode $(Get-StatusText $StatusCode)`r`n" +
    "Content-Type: $ContentType`r`n" +
    "Content-Length: $($Body.Length)`r`n" +
    "Cache-Control: no-store`r`n" +
    "Connection: close`r`n" +
    "`r`n"

  $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Header)
  $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

function Write-TextResponse {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$Text
  )

  $Body = [System.Text.Encoding]::UTF8.GetBytes($Text)
  Write-Response $Stream $StatusCode "text/plain; charset=utf-8" $Body
}

$Listener = [System.Net.Sockets.TcpListener]::new($Address, $Port)

try {
  $Listener.Start()
  Write-Host "32x32 Minecraft Image Slicer running at $Prefix"
  Write-Host "Close this command window to stop the local site."
  Write-Host ""

  if ($Open) {
    Start-Process $Prefix
  }

  while ($true) {
    $Client = $Listener.AcceptTcpClient()
    try {
      $Stream = $Client.GetStream()
      $Buffer = New-Object byte[] 8192
      $Read = $Stream.Read($Buffer, 0, $Buffer.Length)
      if ($Read -le 0) {
        continue
      }

      $RequestText = [System.Text.Encoding]::ASCII.GetString($Buffer, 0, $Read)
      $FirstLine = ($RequestText -split "`r?`n", 2)[0]
      $Parts = $FirstLine -split " "

      if ($Parts.Length -lt 2 -or $Parts[0] -ne "GET") {
        Write-TextResponse $Stream 404 "Not found"
        continue
      }

      $RequestPath = [System.Uri]::UnescapeDataString(($Parts[1] -split "\?", 2)[0])
      if ($RequestPath -eq "/") {
        $RequestPath = "/index.html"
      }

      $RelativePath = $RequestPath.TrimStart("/") -replace "/", [System.IO.Path]::DirectorySeparatorChar
      $FilePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($Root, $RelativePath))

      if (-not $FilePath.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-TextResponse $Stream 403 "Forbidden"
        continue
      }

      if (-not [System.IO.File]::Exists($FilePath)) {
        Write-TextResponse $Stream 404 "Not found"
        continue
      }

      $Body = [System.IO.File]::ReadAllBytes($FilePath)
      $Ext = [System.IO.Path]::GetExtension($FilePath).ToLowerInvariant()
      $ContentType = if ($MimeTypes.ContainsKey($Ext)) { $MimeTypes[$Ext] } else { "application/octet-stream" }
      Write-Response $Stream 200 $ContentType $Body
    }
    catch {
      try {
        Write-TextResponse $Stream 404 "Not found"
      }
      catch {
      }
    }
    finally {
      if ($Stream) {
        $Stream.Close()
      }
      $Client.Close()
    }
  }
}
finally {
  $Listener.Stop()
}
