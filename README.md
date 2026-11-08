# ShieldHer

**Privacy-first image forensics and NCII victim-support application**

ShieldHer is a platform for documenting and assessing potentially manipulated or non-consensually shared imagery. It combines a quality gateway, four independent pretrained detectors, deterministic forensic measurements, secure evidence handling, and trauma-informed complaint-drafting support. It is designed to provide reviewable technical indicators—not a definitive finding of authenticity or legal proof.

> **Safety and evidence note:** Detector outputs are uncalibrated or model-specific measurements. They must not be treated as proof that an image is authentic or manipulated. ShieldHer does not automatically submit complaints, and an “authentic” model result never triggers automatic evidence deletion.

## What’s new

The verification pipeline now runs up to four models in two distinct categories, exposes per-model results and category-level agreement, and supports asynchronous jobs with progressive status checkpoints:

| Category | Model | Evaluates |
|---|---|---|
| Face manipulation | [EFFORT](https://github.com/YZY-stack/Effort-AIGI-Detection) | Face crop; CLIP ViT-L/14 with SVD residuals |
| Face manipulation | [GenD](https://github.com/yermandy/GenD) | Face crop; CLIP ViT-L/14 LinearNorm detector |
| Full-image AI generation | [Smaug](https://huggingface.co/abacusai/Smaug-AI-Image-Detector) | Full image; EmbeddingGemma-2 vision model |
| Full-image AI generation | [Forensic Self-Descriptions (FSD)](https://github.com/ductai199x/Forensic-Self-Descriptions-CVPR25) | Full image; forensic residuals and GMM |

Models execute independently. A missing checkpoint or failure in one detector does not invalidate other model results. ShieldHer reports agreement or disagreement separately for face manipulation and full-image generation; it does not average heterogeneous model scores into a single verdict. FSD can be skipped when disabled by configuration and is subject to its **CC BY-NC-SA 4.0 non-commercial research license**.

## Features

- **Quality Gateway and image ingestion:** validates supported image formats, evaluates provisional image-quality criteria, computes a SHA-256 digest, and prepares normalized image and face-crop derivatives.
- **Four-model verification:** EFFORT and GenD assess face manipulation; Smaug and FSD assess full-image AI generation. Optional Grad-CAM is available for EFFORT.
- **Progressive verification jobs:** the frontend can start a background verification and poll its 10 checkpoints and partial results.
- **Deterministic forensics:** optional frequency-domain, residual, compression/resampling, and spatial measurements. These are reported as measurements, not fabricated probabilities or proof of manipulation.
- **Evidence and case workflows:** case metadata, audit records, retention choices, encrypted evidence storage, and short-lived signed downloads.
- **Reverse-image search and local comparison:** optional public-web search through SerpApi Google Lens requires explicit consent; local SHA-256 and perceptual-hash comparisons avoid external transfer.
- **Victim-support drafting:** skippable, trauma-informed intake and complaint-draft assistance with a deterministic fallback. Drafts are for user and legal review and are never automatically submitted.
- **Web interfaces:** React/TypeScript verification experience, reviewer console, and system health dashboard.

## Technology stack

| Layer | Technology |
|---|---|
| Backend API | Python 3.11+, FastAPI, Pydantic v2 |
| Database | PostgreSQL 16, SQLAlchemy async, Alembic |
| Cache and task state | Redis 7 |
| Frontend | React 18, TypeScript, Vite |
| Machine learning | PyTorch, torchvision, Pillow; optional model dependencies and checkpoints |
| Workflow orchestration | LangGraph |
| Local orchestration | Docker Compose |

## Repository layout

```text
shieldher/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── app/api/                 # API routes, including verification
│   ├── app/schemas/             # Request and response models
│   ├── app/services/            # Image processing, model adapters, registry/jobs
│   ├── app/workflows/           # LangGraph evidence workflow
│   ├── alembic/                 # Database migrations
│   ├── scripts/evaluate_models.py
│   ├── requirements.txt
│   └── requirements-ml.txt      # Optional, heavier ML dependencies
└── frontend/
    └── src/                     # React application, pages, API client, types
```

## Quick start

### Docker Compose

```bash
cp .env.example .env
# Edit .env and configure secrets, database credentials, and optional provider keys.
docker compose up --build
```

- Frontend: <http://localhost:5173>
- Backend API documentation: <http://localhost:8000/docs>
- Backend health: <http://localhost:8000/health>

### Database migrations

```bash
cd backend
alembic upgrade head
```

### Frontend development and production build

```bash
cd frontend
npm install
npm run build
```

## Configuration

Copy the root `.env.example` to `.env`. Configure the relevant values for your environment, including:

- `APP_ENV` and `APP_SECRET_KEY`
- `POSTGRES_*` and `REDIS_*` connection settings
- `UPLOAD_DIR` and upload-size limits
- `GEN D` model settings (`gend_*`) and FSD settings (`enable_fsd`, `fsd_*`) as defined in `backend/app/config.py`
- Optional integration credentials such as `SERPAPI_API_KEY` and `MISTRAL_API_KEY`
- `EVIDENCE_ENCRYPTION_KEY_BASE64` for local evidence encryption

FSD is enabled by configuration in the current code, but its non-commercial research license applies. Confirm that your intended use is permitted before enabling or distributing it. In production, use an appropriate secrets manager or KMS/HSM for cryptographic keys.

## Verification API

All verification routes accept an image as `multipart/form-data` using the `file` field. The Quality Gateway runs first; unsupported or inadequate images do not proceed to model inference.

### Synchronous verification

`POST /verify` runs the selected detectors and returns a `VerificationResponse`. Query options include:

- `include_effort` (default `true`)
- `include_gend` (default `true`)
- `include_smaug` (default `true`)
- `include_fsd` (default `true`)
- `include_forensics` (default `false`)
- `include_gradcam` (default `false`)

The response contains the quality assessment, individual model outputs, model registry, checkpoint states, category agreement summaries, and optional deterministic forensic report.

### Asynchronous verification

1. `POST /verify/jobs` accepts the image and the same model-selection options, plus an optional `case_id`; it returns a `job_id`.
2. Poll `GET /verify/jobs/{job_id}` for job status, progressive model results, and checkpoint states.

The 10 checkpoints are: image upload, image validation, face detection, quality assessment, EFFORT, GenD, Smaug, FSD, forensic summary, and final result. Job state is managed in memory by the current job manager; it is not a durable job queue.

### Other endpoint groups

- `GET /health` and `GET /health/live` — service health and liveness
- `POST /upload` — image ingestion and quality assessment
- `POST /analyze/forensics` — deterministic forensic analysis
- `POST /workflow/execute` and `POST /workflow/review` — evidence workflow and human review
- Case, evidence, retention, deletion, reverse-search, and local-comparison routes are documented in the backend OpenAPI schema at `/docs`.

## Model checkpoints

Model weights are not committed to the repository. Store them in the configured weights directories and check the applicable upstream terms before downloading or using any checkpoint.

### EFFORT

Expected checkpoint: `backend/models/weights/effort_clip_L14_trainOn_FaceForensic.pth`.

```bash
mkdir -p backend/models/weights
curl -L "https://drive.usercontent.google.com/download?id=1m4fyJecABU-Yk3bJ4b1WhUwQa0xCkMLI&export=download&confirm=t" \
  -o backend/models/weights/effort_clip_L14_trainOn_FaceForensic.pth
```

EFFORT is distributed under CC BY-NC 4.0 terms; review the upstream repository and license before use.

### GenD

The configured default directory is `backend/models/weights/gend`. Download the official checkpoint and model files from [yermandy/GenD_CLIP_L_14](https://huggingface.co/yermandy/GenD_CLIP_L_14) into that directory. The repository code uses the Hugging Face snapshot API:

```bash
python -c "from huggingface_hub import snapshot_download; snapshot_download('yermandy/GenD_CLIP_L_14', local_dir='backend/models/weights/gend')"
```

GenD is identified as MIT licensed in its model metadata; consult the upstream project for authoritative terms and usage instructions.

### Smaug

The configured default directory is `backend/models/weights/smaug`:

```bash
python -c "from huggingface_hub import snapshot_download; snapshot_download('abacusai/Smaug-AI-Image-Detector', local_dir='backend/models/weights/smaug')"
```

Consult the model card and applicable Gemma terms before use.

### FSD

The configured default directory is `backend/models/weights/fsd`. Download the official v1.2.0 release files from the [FSD releases](https://github.com/ductai199x/Forensic-Self-Descriptions-CVPR25/releases/tag/v1.2.0) into that directory. The adapter expects `config.json`, `fre.pt`, `gmm.pt`, and `fsd_transforms.pt`.

FSD is licensed CC BY-NC-SA 4.0 for non-commercial research use. Ensure the license permits your use before enabling the model.

> Model availability depends on local dependencies and checkpoint files. If a model cannot run, ShieldHer returns a structured unavailable, skipped, or error status instead of inventing a score.

## Security, privacy, and ethical safeguards

- Evidence and model weights are excluded from version control by repository ignore rules.
- Evidence encryption at rest uses AES-256-GCM; configure and protect encryption keys appropriately.
- Evidence downloads use authenticated, short-lived signed URLs rather than direct static file serving.
- Exploratory evidence is temporary by default; long-term preservation requires an explicit choice.
- Model results do not automatically delete evidence, and complaint drafts are not automatically filed.
- External reverse-image searches require affirmative consent and transfer a disclosed image representation to the configured provider. ShieldHer does not scrape social-media accounts or bypass access controls.
- Raw image bytes and face crops are not sent to the complaint-drafting LLM; only permitted, sanitized metadata is used.
- Never use verification outputs as the sole basis for legal, safety, or authenticity decisions.

## Tests and evaluation

Backend tests:

```bash
cd backend
pytest tests/ -v
```

Frontend tests and type checking:

```bash
cd frontend
npm run test
npm run type-check
```

Optional four-model evaluation harness:

```bash
cd backend
python scripts/evaluate_models.py --image /path/to/image.jpg --output evaluation.json
```

The evaluation harness requires the relevant model dependencies and checkpoints. Use only images you are authorized to process.

## Limitations

- Quality thresholds are provisional engineering heuristics and require validation for the intended population and use case.
- Model scores are not necessarily calibrated probabilities and may vary across image domains, formats, compression, and model training distributions.
- A detector that does not flag manipulation does not establish that an image is authentic or consensually shared.
- Reverse-image search covers public search indexes only; absence of matches does not prove that an image was never distributed.
- Complaint templates reference Indian law and require jurisdiction-specific review and legal advice.
- FSD's non-commercial license constrains use; check all upstream model licenses and terms.

## License

Check the repository's license and each third-party model's license independently. The upstream model licenses differ; use of a model checkpoint may impose additional restrictions beyond ShieldHer's own code license.
