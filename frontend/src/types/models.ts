/**
 * ShieldHer - Frontend TypeScript Model Definitions
 */

export type UserRole = "VICTIM" | "EXAMINER" | "ADVOCATE" | "ADMIN";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in_minutes: number;
  user_id: string;
  email: string;
  role: UserRole;
}

// ── Quality Gateway ─────────────────────────────────────────────────────────

export interface FaceBox {
  box?: [number, number, number, number];
  origin_x?: number;
  origin_y?: number;
  width?: number;
  height?: number;
  confidence?: number;
  landmarks?: Record<string, [number, number]>;
}

export interface QualityMetrics {
  width?: number;
  height?: number;
  total_pixels?: number;
  aspect_ratio?: number;
  blur_score?: number;
  blur_laplacian_var?: number;
  brightness?: number;
  brightness_mean?: number;
  contrast?: number;
  contrast_std?: number;
  faces_detected?: number;
  is_sharp?: boolean;
  is_well_exposed?: boolean;
  has_acceptable_contrast?: boolean;
  primary_face_crop_dims?: [number, number];
  face_bounding_boxes?: FaceBox[];
}

export interface ProvisionalThresholds {
  min_pixels?: number;
  max_pixels?: number;
  min_sharpness_laplacian?: number;
  min_brightness?: number;
  max_brightness?: number;
  min_contrast?: number;
  min_image_width?: number;
  min_image_height?: number;
}

export interface UploadResponse {
  sha256?: string;
  sha256_hash?: string;
  storage_reference?: string;
  file_format?: string;
  file_size_bytes?: number;
  mime_type?: string;
  status: "PASS" | "RETRY_REQUIRED" | "UNSUPPORTED_INPUT" | "PROCESSING_ERROR";
  quality_metrics?: QualityMetrics;
  image_dimensions?: {
    width: number;
    height: number;
    channels?: number;
    aspect_ratio: number;
    total_pixels: number;
  };
  file_metadata?: {
    filename?: string;
    file_size_bytes?: number;
    detected_format?: string;
    content_type?: string;
  };
  provisional_thresholds?: ProvisionalThresholds;
  thresholds?: ProvisionalThresholds;
  face_count?: number;
  faces?: any[];
  reasons?: string[];
  quality_notes?: string[];
  remediation_steps?: string[];
  message?: string;
  normalized_derivative_available?: boolean;
}

// ── Pretrained Detection Models ─────────────────────────────────────────────

export interface GradCamResult {
  has_gradcam?: boolean;
  target_class?: number;
  target_layer?: string;
  heatmap_dimensions?: [number, number];
  overlay_base64_png?: string;
}

export interface EffortResult {
  model_name?: string;
  checkpoint?: string;
  checkpoint_identifier?: string;
  status: "COMPLETED" | "MODEL_UNAVAILABLE" | "FACE_NOT_DETECTED" | "INFERENCE_ERROR" | "SUCCESS" | "UNAVAILABLE" | "ERROR" | string;
  manipulation_probability?: number;
  manipulation_score?: number;
  predicted_label?: "MANIPULATED" | "AUTHENTIC" | "UNCERTAIN" | string;
  raw_logits?: number[];
  score_semantics?: string;
  inference_duration_ms?: number;
  gradcam_available?: boolean;
  gradcam?: GradCamResult;
  notes?: string;
  error_message?: string;
}

export interface SmaugResult {
  model_name?: string;
  checkpoint?: string;
  checkpoint_identifier?: string;
  status: "COMPLETED" | "MODEL_UNAVAILABLE" | "INFERENCE_ERROR" | "SUCCESS" | "UNAVAILABLE" | "ERROR" | string;
  ai_generated_probability?: number;
  ai_generation_score?: number;
  predicted_label?: "AI_GENERATED" | "HUMAN_CAPTURED" | "NATURAL_OR_AUTHENTIC" | "UNCERTAIN" | string;
  raw_score?: number;
  score_semantics?: string;
  inference_duration_ms?: number;
  crops_evaluated?: number;
  crop_scores?: number[];
  hardware_device?: string;
  notes?: string;
  error_message?: string;
}

export interface VerificationResponse {
  case_id?: string;
  sha256?: string;
  sha256_hash?: string;
  verification_status?: "VERIFIED" | "QUALITY_GATEWAY_REJECTED" | "QUALITY_GATEWAY_RETRY_REQUIRED" | "DETECTOR_UNAVAILABLE" | "DETECTION_FAILED" | string;
  processing_status?: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED" | string;
  message?: string;
  summary_message?: string;
  quality_assessment?: any;
  effort_detection?: EffortResult;
  smaug_detection?: SmaugResult;
  effort_result?: EffortResult;
  smaug_result?: SmaugResult;
  detection?: EffortResult;
  forensic_report?: any;
}

// ── Forensic Analysis ───────────────────────────────────────────────────────

export interface FrequencyDomainResult {
  status?: string;
  radial_band_energies?: Record<string, number>;
  high_frequency_ratio?: number;
  dc_component?: number;
  low_freq_energy_ratio?: number;
  mid_freq_energy_ratio?: number;
  high_freq_energy_ratio?: number;
  azimuthal_energy_variance?: number;
  spectrum_visualization_b64?: string;
  fft_spectrum?: any;
  dct_analysis?: any;
  wavelet_analysis?: any;
  notes?: string;
}

