from app.vision.detector import Detector, DetectionResult
import numpy as np
import cv2
import logging

logger = logging.getLogger(__name__)

class ModelAdapter:
    def __init__(self, detector: Detector):
        self.detector = detector

    def predict(self, frame: np.ndarray, required_ppe: list[str] | None = None) -> list[DetectionResult]:
        if frame is None or frame.size == 0:
            return []

        # 1. Neural model detections
        detections = self.detector.predict(frame)
        
        persons = [d for d in detections if d.class_name == 'person']
        ppe_masks = [d for d in detections if d.class_name == 'mask']
        ppe_vests = [d for d in detections if d.class_name == 'vest']
        ppe_helmets = [d for d in detections if d.class_name == 'helmet']
        ppe_gloves = [d for d in detections if d.class_name == 'gloves']

        # 2. Hybrid computer-vision enhancement for Face Masks
        # Analyzes mouth/nose region of detected persons for surgical, N95, or dark cloth face coverings
        if not ppe_masks and persons:
            mask_detections = self.detect_masks_for_persons(frame, persons)
            detections.extend(mask_detections)

        # 3. Hybrid computer-vision enhancement for High-Visibility Safety Vests
        # Analyzes upper body for fluorescent neon safety colors (hi-vis yellow, neon lime, safety orange)
        if not ppe_vests and persons:
            vest_detections = self.detect_vests_for_persons(frame, persons)
            detections.extend(vest_detections)

        # 4. Cleanroom / Sanitary sterile gloves analysis
        if required_ppe and ("gloves" in required_ppe) and not ppe_gloves:
            glove_results = self.detect_gloves_for_persons(frame, persons)
            detections.extend(glove_results)

        return detections

    def detect_masks_for_persons(self, frame: np.ndarray, persons: list[DetectionResult]) -> list[DetectionResult]:
        """
        Detects medical face masks (surgical blue/teal, white N95, dark black protective masks)
        on the lower half of a person's head region.
        """
        results = []
        h_img, w_img = frame.shape[:2]

        for p in persons:
            px1, py1, px2, py2 = p.bbox
            pw = max(1, px2 - px1)
            ph = max(1, py2 - py1)

            # Head region estimation
            hx1 = max(0, px1 + int(pw * 0.22))
            hy1 = max(0, py1 + int(ph * 0.04))
            hx2 = min(w_img, px2 - int(pw * 0.22))
            hy2 = min(h_img, py1 + int(ph * 0.38))

            if hx2 <= hx1 + 15 or hy2 <= hy1 + 15:
                continue

            # Lower half of face (nose & mouth covering area)
            my1 = hy1 + int((hy2 - hy1) * 0.40)
            my2 = hy2
            mx1 = hx1
            mx2 = hx2

            patch = frame[my1:my2, mx1:mx2]
            if patch.size == 0:
                continue

            hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)
            ycrcb = cv2.cvtColor(patch, cv2.COLOR_BGR2YCrCb)
            total_pixels = max(1, patch.shape[0] * patch.shape[1])

            # Measure bare human skin
            skin_ycrcb = cv2.inRange(ycrcb, np.array([0, 133, 77]), np.array([255, 173, 127]))
            skin_hsv = cv2.inRange(hsv, np.array([0, 20, 40]), np.array([25, 230, 255]))
            skin_mask = cv2.bitwise_and(skin_ycrcb, skin_hsv)
            skin_ratio = cv2.countNonZero(skin_mask) / float(total_pixels)

            # Surgical Blue / Cyan mask
            blue_mask = cv2.inRange(hsv, np.array([75, 30, 40]), np.array([135, 255, 255]))
            # White / Off-white N95 mask
            white_mask = cv2.inRange(hsv, np.array([0, 0, 170]), np.array([180, 45, 255]))
            # Black cloth mask
            black_mask = cv2.inRange(hsv, np.array([0, 0, 0]), np.array([180, 255, 50]))

            mask_total = cv2.bitwise_or(blue_mask, cv2.bitwise_or(white_mask, black_mask))
            mask_ratio = cv2.countNonZero(mask_total) / float(total_pixels)

            # If the mouth/nose area has substantial mask material coverage and low exposed skin
            if mask_ratio > 0.35 and skin_ratio < 0.30:
                conf = min(0.96, round(0.60 + (mask_ratio * 0.35), 2))
                results.append(DetectionResult(
                    class_name='mask',
                    confidence=conf,
                    bbox=(mx1, my1, mx2, my2),
                    track_id=p.track_id
                ))
            elif skin_ratio > 0.45:
                # Clear bare mouth/face detected with no mask
                conf = min(0.94, round(0.55 + (skin_ratio * 0.35), 2))
                results.append(DetectionResult(
                    class_name='no_mask',
                    confidence=conf,
                    bbox=(mx1, my1, mx2, my2),
                    track_id=p.track_id
                ))

        return results

    def detect_vests_for_persons(self, frame: np.ndarray, persons: list[DetectionResult]) -> list[DetectionResult]:
        """
        Detects fluorescent high-visibility safety vests (neon lime yellow, bright orange)
        across a worker's torso region.
        """
        results = []
        h_img, w_img = frame.shape[:2]

        for p in persons:
            px1, py1, px2, py2 = p.bbox
            pw = max(1, px2 - px1)
            ph = max(1, py2 - py1)

            # Torso region
            vx1 = max(0, px1 + int(pw * 0.12))
            vy1 = max(0, py1 + int(ph * 0.28))
            vx2 = min(w_img, px2 - int(pw * 0.12))
            vy2 = min(h_img, py1 + int(ph * 0.82))

            if vx2 <= vx1 + 20 or vy2 <= vy1 + 20:
                continue

            patch = frame[vy1:vy2, vx1:vx2]
            if patch.size == 0:
                continue

            hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)
            total_pixels = max(1, patch.shape[0] * patch.shape[1])

            # Fluorescent hi-vis yellow/lime: H 25-55, S 70-255, V 90-255
            hi_vis_yellow = cv2.inRange(hsv, np.array([25, 70, 90]), np.array([55, 255, 255]))
            # Fluorescent safety neon orange: H 5-22, S 110-255, V 110-255
            hi_vis_orange = cv2.inRange(hsv, np.array([5, 110, 110]), np.array([22, 255, 255]))

            vest_mask = cv2.bitwise_or(hi_vis_yellow, hi_vis_orange)
            vest_ratio = cv2.countNonZero(vest_mask) / float(total_pixels)

            if vest_ratio > 0.18:
                conf = min(0.98, round(0.65 + (vest_ratio * 0.3), 2))
                results.append(DetectionResult(
                    class_name='vest',
                    confidence=conf,
                    bbox=(vx1, vy1, vx2, vy2),
                    track_id=p.track_id
                ))

        return results

    def detect_gloves_for_persons(self, frame: np.ndarray, persons: list[DetectionResult]) -> list[DetectionResult]:
        """
        Detects medical/cleanroom nitrile or latex gloves (cyan, blue, purple) vs bare skin on hands.
        """
        results = []
        if frame is None or len(persons) == 0:
            return results

        h_img, w_img = frame.shape[:2]

        for p in persons:
            x1, y1, x2, y2 = p.bbox
            pw = max(1, x2 - x1)
            ph = max(1, y2 - y1)

            hand_boxes = [
                # Left hand region
                (max(0, x1 - int(pw * 0.05)), min(h_img, y1 + int(ph * 0.45)), min(w_img, x1 + int(pw * 0.38)), min(h_img, y1 + int(ph * 0.88))),
                # Right hand region
                (max(0, x2 - int(pw * 0.38)), min(h_img, y1 + int(ph * 0.45)), min(w_img, x2 + int(pw * 0.05)), min(h_img, y1 + int(ph * 0.88))),
                # Center workstation hands region
                (max(0, x1 + int(pw * 0.22)), min(h_img, y1 + int(ph * 0.48)), min(w_img, x2 - int(pw * 0.22)), min(h_img, y1 + int(ph * 0.82)))
            ]

            detected_for_person = False
            for hx1, hy1, hx2, hy2 in hand_boxes:
                if detected_for_person:
                    break
                if hx2 <= hx1 + 10 or hy2 <= hy1 + 10:
                    continue

                patch = frame[hy1:hy2, hx1:hx2]
                if patch.size == 0:
                    continue

                hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)
                total_pixels = max(1, patch.shape[0] * patch.shape[1])

                blue_mask = cv2.inRange(hsv, np.array([80, 40, 40]), np.array([135, 255, 255]))
                purple_mask = cv2.inRange(hsv, np.array([135, 35, 35]), np.array([168, 255, 255]))
                glove_mask = cv2.bitwise_or(blue_mask, purple_mask)
                glove_ratio = cv2.countNonZero(glove_mask) / float(total_pixels)

                if glove_ratio > 0.07:
                    conf = min(0.95, round(0.55 + glove_ratio, 2))
                    results.append(DetectionResult(
                        class_name='gloves',
                        confidence=conf,
                        bbox=(hx1, hy1, hx2, hy2),
                        track_id=p.track_id
                    ))
                    detected_for_person = True

        return results

    def get_persons(self, detections: list[DetectionResult]) -> list[DetectionResult]:
        return [d for d in detections if d.class_name == 'person']

    def get_ppe_items(self, detections: list[DetectionResult]) -> list[DetectionResult]:
        ppe_classes = ['helmet', 'vest', 'mask', 'gloves']
        return [d for d in detections if d.class_name in ppe_classes]

    def get_violations(self, detections: list[DetectionResult]) -> list[DetectionResult]:
        violation_classes = ['no_helmet', 'no_vest', 'no_mask', 'no_gloves']
        return [d for d in detections if d.class_name in violation_classes]

    def annotate_frame(self, frame: np.ndarray, detections: list[DetectionResult]) -> np.ndarray:
        annotated = frame.copy()
        
        for d in detections:
            color = (0, 255, 255) # yellow default
            if d.class_name in ['helmet', 'vest', 'mask', 'gloves']:
                color = (0, 220, 50) # vibrant green for compliant PPE
            elif d.class_name in ['no_helmet', 'no_vest', 'no_mask', 'no_gloves']:
                color = (0, 0, 255) # red for violations
            elif d.class_name == 'person':
                color = (255, 165, 0) # cyan/blue for worker
                
            x1, y1, x2, y2 = d.bbox
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            
            # Label
            label_name = d.class_name.replace('_', ' ')
            label = f"{label_name} {d.confidence:.2f}"
            if d.track_id is not None:
                label = f"#{d.track_id} {label}"
                
            cv2.putText(annotated, label, (x1, max(15, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
            
        return annotated
