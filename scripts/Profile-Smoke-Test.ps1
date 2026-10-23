param(
    [string]$BaseUrl = 'http://localhost:5080',
    [switch]$AllowDemoChanges
)
$ErrorActionPreference = 'Stop'
if (-not $AllowDemoChanges) { throw 'Use -AllowDemoChanges only for the demo database: this test changes profile/subscription and adds demo chat messages.' }
Add-Type -AssemblyName System.Net.Http
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(30)

function Request([string]$Method, [string]$Path, [int]$Expected, $Body = $null) {
    $request = New-Object System.Net.Http.HttpRequestMessage
    $request.Method = New-Object System.Net.Http.HttpMethod($Method)
    $request.RequestUri = [Uri]($BaseUrl.TrimEnd('/') + $Path)
    if ($null -ne $Body) {
        $request.Content = New-Object System.Net.Http.StringContent(($Body | ConvertTo-Json), [Text.Encoding]::UTF8, 'application/json')
    }
    try {
        $response = $client.SendAsync($request).GetAwaiter().GetResult()
        try {
            $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            if ([int]$response.StatusCode -ne $Expected) { throw "$Method $Path expected $Expected, got $([int]$response.StatusCode): $text" }
            if ($text) { return ($text | ConvertFrom-Json) }
        } finally { $response.Dispose() }
    } finally { $request.Dispose() }
}
function Assert($Condition, [string]$Message) { if (-not $Condition) { throw $Message } }


function Upload([byte[]]$Bytes) {
    $form = [System.Net.Http.MultipartFormDataContent]::new()
    $content = [System.Net.Http.ByteArrayContent]::new($Bytes)
    $form.Add($content, 'file', 'avatar.png')
    try {
        $response = $client.PostAsync(($BaseUrl.TrimEnd('/') + '/api/profile/avatar'), $form).GetAwaiter().GetResult()
        try {
            $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            if ([int]$response.StatusCode -ne 200) { throw "Avatar upload failed: $text" }
            return ($text | ConvertFrom-Json)
        } finally { $response.Dispose() }
    } finally { $form.Dispose() }
}

# Create an isolated test account; cookies stay in this HttpClient instance.
$testEmail = 'smoke-' + [Guid]::NewGuid().ToString('N') + '@example.com'
$testPassword = [Guid]::NewGuid().ToString('N') + '!Aa1'
$null = Request 'POST' '/api/auth/register' 200 @{ email = $testEmail; password = $testPassword; displayName = 'Smoke Test' }
$null = Request 'PUT' '/api/profile/subscription' 200 @{ subscription = 'Basic' }

