import json
import logging
from typing import Dict, List, Any
from fastapi import WebSocket

logger = logging.getLogger("pharma.websocket")

class ConnectionManager:
    def __init__(self):
        # Maps shipment_id (int or "all") -> list of WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channel: str):
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = []
        self.active_connections[channel].append(websocket)
        logger.info(f"WebSocket client connected to channel [{channel}]. Total: {len(self.active_connections[channel])}")

    def disconnect(self, websocket: WebSocket, channel: str):
        if channel in self.active_connections and websocket in self.active_connections[channel]:
            self.active_connections[channel].remove(websocket)
            logger.info(f"WebSocket client disconnected from channel [{channel}]. Remaining: {len(self.active_connections[channel])}")

    async def broadcast_to_channel(self, channel: str, message: Dict[str, Any]):
        if channel in self.active_connections:
            dead_connections = []
            for connection in self.active_connections[channel]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.warning(f"Error sending message to websocket on [{channel}]: {e}")
                    dead_connections.append(connection)
            for dead in dead_connections:
                self.disconnect(dead, channel)

    async def broadcast_shipment_update(self, shipment_id: int, message: Dict[str, Any]):
        # Broadcast to specific shipment channel
        await self.broadcast_to_channel(str(shipment_id), message)
        # Also broadcast to global channel for dashboard overview
        await self.broadcast_to_channel("dashboard", message)

manager = ConnectionManager()
