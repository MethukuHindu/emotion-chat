/**
 * EmotionBridge - Handles communication with the emotion detection backend.
 * 
 * This module sends base64-encoded images to the local server for emotion analysis.
 * Only emotion labels are returned and used - images are never stored or forwarded.
 */

const EmotionBridge = (function() {
    'use strict';

    const API_ENDPOINT = '/api/detect-emotion';
    
    // Emotion emoji mappings (fallback if server doesn't provide)
    const EMOTION_EMOJIS = {
        angry: '😠',
        disgust: '🤢',
        fear: '😨',
        happy: '😊',
        sad: '😢',
        surprise: '😲',
        neutral: '😐'
    };

    // Rate limiting
    let lastDetectionTime = 0;
    const MIN_DETECTION_INTERVAL = 500; // ms between detections

    /**
     * Detect emotion from a base64-encoded image.
     * @param {string} base64Image - Base64-encoded image data
     * @returns {Promise<Object>} Detection result with emotion, confidence, emoji
     */
    async function detectEmotion(base64Image) {
        // Rate limiting
        const now = Date.now();
        if (now - lastDetectionTime < MIN_DETECTION_INTERVAL) {
            return null;
        }
        lastDetectionTime = now;

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ image: base64Image })
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const result = await response.json();
            
            // Ensure emoji is present
            if (!result.emoji && result.emotion) {
                result.emoji = EMOTION_EMOJIS[result.emotion] || '😐';
            }

            return result;

        } catch (error) {
            console.error('Emotion detection failed:', error);
            return {
                success: false,
                emotion: 'neutral',
                confidence: 0,
                emoji: '😐',
                error: error.message
            };
        }
    }

    /**
     * Get emoji for a given emotion label.
     * @param {string} emotion - Emotion label
     * @returns {string} Corresponding emoji
     */
    function getEmoji(emotion) {
        return EMOTION_EMOJIS[emotion?.toLowerCase()] || '😐';
    }

    /**
     * Get all available emotions.
     * @returns {string[]} Array of emotion labels
     */
    function getEmotions() {
        return Object.keys(EMOTION_EMOJIS);
    }

    // Public API
    return {
        detectEmotion,
        getEmoji,
        getEmotions,
        EMOTION_EMOJIS
    };

})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmotionBridge;
}
