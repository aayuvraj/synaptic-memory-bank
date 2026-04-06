<div align="center">

# 🧠 Synaptic Memory Bank

**A brain-inspired episodic memory engine for AI agents.**

Instead of naive vector search, this system retrieves memories using a **three-signal cognitive model** — weighting every memory by how *relevant*, how *recent*, and how *important* it is, just like a biological hippocampus.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-0.4-7B61FF?style=flat-square)](https://www.trychroma.com)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

</div>

---

## The Problem With Pure Vector Search

Most AI memory systems work like a search engine: embed the query, find the nearest vectors, return the closest matches. This breaks in practice because:

- A **highly relevant but old memory** scores the same as a fresh one
- A **critical fact** (e.g. "user is allergic to peanuts") competes equally with a trivial one (e.g. "user likes coffee")
- There is no notion of *cognitive urgency* — everything is equidistant

**Synaptic Memory Bank solves this with a three-signal algorithm inspired by how the human hippocampus consolidates and retrieves episodic memory.**

---

## The Three-Signal Architecture

Every memory retrieval computes a **Synaptic Weight** across three dimensions:

```
W(m) = α · Relevance(m, q)  +  β · Recency(m)  +  γ · Importance(m)
```

| Signal | Weight | Description |
|---|---|---|
| **α Relevance** | `0.50` | Cosine similarity between query embedding and memory embedding (`all-MiniLM-L6-v2`) |
| **β Recency** | `0.30` | Exponential decay: `R(t) = e^(−λd)` where λ=0.05 and d is age in days. Half-life ≈ 14 days. |
| **γ Importance** | `0.20` | User-assigned criticality at ingest time (0.0 trivial → 1.0 critical) |

This means a **critical memory** (`importance=1.0`) stored last week will consistently outrank a **trivial memory** (`importance=0.2`) that happens to be a slightly better semantic match — mimicking how the brain prioritizes survival-relevant information.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Synaptic Memory Bank                 │
│                                                         │
│  ┌──────────────┐    POST /memory/ingest               │
│  │   AI Agent   │──────────────────────────────────┐   │
│  │  or User App │    POST /memory/retrieve          │   │
│  └──────────────┘──────────────────────────────┐   │   │
│                                                │   │   │
│  ┌─────────────────────────────────────────┐  │   │   │
│  │           FastAPI REST Layer            │  │   │   │
│  │                                         │  │   │   │
│  │  ┌────────────────────────────────┐     │  │   │   │
│  │  │    Three-Signal Re-Ranker      │     │◄─┘   │   │
│  │  │                                │     │      │   │
│  │  │  α·cosine_sim(q, m)            │     │      │   │
│  │  │  β·exp(-λ·age_days)           │     │      │   │
│  │  │  γ·importance                 │     │      │   │
│  │  └──────────────┬─────────────────┘     │      │   │
│  │                 │                       │      │   │
│  │  ┌──────────────▼─────────────────┐     │      │   │
│  │  │  ChromaDB (Persistent Vector   │     │      │   │
│  │  │  Store + HNSW cosine index)    │     │      │   │
│  │  │  Model: all-MiniLM-L6-v2       │     │      │   │
│  │  └────────────────────────────────┘     │      │   │
│  └─────────────────────────────────────────┘      │   │
│                                                    │   │
│  ┌─────────────────────────────────────────┐      │   │
│  │         Neural UI (Vanilla JS)          │◄─────┘   │
│  │  • Hover-glow neuron canvas             │          │
│  │  • Real-time memory ingest + retrieval  │          │
│  │  • Synaptic weight visualizer           │          │
│  └─────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker + Docker Compose CLI)

### 1. Clone the repository

```bash
git clone https://github.com/aayuvraj/synaptic-memory-bank.git
cd synaptic-memory-bank
```

### 2. Build and run

```bash
docker-compose up --build
```

> **First run note:** Docker will download Python 3.11-slim and the `all-MiniLM-L6-v2` sentence-transformers model (~90 MB). This takes ~3 minutes. Subsequent starts are instant.

### 3. Open the UI

