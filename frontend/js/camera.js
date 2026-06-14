/**
 * CameraManager - Handles webcam capture and local emotion detection.
 * 
 * Privacy-first design: All camera processing happens locally.
 * Only emotion labels (strings like "happy") are ever extracted - 
 * no images or video data leaves the user's device.
 */

const CameraManager = (function() {
    'use strict';

    // DOM elements
    let videoElement = null;
    let canvasElement = null;
    let stream = null;

    // State
    let isRunning = false;
    let detectionInterval = null;
    let currentEmotion = { emotion: 'neutral', emoji: '😐', confidence: 0 };

    // Configuration
    const CONFIG = {
        detectionIntervalMs: 1000,  // How often to run detection
        videoConstraints: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
        }
    };

    // Callbacks
    let onEmotionDetected = null;
    let onError = null;

    /**
     * Initialize the camera manager.
     * @param {Object} options - Configuration options
     * @param {HTMLVideoElement} options.videoElement - Video element for preview
     * @param {HTMLCanvasElement} options.canvasElement - Canvas for frame capture
     * @param {Function} options.onEmotionDetected - Callback when emotion is detected
     * @param {Function} options.onError - Callback for errors
     */
    function init(options) {
        videoElement = options.videoElement || document.getElementById('camera-preview');
        canvasElement = options.canvasElement || document.getElementById('camera-canvas');
        onEmotionDetected = options.onEmotionDetected || (() => {});
        onError = options.onError || console.error;

        if (!videoElement || !canvasElement) {
            throw new Error('Video and canvas elements are required');
        }
    }

    /**
     * Request camera access and start the video stream.
     * @returns {Promise<boolean>} Whether camera was successfully started
     */
    async function startCamera() {
        if (isRunning) return true;

        try {
            // Request camera permission
            stream = await navigator.mediaDevices.getUserMedia({
                video: CONFIG.videoConstraints,
                audio: false
            });

            // Attach stream to video element
            videoElement.srcObject = stream;
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                videoElement.onloadedmetadata = () => {
                    videoElement.play();
                    resolve();
                };
            });

            // Set canvas dimensions to match video
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;

            isRunning = true;
            startDetectionLoop();

            console.log('Camera started successfully');
            return true;

        } catch (error) {
            console.error('Failed to start camera:', error);
            onError(getCameraErrorMessage(error));
            return false;
        }
    }

    /**
     * Stop the camera and release resources.
     */
    function stopCamera() {
        if (detectionInterval) {
            clearInterval(detectionInterval);
            detectionInterval = null;
        }

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }

        if (videoElement) {
            videoElement.srcObject = null;
        }

        isRunning = false;
        console.log('Camera stopped');
    }

    /**
     * Start the emotion detection loop.
     */
    function startDetectionLoop() {
        if (detectionInterval) return;

        detectionInterval = setInterval(async () => {
            if (!isRunning) return;

            const frameData = captureFrame();
            if (!frameData) return;

            const result = await EmotionBridge.detectEmotion(frameData);
            
            if (result && result.emotion) {
                currentEmotion = {
                    emotion: result.emotion,
                    emoji: result.emoji || EmotionBridge.getEmoji(result.emotion),
                    confidence: result.confidence || 0
                };
                onEmotionDetected(currentEmotion);
            }
        }, CONFIG.detectionIntervalMs);
    }

    /**
     * Capture a single frame from the video as base64.
     * @returns {string|null} Base64-encoded image data
     */
    function captureFrame() {
        if (!isRunning || !videoElement || !canvasElement) return null;

        const ctx = canvasElement.getContext('2d');
        
        // Draw the current video frame to canvas
        ctx.drawImage(
            videoElement, 
            0, 0, 
            canvasElement.width, 
            canvasElement.height
        );

        // Convert to base64 (JPEG for smaller size)
        return canvasElement.toDataURL('image/jpeg', 0.8);
    }

    /**
     * Get the current detected emotion.
     * @returns {Object} Current emotion data
     */
    function getCurrentEmotion() {
        return { ...currentEmotion };
    }

    /**
     * Check if camera is currently running.
     * @returns {boolean}
     */
    function isCameraRunning() {
        return isRunning;
    }

    /**
     * Check if browser supports camera access.
     * @returns {boolean}
     */
    function isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    /**
     * Get user-friendly error message for camera errors.
     * @param {Error} error - The error object
     * @returns {string} User-friendly error message
     */
    function getCameraErrorMessage(error) {
        switch (error.name) {
            case 'NotAllowedError':
            case 'PermissionDeniedError':
                return 'Camera permission denied. Please allow camera access to use emotion detection.';
            case 'NotFoundError':
            case 'DevicesNotFoundError':
                return 'No camera found. Please connect a webcam to use emotion detection.';
            case 'NotReadableError':
            case 'TrackStartError':
                return 'Camera is in use by another application. Please close other apps using the camera.';
            case 'OverconstrainedError':
                return 'Camera does not meet the required specifications.';
            default:
                return `Camera error: ${error.message}`;
        }
    }

    /**
     * Manually trigger a single emotion detection.
     * @returns {Promise<Object>} Detection result
     */
    async function detectOnce() {
        const frameData = captureFrame();
        if (!frameData) {
            return { emotion: 'neutral', emoji: '😐', confidence: 0 };
        }

        const result = await EmotionBridge.detectEmotion(frameData);
        
        if (result && result.emotion) {
            currentEmotion = {
                emotion: result.emotion,
                emoji: result.emoji || EmotionBridge.getEmoji(result.emotion),
                confidence: result.confidence || 0
            };
        }

        return currentEmotion;
    }

    // Public API
    return {
        init,
        startCamera,
        stopCamera,
        captureFrame,
        getCurrentEmotion,
        isCameraRunning,
        isSupported,
        detectOnce
    };

})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CameraManager;
}