$initial = $null
$avatarBytes = $null
$initialChatEmpty = $false
try {
    $initial = Request 'GET' '/api/profile' 200
    if ($initial.avatarUrl) {
        $avatarBytes = $client.GetByteArrayAsync(($BaseUrl.TrimEnd('/') + $initial.avatarUrl)).GetAwaiter().GetResult()
    }
    $null = Request 'PUT' '/api/profile/subscription' 200 @{ subscription = 'Pro' }
    $history = @(Request 'GET' '/api/chat' 200)
    $initialChatEmpty = ($history.Count -eq 0)
    $null = Request 'PUT' '/api/profile/subscription' 200 @{ subscription = 'Basic' }
    $null = Request 'GET' '/api/chat' 403
    $null = Request 'POST' '/api/chat' 403 @{ text = 'Hello' }
    $null = Request 'DELETE' '/api/chat' 403
    $null = Request 'GET' '/api/products/export' 403
    $null = Request 'PUT' '/api/profile/subscription' 400 @{ subscription = 'Admin' }
    $null = Request 'PUT' '/api/profile' 400 @{ displayName = ' '; fullName = ''; phone = ''; about = '' }
    $null = Request 'PUT' '/api/profile' 400 @{ displayName = 'Demo'; fullName = ''; phone = 'abcdefg'; about = '' }
    $saved = Request 'PUT' '/api/profile' 200 @{ displayName = 'Demo Test'; fullName = 'Demo User'; phone = '+7 (999) 123-45-67'; about = 'Profile smoke test' }
    Assert ($saved.displayName -eq 'Demo Test') 'Profile was not updated.'
    Assert ((Request 'GET' '/api/profile' 200).fullName -eq 'Demo User') 'Profile was not persisted.'
    $null = Request 'PUT' '/api/profile/email' 400 @{ email = 'invalid' }
    Assert ((Request 'PUT' '/api/profile/email' 200 @{ email = 'demo@example.com' }).email -eq 'demo@example.com') 'Email was not linked.'
    Assert ($null -eq (Request 'DELETE' '/api/profile/email' 200).email) 'Email was not unlinked.'
    $png = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=')
    $withAvatar = Upload $png
    Assert ($null -ne $withAvatar.avatarUrl) 'Avatar URL missing.'
    $downloaded = $client.GetByteArrayAsync(($BaseUrl.TrimEnd('/') + $withAvatar.avatarUrl)).GetAwaiter().GetResult()
    Assert ([Convert]::ToBase64String($downloaded) -eq [Convert]::ToBase64String($png)) 'Avatar bytes changed.'
    Assert ($null -eq (Request 'DELETE' '/api/profile/avatar' 200).avatarUrl) 'Avatar was not deleted.'
    $null = Request 'PUT' '/api/profile/subscription' 200 @{ subscription = 'Plus' }
    $export = $client.GetAsync(($BaseUrl.TrimEnd('/') + '/api/products/export')).GetAwaiter().GetResult()
    try { Assert ([int]$export.StatusCode -eq 200) 'Plus export denied.' } finally { $export.Dispose() }
    $null = Request 'GET' '/api/chat' 403
    $null = Request 'PUT' '/api/profile/subscription' 200 @{ subscription = 'Pro' }
    $null = Request 'POST' '/api/chat' 400 @{ text = ' ' }
    $messages = @(Request 'POST' '/api/chat' 200 @{ text = 'Hello' })
    Assert ($messages[-2].role -eq 'user' -and $messages[-1].role -eq 'assistant') 'Expected a complete chat turn.'
    $lastId = $messages[-1].id
    $null = Request 'PUT' '/api/profile/subscription' 200 @{ subscription = 'Basic' }
    $null = Request 'GET' '/api/chat' 403
    $null = Request 'PUT' '/api/profile/subscription' 200 @{ subscription = 'Pro' }
    $restored = @(Request 'GET' '/api/chat' 200)
    Assert ($restored[-1].id -eq $lastId) 'Chat history lost after downgrade.'
    if ($initialChatEmpty) {
        $null = Request 'DELETE' '/api/chat' 204
        Assert (@(Request 'GET' '/api/chat' 200).Count -eq 0) 'Chat history was not cleared.'
    } else {
        Write-Host 'SKIPPED clear-history check: pre-existing chat preserved; test messages remain appended.'
    }
    Write-Host 'PASS: profile, validation, email, avatar, subscriptions, server feature gates, export, chat and preserved history.'
} finally {
    if ($null -ne $initial) {
        try {
            $null = Request 'PUT' '/api/profile' 200 @{ displayName = $initial.displayName; fullName = $initial.fullName; phone = $initial.phone; about = $initial.about }
            if ($initial.email) { $null = Request 'PUT' '/api/profile/email' 200 @{ email = $initial.email } }
            else { $null = Request 'DELETE' '/api/profile/email' 200 }
            if ($null -ne $avatarBytes) { $null = Upload $avatarBytes }
            else { $null = Request 'DELETE' '/api/profile/avatar' 200 }
            $null = Request 'PUT' '/api/profile/subscription' 200 @{ subscription = $initial.subscription }
        } finally { $client.Dispose() }
    } else { $client.Dispose() }
}
