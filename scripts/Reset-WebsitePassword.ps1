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
$uriSecret = $null; $passwordSecret = $null; $confirmSecret = $null
$previousOutputEncoding = $OutputEncoding
try {
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    Write-Host 'The first input must be the ENTIRE MongoDB URI from Render MONGODB_URI, not the database password alone.'
    $uriSecret = Read-Host 'Paste FULL URI starting mongodb+srv:// (input is hidden)' -AsSecureString
    $uriValue = [System.Net.NetworkCredential]::new('', $uriSecret).Password.Trim()
    if ($uriValue -notmatch '^mongodb(\+srv)?://') {
        throw 'The first input is not a full MongoDB connection string. Copy the complete MONGODB_URI value from Render and try again. No change was made.'
    }
    if ($uriValue -match '<db_username>|<db_password>|YOUR_NEW_PASSWORD|YOUR_NEW_DATABASE_PASSWORD') {
        throw 'The URI still contains a placeholder. Use your actual database username and current database password privately. No change was made.'
    }
    $passwordSecret = Read-Host 'Choose a NEW website password (12+ characters, uppercase, lowercase and a number)' -AsSecureString
    $confirmSecret = Read-Host 'Enter the NEW website password again' -AsSecureString
    $passwordValue = [System.Net.NetworkCredential]::new('', $passwordSecret).Password
    $confirmValue = [System.Net.NetworkCredential]::new('', $confirmSecret).Password
    if ($passwordValue -cne $confirmValue) { throw 'Passwords do not match. No change was made.' }
    $payload = @{uri=$uriValue; database=$Database; email=$Email; password=$passwordValue} | ConvertTo-Json -Compress
    $payload | & $nodePath (Join-Path $PSScriptRoot 'reset-admin-password.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Reset was not completed. Review the message above.' }
} finally {
    $OutputEncoding = $previousOutputEncoding
    $uriValue=$null; $passwordValue=$null; $confirmValue=$null; $payload=$null
    foreach ($secret in @($uriSecret,$passwordSecret,$confirmSecret)) { if ($null -ne $secret) { $secret.Dispose() } }
}
