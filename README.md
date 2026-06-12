# AI Strategic Research Assistant

A local, production-ready multi-agent orchestration engine that automates advanced research and technical brief generation. Powered by LangGraph's state persistence framework and Gemini 2.5 Flash, the system handles fault-tolerant operations, streams data via server-sent events, and supports real-time human steering.

## 🏗️ Architecture & Agent Workflow

The system coordinates four specialized AI agents using a shared whiteboard state via LangGraph:

1. **The Researcher:** Dynamically discovers specific historical details, metrics, and trends based on the primary topic or direct feedback. It utilizes a cumulative state optimization approach to safely append new data without overflowing context window tokens.
2. **The Verifier:** Actively audits the researcher's raw data pipeline to enforce factual integrity and prevent hallucinations before drafting begins.
3. **The Summarizer:** Synthesizes the checked facts into a deeply structured, executive-level technical brief adhering strictly to current directives.
4. **The Critic:** Acts as a ruthless corporate editor. It evaluates the brief against an explicit scoring rubric, assigning an objective quality score (1-10). If the score drops below 8, it generates constructive critiques and loops the workflow back to the Researcher.

## 🚀 Key Features

* **Dual-Engine Flexibility:** Optimized for ultra-fast, cost-efficient loops using **Gemini 2.5 Flash**, with seamless drop-in support for deep reasoning via **Gemini 2.5 Pro**.
* **Human-in-the-Loop Interruption:** Automatically pauses execution at the edge of evaluation loops, exposing current state outputs to an elegant web UI so users can manually inject strategic steering.
* **Fault-Tolerant Operations:** Built-in resilience against server bottlenecks, network dropouts, and API rate limits via custom exponential backoff configurations (`max_retries=5`).
* **Decoupled High-Performance Streaming:** Exposes execution streams over FastAPI using high-throughput Server-Sent Events (SSE) consumed dynamically by a Next.js 14 App Router and Tailwind CSS dashboard.
* **Context Preservation Guardrails:** Protects state memory across continuous iterative loops while preventing exponential token bloat.

## 🛠️ Tech Stack

* **Backend Engine:** Python, LangGraph, LangChain, FastAPI, Uvicorn, Pydantic
* **Frontend UI:** Next.js (TypeScript), Tailwind CSS, Lucide React
* **LLM Foundation:** Google Gemini API (`gemini-2.5-flash` / `gemini-2.5-pro`)

## 📦 Quick Start

### 1. Clone & Set Up Backend
Ensure your environment variables are configured in an `.env` file containing your `GOOGLE_API_KEY`.

```bash
# Activate your virtual environment
source agent_env/bin/activate  # On Windows: agent_env\Scripts\activate

# Install requirements and start the API engine
python main.py
