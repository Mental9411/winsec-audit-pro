from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..utils.ws_manager import manager

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await manager.broadcast("terminal", {"line": "[+] Connected to Windows Security Audit Pro live feed"})
        while True:
            # We don't expect inbound messages, but keep the socket alive
            # and drop the connection cleanly if the client goes away.
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
