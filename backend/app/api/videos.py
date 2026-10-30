from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import User
from app.core.security import get_current_user
from app.api.schemas import VideoUploadResponse
from app.core.config import settings
from pydantic import BaseModel
from typing import Optional, List
import os
import uuid
import shutil
import base64
import time
import numpy as np
import cv2
import logging
from app.vision.detector import get_detector, DetectionResult
from app.vision.adapter import ModelAdapter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/videos", tags=["videos"])

ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}

class FrameDetectRequest(BaseModel):
    frame_base64: str
    camera_id: Optional[int] = None
    required_ppe: Optional[List[str]] = None

@router.post("/detect-frame")
def detect_frame(payload: FrameDetectRequest, current_user: User = Depends(get_current_user)):
    t0 = time.time()
    raw = payload.frame_base64
    if "," in raw:
        raw = raw.split(",", 1)[1]
    
    try:
        img_bytes = base64.b64decode(raw)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode base64 frame: {e}")

    if frame is None:
        raise HTTPException(status_code=400, detail="Could not parse image bytes into frame")

    h, w = frame.shape[:2]

    detector = get_detector(
        repo_id=settings.model_repo_id,
        revision=settings.model_revision,
        person_conf=settings.person_confidence,
        ppe_conf=settings.ppe_confidence
    )
    adapter = ModelAdapter(detector)
    req_ppe = payload.required_ppe or ["helmet", "vest"]
    
    # Run AI inference
    detections = adapter.predict(frame, required_ppe=req_ppe)
    
    # Check if a person is present without a detected helmet/vest
    head_violations = []
    persons = [d for d in detections if d.class_name == 'person']
    helmets = [d for d in detections if d.class_name in ['helmet', 'Hardhat']]
    no_helmets = [d for d in detections if d.class_name in ['no_helmet', 'NO-Hardhat']]

    for p in persons:
        px1, py1, px2, py2 = p.bbox
        pw = px2 - px1
        ph = py2 - py1
        
        # If helmet required, and neither helmet nor direct no_helmet was detected on head, synthesize no_helmet badge
        if "helmet" in req_ppe and not helmets and not no_helmets:
            head_violations.append(DetectionResult(
                class_name="no_helmet",
                confidence=0.88,
                bbox=(px1 + int(pw * 0.15), py1, px2 - int(pw * 0.15), py1 + int(ph * 0.32)),
                track_id=p.track_id
            ))

    all_detections = detections + head_violations
    latency_ms = round((time.time() - t0) * 1000, 1)

    return {
        "detections": [
            {
                "class_name": d.class_name,
                "confidence": round(d.confidence, 2),
                "bbox": [float(c) for c in d.bbox],
                "track_id": d.track_id
            }
            for d in all_detections
        ],
        "metrics": {
            "fps": round(1000.0 / latency_ms, 1) if latency_ms > 0 else 30.0,
            "latency_ms": latency_ms,
            "detections_count": len(all_detections),
            "frame_width": w,
            "frame_height": h
        }
    }

@router.post("/upload", response_model=VideoUploadResponse)
async def upload_video(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file extension. Allowed: {ALLOWED_EXTENSIONS}")
        
    upload_directory = getattr(settings, 'upload_dir', './storage/uploads')
    os.makedirs(upload_directory, exist_ok=True)
    
    new_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(upload_directory, new_filename)
    
    size_bytes = 0
    max_mb = getattr(settings, 'max_upload_mb', 500)
    
    with open(file_path, "wb") as buffer:
        while content := await file.read(1024 * 1024):
            size_bytes += len(content)
            if size_bytes > max_mb * 1024 * 1024:
                buffer.close()
                if os.path.exists(file_path):
                    os.remove(file_path)
                raise HTTPException(status_code=400, detail="File too large.")
            buffer.write(content)
            
    return VideoUploadResponse(
        filename=new_filename,
        file_path=file_path,
        size_mb=size_bytes / (1024 * 1024),
        session_id=None
    )

@router.get("/uploads")
def list_uploads(current_user: User = Depends(get_current_user)):
    upload_directory = getattr(settings, 'upload_dir', './storage/uploads')
    if not os.path.exists(upload_directory):
        return []
    
    files = []
    for f in os.listdir(upload_directory):
        path = os.path.join(upload_directory, f)
        if os.path.isfile(path):
            files.append({
                "filename": f,
                "size_mb": os.path.getsize(path) / (1024 * 1024)
            })
    return files
