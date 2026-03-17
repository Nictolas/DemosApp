# Script per aggiungere variabili Axiom al .env
$envPath = Join-Path $PSScriptRoot "..\.env"

$axiomConfig = @"

# Axiom Configuration
AXIOM_ENABLED=true
AXIOM_API_TOKEN=xaat-...
AXIOM_ORG_ID=demos-institute-jrim
AXIOM_DATASET=centralized_logs
AXIOM_REALTIME_DATASET=real-time
AXIOM_REGION=eu
AXIOM_ANONYMIZE=true
AXIOM_ANONYMIZE_USER_ID=true
EXPORT_HASH_SALT=your-export-hash-salt
"@

Add-Content -Path $envPath -Value $axiomConfig
Write-Host "✅ Variabili Axiom aggiunte al file .env"

