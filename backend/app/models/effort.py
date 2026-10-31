"""
ShieldHer – Effort: Orthogonal Subspace Decomposition for Generalizable AI-Generated Image Detection.

Official Repository: https://github.com/YZY-stack/Effort-AIGI-Detection
Paper: "Orthogonal Subspace Decomposition for Generalizable AI-Generated Image Detection" (ICML 2025 Oral)
License: CC BY-NC 4.0

Architecture:
- Vision Backbone: OpenAI CLIP ViT-L/14 vision transformer
- Self-attention linear layers (q_proj, k_proj, v_proj, out_proj) decomposed via SVD
- Top r=1023 principal singular components are frozen (preserving semantic knowledge)
- Residual 1-dimensional subspace is trainable (~0.19M parameters) to detect forgery patterns
- Classifier head: nn.Linear(1024, 2)
"""
from __future__ import annotations

import base64
import io
import math
from typing import Optional, Tuple
import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import structlog

logger = structlog.get_logger(__name__)


class SVDResidualLinear(nn.Module):
    """
    SVD Residual Linear layer replacing nn.Linear in self-attention modules.

    Splits the weight matrix W into:
      W = weight_main (top r components) + U_residual @ diag(S_residual) @ V_residual
    """

    def __init__(
        self,
        in_features: int,
        out_features: int,
        r: int = 1023,
        bias: bool = True,
        init_weight: Optional[torch.Tensor] = None,
    ):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.r = r

        # Main frozen components (top r singular values)
        self.weight_main = nn.Parameter(
            torch.Tensor(out_features, in_features), requires_grad=False
        )
        if init_weight is not None:
            self.weight_main.data.copy_(init_weight)
        else:
            nn.init.kaiming_uniform_(self.weight_main, a=math.sqrt(5))

        # Bias
        if bias:
            self.bias = nn.Parameter(torch.Tensor(out_features))
            nn.init.zeros_(self.bias)
        else:
            self.register_parameter("bias", None)

        # Trainable residual components (rank = 1)
        self.S_residual = nn.Parameter(torch.zeros(1))
        self.U_residual = nn.Parameter(torch.zeros(out_features, 1))
        self.V_residual = nn.Parameter(torch.zeros(1, in_features))

        # Fixed SVD reference components for loss computation
        self.S_r = None
        self.U_r = None
        self.V_r = None

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if (
            hasattr(self, "U_residual")
            and hasattr(self, "V_residual")
            and self.S_residual is not None
        ):
            residual_weight = (
                self.U_residual @ torch.diag(self.S_residual) @ self.V_residual
            )
            weight = self.weight_main + residual_weight
        else:
            weight = self.weight_main

        return F.linear(x, weight, self.bias)


def apply_svd_residual_to_self_attn(model: nn.Module, r: int = 1023) -> nn.Module:
    """
    Recursively traverse model and replace nn.Linear layers inside 'self_attn'
    modules with SVDResidualLinear.
    """
    for name, module in model.named_children():
        if "self_attn" in name:
            for sub_name, sub_module in module.named_modules():
                if isinstance(sub_module, nn.Linear):
                    parent_module = module
                    sub_module_names = sub_name.split(".")
                    for m_name in sub_module_names[:-1]:
                        parent_module = getattr(parent_module, m_name)

                    new_module = SVDResidualLinear(
                        in_features=sub_module.in_features,
                        out_features=sub_module.out_features,
                        r=r,
                        bias=(sub_module.bias is not None),
                        init_weight=sub_module.weight.data.clone(),
                    )
                    if sub_module.bias is not None:
                        new_module.bias.data.copy_(sub_module.bias.data)

                    setattr(parent_module, sub_module_names[-1], new_module)
        else:
            apply_svd_residual_to_self_attn(module, r)

    return model


class EffortDetector(nn.Module):
    """
    Effort Detector Model:
    Vision Transformer (CLIP ViT-L/14) with SVD Residuals + 2-class Classification Head.
    """

    def __init__(self, clip_model_name: str = "openai/clip-vit-large-patch14"):
        super().__init__()
        from transformers import CLIPConfig, CLIPModel

        config = CLIPConfig.from_pretrained(clip_model_name)
        clip_model = CLIPModel(config)

        # Apply SVD residual decomposition to vision backbone self_attn layers
        self.backbone = apply_svd_residual_to_self_attn(
            clip_model.vision_model, r=1023
        )

        # Binary classification head: [Class 0: Authentic, Class 1: Manipulated]
        self.head = nn.Linear(1024, 2)

    def features(self, x: torch.Tensor) -> torch.Tensor:
        vision_output = self.backbone(x)
        return vision_output["pooler_output"]

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        feat = self.features(x)
        return self.head(feat)