export interface NoiseResidualResult {
  status?: string;
  residual_std?: number;
  residual_kurtosis?: number;
  snr_estimate_db?: number;
  method?: string;
  high_pass_filter?: any;
  median_filter_residual?: any;
  visualization_b64?: string;
  notes?: string;
}

export interface CompressionResult {
  status?: string;
  is_jpeg?: boolean;
  estimated_jpeg_quality?: number;
  ela_mean_difference?: number;
  ela_mean_residual?: number;
  ela_visualization_b64?: string;
  block_artifact_measure?: number;
  block_artifact_grid?: any;
  error_level_analysis?: any;
  blockiness?: any;
  ela?: any;
  resampling?: any;
  notes?: string;
}

export interface SpatialResult {
  status?: string;
  face_boundary_laplacian_discontinuity?: number;
  laplacian_boundary_variance?: number;
  face_edge_discontinuity_score?: number;
  local_texture_entropy?: number;
  face_boundary?: any;
  notes?: string;
}

export interface ForensicsResponse {
  sha256?: string;
  sha256_hash?: string;
  frequency?: any;
  frequency_analysis?: FrequencyDomainResult;
  frequency_domain?: FrequencyDomainResult;
  noise_residuals?: NoiseResidualResult;
  compression_diagnostics?: CompressionResult;
  compression_resampling?: CompressionResult;
  spatial?: any;
  spatial_analysis?: SpatialResult;
  spatial_boundary?: SpatialResult;
  prnu_disclosure?: any;
  disclaimer?: string;
  forensic_disclaimer?: string;
}

// ── Reverse Image Search ────────────────────────────────────────────────────

export interface SearchMatchItem {
  title?: string;
  link: string;
  source?: string;
  thumbnail?: string;
  match_type: "EXACT_SHA256" | "PERCEPTUAL_PHASH" | "VISUAL_SIMILARITY";
  similarity_score?: number;
}

export interface ReverseSearchDisclosure {
  provider_name: string;
  provider_url: string;
  terms_summary: string;
  data_sent_description: string;
  warning: string;
}

export interface ReverseSearchResponse {
  search_id: string;
  case_id: string;
  evidence_id: string;
  provider: string;
  status: "COMPLETED" | "NO_MATCHES" | "RATE_LIMITED" | "PROVIDER_ERROR";
  exact_matches_count: number;
  visual_matches_count: number;
  exact_matches: SearchMatchItem[];
  visual_matches: SearchMatchItem[];
  search_duration_ms?: number;
  disclaimer: string;
}

// ── Information Elicitation & Complaint ─────────────────────────────────────

export interface ElicitationQuestion {
  question_id: string;
  round_number: number;
  category: string;
  prompt: string;
  field_key: string;
  is_optional: boolean;
  input_type: "text" | "textarea" | "select" | "multiselect" | "date";
  options?: string[];
  helper_text?: string;
}

export interface ElicitationQuestionsResponse {
  round_number: number;
  total_rounds: number;
  is_last_round: boolean;
  questions: ElicitationQuestion[];
}

export interface ComplaintDraftResponse {
  case_id: string;
  draft_status: "DRAFT_FOR_REVIEW" | "FINALIZED_FOR_EXPORT";
  generated_at: string;
  markdown_body: string;
  statutory_provisions_cited: string[];
  evidence_custody_count: number;
  filing_portal_url: string;
  emergency_helpline: string;
  mandatory_human_review_notice: string;
  provisional_findings_notice: string;
}

// ── Case Persistence & Review ───────────────────────────────────────────────

export interface ModelOutputItem {
  id: string;
  detector_name: string;
  model_version: string;
  checkpoint_identifier: string;
  status: string;
  raw_score?: number;
  predicted_label?: string;
  score_semantics: string;
  execution_duration_ms?: number;
  created_at: string;
}

export interface EvidenceItem {
  id: string;
  case_id: string;
  filename_sanitized: string;
  original_sha256: string;
  mime_type: string;
  file_size_bytes: number;
  is_preserved: boolean;
  is_deleted: boolean;
  created_at: string;
  model_outputs: ModelOutputItem[];
}

export interface CaseItem {
  id: string;
  case_number: string;
  user_id: string;
  title: string;
  incident_description?: string;
  incident_date?: string;
  platform_observed?: string;
  status: "OPEN" | "UNDER_REVIEW" | "EVIDENCE_PRESERVED" | "CLOSED" | "PURGED";
  retention_policy: "TEMPORARY_EXPLORATORY" | "PRESERVED_EVIDENCE" | "SCHEDULED_PURGE";
  retention_expires_at?: string;
  review_status: string;
  examiner_notes?: string;
  created_at: string;
  evidence_count: number;
  evidence_items: EvidenceItem[];
}

export interface AuditLogItem {
  id: string;
  case_id?: string;
  user_id?: string;
  action: string;
  details_json?: Record<string, any>;
  created_at: string;
}

export interface DownloadUrlResponse {
  evidence_id: string;
  download_url: string;
  expires_at_utc: string;
  expires_in_seconds: number;
}
