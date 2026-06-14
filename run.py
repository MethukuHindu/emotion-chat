#!/usr/bin/env python3
"""
EmotiChat - Privacy-Preserving Emotion-Aware Messaging System

Run this script to start the application.
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.app import app, socketio


def main():
    """Run the EmotiChat server."""
    print("""
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║   💬 EmotiChat - Privacy-First Emotion Messaging          ║
    ║                                                           ║
    ║   Server starting at: [localhost](http://localhost:5000)               ║
    ║                                                           ║
    ║   🔒 Privacy: Camera processing is 100% local             ║
    ║      Only emotion labels are transmitted                  ║
    ║                                                           ║
    ╚═══════════════════════════════════════════════════════════╝
    """)
    
    # Run with eventlet for WebSocket support
    socketio.run(
        app,
        host='0.0.0.0',
        port=5000,
        debug=True,
        use_reloader=True
    )


if __name__ == '__main__':
    main()
