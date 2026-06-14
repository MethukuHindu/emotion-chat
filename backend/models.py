"""Data models for the messaging system."""

from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional
import json


@dataclass
class Message:
    """Represents a chat message with emotion metadata."""
    
    id: str
    sender_id: str
    text: str
    emotion: str
    timestamp: str
    
    def to_dict(self) -> dict:
        """Convert message to dictionary for JSON serialization."""
        return asdict(self)
    
    @classmethod
    def create(cls, sender_id: str, text: str, emotion: str) -> "Message":
        """Factory method to create a new message with auto-generated fields."""
        import uuid
        return cls(
            id=str(uuid.uuid4()),
            sender_id=sender_id,
            text=text,
            emotion=emotion,
            timestamp=datetime.now().isoformat()
        )


@dataclass
class User:
    """Represents a chat user."""
    
    id: str
    username: str
    is_online: bool = False
    
    def to_dict(self) -> dict:
        """Convert user to dictionary for JSON serialization."""
        return asdict(self)


class ChatRoom:
    """Manages messages and users in a chat room."""
    
    def __init__(self, room_id: str = "default"):
        self.room_id = room_id
        self.messages: list[Message] = []
        self.users: dict[str, User] = {}
    
    def add_message(self, message: Message) -> None:
        """Add a message to the chat history."""
        self.messages.append(message)
        # Keep only last 100 messages in memory
        if len(self.messages) > 100:
            self.messages = self.messages[-100:]
    
    def add_user(self, user: User) -> None:
        """Add or update a user in the room."""
        self.users[user.id] = user
    
    def remove_user(self, user_id: str) -> Optional[User]:
        """Remove a user from the room."""
        return self.users.pop(user_id, None)
    
    def get_messages(self, limit: int = 50) -> list[dict]:
        """Get recent messages as dictionaries."""
        return [msg.to_dict() for msg in self.messages[-limit:]]
    
    def get_online_users(self) -> list[dict]:
        """Get list of online users."""
        return [
            user.to_dict() 
            for user in self.users.values() 
            if user.is_online
        ]