# ShieldHer

**Privacy-First Image-Forensics and NCII Victim-Support Application**

ShieldHer is an engineering platform built to assist victims of Non-Consensual Intimate Imagery (NCII) through verifiable forensic image analysis, cryptographic hashing, metadata extraction, and victim support workflows — designed from the ground up with a privacy-by-design architecture.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend API** | Python 3.11+, FastAPI, Pydantic v2 |
| **Database** | PostgreSQL 16 (Case metadata, relational data via SQLAlchemy async + Alembic) |
| **Cache & Task State** | Redis 7 (Ephemeral job states, session caching) |
| **Frontend** | React 18, TypeScript, Vite |
| **Forensic ML (isolated)** | PyTorch, torchvision, Pillow (Isolated in `requirements-ml.txt`) |
| **Orchestration** | LangGraph (scheduled for subsequent analysis workflows) |
| **Infrastructure** | Docker Compose |

---

## Repository Structure

```
shieldher/
├── .env.example              # Central environment variables template
├── .gitignore                # Strict rules (blocks uploads, credentials, model weights, logs)
├── docker-compose.yml        # Multi-container local orchestration (db, redis, backend, frontend)
├── README.md                 # Project documentation
│
├── backend/                  # FastAPI Application
│   ├── Dockerfile            # Container configuration for backend service
│   ├── alembic.ini           # Database migration configuration
│   ├── pytest.ini            # Pytest test suite configuration
│   ├── requirements.txt      # Core backend dependencies
│   ├── requirements-ml.txt   # Isolated optional ML dependencies (torch, etc.)
│   │
│   ├── alembic/              # Database migration scripts
│   │   ├── env.py            # Async-compatible migration runner
│   │   ├── script.py.mako    # Migration template
│   │   └── versions/         # Migration versions directory
│   │
│   ├── app/                  # Application source package
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI entrypoint, middleware, lifespan
│   │   ├── config.py         # Settings & environment variable loading (Pydantic)
│   │   ├── logging_config.py # Structured JSON/Console logging (structlog)
│   │   ├── database.py       # SQLAlchemy 2 async engine & sessionmaker
│   │   ├── redis_client.py   # Async Redis connection pool
│   │   ├── exceptions.py     # Global error handling and error envelope
│   │   │
│   │   ├── api/              # API Routers
│   │   │   ├── __init__.py
│   │   │   └── health.py     # /health & /health/live endpoints
│   │   │
│   │   └── models/           # SQLAlchemy ORM models
│   │       └── __init__.py   # Model registry for migrations
│   │
│   └── tests/                # Test suite
│       ├── __init__.py
│       ├── conftest.py       # Test fixtures and async client
│       ├── test_config.py    # Configuration unit tests
│       ├── test_health.py    # Health check endpoint tests (mocked dependencies)
│       └── test_exceptions.py# Global error handler tests
│
└── frontend/                 # React + TypeScript + Vite SPA
    ├── Dockerfile            # Container configuration for frontend service
    ├── index.html            # Single page entry HTML
    ├── package.json          # Frontend dependencies & scripts
    ├── tsconfig.json         # TypeScript strict configuration
    ├── vite.config.ts        # Vite configuration & API proxy
    ├── .env.example          # Frontend environment variables template
    │
    ├── public/
    │   └── shield.svg        # Application branding icon
    │
    └── src/
        ├── App.tsx           # Router configuration (/health, 404)
        ├── main.tsx          # React application root mount
        ├── index.css         # Base styles & theme variables
        │
        ├── types/
        │   └── health.ts     # Health check contract types
        │
        ├── services/
        │   └── api.ts        # API client for health queries
        │
        ├── pages/
        │   ├── HealthPage.tsx      # Interactive health dashboard
        │   ├── HealthPage.test.tsx # Component unit tests
        │   └── NotFoundPage.tsx    # 404 handler
        │
        └── test/
            └── setup.ts      # Jest-DOM matchers setup for Vitest
```

---

## Configuration & Environment Variables

Copy `.env.example` to `.env` in the repository root:

```bash
cp .env.example .env
```

Key environment configurations:

- `APP_ENV`: Application environment (`development`, `staging`, `production`). In production, docs are hidden and JSON logging is enforced.
- `APP_SECRET_KEY`: Random cryptographic secret key.
- `POSTGRES_*`: Connection parameters for PostgreSQL case database.
- `REDIS_*`: Connection parameters for Redis cache & task queue.
- `UPLOAD_DIR`: Target path for temporary upload processing (never committed to git).
- `MAX_UPLOAD_BYTES`: File size limits (default 20MB).

---

## API Endpoints

### Health Checks

- **`GET /health`**: Evaluates application state and downstream connectivity to PostgreSQL and Redis. Returns HTTP 200 when all are healthy, or HTTP 503 if any service is degraded.
- **`GET /health/live`**: Fast liveness probe for orchestrators. Returns `{"status": "ok"}`.

