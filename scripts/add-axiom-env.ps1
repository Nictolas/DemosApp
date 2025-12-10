# Script per aggiungere variabili Axiom al .env
$envPath = Join-Path $PSScriptRoot "..\.env"

$axiomConfig = @"

# Axiom Configuration
AXIOM_ENABLED=true
AXIOM_API_TOKEN=xaat-e1be5dc4-fc4a-4123-ae6b-5104a6b94e99
AXIOM_ORG_ID=demos-institute-jrim
AXIOM_DATASET=centralized_logs
AXIOM_REALTIME_DATASET=real-time
AXIOM_REGION=eu
AXIOM_ANONYMIZE=true
AXIOM_ANONYMIZE_USER_ID=true
EXPORT_HASH_SALT=c88eef574bfcb314db3c22b6474a08194e5bd18d903701eff3d68cdaba725b5c
"@

Add-Content -Path $envPath -Value $axiomConfig
Write-Host "✅ Variabili Axiom aggiunte al file .env"

