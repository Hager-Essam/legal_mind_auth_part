$body = @{
    query = "ما هي عقوبة السرقة؟"
    top_k = 3
    user_role = "citizen"
} | ConvertTo-Json

Write-Host "Testing LegalMind API..." -ForegroundColor Cyan
Write-Host "Endpoint: http://localhost:3000/api/v1/query" -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/query" -Method Post -Body $body -ContentType "application/json"
    
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Answer:" -ForegroundColor Cyan
    Write-Host $response.answer
    Write-Host ""
    Write-Host "Category: $($response.category)" -ForegroundColor Yellow
    Write-Host "Latency: $($response.latency_ms)ms" -ForegroundColor Yellow
    Write-Host "LLM Provider: $($response.llm_provider_used)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Source Chunks: $($response.source_chunks.Count)" -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ ERROR!" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host ""
    Write-Host "Make sure the server is running with: npm run dev"
}