### Image Ingestion & Forensic Quality Assessment

- **`POST /upload`**: Ingests an evidence image file (`multipart/form-data`, key `file`).
  - Verifies magic byte signatures (JPEG, PNG, WEBP).
  - Computes original byte stream SHA-256 for evidentiary chain-of-custody.
  - Safely performs non-destructive EXIF orientation correction.
  - Runs pretrained MediaPipe Face Detector (extracts bounding boxes, confidence, keypoints).
  - Computes full-image and face-crop quality metrics (Laplacian blur variance, mean brightness, contrast).
  - Evaluates configurable provisional quality thresholds.
  - Generates normalized RGB image and primary face crop derivatives.
  - Returns structured status: `PASS`, `RETRY_REQUIRED`, `UNSUPPORTED_INPUT`, or `PROCESSING_ERROR`.

### Forensic Verification & Manipulation Detection

- **`POST /verify`**: Multi-model evidence verification pipeline.
  - Passes image through the Quality Gateway.
  - If quality assessment fails (`UNSUPPORTED_INPUT` or `RETRY_REQUIRED`), halts early to avoid running ML cycles on inadequate imagery.
  - If quality passes, extracts derivatives and evaluates with both pretrained forensic models independently:
    - **Effort-AIGI-Detection** (CLIP-ViT-L/14 with SVD Residuals): evaluates face crop for face-swap / deepfake manipulation artifacts.
    - **Smaug-AI-Image-Detector** (Streamlined EmbeddingGemma-2): evaluates the full image at native resolution via 3 systematic 528x528 crops for full-image generative AI synthesis.
  - Optional: pass `include_forensics=true` to execute the deterministic forensic analysis suite alongside pretrained ML inference.
  - Returns raw logits/scores, predicted labels, documented score semantics, and optional Grad-CAM activation heatmap overlay (`include_gradcam=true`).
  - **Independent Fault Isolation**: Failure or missing weights for one detector does NOT erase or invalidate results from the other.

### Deterministic Forensic Analysis Suite

- **`POST /analyze/forensics`**: Standalone deterministic forensic analysis pipeline.
  - **Frequency Domain (A)**:
    - 2D Fast Fourier Transform (FFT) with generated log-magnitude spectrum visualization.
    - Radial energy band ratios: Low ($0 - 0.15 R_{\max}$), Mid ($0.15 - 0.50 R_{\max}$), High ($\ge 0.50 R_{\max}$).
    - Azimuthal directional energy variance across 36 sectors (flags directional grid spikes and synthetic generator ray artifacts).
    - 2D 8x8 block Discrete Cosine Transform (DCT) energy distribution (DC, low AC, high AC).
    - 2D Haar Discrete Wavelet Transform (DWT) subband energy ratios ($LL, LH, HL, HH$).
  - **Noise Residuals (B)**:
    - Gaussian difference high-pass filter residual with amplified visualization map.
    - Median filter denoising residual ($I - \text{MedianBlur}(I, k=3)$) with higher-order statistical moments (mean, std, skewness, kurtosis).
    - *Evidentiary Safety Mandate*: Noise residuals capture high-frequency scene edges, textures, and lossy compression artifacts; they are strictly NEVER labeled as pure sensor noise.
  - **Compression & Resampling (C)**:
    - Fan & de Queiroz 8x8 JPEG block boundary discontinuity metric.
    - Error Level Analysis (ELA) at configurable recompression quality (default $Q=90$, $10\times$ visual amplification).
    - *Format Safeguard*: JPEG assumptions are strictly NOT applied to PNG or WebP images (marked `NOT_APPLICABLE`).
    - Gallagher-Chen periodic second-difference spectral peak analysis for geometric resampling/interpolation detection.
  - **Spatial Analysis (D)**:
    - Face boundary margin, inner core, and outer background texture sharpness (Laplacian variance) comparison.
    - Texture discontinuity ratio and CIE LAB $\Delta E$ color seam transition difference.
    - Generated diagnostic boundary overlay visualization.
  - **Optional Pretrained Forensic Models Disclosure (E)**:
    - Discloses FSD and TruFor repository links, paper citations, and usage terms.
    - Kept disabled by default (`is_enabled=False`, `DISABLED_BY_DEFAULT`) pending formal legal terms review.
  - **PRNU Sensor Attribution Disclosure (F)**:
    - Enforces strict scientific standards: camera attribution from a single query image without reference flat-field frames or an authenticated sensor database is rejected as scientifically invalid.
  - *No Fake Probabilities*: All measurements are returned as pure mathematical values with method names, versions, and documented limitations.

### LangGraph Workflow Orchestration

