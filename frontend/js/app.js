/**
 * EmotiChat - Main Application
 * 
 * Privacy-preserving emotion-aware messaging system.
 * Emotions are detected locally; only text labels are transmitted.
 */

(function() {
    'use strict';

    // ========================================================================
    // State Management
    // ========================================================================

    const state = {
        socket: null,
        userId: null,
        username: null,
        currentEmotion: { emotion: 'neutral', emoji: '😐' },
        isConnected: false,
        isCameraEnabled: false,
        typingTimeout: null,
        isTyping: false
    };

    // ========================================================================
    // DOM Elements
    // ========================================================================

    const elements = {
        // Screens
        loginScreen: document.getElementById('login-screen'),
        chatScreen: document.getElementById('chat-screen'),
        
        // Login
        loginForm: document.getElementById('login-form'),
        usernameInput: document.getElementById('username-input'),
        
        // Header
        userCount: document.getElementById('user-count'),
        cameraToggle: document.getElementById('camera-toggle'),
        logoutBtn: document.getElementById('logout-btn'),
        
        // Messages
        messagesContainer: document.getElementById('messages-container'),
        messagesList: document.getElementById('messages-list'),
        typingIndicator: document.getElementById('typing-indicator'),
        
        // Camera
        cameraSidebar: document.getElementById('camera-sidebar'),
        cameraPreview: document.getElementById('camera-preview'),
        cameraCanvas: document.getElementById('camera-canvas'),
        closeCamera: document.getElementById('close-camera'),
        currentEmotionDisplay: document.getElementById('current-emotion'),
        emotionLabel: document.getElementById('emotion-label'),
        emotionConfidence: document.getElementById('emotion-confidence'),
        
        // Input
        emotionBadge: document.getElementById('emotion-badge'),
        inputEmotion: document.getElementById('input-emotion'),
        messageInput: document.getElementById('message-input'),
        sendBtn: document.getElementById('send-btn'),
        
        // Modal
        cameraModal: document.getElementById('camera-modal'),
        allowCamera: document.getElementById('allow-camera'),
        denyCamera: document.getElementById('deny-camera'),
        
        // Toast
        toastContainer: document.getElementById('toast-container')
    };

    // ========================================================================
    // Initialization
    // ========================================================================

    function init() {
        // Generate a unique user ID
        state.userId = generateUserId();
        
        // Initialize camera manager
        CameraManager.init({
            videoElement: elements.cameraPreview,
            canvasElement: elements.cameraCanvas,
            onEmotionDetected: handleEmotionDetected,
            onError: (msg) => showToast(msg, 'error')
        });
        
        // Set up event listeners
        setupEventListeners();
        
        console.log('EmotiChat initialized');
    }

    function setupEventListeners() {
        // Login form
        elements.loginForm.addEventListener('submit', handleLogin);
        
        // Header buttons
        elements.cameraToggle.addEventListener('click', toggleCamera);
        elements.logoutBtn.addEventListener('click', handleLogout);
        elements.closeCamera.addEventListener('click', () => toggleCameraSidebar(false));
        
        // Message input
        elements.messageInput.addEventListener('input', handleInputChange);
        elements.messageInput.addEventListener('keypress', handleKeyPress);
        elements.sendBtn.addEventListener('click', sendMessage);
        
        // Camera modal
        elements.allowCamera.addEventListener('click', handleAllowCamera);
        elements.denyCamera.addEventListener('click', handleDenyCamera);
    }

    // ========================================================================
    // Authentication
    // ========================================================================

    function handleLogin(e) {
        e.preventDefault();
        
        const username = elements.usernameInput.value.trim();
        if (!username) {
            showToast('Please enter your name', 'error');
            return;
        }
        
        state.username = username;
        
        // Connect to server
        connectSocket();
        
        // Switch to chat screen
        switchScreen('chat');
        
        // Show camera permission modal if camera is supported
        if (CameraManager.isSupported()) {
            showCameraModal();
        }
    }

    function handleLogout() {
        // Disconnect socket
        if (state.socket) {
            state.socket.emit('leave');
            state.socket.disconnect();
        }
        
        // Stop camera
        CameraManager.stopCamera();
        
        // Reset state
        state.socket = null;
        state.isConnected = false;
        state.isCameraEnabled = false;
        
        // Clear messages
        elements.messagesList.innerHTML = '';
        
        // Switch to login screen
        switchScreen('login');
        
        showToast('You have left the chat');
    }

    // ========================================================================
    // Socket.IO Connection
    // ========================================================================

    function connectSocket() {
        state.socket = io({
            transports: ['websocket', 'polling']
        });

        state.socket.on('connect', () => {
            console.log('Connected to server');
            state.isConnected = true;
            
            // Join the chat
            state.socket.emit('join', {
                username: state.username,
                user_id: state.userId
            });
        });

        state.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            state.isConnected = false;
            showToast('Connection lost. Reconnecting...', 'error');
        });

        state.socket.on('chat_history', (data) => {
            // Clear existing messages
            elements.messagesList.innerHTML = '';
            
            // Add historical messages
            data.messages.forEach(msg => addMessage(msg, false));
            scrollToBottom();
        });

        state.socket.on('new_message', (data) => {
            addMessage(data.message, true);
        });

        state.socket.on('user_joined', (data) => {
            addSystemMessage(`${data.user.username} joined the chat`);
        });

        state.socket.on('user_left', (data) => {
            addSystemMessage(`${data.user.username} left the chat`);
        });

        state.socket.on('users_updated', (data) => {
            elements.userCount.textContent = data.users.length;
        });

        state.socket.on('user_typing', (data) => {
            if (data.is_typing) {
                elements.typingIndicator.classList.remove('hidden');
            } else {
                elements.typingIndicator.classList.add('hidden');
            }
        });

        state.socket.on('error', (data) => {
            showToast(data.message, 'error');
        });
    }

    // ========================================================================
    // Messages
    // ========================================================================

    function sendMessage() {
        const text = elements.messageInput.value.trim();
        if (!text || !state.isConnected) return;

        // Get current emotion
        const emotion = state.currentEmotion.emotion;

        // Send message through socket
        state.socket.emit('send_message', {
            text: text,
            emotion: emotion,
            sender_id: state.userId
        });

        // Clear input
        elements.messageInput.value = '';
        elements.sendBtn.disabled = true;
        
        // Stop typing indicator
        sendTypingStatus(false);
    }

    function addMessage(message, animate = true) {
        const isSent = message.sender_id === state.userId;
        const emoji = EmotionBridge.getEmoji(message.emotion);
        
        const messageEl = document.createElement('div');
        messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
        if (animate) {
            messageEl.style.animation = 'messageIn 0.2s ease';
        }

        const time = formatTime(message.timestamp);
        
        // Find username from message or use default
        const senderName = isSent ? 'You' : (message.sender_name || message.sender_id.slice(0, 8));

        messageEl.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${escapeHtml(senderName)}</span>
                <span class="message-emotion" title="${message.emotion}">${emoji}</span>
            </div>
            <div class="message-bubble">
                <div class="message-text">${escapeHtml(message.text)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;

        elements.messagesList.appendChild(messageEl);
        
        if (animate) {
            scrollToBottom();
        }
    }

    function addSystemMessage(text) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message system';
        messageEl.innerHTML = `
            <div class="message-bubble">
                ${escapeHtml(text)}
            </div>
        `;
        elements.messagesList.appendChild(messageEl);
        scrollToBottom();
    }

    // ========================================================================
    // Input Handling
    // ========================================================================

    function handleInputChange() {
        const hasText = elements.messageInput.value.trim().length > 0;
        elements.sendBtn.disabled = !hasText;
        
        // Send typing status
        if (hasText && !state.isTyping) {
            sendTypingStatus(true);
        }
        
        // Clear existing timeout
        if (state.typingTimeout) {
            clearTimeout(state.typingTimeout);
        }
        
        // Set timeout to stop typing indicator
        state.typingTimeout = setTimeout(() => {
            sendTypingStatus(false);
        }, 2000);
    }

    function handleKeyPress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    function sendTypingStatus(isTyping) {
        if (state.isTyping === isTyping) return;
        
        state.isTyping = isTyping;
        
        if (state.socket && state.isConnected) {
            state.socket.emit('typing', {
                user_id: state.userId,
                is_typing: isTyping
            });
        }
    }

    // ========================================================================
    // Camera & Emotion Detection
    // ========================================================================

    function showCameraModal() {
        elements.cameraModal.classList.remove('hidden');
    }

    function hideCameraModal() {
        elements.cameraModal.classList.add('hidden');
    }

    async function handleAllowCamera() {
        hideCameraModal();
        
        const started = await CameraManager.startCamera();
        
        if (started) {
            state.isCameraEnabled = true;
            toggleCameraSidebar(true);
            showToast('Camera enabled! Your emotion will be detected locally.', 'success');
        }
    }

    function handleDenyCamera() {
        hideCameraModal();
        showToast('Emotion detection disabled. You can enable it later.');
    }

    async function toggleCamera() {
        if (state.isCameraEnabled) {
            CameraManager.stopCamera();
            state.isCameraEnabled = false;
            toggleCameraSidebar(false);
            
            // Reset emotion to neutral
            state.currentEmotion = { emotion: 'neutral', emoji: '😐' };
            updateEmotionDisplay();
        } else {
            const started = await CameraManager.startCamera();
            if (started) {
                state.isCameraEnabled = true;
                toggleCameraSidebar(true);
            }
        }
    }

    function toggleCameraSidebar(show) {
        if (show) {
            elements.cameraSidebar.classList.remove('hidden');
        } else {
            elements.cameraSidebar.classList.add('hidden');
        }
    }

    function handleEmotionDetected(emotionData) {
        state.currentEmotion = emotionData;
        updateEmotionDisplay();
    }

    function updateEmotionDisplay() {
        const { emotion, emoji, confidence } = state.currentEmotion;
        
        // Update input badge
        elements.inputEmotion.textContent = emoji;
        elements.emotionBadge.title = `Current emotion: ${emotion}`;
        
        // Update camera sidebar
        elements.currentEmotionDisplay.textContent = emoji;
        elements.emotionLabel.textContent = emotion;
        elements.emotionConfidence.textContent = confidence ? `${confidence.toFixed(1)}%` : '--';
    }

    // ========================================================================
    // UI Utilities
    // ========================================================================

    function switchScreen(screen) {
        elements.loginScreen.classList.remove('active');
        elements.chatScreen.classList.remove('active');
        
        if (screen === 'login') {
            elements.loginScreen.classList.add('active');
        } else if (screen === 'chat') {
            elements.chatScreen.classList.add('active');
            elements.messageInput.focus();
        }
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
        });
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        elements.toastContainer.appendChild(toast);
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'toastIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ========================================================================
    // Helper Functions
    // ========================================================================

    function generateUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 9);
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========================================================================
    // Start Application
    // ========================================================================

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
