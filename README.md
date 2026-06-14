# 💬 EmotiChat - Privacy-Preserving Emotion-Aware Messaging

A real-time chat application that detects facial emotions locally before sending messages. Only emotion labels (like "happy" or "neutral") are transmitted—**never images or video**.

## 🔒 Privacy First

- **Local Processing**: All camera/video processing happens on your device using DeepFace and OpenCV
- **No Image Transmission**: The server never receives, stores, or processes any images
- **Minimal Data**: Only the emotion label (a single word) is sent with each message

## ✨ Features

- WhatsApp-style chat interface
- Real-time messaging with Socket.IO
- Local facial emotion detection (7 emotions)
- Emotion displayed with each message
- Multiple users support
- Typing indicators
- Dark mode support
- Responsive design

## 📋 Requirements

- Python 3.9+
- Webcam (for emotion detection)
- Modern web browser with camera support

## 🚀 Quick Start

### 1. Clone and Navigate

```bash
cd emotion-chat
```
