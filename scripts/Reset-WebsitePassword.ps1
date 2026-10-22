param(
    [string]$Database = 'Cluster0',
    [string]$Email = 'kasanikarthikyadav2001@gmail.com'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$bundledNode = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
if (Test-Path -LiteralPath $bundledNode) { $nodePath = $bundledNode }
else { $nodePath = (Get-Command node -ErrorAction Stop).Source }
if ((& $nodePath --version) -notmatch '^v24\.') { throw 'Use Node.js 24 for this project.' }
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'backend/dist/services/adminRecovery.js'))) {
    throw 'Build the updated project first with npm run build.'
}
Write-Host "Resetting the active website administrator in database $Database. No database user password will change."
$uriSecret = Read-Host 'Paste your current Atlas connection string (input is hidden)' -AsSecureString
$passwordSecret = Read-Host 'Choose a NEW website password (12+ characters, uppercase, lowercase and a number)' -AsSecureString
$confirmSecret = Read-Host 'Enter the NEW website password again' -AsSecureString
$previousOutputEncoding = $OutputEncoding
try {
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $uriValue = [System.Net.NetworkCredential]::new('', $uriSecret).Password
    $passwordValue = [System.Net.NetworkCredential]::new('', $passwordSecret).Password
    $confirmValue = [System.Net.NetworkCredential]::new('', $confirmSecret).Password
    if ($passwordValue -cne $confirmValue) { throw 'Passwords do not match. No change was made.' }
    $payload = @{uri=$uriValue; database=$Database; email=$Email; password=$passwordValue} | ConvertTo-Json -Compress
    $payload | & $nodePath (Join-Path $PSScriptRoot 'reset-admin-password.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Reset was not completed. Review the message above.' }
} finally {
    $OutputEncoding = $previousOutputEncoding
    $uriValue=$null; $passwordValue=$null; $confirmValue=$null; $payload=$null
    $uriSecret.Dispose(); $passwordSecret.Dispose(); $confirmSecret.Dispose()
}
