param(
    [string]$BaseUrl = 'http://localhost:5080',
    [switch]$AllowDemoChanges
)
$ErrorActionPreference = 'Stop'
if (-not $AllowDemoChanges) { throw 'Use -AllowDemoChanges only for the demo database: this test generates new snapshots.' }
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

$testId = $null
$trackedByTest = $false
try {
    $products = @(Request 'GET' '/api/products' 200)
    Assert ($products.Count -gt 0) 'Expected seeded tracked products.'
    Assert ($products[0].history.Count -ge 30) 'Expected seeded price history.'
    $catalog = @(Request 'GET' '/api/catalog' 200)
    Assert ($catalog.Count -gt 0) 'Untrack a demo product first: the catalog must have an available item.'
    $testId = $catalog[0].ozonProductId
    $created = Request 'POST' '/api/products' 201 @{ value = "$testId" }
    $trackedByTest = $true
    Assert ($created.name -eq $catalog[0].name) 'Catalog metadata was not loaded.'
    $null = Request 'POST' '/api/products' 409 @{ value = "$testId" }
    $null = Request 'POST' '/api/products' 400 @{ value = 'invalid' }
    $null = Request 'POST' '/api/products' 404 @{ value = '9999999999999' }
    $before = Request 'GET' "/api/products/$testId" 200
    $result = Request 'POST' '/api/demo/simulate' 200
    Assert ($result.updatedProducts -eq ($products.Count + 1)) 'Unexpected simulated product count.'
    $after = Request 'GET' "/api/products/$testId" 200
    Assert ($after.history.Count -eq $before.history.Count + 1) 'Simulation must append exactly one snapshot.'
    Assert ($after.price -ne $before.price) 'The simulated price did not change.'
    Assert ($after.soldUnits -eq $before.soldUnits + 3) 'Sales counter was not updated.'
    Assert ($after.history[-1].price -eq $after.price) 'Current price differs from latest history.'
    $null = Request 'DELETE' "/api/products/$testId" 204
    $trackedByTest = $false
    $null = Request 'GET' "/api/products/$testId" 404
    $restored = Request 'POST' '/api/products' 201 @{ value = "$testId" }
    $trackedByTest = $true
    Assert ($restored.history.Count -eq $after.history.Count) 'History was lost when untracking.'
    Assert ($restored.price -eq $after.price) 'Stored price was lost.'
    Write-Host 'PASS: catalog, tracking, validation, conflict, simulation, persisted history, untracking and re-tracking.'
} finally {
    if ($trackedByTest) { $null = Request 'DELETE' "/api/products/$testId" 204 }
    $client.Dispose()
}
