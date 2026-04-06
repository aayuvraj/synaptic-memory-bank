import time
import math
import uuid
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import chromadb
from chromadb.utils import embedding_functions

# ─────────────────────────────────────────────
#  Brain-Inspired Constants
# ─────────────────────────────────────────────
#  Three-signal scoring weights (must sum to 1.0)
ALPHA = 0.5   # Relevance   — semantic cosine similarity
BETA  = 0.3   # Recency     — exponential time-decay
GAMMA = 0.2   # Importance  — user-supplied criticality

DECAY_RATE = 0.05  # Memory half-life: ~14 days

# ─────────────────────────────────────────────
#  App Initialization
# ─────────────────────────────────────────────
app = FastAPI(
    title="Synaptic Memory Bank API",
    description=(
        "A brain-inspired episodic memory engine for AI agents. "
        "Retrieves memories using a three-signal algorithm: "
        "Relevance (semantic), Recency (time-decay), and Importance."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Persistent ChromaDB — memories survive restarts
chroma_client = chromadb.PersistentClient(path="./memory_storage")
embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

collection = chroma_client.get_or_create_collection(
    name="agent_episodic_memory",
    embedding_function=embed_fn,
    metadata={"hnsw:space": "cosine"},
)

# ─────────────────────────────────────────────
#  Pydantic Models
# ─────────────────────────────────────────────
class MemoryIngest(BaseModel):
    user_id: str
    text: str
    importance: float = Field(
        default=0.5, ge=0.0, le=1.0,
        description="Criticality of this memory: 0.0 (trivial) → 1.0 (critical)"
    )

class QueryRequest(BaseModel):
    user_id: str
    query: str
    top_k: int = Field(default=5, ge=1, le=50)

class DeleteRequest(BaseModel):
    memory_id: str

# ─────────────────────────────────────────────
#  Core Scoring Logic
# ─────────────────────────────────────────────
def calculate_recency_score(created_at: float, current_time: float) -> float:
    """
    Exponential time-decay: R(t) = e^(-λ·d)
    where λ = DECAY_RATE and d = age in days.
    A memory stored today scores 1.0; after ~14 days it scores ~0.5.
    """
    days_old = max(0.0, (current_time - created_at) / 86400)
    return math.exp(-DECAY_RATE * days_old)

# ─────────────────────────────────────────────
#  Endpoints
# ─────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "Synaptic Memory Bank",
        "status": "online",
        "version": "1.0.0",
        "signals": {
            "alpha_relevance": ALPHA,
            "beta_recency": BETA,
            "gamma_importance": GAMMA,
        },
    }


@app.post("/memory/ingest", tags=["Memory"])
async def ingest_memory(payload: MemoryIngest):
    """Store an episodic memory with temporal and importance metadata."""
    memory_id = str(uuid.uuid4())
    current_time = time.time()

    collection.add(
        documents=[payload.text],
        metadatas=[{
            "user_id": payload.user_id,
            "created_at": current_time,
            "importance": payload.importance,
        }],
        ids=[memory_id],
    )

    return {
        "status": "success",
        "memory_id": memory_id,
        "message": "Memory consolidated into the synaptic store.",
        "metadata": {
            "user_id": payload.user_id,
            "importance": payload.importance,
            "created_at": current_time,
        },
    }


@app.post("/memory/retrieve", tags=["Memory"])
async def retrieve_memory(payload: QueryRequest):
    """
    Retrieve memories using the three-signal brain-inspired algorithm.

    Final Score = α·Relevance + β·Recency + γ·Importance
    """
    # Dense vector retrieval — fetch 3× to allow re-ranking
    candidate_count = min(payload.top_k * 3, 100)

    try:
        results = collection.query(
            query_texts=[payload.query],
            n_results=candidate_count,
            where={"user_id": payload.user_id},
            include=["documents", "metadatas", "distances"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Retrieval error: {str(e)}")

    docs      = results.get("documents", [[]])[0]
    metas     = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]
    ids       = results.get("ids", [[]])[0]

    if not docs:
        return {"memories": [], "query": payload.query, "count": 0}

    current_time = time.time()
    scored: list[dict] = []

    for i in range(len(docs)):
        # Cosine distance → similarity (0–1)
        relevance  = float(np.clip(1.0 - distances[i], 0.0, 1.0))
        recency    = calculate_recency_score(float(metas[i]["created_at"]), current_time)
        importance = float(metas[i].get("importance", 0.5))

        final_score = (ALPHA * relevance) + (BETA * recency) + (GAMMA * importance)

        scored.append({
            "id": ids[i],
            "text": docs[i],
            "final_score": round(final_score, 4),
            "metrics": {
                "relevance":  round(relevance,  4),
                "recency":    round(recency,    4),
                "importance": round(importance, 4),
                "weighted": {
                    "relevance_contrib":  round(ALPHA * relevance,  4),
                    "recency_contrib":    round(BETA  * recency,    4),
                    "importance_contrib": round(GAMMA * importance, 4),
                },
            },
        })

    # Re-rank by synaptic weight
    scored.sort(key=lambda x: x["final_score"], reverse=True)

    return {
        "memories": scored[: payload.top_k],
        "query": payload.query,
        "count": len(scored[: payload.top_k]),
        "scoring_config": {
            "alpha_relevance": ALPHA,
            "beta_recency": BETA,
            "gamma_importance": GAMMA,
            "decay_rate": DECAY_RATE,
        },
    }


@app.get("/memory/list/{user_id}", tags=["Memory"])
async def list_memories(user_id: str, limit: int = 20):
    """List all stored memories for a given user."""
    try:
        results = collection.get(
            where={"user_id": user_id},
            include=["documents", "metadatas"],
            limit=limit,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    memories = []
    current_time = time.time()
    for i in range(len(results["ids"])):
        meta = results["metadatas"][i]
        recency = calculate_recency_score(float(meta["created_at"]), current_time)
        memories.append({
            "id":         results["ids"][i],
            "text":       results["documents"][i],
            "importance": meta.get("importance", 0.5),
            "created_at": meta.get("created_at"),
            "recency":    round(recency, 4),
        })

    memories.sort(key=lambda x: x["created_at"], reverse=True)
    return {"memories": memories, "count": len(memories), "user_id": user_id}


@app.delete("/memory/{memory_id}", tags=["Memory"])
async def delete_memory(memory_id: str):
    """Permanently delete a memory by ID."""
    try:
        collection.delete(ids=[memory_id])
        return {"status": "success", "message": f"Memory {memory_id} deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stats/{user_id}", tags=["Analytics"])
async def get_stats(user_id: str):
    """Return memory statistics for a user."""
    try:
        results = collection.get(
            where={"user_id": user_id},
            include=["metadatas"],
        )
    except Exception:
        return {"count": 0, "user_id": user_id}

    count = len(results["ids"])
    if count == 0:
        return {"count": 0, "user_id": user_id}

    importances = [m.get("importance", 0.5) for m in results["metadatas"]]
    current_time = time.time()
    recencies = [
        calculate_recency_score(float(m["created_at"]), current_time)
        for m in results["metadatas"]
    ]

    return {
        "user_id":          user_id,
        "total_memories":   count,
        "avg_importance":   round(float(np.mean(importances)), 3),
        "avg_recency":      round(float(np.mean(recencies)),   3),
        "critical_memories": sum(1 for x in importances if x >= 0.8),
    }
