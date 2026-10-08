param([ValidateSet('load', 'store')][string]$Action = 'load')
$ErrorActionPreference = 'Stop'
$taskTokenDirectory = [IO.Path]::Combine($env:LOCALAPPDATA, 'DebugHomelessness')
$taskTokenPath = [IO.Path]::Combine($taskTokenDirectory, 'deploy-token.dpapi')
$null = [Reflection.Assembly]::LoadWithPartialName('System.Security')
$taskEntropy = [Text.Encoding]::UTF8.GetBytes('debughomelessness-deployment-v1')

if ($Action -eq 'store') {
    $taskToken = [Console]::In.ReadToEnd().Trim()
    if ($taskToken -notmatch '^[A-Za-z0-9_-]{20,200}$') { throw 'Invalid deployment token format.' }
    $taskDirectory = [IO.Directory]::CreateDirectory($taskTokenDirectory)
    $taskIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $taskAcl = [System.Security.AccessControl.DirectorySecurity]::new()
    $taskAcl.SetOwner($taskIdentity)
    $taskAcl.SetAccessRuleProtection($true, $false)
    $taskRule = [System.Security.AccessControl.FileSystemAccessRule]::new($taskIdentity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $taskAcl.AddAccessRule($taskRule)
    $taskDirectory.SetAccessControl($taskAcl)
    $taskBytes = [Text.Encoding]::UTF8.GetBytes($taskToken)
    try {
        $taskEncrypted = [Security.Cryptography.ProtectedData]::Protect($taskBytes, $taskEntropy, [Security.Cryptography.DataProtectionScope]::CurrentUser)
        [IO.File]::WriteAllText($taskTokenPath, [Convert]::ToBase64String($taskEncrypted))
    } finally { [Array]::Clear($taskBytes, 0, $taskBytes.Length) }
    [Console]::Out.WriteLine('Deployment token encrypted for this Windows user.')
} elseif ([IO.File]::Exists($taskTokenPath)) {
    $taskEncrypted = [Convert]::FromBase64String([IO.File]::ReadAllText($taskTokenPath))
    $taskBytes = [Security.Cryptography.ProtectedData]::Unprotect($taskEncrypted, $taskEntropy, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    try { [Console]::Out.Write([Text.Encoding]::UTF8.GetString($taskBytes)) }
    finally { [Array]::Clear($taskBytes, 0, $taskBytes.Length) }
}
