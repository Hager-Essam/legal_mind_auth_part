$body = @{
    query = "What is the penalty for theft?"
    top_k = 3
    user_role = "citizen"
} | ConvertTo-Json

Write-Host "Testing LegalMind API..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/query" -Method Post -Body $body -ContentType "application/json"
    
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Answer:"
    Write-Host $response.answer
    Write-Host ""
    Write-Host "Category:" $response.category
    Write-Host "Latency:" $response.latency_ms "ms"
    Write-Host "Provider:" $response.llm_provider_used
    Write-Host "Sources:" $response.source_chunks.Count
    
} catch {
    Write-Host "ERROR!" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host ""
    Write-Host "Make sure the server is running with: npm run dev"
}
