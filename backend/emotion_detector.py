"""Local emotion detection using DeepFace and OpenCV.

This module processes webcam frames locally and returns only emotion labels,
ensuring user privacy by never transmitting image data.
"""

import cv2
import numpy as np
import base64
import logging
from typing import Optional
from deepface import DeepFace

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EmotionDetector:
    """Handles local facial emotion detection."""
    
    # Emotion labels that DeepFace can detect
    EMOTIONS = [
        "angry", "disgust", "fear", "happy", 
        "sad", "surprise", "neutral"
    ]
    
    # Emoji mappings for each emotion
    EMOTION_EMOJIS = {
        "angry": "😠",
        "disgust": "🤢",
        "fear": "😨",
        "happy": "😊",
        "sad": "😢",
        "surprise": "😲",
        "neutral": "😐"
    }
    
    def __init__(self):
        """Initialize the emotion detector."""
        self._model_loaded = False
        self._warm_up()
    
    def _warm_up(self) -> None:
        """Pre-load the model by running a dummy detection."""
        try:
            # Create a dummy image to warm up the model
            dummy_img = np.zeros((48, 48, 3), dtype=np.uint8)
            DeepFace.analyze(
                dummy_img,
                actions=["emotion"],
                enforce_detection=False,
                silent=True
            )
            self._model_loaded = True
            logger.info("Emotion detection model loaded successfully")
        except Exception as e:
            logger.warning(f"Model warm-up failed (will retry on first use): {e}")
    
    def detect_from_base64(self, image_data: str) -> dict:
        """
        Detect emotion from a base64-encoded image.
        
        Args:
            image_data: Base64-encoded image string (with or without data URI prefix)
            
        Returns:
            Dictionary containing:
                - success: bool indicating if detection succeeded
                - emotion: detected emotion label (or "neutral" on failure)
                - confidence: confidence score (0-100)
                - emoji: emoji representation of the emotion
                - all_emotions: dict of all emotion scores (if successful)
        """
        try:
            # Remove data URI prefix if present
            if "," in image_data:
                image_data = image_data.split(",")[1]
            
            # Decode base64 to bytes
            image_bytes = base64.b64decode(image_data)
            
            # Convert to numpy array
            nparr = np.frombuffer(image_bytes, np.uint8)
            
            # Decode image
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                return self._error_response("Failed to decode image")
            
            return self._detect_emotion(frame)
            
        except Exception as e:
            logger.error(f"Error processing base64 image: {e}")
            return self._error_response(str(e))
    
    def _detect_emotion(self, frame: np.ndarray) -> dict:
        """
        Run emotion detection on an OpenCV frame.
        
        Args:
            frame: OpenCV image (BGR format)
            
        Returns:
            Detection result dictionary
        """
        try:
            # Run DeepFace analysis
            results = DeepFace.analyze(
                frame,
                actions=["emotion"],
                enforce_detection=False,
                silent=True
            )
            
            # Handle both single and multiple face results
            if isinstance(results, list):
                if len(results) == 0:
                    return self._error_response("No face detected")
                result = results[0]
            else:
                result = results
            
            # Extract emotion data
            emotions = result.get("emotion", {})
            dominant_emotion = result.get("dominant_emotion", "neutral")
            confidence = emotions.get(dominant_emotion, 0)
            
            return {
                "success": True,
                "emotion": dominant_emotion,
                "confidence": round(float(confidence), 2),
                "emoji": self.EMOTION_EMOJIS.get(dominant_emotion, "😐"),
                "all_emotions": {k: round(float(v), 2) for k, v in emotions.items()}
            }
            
        except Exception as e:
            logger.error(f"Emotion detection failed: {e}")
            return self._error_response(str(e))
    
    def _error_response(self, error_msg: str) -> dict:
        """Generate a standardized error response."""
        return {
            "success": False,
            "emotion": "neutral",
            "confidence": 0,
            "emoji": "😐",
            "error": error_msg
        }
    
    @classmethod
    def get_emoji(cls, emotion: str) -> str:
        """Get emoji for a given emotion label."""
        return cls.EMOTION_EMOJIS.get(emotion.lower(), "😐")


# Singleton instance for reuse
_detector_instance: Optional[EmotionDetector] = None


def get_detector() -> EmotionDetector:
    """Get or create the singleton EmotionDetector instance."""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = EmotionDetector()
    return _detector_instance
