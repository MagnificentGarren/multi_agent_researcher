# 🔍 AI Strategic Research Assistant

A production-ready multi-agent research orchestration platform that automates deep research, fact verification, and executive brief generation.

Built with **LangGraph**, **FastAPI**, and **Google Gemini 2.5**, the system coordinates multiple specialized AI agents through a persistent shared state architecture. It supports fault-tolerant execution, real-time streaming via Server-Sent Events (SSE), and human-in-the-loop intervention for strategic steering during research cycles.

---

## 🏗️ Architecture & Agent Workflow

The platform coordinates four specialized AI agents through a shared LangGraph state.

### Researcher

Discovers relevant facts, historical context, metrics, and emerging trends related to the requested topic. Uses cumulative state updates to safely expand knowledge while minimizing context-window growth.

### Verifier

Audits and validates research outputs before they are used downstream, reducing factual inconsistencies and mitigating hallucinations.

### Summarizer

Transforms verified findings into a structured, executive-level technical brief aligned with the user's objectives and guidance.

### Critic

Evaluates generated reports against a predefined quality rubric and assigns a score from 1–10. Reports scoring below the acceptance threshold are returned to the workflow with targeted improvement recommendations.

```text
[User Input]
      │
      ▼
[Researcher]
      │
      ▼
[Verifier]
      │
      ▼
[Summarizer]
      │
      ▼
[Critic]
      │
      ├── Score ≥ 8 ─────────► [Final Report]
      │
      └── Score < 8 ─────────► Feedback Loop
                                 │
                                 ▼
                           [Researcher]
```

---

## 🚀 Key Features

### Multi-Agent Research Pipeline

Coordinates specialized AI agents through a persistent graph-based workflow to improve research quality and consistency.

### Human-in-the-Loop Steering

Pauses execution at configurable checkpoints, allowing users to review intermediate outputs and inject strategic guidance before execution continues.

### Fault-Tolerant Execution

Handles transient API failures, network interruptions, and rate limits using configurable retry policies and exponential backoff mechanisms.

### Real-Time Streaming

Streams workflow progress and state updates through FastAPI-powered Server-Sent Events (SSE), enabling responsive user interfaces and live monitoring.

### Context Preservation Guardrails

Maintains long-running research state while preventing uncontrolled context expansion and token bloat.

### Flexible Model Selection

Optimized for rapid iterative workflows using Gemini 2.5 Flash, with support for Gemini 2.5 Pro when deeper reasoning is required.

---

## 🛠️ Technology Stack

### Backend

* Python
* LangGraph
* LangChain
* FastAPI
* Uvicorn
* Pydantic

### Frontend

* Next.js 14
* TypeScript
* Tailwind CSS
* Lucide React

### AI Models

* Gemini 2.5 Flash
* Gemini 2.5 Pro

---

## 📦 Installation & Setup

### 1. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Backend Configuration
GOOGLE_API_KEY=your_gemini_api_key_here
PORT=8000
HOST=127.0.0.1

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

### 2. Set Up the Backend

```bash
# Clone repository
git clone https://github.com/yourusername/ai-strategic-research-assistant.git

cd ai-strategic-research-assistant

# Create virtual environment
python -m venv agent_env

# Activate environment
source agent_env/bin/activate
# Windows:
# agent_env\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
python main.py
```

Backend services will be available at:

```text
http://localhost:8000
```

Interactive API documentation:

```text
http://localhost:8000/docs
```

---

### 3. Launch the Frontend Dashboard

```bash
cd frontend

npm install

npm run dev
```

Open:

```text
http://localhost:3000
```

---

## 🔌 API & Streaming Interface

### Start Research Task

**POST** `/api/research/start`

Initiates a new research workflow.

#### Request

```json
{
  "topic": "Quantum Computing Scalability Milestones 2024-2026",
  "model_preference": "gemini-2.5-flash"
}
```

---

### Stream Workflow Updates

**GET** `/api/research/stream/{task_id}`

Opens a persistent SSE connection and streams workflow state updates.

#### Events

* `researcher_yield`
* `verifier_audit`
* `summarizer_draft`
* `critic_review`
* `human_interrupt_required`

---

### Inject Human Feedback

**POST** `/api/research/steer`

Provides strategic feedback to an active workflow.

#### Request

```json
{
  "task_id": "string",
  "user_feedback": "Focus deeper on topological qubit error-correction rates and skip general hardware overviews."
}
```

---

## 📈 Example Use Cases

* Market intelligence research
* Competitive analysis
* Technical due diligence
* Industry trend monitoring
* Executive briefing generation
* Investment research support
* Technology landscape analysis

---

## 🔒 Reliability & Safety

The platform includes several safeguards designed for long-running research workflows:

* State persistence through LangGraph
* Retry and recovery mechanisms
* Human approval checkpoints
* Fact verification stages
* Controlled context growth
* Streaming-based observability

---

## 📄 License

Distributed under the MIT License.

See the `LICENSE` file for additional information.