- **`POST /workflow/execute`**: Executes the unified LangGraph pipeline with TypedDict `ImageState`.
  - **Graph Topology**:
    `Image Upload → Quality Gateway → [Conditional Fan-Out] → Parallel EFFORT & Smaug → [Fan-In] → Deterministic Forensics → Evidence Summary & Synthesis`.
  - **Evidence-Oriented States**:
    - `POSSIBLE_FACE_MANIPULATION`: Effort flags face swap / deepfake artifacts; Smaug full-image score is low.
    - `POSSIBLE_AI_GENERATION`: Smaug flags full-image synthesis; Effort face manipulation score is low.
    - `POSSIBLE_COMBINED_MANIPULATION`: Both detectors flag positive manipulation signals.
    - `CONFLICTING_MODEL_RESULTS`: Discrepant or ambiguous model signals.
    - `INCONCLUSIVE`: Neither detector flags positive manipulation signals (MANDATORY RULE: low scores do NOT prove authenticity; images are never labeled `AUTHENTIC`).
    - `INSUFFICIENT_IMAGE_QUALITY`: Quality Gateway halted before ML inference (e.g. blurry, no face, severe exposure).
    - `UNSUPPORTED_INPUT`: Invalid file signature or corrupt byte stream.
  - **Evidence Manifest & Complaint Drafting**: Automatically generates an evidentiary chain of custody (hashes, timestamps, model identifiers) and structured victim-support complaint draft.
  - **Idempotent Processing**: Re-running nodes with existing hashes/assessments avoids duplicate execution and prevents log pollution.
- **`POST /workflow/review`**: Human examiner review endpoint. Records expert observations and findings without overwriting original model predictions.

---

## Machine Learning & Pretrained Forensic Detection Models

