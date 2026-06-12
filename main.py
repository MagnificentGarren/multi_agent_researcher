import os
import json
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

# Import your graph elements from app.py
from app import app as langgraph_app, ResearchState

backend = FastAPI(title="Multi-Agent Researcher API")

# 🌐 Permissive CORS Configuration to allow Next.js on port 3000 or 3001
backend.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Captures the OPTIONS preflight handshake properly
    allow_headers=["*"],
)

class StartRequest(BaseModel):
    topic: str
    thread_id: str

class ResumeRequest(BaseModel):
    thread_id: str
    user_input: Optional[str] = ""

@backend.post("/api/research/start")
async def start_research(payload: StartRequest):
    config = {"configurable": {"thread_id": payload.thread_id}}
    
    initial_state = {
        "topic": payload.topic,
        "research_notes": "",
        "verified_facts": "",
        "draft": "",
        "critique": "",
        "score": 0,
        "revision_count": 0,
        "user_input": "" 
    }

    async def event_generator():
        # Stream the graph execution over the web
        for chunk in langgraph_app.stream(initial_state, config, stream_mode="updates"):
            # Identify which agent just finished running
            node_name = list(chunk.keys())[0]
            node_data = chunk[node_name]
            
            # Send the updates cleanly to the frontend
            yield f"data: {json.dumps({'node': node_name, 'data': node_data})}\n\n"
            await asyncio.sleep(0.1) # Smooth stream handoff

        # Check if we paused on a human interrupt
        state = langgraph_app.get_state(config)
        if state.next:
            yield f"data: {json.dumps({'node': 'interrupt', 'state': state.values})}\n\n"
        else:
            yield f"data: {json.dumps({'node': 'complete', 'state': state.values})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@backend.post("/api/research/resume")
async def resume_research(payload: ResumeRequest):
    config = {"configurable": {"thread_id": payload.thread_id}}
    state = langgraph_app.get_state(config)
    
    if not state.next:
        raise HTTPException(status_code=400, detail="Workflow is already finished.")

    # 🛠️ BREAK THE DEADLOCK: Force-inject the frontend instructions directly into state
    # This captures BOTH custom text instructions and your frontend's Auto-Pilot string payload.
    if payload.user_input and payload.user_input.strip():
        langgraph_app.update_state(
            config, 
            {"user_input": payload.user_input.strip()}, 
            as_node="critic"
        )

    async def event_generator():
        # Resume streaming from the pause checkpoint
        for chunk in langgraph_app.stream(None, config, stream_mode="updates"):
            node_name = list(chunk.keys())[0]
            node_data = chunk[node_name]
            yield f"data: {json.dumps({'node': node_name, 'data': node_data})}\n\n"
            await asyncio.sleep(0.1)

        state_after = langgraph_app.get_state(config)
        if state_after.next:
            yield f"data: {json.dumps({'node': 'interrupt', 'state': state_after.values})}\n\n"
        else:
            yield f"data: {json.dumps({'node': 'complete', 'state': state_after.values})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(backend, host="127.0.0.1", port=8000)