# Storage Architecture: Cloudflare R2 + MongoDB

## Overview

The contract analysis system has been refactored to use a modern, scalable storage architecture:

- **Cloudflare R2**: For storing contract files and generated reports
- **MongoDB**: For storing job metadata, analysis results, and progress tracking

## Architecture Components

### 1. Cloudflare R2 Storage
- **Purpose**: Store uploaded contract files and generated reports
- **Benefits**: 
  - Cost-effective object storage
  - Global CDN distribution
  - S3-compatible API
  - No egress fees

### 2. MongoDB Collections

#### Job Collection (`jobs`)
Stores job metadata and processing status:
```typescript
interface IJob {
  id: string;                    // Unique job identifier
  status: 'queued' | 'processing' | 'completed' | 'failed';
  userId?: string;               // Optional user association
  originalFileName: string;      // Original uploaded filename
  fileSize: number;             // File size in bytes
  fileType: string;             // MIME type
  contractFileUrl?: string;     // R2 URL for contract file
  reportFileUrl?: string;       // R2 URL for generated report
  analysisId?: ObjectId;        // Reference to ResultsAnalysis
  error?: string;               // Error message if failed
  createdAt: Date;
  completedAt?: Date;
  progressLogs: IProgressLog[]; // Real-time progress tracking
}
```

#### ResultsAnalysis Collection (`resultsanalyses`)
Stores detailed analysis results:
```typescript
interface IResultsAnalysis {
  jobId: string;                // Link back to Job
  overall: OverallScore;        // Overall compliance score
  clauses: ClauseAnalysis[];    // Detailed clause analysis
  reportMarkdown: string;       // Generated report in Markdown
  processedAt: Date;
  metadata?: {
    totalClauses: number;
    processingTimeSeconds?: number;
    modelUsed?: string;
  };
}
```

## Data Flow

### 1. Contract Upload
```mermaid
sequenceDiagram
    participant Client
    participant API
    participant R2
    participant MongoDB
    
    Client->>API: Upload contract file
    API->>R2: Upload file to R2
    R2-->>API: Return file URL
    API->>MongoDB: Create job record
    MongoDB-->>API: Return job ID
    API-->>Client: Return job ID
    API->>Background: Start processing
```

### 2. Contract Processing
```mermaid
sequenceDiagram
    participant Processor
    participant R2
    participant MongoDB
    participant AI
    
    Processor->>MongoDB: Update status to 'processing'
    Processor->>R2: Download contract file
    Processor->>AI: Analyze contract
    AI-->>Processor: Return analysis results
    Processor->>MongoDB: Save analysis results
    Processor->>R2: Upload report file
    Processor->>MongoDB: Update job status to 'completed'
```

## Configuration

### Environment Variables
```bash
# Cloudflare R2
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=legal-mind-contracts
R2_PUBLIC_URL=https://your-custom-domain.com # Optional

# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
DB_NAME=legalmind
```

### R2 Bucket Structure
```
legal-mind-contracts/
├── contracts/
│   └── {jobId}/
│       └── {timestamp}_{originalFilename}
└── reports/
    └── {jobId}/
        └── {timestamp}_{filename}_report.md
```

## API Endpoints

### Upload Contract
```http
POST /api/contract-analysis/upload
Content-Type: multipart/form-data

file: [contract file]
```

Response:
```json
{
  "jobId": "uuid-here",
  "status": "queued",
  "message": "Analysis started..."
}
```

### Get Job Status
```http
GET /api/contract-analysis/{jobId}
```

Response:
```json
{
  "jobId": "uuid-here",
  "status": "completed",
  "originalFileName": "contract.pdf",
  "fileSize": 1024000,
  "fileType": "application/pdf",
  "createdAt": "2024-01-01T00:00:00Z",
  "completedAt": "2024-01-01T00:05:00Z",
  "result": {
    "overall": { /* overall score */ },
    "clauses": [ /* clause analyses */ ],
    "report_markdown": "# Analysis Report...",
    "processed_at": "2024-01-01T00:05:00Z"
  },
  "files": {
    "contract": "https://r2-url/contracts/job/file.pdf",
    "report": "https://r2-url/reports/job/report.md"
  }
}
```

## Benefits of New Architecture

### Scalability
- **Horizontal scaling**: MongoDB can be sharded
- **Global distribution**: R2 provides global CDN
- **Stateless processing**: No in-memory job storage

### Reliability
- **Persistent storage**: Survive server restarts
- **Data durability**: Both MongoDB and R2 provide high durability
- **Error recovery**: Jobs can be retried from database state

### Cost Efficiency
- **No egress fees**: R2 doesn't charge for data transfer
- **Efficient storage**: Only store what's needed
- **Automatic cleanup**: Old jobs and files can be pruned

### Security
- **Access control**: Fine-grained permissions in R2
- **Encryption**: Data encrypted at rest and in transit
- **Audit trail**: Complete job history in MongoDB

## Migration from Old System

The old system used:
- **In-memory storage** (jobStore) → **MongoDB collections**
- **Local filesystem** (`src/result/`) → **Cloudflare R2**
- **File paths** → **URLs and database references**

Key improvements:
- No data loss on server restart
- Better error handling and recovery
- Real-time progress tracking
- Scalable architecture
- Global file distribution

## Monitoring and Maintenance

### Database Indexes
```javascript
// Job collection
db.jobs.createIndex({ "id": 1 }, { unique: true })
db.jobs.createIndex({ "status": 1, "createdAt": -1 })
db.jobs.createIndex({ "userId": 1, "createdAt": -1 })

// ResultsAnalysis collection
db.resultsanalyses.createIndex({ "jobId": 1 }, { unique: true })
db.resultsanalyses.createIndex({ "processedAt": -1 })
db.resultsanalyses.createIndex({ "overall.overall_score": 1 })
```

### Cleanup Tasks
```javascript
// Delete jobs older than 30 days
await jobRepository.deleteOlderThan(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

// Delete analyses older than 30 days
await resultsAnalysisRepository.deleteOlderThan(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
```

### Health Monitoring
- Monitor R2 storage usage
- Track MongoDB performance metrics
- Monitor job success/failure rates
- Alert on processing time anomalies