### 1. Face Manipulation Detection: Effort (ICML 2025 Oral)
- **Repository**: [YZY-stack/Effort-AIGI-Detection](https://github.com/YZY-stack/Effort-AIGI-Detection)
- **Architecture**: OpenAI CLIP `ViT-L/14` backbone with Orthogonal Subspace Decomposition (SVD Residuals on self-attention linear layers, freezing top $r=1023$ principal components while training a 1D residual subspace) + binary classification head.
- **Official Checkpoint**: `effort_clip_L14_trainOn_FaceForensic.pth` (FaceForensics++ c23, 1.15 GB).
- **License**: CC BY-NC 4.0.
- **Evaluation Target**: Aligned primary face crop derivative (224x224 bilinear resize, CLIP normalization).

#### Checkpoint Download Instructions:
```bash
mkdir -p backend/models/weights
curl -L "https://drive.usercontent.google.com/download?id=1m4fyJecABU-Yk3bJ4b1WhUwQa0xCkMLI&export=download&confirm=t" \
  -o backend/models/weights/effort_clip_L14_trainOn_FaceForensic.pth
```

### 2. Full-Image AI Generation Detection: Smaug-AI-Image-Detector
- **Repository**: [abacusai/Smaug-AI-Image-Detector](https://huggingface.co/abacusai/Smaug-AI-Image-Detector)
- **Architecture**: Vision-only EmbeddingGemma-2 backbone + linear classification head (Abacus.AI streamlined the model by stripping the 305M audio tower, yielding 439M parameters).
- **Official Checkpoint**: `abacusai/Smaug-AI-Image-Detector` (`model.safetensors`, 837 MB).
- **License**: Apache-2.0.
- **Evaluation Target**: Full image evaluated at native resolution using 3 systematic 528x528 crops (start, centre, end along the long axis). Shorter side normalized to 576 px if larger (Lanczos) or upscaled to 528 px if smaller (Bicubic).
- **Hardware & Memory Requirements**: Runs on NVIDIA GPU (~1 GB VRAM), Apple Silicon (Metal/MPS), or standard CPU. Uses `bfloat16` precision on CUDA and `float32` precision on CPU/MPS (model is numerically unstable in `float16`).
- **Domain Boundaries & Semantics**:
  - Full-image AI-generation detection is **not** interchangeable with face-swap detection: an authentic photograph with a small AI-swapped face will often score low here, while a fully AI-generated image depicting a fictional scene without any real human victim will score high.
  - **Calibration Limitation**: Output scores are uncalibrated sigmoid probabilities and must NOT be interpreted as certified posterior probabilities or sole legal proof of authenticity without domain-specific calibration.

#### Checkpoint Download Instructions:
```bash
python -c "from huggingface_hub import snapshot_download; snapshot_download('abacusai/Smaug-AI-Image-Detector', local_dir='backend/models/weights/smaug')"
```

*(All model weights are automatically ignored by `.gitignore` and are never committed to Git).*

---

## Health Check Frontend Page

- **`/health`**: Interactive status page showing:
  - Frontend client state & build environment
  - Backend API connectivity
  - PostgreSQL & Redis health status with real-time ping latencies
  - Manual recheck trigger button

---

## Running with Docker Compose

Run the entire stack (PostgreSQL, Redis, FastAPI, and Vite):

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173/health`
- Backend API: `http://localhost:8000/docs`
- Backend Health: `http://localhost:8000/health`

---

## Case Persistence, Storage, & Cryptographic Security Architecture

ShieldHer enforces strict data isolation and privacy protection for sensitive case files and digital evidence:

### 1. Database & Persistence Model
PostgreSQL persists structured metadata via SQLAlchemy 2 async and Alembic migrations:
- **`users`**: Role-Based Access Control (`VICTIM`, `EXAMINER`, `ADVOCATE`, `ADMIN`) with bcrypt password hashing (`cost=12`).
- **`cases`**: Incident narrative, platform observed, case number (`SH-YYYYMM-XXXXXXXX`), retention policy, examiner review status (`UNREVIEWED`, `UNDER_REVIEW`, `CONFIRMED_SYNTHETIC`, `CONFIRMED_NON_SYNTHETIC`, `INCONCLUSIVE`).
- **`evidence_items`**: Sanitized filenames, SHA-256 content hashes, MIME types, storage pointers, AES-256-GCM initialization vectors (IVs), retention status, and soft-delete audit records. **Raw image bytes are never written to database tables or text fields.**
- **`model_outputs`**: Detector-specific execution records (`Effort-AIGI-Detection`, `Smaug-AI-Image-Detector`), model versions, checkpoint identifiers, raw scores, labels, execution durations, and full execution metadata JSON.
- **`evidence_manifest_entries`**: Verifiable custody logs linking state snapshots to original evidence SHA-256 hashes.
- **`deletion_requests`**: Immutable records tracking requested deletions, original SHA-256 snapshot, requester ID, role, justification, and completion timestamp.
- **`audit_logs`**: Tamper-evident operational audit trail capturing all uploads, downloads, retention changes, and deletion events.

### 2. Evidence Encryption at Rest (AES-256-GCM)
- Every uploaded image is encrypted in-memory before writing to disk using authenticated **AES-256-GCM** with a distinct 12-byte random cryptographic nonce/IV per file.
- Encrypted payloads are stored in an isolated subtree (`originals/<evidence_id>.enc`).
- **Local vs. KMS Key Management**:
  - In development: AES key is loaded from `EVIDENCE_ENCRYPTION_KEY_BASE64` (32 bytes base64-encoded).
  - In production: Keys should be generated and managed via a Hardware Security Module (HSM) or cloud KMS (e.g., AWS KMS, GCP Cloud KMS, HashiCorp Vault) using envelope encryption.

### 3. Separation of Reports and Intimate Imagery
- Encrypted imagery lives exclusively in `originals/`.
- Intermediate derivatives (such as aligned facial crops) reside under `derivatives/`.
- Forensic analysis reports (frequency spectra metrics, noise residuals, ELA blockiness, and model verdicts) reside separately under `forensics/<evidence_id>_report.json`.
- Forensic reports and case files can be shared with investigators and victim advocates without exposing raw intimate imagery.

### 4. Authenticated, Short-Lived Signed Download URLs
- Direct static file serving of evidence is strictly disabled.
- Victims and authorized examiners obtain a time-limited HMAC-SHA256 signed download URL via `GET /cases/{case_id}/evidence/{evidence_id}/download-url`.
- Signed tokens expire automatically (configurable via `DOWNLOAD_URL_TTL_SECONDS`, default 300 seconds) and bind the target evidence ID and user ID to prevent URL tampering and cross-user sharing.
- Tokens are decrypted on-the-fly and streamed with `Cache-Control: no-store, no-cache, must-revalidate` headers.

### 5. Retention Policies & Critical Ethical Safeguards
- **Exploratory Uploads are Temporary by Default**: Initial uploads are assigned `TEMPORARY_EXPLORATORY` retention with automatic TTL tracking in Redis (default 24 hours).
- **Explicit Preservation Choice**: Imagery and case records are preserved long-term **only** upon an explicit, documented victim decision (`PATCH /cases/{case_id}/retention` selecting `PRESERVED_EVIDENCE`).
- **CRITICAL SAFEGUARD**: An image is **never automatically deleted** simply because a forensic model labels it "authentic" or "non-synthetic". Non-Consensually Disseminated Intimate Imagery often involves genuine, unaltered private photographs whose distribution is illegal.

### 6. Secure Deletion & Multi-Pass Cryptographic Shredding
- Deletion requests (`DELETE /cases/{case_id}/evidence/{evidence_id}` or `DELETE /cases/{case_id}`) trigger a multi-pass overwrite before unlinking the file from disk:
  1. Pass 1: Overwrite file length with cryptographically secure pseudo-random bytes (`os.urandom`).
  2. Pass 2: Overwrite file length with zero bytes (`b"\x00"`).
  3. Flush and sync to disk (`os.fsync`).
  4. Unlink file from filesystem.
- Database records are flagged with `is_deleted = True` and all storage keys cleared; subsequent download requests return `HTTP 410 Gone`.
- An auditable snapshot of the file's original SHA-256 hash is recorded in `deletion_requests` for legal chain-of-custody without preserving any image data.

### 7. Upload Protections & Decompression Bomb Prevention
- **Filename Sanitization**: Path traversal sequences (`../`, `..\`), special characters, and null bytes are stripped to prevent directory escape attacks.
- **Decompression Bombs**: Pillow's `Image.MAX_IMAGE_PIXELS` (50,000,000 pixels) and max payload size limits (25 MB) protect memory buffers against zip-bomb and decompression attacks prior to processing.

---

## Reverse Image Search & Perceptual Comparison Module

ShieldHer incorporates an optional, privacy-defensible reverse-image search and local image comparison system designed for NCII evidence discovery without violating victim confidentiality.

### 1. External Provider: SerpApi Google Lens
* **Official Provider API**: [SerpApi Google Lens API](https://serpapi.com/google-lens-api) (`engine=google_lens`).
* **Server-Side Credential Isolation**: SerpApi API keys (`SERPAPI_API_KEY`) remain strictly on the backend server and are never delivered to the client, exposed in JSON payloads, or written to application logs.
* **No Social Media Scraping**: ShieldHer never scrapes social media platforms, authenticates behind private account walls, or bypasses access controls. Searches are conducted solely against public search indices.

### 2. Mandatory Informed Consent & Disclosure Flow
* **Affirmative User Consent Required**: External search transfers query data outside ShieldHer's encrypted boundary. The API enforces affirmative consent (`consent_to_external_search: true`) immediately prior to any external API call. Requests lacking explicit consent are rejected with `HTTP 400 Bad Request`.
* **Consent Disclosure Endpoint**: `GET /cases/{case_id}/evidence/{evidence_id}/reverse-search/disclosure` returns:
  * The exact target image and its original SHA-256 hash.
  * The image representation transferred (metadata-stripped representation).
  * The identified receiving provider (`SerpApi Google Lens`).
  * Current search budget remaining and rate limit allowances.

### 3. Match Distinction: Exact Matches vs. Visual Resemblance
Results are strictly segregated into two distinct arrays:
* **`exact_matches`**: Webpages where Google Lens identifies the identical or near-identical image indexed on the public web.
* **`visual_matches`**: Webpages featuring visually or stylistically similar content (e.g. similar clothing, pose, framing).
* **Legal / Evidentiary Semantics**: Visual similarity is explicitly labeled as not proving identical source, camera origin, or common identity.

### 4. Critical Invariants
* **Absence of Matches Invariant**: If 0 matches are returned, ShieldHer explicitly documents:
  > *"No public web matches were discovered by Google Lens. This does NOT prove that the image has never appeared online; unindexed websites, private messaging channels, paywalled forums, and restricted social platforms are not covered by public search indices."*
* **Idempotency & Non-Repetition**: ShieldHer will not automatically re-execute external provider searches. If a search was already performed for an evidence item, subsequent queries return cached results from PostgreSQL unless the user explicitly flags `force_refresh=true`.
* **Independence from AI Scores**: Reverse search matches and URLs are stored and processed independently of ML face-manipulation (Effort) and AI-generation (Smaug) scores.

### 5. Rate Limiting & Case-Level Search Budgeting
* **Per-Minute Rate Limits**: Prevents denial-of-service and runaway loops (`REVERSE_SEARCH_RATE_LIMIT_PER_MINUTE=10`).
* **Daily Case Budgets**: Restricts daily searches per case (`REVERSE_SEARCH_DAILY_BUDGET_PER_CASE=5`) tracked via Redis TTL keys to protect victims and maintain operational controls.
* **Graceful Degradation**: Clear statuses returned for `UNAVAILABLE` (missing key), `TIMEOUT` (after 15s), `RATE_LIMITED` (429), and `QUOTA_EXCEEDED` (monthly budget exhausted).

### 6. Local Cryptographic & Perceptual Hash Comparison
Compares images locally without external network exposure:
* **Exact SHA-256 Digest**: Validates bit-for-bit file identity.
* **64-bit DCT Perceptual Hash (pHash)**: Evaluates structural low-frequency resemblance under resizing or re-compression.
* **Auxiliary Hashes**: Average Hash (aHash) and Difference Hash (dHash).
* **Normalized Similarity & Hamming Distance**: Returns Hamming distance ($0 \le d \le 64$) and similarity score ($(64 - d) / 64.0$).
* **Forensic Disclaimer**:
  > *"Perceptual hash comparisons evaluate mathematical visual resemblance under compression, resizing, or minor color grading. A close perceptual match DOES NOT prove shared origin, identical camera sensor provenance, or common authorship."*

### 7. Endpoints
* `GET /cases/{case_id}/evidence/{evidence_id}/reverse-search/disclosure`: Retrieve consent disclosure and budget status.
* `POST /cases/{case_id}/evidence/{evidence_id}/reverse-search`: Execute search with explicit consent.
* `GET /cases/{case_id}/evidence/{evidence_id}/reverse-search`: List historical reverse search records for this evidence.
* `POST /cases/{case_id}/evidence/{evidence_id}/compare-local`: Compare case evidence against an uploaded reference image.
* `POST /compare/local`: Standalone comparison between two uploaded images.

---

## Victim Support: Information Elicitation & Legal Complaint Drafting

ShieldHer provides a trauma-informed, constrained intake and complaint drafting pipeline designed to help victims prepare formal evidence packages for the **National Cyber Crime Reporting Portal (cybercrime.gov.in)** and emergency takedown notices under **Rule 3(2)(b) of the Information Technology Rules, 2021**.

### 1. Trauma-Informed Elicitation (Maximum 3 Rounds)
* **Round 1 (Incident Discovery & Location)**: Identifies online platform, discovery timestamp, and specific offending URLs/handles.
* **Round 2 (Consent, Provenance & Harm)**: Documents lack of consent, private creation boundaries, synthetic/deepfake alteration, and extortion threats.
* **Round 3 (Platform Takedown & Remedy Selection)**: Prior takedown status, immediate physical safety needs, and desired reporting documents.
* **100% Skippable**: Victims are never forced to answer distressing questions; questions can be skipped without blocking draft generation.

### 2. Privacy & LLM Boundary Rules
* **Zero Image Bytes to Mistral / LLM**: Image binaries, face crops, and intimate pixels are **never** transmitted to the Mistral AI API. Only sanitized metadata (SHA-256 hashes, file sizes, and model confidence scores) is provided.
* **Never Generate or Distribute Intimate Imagery**: The system does not generate, alter, or simulate intimate visual content.
* **Segregation of User Facts vs. Technical Measurements**: User-reported statements (`user_reported_facts`) and forensic detector findings (`technical_findings_summary`) are kept in separate data structures and distinct report sections.
* **Zero Hallucination Guarantee**: The drafter never invents suspect identities, dates, or events. If a suspect or platform is unspecified, the complaint explicitly states `"Unknown / Under Investigation"` or `"Not specified by user"`.

### 3. Verified Indian Statutory Framework
Provisions are conditionally matched based on user-reported facts:
* **Information Technology Act, 2000 — Section 66E**: Capturing, publishing, or transmitting images of private areas without consent (imprisonment up to 3 years or fine up to ₹2 lakh).
* **Information Technology Act, 2000 — Section 67A**: Publishing or transmitting sexually explicit acts in electronic form (up to 5 years imprisonment and fine up to ₹10 lakh).
* **Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 — Rule 3(2)(b)**: **Mandatory 24-hour statutory takedown** obligation for intermediaries upon receiving an NCII complaint.
* **Bhartiya Nyaya Sanhita, 2023 — Section 77**: Voyeurism (governs offenses committed on or after July 1, 2024; prior offenses cite Section 354C IPC).
* **Bhartiya Nyaya Sanhita, 2023 — Section 318 / IT Act Section 66D**: Cheating by personation and synthetic/deepfake misrepresentation.
* **Bhartiya Nyaya Sanhita, 2023 — Section 351 & Section 308**: Criminal intimidation and extortion via threat of dissemination.

### 4. LangGraph Workflow & Mistral Drafting with Safe Fallback
* **LangGraph Orchestration**: Executed via compiled StateGraph (`complaint_drafting_workflow`):
  `validate_inputs -> statutory_assessment -> evidence_indexing -> drafting_synthesis -> final_packaging`
* **Constrained Mistral AI API**: When `MISTRAL_API_KEY` is configured, Mistral synthesizes the formal narrative with strict prompt-injection defenses.
* **Deterministic Fallback Engine**: If the Mistral API key is absent, times out, or encounters errors, ShieldHer seamlessly switches to the deterministic template generator, producing the complete legal complaint and 24-hour notice with zero hallucinations.

### 5. Escalation & Non-Submission Safety Guarantee
* **Label Stamping**: All generated drafts are prominently stamped at the top and in metadata:
  `DRAFT — FOR USER AND LEGAL REVIEW`
* **NEVER Automatically Submitted**: `POST /escalate` generates a downloadable draft (`.md`) and official step-by-step guidance for `https://cybercrime.gov.in`. ShieldHer **never** transmits complaints to police, intermediaries, or third parties.
* **Recorded User Confirmation**: Requires affirmative user acknowledgement (`acknowledged_draft_reviewed: true`) prior to finalization, recorded immutably in `audit_logs`.

### 6. Endpoints
* `GET /elicit`: Retrieve questionnaire questions for current round (1, 2, or 3).
* `POST /elicit`: Submit answers for questionnaire round and advance to the next round.
* `POST /escalate`: Finalize downloadable legal draft with recorded user confirmation.
* `GET /cases/{case_id}/draft`: Retrieve existing complaint draft for a case.
* `POST /cases/{case_id}/elicit` & `POST /cases/{case_id}/escalate`: Case-scoped aliases.

---

---

## Frontend Architecture & Web Interfaces

ShieldHer provides a modern, responsive Single Page Application built with React 18, TypeScript, and Vite.

### 1. Victim Intake & Reporting UI (`/`)
An intuitive, confidential flow designed for victims and legal advocates:
1. **Secure Evidence Intake**: Client-side format checks (JPEG, PNG, WebP) and size limits (< 20MB) with mandatory privacy & boundary consent acknowledgments.
2. **Quality Gateway Card**: Laplacian blur variance, mean luminance, contrast standard deviation, face detection count, and provisional thresholds disclaimer.
3. **Pretrained Forensic Verification**: Side-by-side EFFORT (face manipulation / face-swap) and Smaug (whole-image synthetic generation) cards with native score semantics and explicit disclaimer that scores are not interchangeable.
4. **Deterministic Forensics Viewer**: Interactive 2D FFT log-magnitude spectrum, high-pass noise residual statistics (SNR dB, kurtosis, residual maps), and JPEG Error Level Analysis (ELA) heatmaps.
5. **Reverse Image Search & Distribution**: Explicit affirmative consent disclosure modal before transmitting any evidence to Google Lens (via SerpApi). Displays exact SHA-256/pHash matches separately from visual resemblance matches.
6. **Trauma-Informed Elicitation Form**: 3-round questionnaire for incident context. Fully skippable questions with deterministic fallback, zero raw image byte transmission to LLMs.
7. **Complaint Draft Viewer & Editor**: Interactive markdown editor with copy-to-clipboard, markdown file download (`.md`), statutory citations (IT Act 2000, IT Rules 2021, BNS 2023), official filing links (`cybercrime.gov.in`), and affirmative review confirmation.
8. **Evidence Vault & Cryptographic Shredding**: Case metadata, AES-256-GCM encryption at rest, short-lived HMAC download links, and multi-pass secure purging.

### 2. Role-Gated Reviewer Console (`/reviewer`)
Designed for certified forensic examiners, victim advocates, and administrators:
* **Role Gate & Authentication**: Access restricted via JWT bearer tokens to accounts with `EXAMINER`, `ADVOCATE`, or `ADMIN` roles.
* **Triage Case List with Minimal Sensitive Data**: PII is redacted; cases are presented by pseudonymized case number, status, review status, and timestamp.
* **Authorized Case Inspection**: Detailed evidence items, model outputs, execution durations, and forensic reports.
* **Human Annotations & Override Controls**: Allows expert examiners to record findings (`CONFIRMED_MANIPULATION`, `AUTHENTIC`, `INCONCLUSIVE`, `TAMPERING_EVIDENT`), technical notes, and an explicit `human_override` flag.
* **Immutable Audit Trail**: Displays complete chronological log of actions taken on each case (`CASE_CREATED`, `DOWNLOAD_URL_ISSUED`, `HUMAN_REVIEW_RECORDED`, `DELETION_REQUESTED`).

### 3. System Health Dashboard (`/health`)
Monitors operational readiness, database connectivity, and Redis cache responsiveness.

---

## Deployment & Docker Compose

ShieldHer is configured for multi-container local and production deployment via Docker Compose.

### Quickstart with Docker Compose

```bash
# 1. Clone repository and enter directory
cd shieldher

# 2. Configure environment variables
cp .env.example .env
# Edit .env with your secrets, database credentials, and optional API keys

# 3. Start all services
docker compose up --build
```

### Services Orchestrated

| Service | Container Image | Port | Description | Healthcheck |
|---|---|---|---|---|
| `db` | `postgres:16-alpine` | `5432` | PostgreSQL database storing case metadata, models, and audit logs | `pg_isready -U shieldher` |
| `redis` | `redis:7-alpine` | `6379` | Ephemeral session cache and reverse search rate limiter | `redis-cli ping` |
| `backend` | `./backend/Dockerfile` | `8000` | FastAPI application with async workers | `curl -f http://localhost:8000/health` |
| `frontend` | `./frontend/Dockerfile` | `5173` | React TypeScript Vite client | HTTP `200 OK` on `/health` |

### Production Build Instructions (Frontend)

To build static assets for production deployment on Nginx, Cloudflare Pages, or AWS S3:

```bash
cd frontend
npm install
npm run build
# Production artifacts generated in frontend/dist/
```

---

## Pretrained Model Setup & Checkpoints

ShieldHer uses official released model checkpoints for pretrained inference without training or fine-tuning.

### 1. EFFORT Model (Face-Swap & Manipulation Detection)
* **Official Repository**: [YZY-stack/Effort-AIGI-Detection](https://github.com/YZY-stack/Effort-AIGI-Detection)
* **Checkpoint**: `effort_clip_L14_trainOn_FaceForensic.pth`
* **Base Architecture**: OpenAI `ViT-L/14@336px` CLIP visual encoder with linear classifier probe.
* **Download Instructions**:
  ```bash
  mkdir -p backend/models/weights
  # Download official checkpoint into backend/models/weights/
  # Checkpoint file: effort_clip_L14_trainOn_FaceForensic.pth
  ```
* **Resource Requirements**: ~1.5 GB RAM on CPU. GPU acceleration supported on CUDA / Apple Silicon MPS.
* **License**: Follows upstream EFFORT and CLIP research terms.

### 2. Smaug AI Detector (Whole-Image Synthetic Generation)
* **Official Model Card**: [abacusai/Smaug-AI-Image-Detector](https://huggingface.co/abacusai/Smaug-AI-Image-Detector)
* **Architecture**: Vision-only `EmbeddingGemma-2` (439M parameters).
* **Weights Directory**: `backend/models/weights/smaug`
* **Snapshot Download**:
  ```bash
  python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='abacusai/Smaug-AI-Image-Detector', local_dir='backend/models/weights/smaug')"
  ```
* **Resource Requirements**: ~2.0 GB RAM for FP32 CPU inference (~1.0 GB for FP16 on GPU).
* **Score Interpretation**: Probability in $[0.0, 1.0]$. Default recommended threshold is $0.50$.
* **License**: Gemma Terms of Use.

---

## Testing & Quality Assurance

ShieldHer features comprehensive test suites covering unit logic, cryptographic guarantees, security invariants, and UI components.

### Run Backend Tests (Pytest)

```bash
cd backend
# Run all 106 unit & integration tests
pytest tests/ -v
```

### Run Frontend Tests (Vitest)

```bash
cd frontend
# Run component tests and mocks
npm run test
# Run TypeScript static analysis
npm run type-check
```

### Verified Security Invariants

* **Model Failure Isolation**: Unavailable weights or inference exceptions do not crash endpoints or discard valid outputs from parallel modules.
* **Decompression Bomb Protection**: Pillows `MAX_IMAGE_PIXELS` (50 MP) and upload payload size limits (20 MB) prevent zip-bomb exploits.
* **No Raw Image Transmission to LLMs**: Only sanitized custody metadata, file hashes, and model confidence scores are sent to Mistral AI. Intimate imagery is never transmitted.
* **No Automatic Complaint Filing**: Complaint drafts are local files for user review; no automated police or third-party submissions occur.
* **Preservation on Authentic Verdict**: Authentic model verdicts do NOT trigger automated evidence deletion; evidence remains preserved according to case retention policy.
* **Cryptographic Shredding**: Multi-pass random overwrite and key destruction ensure irrecoverable evidence erasure on user demand.

---

## Known Limitations & Ethical Constraints

1. **Provisional Quality Thresholds**: Blur, brightness, contrast, and face size thresholds are engineering heuristics. They must be calibrated against representative victim-reported imagery prior to formal judicial presentation.
2. **Probabilistic Scores**: Neither face-swap scores nor full-image AI generation scores constitute definitive proof in isolation. They must be evaluated in conjunction with forensic signal measurements and chain-of-custody documentation.
3. **Public Search Index Limitations**: Reverse image search queries public web indices (Google Lens). Absence of public search results does not prove that imagery has not been distributed via private messaging channels, encrypted platforms, or unindexed forums.
4. **Local Legal Variations**: Complaint templates cite verified Indian statutes (IT Act 2000, IT Rules 2021, BNS 2023). Cases originating outside Indian jurisdiction must be adapted for local legal frameworks.


To apply database schema migrations:

```bash
cd backend
alembic upgrade head
```

To generate a new migration after model changes:

```bash
cd backend
alembic revision --autogenerate -m "description_of_change"
```

To inspect static SQL DDL without applying it:

```bash
cd backend
alembic upgrade --sql base:head
```

---

## Security & Privacy Guidelines

1. **Zero Data Retention in Version Control**: Uploaded images, intermediate forensic artifacts, cryptographic hashes of victims' media, and model weights are strictly ignored in `.gitignore`.
2. **Pretrained Inference Only**: In compliance with safety standards, no user images are used for model training or fine-tuning.
3. **No Mock/Placeholder Successes**: Real status codes and truthful errors are reported.
4. **Isolated ML Dependencies**: PyTorch and heavy machine learning packages reside in `requirements-ml.txt` to keep the base API lightweight and prevent dependency conflicts.
