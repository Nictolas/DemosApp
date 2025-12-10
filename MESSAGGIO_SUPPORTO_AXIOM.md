# 📧 Messaggio per Supporto Axiom

## Subject
**403 Forbidden Error with API Token Despite Correct Permissions**

---

## Body

Hello Axiom Support Team,

I'm experiencing a persistent **403 Forbidden** error when trying to use the Axiom API, even though my API token appears to have the correct permissions configured.

### Organization Details
- **Organization ID**: `demos-institute-jrim`
- **Region**: EU (`eu`)
- **Account**: Demos Institute

### API Token Details
- **Token Name**: `demosapp-backup`
- **Token ID**: `xaat-d97a9535-fdc4-47ab-8197-c5847b12122d`
- **Permissions Configured**:
  - **Ingest**: CREATE ✅, READ ✅
  - **Query**: READ ✅
  - **Scope**: All datasets

### Problem Description

All API requests to Axiom are returning `403 - forbidden`, including:
1. **List datasets**: `GET https://api.eu.axiom.co/v1/datasets`
2. **Ingest data**: `POST https://api.eu.axiom.co/v1/datasets/centralized_logs/ingest`
3. **Test ingest**: `POST https://api.eu.axiom.co/v1/datasets/real-time/ingest`

### Request Details

**Endpoint tested**: `https://api.eu.axiom.co/v1/datasets/centralized_logs/ingest`

**Headers used**:
```
Authorization: Bearer xaat-d97a9535-fdc4-47ab-8197-c5847b12122d
Content-Type: application/json
X-Axiom-Org-Id: demos-institute-jrim
```

**Request body** (example):
```json
[
  {
    "_time": "2025-12-10T18:45:00.000Z",
    "level": "INFO",
    "message": "Test evento",
    "log_type": "test"
  }
]
```

**Response**:
```json
{
  "code": 403,
  "message": "forbidden"
}
```

### What I've Verified

✅ Token is correctly configured in Axiom dashboard  
✅ Token has Ingest (CREATE, READ) and Query (READ) permissions  
✅ Token is set for "All datasets" scope  
✅ Organization ID is correct: `demos-institute-jrim`  
✅ Region is correctly set to EU  
✅ Datasets exist: `centralized_logs` and `real-time`  
✅ Request format matches Axiom API documentation  
✅ Tried with and without `X-Axiom-Org-Id` header  
✅ Tried different endpoints (both datasets)  
✅ Token was regenerated and updated in environment variables  

### Environment

- **Platform**: Render (cloud hosting)
- **Region**: EU
- **SDK**: `@axiomhq/axiom-node` v0.12.0
- **API Method**: Direct HTTP API calls (also tried SDK)

### Questions

1. Is there a delay after token creation before it becomes active?
2. Are there any known issues with EU region API tokens?
3. Could there be an issue with "All datasets" permissions?
4. Is there a different authentication method required for EU region?

### Additional Information

- Token was created/regenerated today (December 10, 2025)
- All environment variables are correctly set
- The same error occurs both locally and on Render
- I've verified the token matches exactly what's shown in the Axiom dashboard

Could you please investigate why the API is returning 403 despite the token having the correct permissions? Any guidance would be greatly appreciated.

Thank you for your assistance.

---

**Contact Information** (if needed):
- Organization: Demos Institute
- Organization ID: `demos-institute-jrim`

---

## 📋 Come Inviare

1. Vai su: https://axiom.co/support
2. Oppure: https://docs.axiom.xyz/api-reference/support-and-config/getting-help
3. Copia e incolla il messaggio sopra
4. Allega screenshot se necessario (delle impostazioni del token)


