"""Flask application with Socket.IO for real-time messaging."""

import os
import logging
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS

from .models import Message, User, ChatRoom
from .emotion_detector import get_detector

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(
    __name__,
    static_folder="../frontend",
    template_folder="../frontend"
)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")

# Enable CORS
CORS(app)

# Initialize Socket.IO
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="eventlet",
    logger=True,
    engineio_logger=True
)

# Initialize chat room
chat_room = ChatRoom("main")

# Track socket-to-user mapping
socket_users: dict[str, str] = {}


# ============================================================================
# HTTP Routes
# ============================================================================

@app.route("/")
def index():
    """Serve the main chat interface."""
    return send_from_directory(app.static_folder, "index.html")


@app.route("/css/<path:filename>")
def serve_css(filename):
    """Serve CSS files."""
    return send_from_directory(os.path.join(app.static_folder, "css"), filename)


@app.route("/js/<path:filename>")
def serve_js(filename):
    """Serve JavaScript files."""
    return send_from_directory(os.path.join(app.static_folder, "js"), filename)


@app.route("/api/health")
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "service": "emotion-chat"})


@app.route("/api/detect-emotion", methods=["POST"])
def detect_emotion():
    """
    Detect emotion from uploaded image.
    
    Expects JSON body with 'image' field containing base64-encoded image.
    Returns only the emotion label and confidence - never stores or forwards the image.
    """
    try:
        data = request.get_json()
        
        if not data or "image" not in data:
            return jsonify({"error": "No image data provided"}), 400
        
        detector = get_detector()
        result = detector.detect_from_base64(data["image"])
        
        # Log detection (without image data for privacy)
        logger.info(f"Emotion detected: {result['emotion']} (confidence: {result['confidence']}%)")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Emotion detection error: {e}")
        return jsonify({"error": str(e), "emotion": "neutral"}), 500


@app.route("/api/messages")
def get_messages():
    """Get recent chat messages."""
    limit = request.args.get("limit", 50, type=int)
    return jsonify({"messages": chat_room.get_messages(limit)})


@app.route("/api/users")
def get_users():
    """Get online users."""
    return jsonify({"users": chat_room.get_online_users()})


# ============================================================================
# Socket.IO Events
# ============================================================================

@socketio.on("connect")
def handle_connect():
    """Handle new socket connection."""
    logger.info(f"Client connected: {request.sid}")
    emit("connected", {"sid": request.sid})


@socketio.on("disconnect")
def handle_disconnect():
    """Handle socket disconnection."""
    sid = request.sid
    logger.info(f"Client disconnected: {sid}")
    
    # Remove user from room if they were registered
    if sid in socket_users:
        user_id = socket_users.pop(sid)
        user = chat_room.remove_user(user_id)
        
        if user:
            # Notify others that user left
            emit(
                "user_left",
                {"user": user.to_dict()},
                room="main",
                include_self=False
            )
            
            # Broadcast updated user list
            emit(
                "users_updated",
                {"users": chat_room.get_online_users()},
                room="main"
            )


@socketio.on("join")
def handle_join(data):
    """Handle user joining the chat."""
    username = data.get("username", "Anonymous")
    user_id = data.get("user_id", request.sid)
    
    # Create and register user
    user = User(id=user_id, username=username, is_online=True)
    chat_room.add_user(user)
    socket_users[request.sid] = user_id
    
    # Join the socket room
    join_room("main")
    
    logger.info(f"User joined: {username} ({user_id})")
    
    # Send chat history to new user
    emit("chat_history", {"messages": chat_room.get_messages()})
    
    # Notify others
    emit(
        "user_joined",
        {"user": user.to_dict()},
        room="main",
        include_self=False
    )
    
    # Broadcast updated user list
    emit(
        "users_updated",
        {"users": chat_room.get_online_users()},
        room="main"
    )


@socketio.on("leave")
def handle_leave():
    """Handle user leaving the chat."""
    sid = request.sid
    
    if sid in socket_users:
        user_id = socket_users.pop(sid)
        user = chat_room.remove_user(user_id)
        
        leave_room("main")
        
        if user:
            emit(
                "user_left",
                {"user": user.to_dict()},
                room="main"
            )
            emit(
                "users_updated",
                {"users": chat_room.get_online_users()},
                room="main"
            )


@socketio.on("send_message")
def handle_message(data):
    """
    Handle incoming chat message.
    
    Expected data:
        - text: message content
        - emotion: detected emotion label
        - sender_id: user identifier
    """
    text = data.get("text", "").strip()
    emotion = data.get("emotion", "neutral")
    sender_id = data.get("sender_id", socket_users.get(request.sid, "unknown"))
    
    if not text:
        emit("error", {"message": "Empty message"})
        return
    
    # Create and store message
    message = Message.create(
        sender_id=sender_id,
        text=text,
        emotion=emotion
    )
    chat_room.add_message(message)
    
    logger.info(f"Message from {sender_id}: '{text[:50]}...' with emotion: {emotion}")
    
    # Broadcast to all users in room
    emit(
        "new_message",
        {"message": message.to_dict()},
        room="main"
    )


@socketio.on("typing")
def handle_typing(data):
    """Broadcast typing indicator."""
    user_id = data.get("user_id", socket_users.get(request.sid))
    is_typing = data.get("is_typing", False)
    
    emit(
        "user_typing",
        {"user_id": user_id, "is_typing": is_typing},
        room="main",
        include_self=False
    )


# ============================================================================
# Error Handlers
# ============================================================================

@app.errorhandler(404)
def not_found(e):
    """Handle 404 errors."""
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(500)
def server_error(e):
    """Handle 500 errors."""
    return jsonify({"error": "Internal server error"}), 500


def create_app():
    """Application factory."""
    return app


if __name__ == "__main__":
    socketio.run(app, debug=True, host="0.0.0.0", port=5000)