Navigate to **[http://localhost:3000](http://localhost:3000)** to use the neural interface.

The raw API is at **[http://localhost:8000](http://localhost:8000)**.  
Interactive API docs (Swagger): **[http://localhost:8000/docs](http://localhost:8000/docs)**

---

## API Reference

### `POST /memory/ingest`

Store a memory with temporal and importance metadata.

```json
{
  "user_id": "user_123",
  "text": "The user is highly allergic to peanuts and dairy.",
  "importance": 1.0
}
```

**Response:**
```json
{
  "status": "success",
  "memory_id": "a1b2c3d4-...",
  "message": "Memory consolidated into the synaptic store."
}
```

---

### `POST /memory/retrieve`

Retrieve memories ranked by synaptic weight.

```json
{
  "user_id": "user_123",
  "query": "What dietary restrictions does this user have?",
  "top_k": 5
}
```

**Response:**
```json
{
  "memories": [
    {
      "id": "a1b2c3d4-...",
      "text": "The user is highly allergic to peanuts and dairy.",
      "final_score": 0.8921,
      "metrics": {
        "relevance": 0.9142,
        "recency": 0.9512,
        "importance": 1.0,
        "weighted": {
          "relevance_contrib": 0.4571,
          "recency_contrib": 0.2854,
          "importance_contrib": 0.2000
        }
      }
    }
  ],
  "scoring_config": {
    "alpha_relevance": 0.5,
    "beta_recency": 0.3,
    "gamma_importance": 0.2,
    "decay_rate": 0.05
  }
}
```

---

### `GET /memory/list/{user_id}`

List all stored memories for a user.

### `DELETE /memory/{memory_id}`

Permanently delete a memory by ID.

### `GET /stats/{user_id}`

Return cognitive statistics: total memories, critical count, average importance and recency scores.

---

## cURL Examples

**Ingest a routine memory:**
```bash
curl -X POST http://localhost:8000/memory/ingest \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user_123","text":"The user likes drinking coffee in the morning.","importance":0.2}'
```

**Ingest a critical memory:**
```bash
curl -X POST http://localhost:8000/memory/ingest \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user_123","text":"The user is highly allergic to peanuts and dairy.","importance":1.0}'
```

**Retrieve with synaptic scoring:**
```bash
curl -X POST http://localhost:8000/memory/retrieve \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user_123","query":"What dietary habits does this user have?","top_k":3}'
```

The peanut allergy memory will rank far above the coffee preference — even though both are semantically related to "dietary habits" — because of the importance differential.

---

## Project Structure

```
synaptic-memory-bank/
├── main.py                 # FastAPI backend — three-signal scoring engine
├── requirements.txt        # Python dependencies
├── Dockerfile              # Container definition
├── docker-compose.yml      # Orchestration (API + UI)
├── memory_storage/         # Persistent ChromaDB data (auto-created)
└── frontend/
    ├── index.html          # Neural UI shell
    ├── style.css           # Synaptic dark theme + animations
    ├── app.js              # Neural canvas + API client
    └── favicon.svg         # Custom brain-network logo
```

---

## Tuning the Algorithm

Modify the constants at the top of `main.py` to change retrieval behavior:

```python
ALPHA = 0.5   # Relevance weight  — increase to prioritize semantic match
BETA  = 0.3   # Recency weight    — increase to heavily favor fresh memories
GAMMA = 0.2   # Importance weight — increase to elevate critical memories

DECAY_RATE = 0.05  # λ — half-life ≈ ln(2)/λ ≈ 14 days
                   # Increase for faster forgetting, decrease for longer retention
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| API Framework | FastAPI 0.104 |
| Vector Store | ChromaDB 0.4 (persistent HNSW index) |
| Embeddings | `all-MiniLM-L6-v2` via sentence-transformers |
| Scoring | Custom NumPy re-ranking algorithm |
| Containerization | Docker + Docker Compose |
| UI | Vanilla JS + CSS (zero framework dependencies) |
| Neural Canvas | HTML5 Canvas API |

---

## License

MIT — build something cool with it.

---

<div align="center">
  <sub>Built with neuroscience-inspired architecture and a love for distributed systems.</sub>
</div>
