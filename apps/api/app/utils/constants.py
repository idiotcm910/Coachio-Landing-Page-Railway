from enum import Enum
from typing import Dict


# ============================================================================
# Package System
# ============================================================================

class PackageType(str, Enum):
    BASIC = "basic"
    STANDARD = "standard"
    PREMIUM = "premium"


PACKAGES: Dict[str, Dict] = {
    "basic": {
        "id": "basic",
        "name": "Basic",
        "credits": 200,
        "price": 200000,
        "description": "Perfect for getting started",
        "discount": 0,  # percentage off original price
    },
    "standard": {
        "id": "standard",
        "name": "Standard",
        "credits": 600,
        "price": 539000,
        "description": "Great for regular users",
        "discount": 10,  # percentage off original price
    },
    "premium": {
        "id": "premium",
        "name": "Premium",
        "credits": 1300,
        "price": 1149000,
        "description": "Best value for power users",
        "discount": 12,  # percentage off original price
    },
    "ai_tools": {
        "id": "ai_tools",
        "name": "AI Tools",
        "credits": 0,
        "price": 360000,
        "description": "16 AI Tools",
        "discount": 0,  # percentage off original price
    },
}


# ============================================================================
# Unified API Schema Enums (matching frontend)
# ============================================================================

class Provider(str, Enum):
    """Provider enum matching frontend schema"""
    AIVIDEO = "aivideo"
    KIE = "kie"


class TaskType(str, Enum):
    """Task type enum matching frontend schema"""
    IMAGE = "image"
    VIDEO = "video"
    MUSIC = "music"
    AUDIO = "audio"


class TaskStatus(str, Enum):
    """Task status enum matching frontend schema"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class GenerationMode(str, Enum):
    """Generation mode enum matching frontend schema"""
    # Fast modes
    FAST = "fast"
    RELAXED = "relaxed"

    # Standard modes
    STANDARD = "standard"
    DEFAULT = "default"

    # Professional modes
    PROFESSIONAL = "professional"
    PROFESSIONAL_AUDIO = "professional_audio"
    QUALITY = "quality"

    # AI-enhanced modes
    REASON = "reason"

    # Kling 3.0 modes
    STD = "std"
    PRO = "pro"


class AspectRatio(str, Enum):
    """Aspect ratio enum matching frontend schema"""
    AUTO = "auto"
    RATIO_16_9 = "16:9"
    RATIO_9_16 = "9:16"
    RATIO_1_1 = "1:1"
    RATIO_4_3 = "4:3"
    RATIO_3_4 = "3:4"
    RATIO_21_9 = "21:9"
    RATIO_5_4 = "5:4"
    RATIO_3_2 = "3:2"
    RATIO_2_3 = "2:3"
    RATIO_4_5 = "4:5"


class ImageResolution(str, Enum):
    """Image resolution enum matching frontend schema"""
    RES_1K = "1k"
    RES_2K = "2k"
    RES_4K = "4k"
    RES_480P = "480p"
    RES_720P = "720p"
    RES_1080P = "1080p"


class VideoDuration(int, Enum):
    """Video duration enum matching frontend schema"""
    DURATION_3S = 3
    DURATION_4S = 4
    DURATION_5S = 5
    DURATION_6S = 6
    DURATION_7S = 7
    DURATION_8S = 8
    DURATION_9S = 9
    DURATION_10S = 10
    DURATION_11S = 11
    DURATION_12S = 12
    DURATION_13S = 13
    DURATION_14S = 14
    DURATION_15S = 15


class VideoQualityMode(str, Enum):
    """Video quality mode enum for motion control models"""
    MODE_720P = "720p"
    MODE_1080P = "1080p"


class SunoModel(str, Enum):
    """Suno model versions"""
    V4 = "V4"
    V4_5 = "V4_5"
    V4_5PLUS = "V4_5PLUS"
    V4_5ALL = "V4_5ALL"
    V5 = "V5"


class VocalGender(str, Enum):
    """Vocal gender preference for Suno music generation"""
    MALE = "m"
    FEMALE = "f"


class MusicGenerationMode(str, Enum):
    """Music generation modes for Suno"""
    SIMPLE = "simple"    # Non-custom mode (prompt only)
    CUSTOM = "custom"    # Custom mode with full control


# Allowed file extensions and MIME types for images
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
ALLOWED_MIME_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15MB in bytes