class EffortGradCAM:
    """
    Grad-CAM implementation for Vision Transformer (ViT-L/14).

    Hooks the final encoder layer norm (layer_norm1) before MLP/residual,
    computes gradient-weighted token activations (ignoring [CLS] token at index 0),
    reshapes to a 16x16 spatial patch grid, and bilinearly interpolates to 224x224.
    """

    def __init__(self, model: EffortDetector):
        self.model = model
        self.activations: list[torch.Tensor] = []
        self.gradients: list[torch.Tensor] = []
        self.hooks: list = []

    def _register_hooks(self) -> None:
        self.activations.clear()
        self.gradients.clear()

        # Target layer: last transformer block's layer_norm1
        target_layer = self.model.backbone.encoder.layers[-1].layer_norm1

        def forward_hook(module, inp, out):
            self.activations.append(out)

        def backward_hook(module, grad_in, grad_out):
            self.gradients.append(grad_out[0])

        self.hooks.append(target_layer.register_forward_hook(forward_hook))
        self.hooks.append(target_layer.register_full_backward_hook(backward_hook))

    def _remove_hooks(self) -> None:
        for hook in self.hooks:
            hook.remove()
        self.hooks.clear()

    def generate_heatmap(
        self,
        input_tensor: torch.Tensor,
        target_class: int = 1,
        original_rgb: Optional[np.ndarray] = None,
    ) -> Tuple[np.ndarray, Optional[str]]:
        """
        Generate Grad-CAM heatmap for target_class (1 = Manipulated).
        Returns:
            heatmap_224: np.ndarray of shape (224, 224) in range [0.0, 1.0]
            overlay_base64: Optional base64 PNG string if original_rgb is provided
        """
        self._register_hooks()
        try:
            input_tensor.requires_grad_(True)
            self.model.zero_grad()

            logits = self.model(input_tensor)
            score = logits[0, target_class]
            score.backward()

            if not self.activations or not self.gradients:
                raise RuntimeError("Grad-CAM hooks failed to capture activations/gradients")

            act = self.activations[0]  # (1, 257, 1024)
            grad = self.gradients[0]   # (1, 257, 1024)

            # Exclude CLS token at index 0; slice remaining 256 spatial tokens (16x16 grid)
            patch_act = act[:, 1:, :]   # (1, 256, 1024)
            patch_grad = grad[:, 1:, :] # (1, 256, 1024)

            # Weight by mean spatial gradients
            weights = patch_grad.mean(dim=1, keepdim=True)  # (1, 1, 1024)
            cam = (patch_act * weights).sum(dim=-1).squeeze(0)  # (256,)
            cam = torch.clamp(cam, min=0)

            cam_np = cam.detach().cpu().numpy().reshape(16, 16)
            denom = cam_np.max() - cam_np.min()
            if denom > 1e-8:
                cam_norm = (cam_np - cam_np.min()) / denom
            else:
                cam_norm = np.zeros((16, 16), dtype=np.float32)

            heatmap_224 = cv2.resize(cam_norm, (224, 224), interpolation=cv2.INTER_CUBIC)
            heatmap_224 = np.clip(heatmap_224, 0.0, 1.0)

            overlay_base64 = None
            if original_rgb is not None:
                # Resize original to 224x224
                orig_resized = cv2.resize(original_rgb, (224, 224), interpolation=cv2.INTER_LINEAR)
                colored_cam = cv2.applyColorMap(
                    np.uint8(255 * heatmap_224), cv2.COLORMAP_JET
                )
                colored_cam = cv2.cvtColor(colored_cam, cv2.COLOR_BGR2RGB)
                blended = np.uint8(0.6 * orig_resized + 0.4 * colored_cam)

                # Encode to base64 PNG
                is_success, buffer = cv2.imencode(".png", cv2.cvtColor(blended, cv2.COLOR_RGB2BGR))
                if is_success:
                    overlay_base64 = base64.b64encode(buffer).decode("utf-8")

            return heatmap_224, overlay_base64
        finally:
            self._remove_hooks()
