from dataclasses import dataclass, field
from typing import Protocol, Optional
import numpy as np
import logging
logger = logging.getLogger(__name__)

@dataclass
class DetectionResult:
    class_name: str
    confidence: float
    bbox: tuple[int, int, int, int]  # x1, y1, x2, y2
    track_id: int | None = None

class Detector(Protocol):
    def predict(self, frame: np.ndarray) -> list[DetectionResult]: ...
    def get_labels(self) -> dict[int, str]: ...
    def is_ready(self) -> bool: ...
    def get_model_info(self) -> dict: ...

# Canonical map mapping model classes to platform standard classes
CANONICAL_LABELS = {
    'Hardhat': 'helmet', 'Hard_hat': 'helmet', 'Helmet': 'helmet',
    'Safety Vest': 'vest', 'Vest': 'vest',
    'Mask': 'mask',
    'NO-Hardhat': 'no_helmet', 'No-Helmet': 'no_helmet', 'No-Hard_hat': 'no_helmet',
    'NO-Safety Vest': 'no_vest', 'No-Vest': 'no_vest',
    'NO-Mask': 'no_mask', 'No-Mask': 'no_mask',
    'Person': 'person', 'Worker': 'person',
    'Safety Cone': 'safety_cone',
    'Glove': 'gloves', 'gloves': 'gloves',
    'No-Glove': 'no_gloves',
    'machinery': 'machinery', 'vehicle': 'vehicle'
}

class YOLOv8Detector:
    _instance = None

    def __init__(self, repo_id: str = "killuminati1/construction-ppe-yolov8", revision: Optional[str] = None, person_conf: float = 0.25, ppe_conf: float = 0.22):
        self.repo_id = repo_id
        self.revision = revision if revision else None
        self.person_conf = person_conf
        self.ppe_conf = ppe_conf
        self.model = None
        self.fallback_model = None
        self.ready = False
        
        # Load primary robust PPE model
        try:
            from huggingface_hub import hf_hub_download
            from ultralytics import YOLO

            logger.info(f"Loading primary PPE detector: {self.repo_id}")
            model_path = hf_hub_download(repo_id=self.repo_id, filename="best.pt", revision=self.revision)
            self.model = YOLO(model_path)
            self.ready = True
            logger.info(f"Primary YOLO model loaded from {model_path}")
        except Exception as e:
            logger.error(f"Failed to load primary model {self.repo_id}: {e}")
            try:
                # Fallback to secondary model if network or repository unavailable
                from huggingface_hub import hf_hub_download
                from ultralytics import YOLO
                fb_path = hf_hub_download(repo_id="Hansung-Cho/yolov8-ppe-detection", filename="best.pt")
                self.model = YOLO(fb_path)
                self.ready = True
                logger.info(f"Loaded fallback model from {fb_path}")
            except Exception as e2:
                logger.error(f"Failed to load fallback model: {e2}")
                self.ready = False

    def predict(self, frame: np.ndarray) -> list[DetectionResult]:
        if not self.ready or self.model is None or frame is None:
            return []
        
        # Run inference with sensitive threshold to catch PPE items accurately
        results = self.model(frame, conf=0.18, verbose=False)
        detections = []
        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                class_name = self.model.names[cls_id]
                canon_name = CANONICAL_LABELS.get(class_name, class_name)
                
                # Filter by confidence
                if canon_name == 'person' and conf < self.person_conf:
                    continue
                elif canon_name != 'person' and conf < self.ppe_conf:
                    continue
                
                detections.append(DetectionResult(
                    class_name=canon_name,
                    confidence=conf,
                    bbox=(x1, y1, x2, y2)
                ))
        return detections

    def get_labels(self) -> dict[int, str]:
        if not self.ready or self.model is None:
            return {}
        return self.model.names

    def is_ready(self) -> bool:
        return self.ready

    def get_model_info(self) -> dict:
        return {
            "repo_id": self.repo_id,
            "revision": self.revision,
            "ready": self.ready
        }

def get_detector(repo_id: str = "killuminati1/construction-ppe-yolov8", revision: Optional[str] = None, person_conf: float = 0.25, ppe_conf: float = 0.22) -> YOLOv8Detector:
    if YOLOv8Detector._instance is None:
        YOLOv8Detector._instance = YOLOv8Detector(repo_id, revision, person_conf, ppe_conf)
    return YOLOv8Detector._instance
