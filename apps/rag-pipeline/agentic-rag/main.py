import os
import json
import re
from typing import TypedDict, List, Dict, Any, Literal
from dotenv import load_dotenv
from openai import OpenAI
import chromadb
from sentence_transformers import SentenceTransformer
from langgraph.graph import StateGraph, END
import numpy as np

# Load environment variables
load_dotenv()

# Global Configuration
BASE_URL = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai")
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
API_KEY = os.getenv("GEMINI_API_KEY")

# Ensure API Key is present
if not API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is not set.")

# Import documents using dynamic sys.path addition
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))

try:
    from data.data import DOCUMENTS, DISTRACTOR_DOCUMENTS
    ALL_DOCUMENTS = DOCUMENTS + DISTRACTOR_DOCUMENTS
except ImportError as err:
    print(f"[Warning] Failed to import data.data: {err}")
    ALL_DOCUMENTS = []

# Define Agent Workflow State Schema
class AgentState(TypedDict):
    question: str
    original_question: str
    generation: str
    documents: List[Dict[str, Any]]
    steps: List[str]
    retries: int
    max_retries: int
    route: Literal["retrieve", "direct_answer"]
    relevant_found: bool

# Initialize RAG Helper and Grader Class
class RAGAgentPipeline:
    def __init__(self, base_url: str, api_key: str, model_name: str, documents: List[Dict[str, Any]]):
        self.client = OpenAI(base_url=base_url, api_key=api_key)
        self.model_name = model_name
        self.documents = documents
        self.chroma = chromadb.Client()
        self.embedder = SentenceTransformer("all-MiniLM-L6-v2")
        self.all_chunks = []
        self.chunk_meta = []
        self.collection = None

        # Build chunks and metadata
        self._prepare_chunks()
        # Initialize and store vectors
        self._store_embeddings()

    def _prepare_chunks(self):
        """Prepare sentence-aware recursive chunks of documents."""
        print("[System] Chunking documents...")
        for doc in self.documents:
            paragraphs = [p.strip() for p in doc["content"].split("\n\n") if p.strip()]
            for para in paragraphs:
                words = para.split()
                # Split paragraph into smaller parts if too large
                if len(words) <= 120:
                    self.all_chunks.append(para)
                    self.chunk_meta.append({"title": doc["title"], "source": doc["source"]})
                else:
                    sentences = para.replace(". ", ".\n").split("\n")
                    current_chunk, current_len = [], 0
                    for sent in sentences:
                        sent_len = len(sent.split())
                        if current_len + sent_len > 120 and current_chunk:
                            self.all_chunks.append(" ".join(current_chunk))
                            self.chunk_meta.append({"title": doc["title"], "source": doc["source"]})
                            current_chunk, current_len = [sent], sent_len
                        else:
                            current_chunk.append(sent)
                            current_len += sent_len
                    if current_chunk:
                        self.all_chunks.append(" ".join(current_chunk))
                        self.chunk_meta.append({"title": doc["title"], "source": doc["source"]})
        print(f"[System] Prepared {len(self.all_chunks)} chunks from {len(self.documents)} documents.")

    def _store_embeddings(self):
        """Re-create and populate local ChromaDB collection."""
        try:
            self.chroma.delete_collection("agentic_rag")
        except Exception:
            pass

        self.collection = self.chroma.create_collection(
            "agentic_rag", metadata={"hnsw:space": "cosine"}
        )

        print("[System] Generating embeddings and storing in ChromaDB...")
        embeddings = self.embedder.encode(
            [text.replace("\n", " ").strip() for text in self.all_chunks],
            normalize_embeddings=True,
            convert_to_numpy=True,
            batch_size=32,
            show_progress_bar=False
        ).tolist()

        self.collection.add(
            ids=[f"chunk_{i}" for i in range(len(self.all_chunks))],
            embeddings=embeddings,
            documents=self.all_chunks,
            metadatas=self.chunk_meta
        )
        print(f"[System] ChromaDB collection 'agentic_rag' loaded with {len(self.all_chunks)} chunks.")

    def get_embedding(self, text: str) -> List[float]:
        """Generate embedding vector for a single query string."""
        return self.embedder.encode([text], normalize_embeddings=True)[0].tolist()

    def query_llm_json(self, system_instruction: str, user_content: str) -> Dict[str, Any]:
        """Call Gemini to get a parsed JSON response."""
        response = self.client.chat.completions.create(
            model=self.model_name,
            temperature=0.0,
            messages=[
                {"role": "system", "content": system_instruction + "\nReturn response strictly in valid JSON format."},
                {"role": "user", "content": user_content}
            ],
            response_format={"type": "json_object"}
        )
        try:
            return json.loads(response.choices[0].message.content)
        except Exception as err:
            print(f"[Warning] Failed to parse JSON response: {err}. Raw: {response.choices[0].message.content}")
            # Robust extraction fallback
            match = re.search(r"\{.*\}", response.choices[0].message.content, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(0))
                except Exception:
                    pass
            return {}

# Define the graph workflow nodes

class AgenticRAGRouter:
    def __init__(self, pipeline: RAGAgentPipeline):
        self.pipeline = pipeline

    def route_query(self, state: AgentState) -> AgentState:
        """Determines if the query requires retrieval or can be answered directly."""
        question = state["question"]
        print(f"\n[Node: Route Query] Analyzing routing path for: '{question}'")

        system_instruction = (
            "You are a router that decides whether a user query requires searching internal company documents "
            "or can be answered directly using general knowledge. Internal topics include: company financial reports (Q2/Q3 2024), "
            "remote work policies, employee handbooks, authentication systems/engineering wikis, deployment pipelines, "
            "and board meeting decisions. For internal database search, output: {\"route\": \"retrieve\"}. "
            "For general knowledge queries or simple greetings, output: {\"route\": \"direct_answer\"}."
        )

        user_content = f"Question to route: '{question}'"
        result = self.pipeline.query_llm_json(system_instruction, user_content)
        route_decision = result.get("route", "retrieve")

        print(f"  -> Decision: Route to '{route_decision}'")
        state["route"] = route_decision
        state["steps"].append("route_query")
        return state

    def retrieve(self, state: AgentState) -> AgentState:
        """Retrieves documents from ChromaDB matching the current question query."""
        question = state["question"]
        print(f"[Node: Retrieve] Fetching relevant documents for query: '{question}'")

        query_embedding = self.pipeline.get_embedding(question)
        results = self.pipeline.collection.query(
            query_embeddings=[query_embedding],
            n_results=6
        )

        docs = results["documents"][0]
        metas = results["metadatas"][0]
        distances = results["distances"][0]

        retrieved_docs = []
        for d, m, dist in zip(docs, metas, distances):
            retrieved_docs.append({
                "content": d,
                "title": m["title"],
                "source": m["source"],
                "distance": dist
            })

        print(f"  -> Retrieved {len(retrieved_docs)} chunks from Vector DB.")
        state["documents"] = retrieved_docs
        state["steps"].append("retrieve")
        return state

    def grade_documents(self, state: AgentState) -> AgentState:
        """Grades documents for relevance to the user question, filtering out distractors."""
        question = state["question"]
        documents = state["documents"]
        print(f"[Node: Grade Documents] Grading {len(documents)} retrieved documents against query...")

        system_instruction = (
            "You are a document grader. Assess whether the provided document chunk contains facts, data, or context "
            "relevant to answering the user's question. Be generous but precise. "
            "Respond strictly in JSON: {\"relevance\": \"yes\"} or {\"relevance\": \"no\"}."
        )

        relevant_docs = []
        for doc in documents:
            user_content = f"User Question: {question}\n\nDocument Chunk:\n{doc['content']}"
            result = self.pipeline.query_llm_json(system_instruction, user_content)
            relevance = result.get("relevance", "no").strip().lower()
            if relevance == "yes":
                relevant_docs.append(doc)

        print(f"  -> Graded relevant: {len(relevant_docs)} / {len(documents)} chunks.")
        state["documents"] = relevant_docs
        state["relevant_found"] = len(relevant_docs) > 0
        state["steps"].append("grade_documents")
        return state

    def generate(self, state: AgentState) -> AgentState:
        """Generates an answer based on graded relevant documents."""
        question = state["question"]
        documents = state["documents"]
        print(f"[Node: Generate] Generating answer from {len(documents)} relevant chunks...")

        if not documents:
            context = "No relevant context found in database. State that you do not have enough information."
        else:
            context = "\n\n".join(
                f"[Source: {doc['title']} ({doc['source']})]\n{doc['content']}" for doc in documents
            )

        system_instruction = (
            "You are a precise facts-based AI assistant. Answer the user's question using ONLY the provided document context. "
            "If the context doesn't contain enough information to answer, explicitly state: 'I do not have enough information to answer.' "
            "Always cite the source document titles and files when providing the answer."
        )

        user_content = f"Context:\n{context}\n\nQuestion: {question}\n\nAnswer:"
        response = self.pipeline.client.chat.completions.create(
            model=self.pipeline.model_name,
            temperature=0.0,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_content}
            ]
        )
        answer = response.choices[0].message.content.strip()
        print(f"  -> Generated Answer length: {len(answer)} chars.")
        state["generation"] = answer
        state["steps"].append("generate")
        return state

    def rewrite_query(self, state: AgentState) -> AgentState:
        """Rewrites the current query to improve vector database retrieval quality."""
        question = state["question"]
        original = state["original_question"]
        print(f"[Node: Rewrite Query] Reformulating search query for better document retrieval...")

        system_instruction = (
            "You are an expert query optimizer. Rewrite the user's question to be highly optimized for vector search and keyword matching. "
            "Focus on the underlying intent, core nouns, and synonyms. Maintain the semantic focus. "
            "Output strictly in JSON: {\"optimized_query\": \"your rewritten query here\"}."
        )

        user_content = f"Original query: '{original}'\nCurrent query: '{question}'"
        result = self.pipeline.query_llm_json(system_instruction, user_content)
        optimized_query = result.get("optimized_query", question)

        print(f"  -> Optimized Query: '{optimized_query}'")
        state["question"] = optimized_query
        state["retries"] += 1
        state["steps"].append("rewrite_query")
        return state

    def direct_answer(self, state: AgentState) -> AgentState:
        """Generates a direct response for general knowledge queries or greetings."""
        question = state["question"]
        print(f"[Node: Direct Answer] Generating response directly without RAG lookup...")

        system_instruction = (
            "You are a helpful and friendly general assistant. Answer the user's question directly and concisely."
        )

        response = self.pipeline.client.chat.completions.create(
            model=self.pipeline.model_name,
            temperature=0.3,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": question}
            ]
        )
        state["generation"] = response.choices[0].message.content.strip()
        state["steps"].append("direct_answer")
        return state

# Conditional Edges & Routing Helpers

def route_conditional_entry(state: AgentState) -> str:
    """Routes to retrieve flow or direct answer flow based on route classification."""
    return state["route"]

def route_after_grading(state: AgentState) -> str:
    """Decides to generate answer or rewrite query if document retrieval was poor."""
    if state["relevant_found"]:
        return "generate"
    
    if state["retries"] < state["max_retries"]:
        return "rewrite_query"
    
    # Fallback to generation (generating with empty context warning)
    return "generate"

def route_after_generation(state: AgentState, pipeline: RAGAgentPipeline) -> str:
    """Self-Correction Check: verifies hallucinations and response relevance."""
    if state["route"] == "direct_answer":
        return END

    question = state["question"]
    generation = state["generation"]
    documents = state["documents"]

    # 1. Hallucination Grader: Check if answer is grounded in retrieved documents
    if not documents:
        # No docs to check hallucinations against
        return END

    print("[Grader] Checking for hallucinations (grounded check)...")
    context_text = "\n\n".join(doc["content"] for doc in documents)
    system_instruction_grounded = (
        "You are an auditor verifying claims. Evaluate if the generated answer is strictly grounded in "
        "and supported by the provided facts context. If the answer makes claims not supported by the context, "
        "mark it as 'no'. Respond strictly in JSON: {\"grounded\": \"yes\"} or {\"grounded\": \"no\"}."
    )
    user_content_grounded = f"Context:\n{context_text}\n\nGenerated Answer:\n{generation}"
    grounded_res = pipeline.query_llm_json(system_instruction_grounded, user_content_grounded)
    grounded = grounded_res.get("grounded", "yes").strip().lower()

    if grounded == "no":
        print("  -> Grader Result: Hallucinations detected.")
        if state["retries"] < state["max_retries"]:
            print("  -> Routing to rewrite_query to try again.")
            return "rewrite_query"
        else:
            print("  -> Exceeded max retries, returning best effort answer.")
            return END

    # 2. Answer Grader: Check if response answers the question
    print("[Grader] Checking if answer addresses user question...")
    system_instruction_answer = (
        "You are an evaluator. Determine if the generated answer actually addresses and answers the user's question. "
        "Respond strictly in JSON: {\"answers_question\": \"yes\"} or {\"answers_question\": \"no\"}."
    )
    user_content_answer = f"Question: {question}\n\nGenerated Answer:\n{generation}"
    answer_res = pipeline.query_llm_json(system_instruction_answer, user_content_answer)
    answers_question = answer_res.get("answers_question", "yes").strip().lower()

    if answers_question == "no":
        print("  -> Grader Result: Answer does not fully address the question.")
        if state["retries"] < state["max_retries"]:
            print("  -> Routing to rewrite_query to try again.")
            return "rewrite_query"
        else:
            print("  -> Exceeded max retries, returning best effort answer.")
            return END

    print("  -> Grader Result: Answer grounded and fully relevant.")
    return END


# Compile the LangGraph graph
def create_agentic_rag_graph(pipeline: RAGAgentPipeline) -> StateGraph:
    workflow = StateGraph(AgentState)
    router_nodes = AgenticRAGRouter(pipeline)

    # Register nodes
    workflow.add_node("route_query", router_nodes.route_query)
    workflow.add_node("retrieve", router_nodes.retrieve)
    workflow.add_node("grade_documents", router_nodes.grade_documents)
    workflow.add_node("generate", router_nodes.generate)
    workflow.add_node("rewrite_query", router_nodes.rewrite_query)
    workflow.add_node("direct_answer", router_nodes.direct_answer)

    # Define edges and conditional routing
    workflow.set_entry_point("route_query")
    
    workflow.add_conditional_edges(
        "route_query",
        route_conditional_entry,
        {
            "retrieve": "retrieve",
            "direct_answer": "direct_answer"
        }
    )

    workflow.add_edge("retrieve", "grade_documents")

    workflow.add_conditional_edges(
        "grade_documents",
        route_after_grading,
        {
            "generate": "generate",
            "rewrite_query": "rewrite_query"
        }
    )

    workflow.add_edge("rewrite_query", "retrieve")

    workflow.add_conditional_edges(
        "generate",
        lambda state: route_after_generation(state, pipeline),
        {
            "rewrite_query": "rewrite_query",
            END: END
        }
    )

    workflow.add_edge("direct_answer", END)

    return workflow.compile()


# Test Runner function
def test_agentic_rag():
    print("=" * 80)
    print("🚀 STARTING AGENTIC RAG SYSTEM TEST RUNNER")
    print("=" * 80)

    # Initialize RAG Pipeline Agent
    agent_pipeline = RAGAgentPipeline(
        base_url=BASE_URL,
        api_key=API_KEY,
        model_name=MODEL_NAME,
        documents=ALL_DOCUMENTS
    )

    # Compile the workflow graph
    graph = create_agentic_rag_graph(agent_pipeline)

    # Test cases to evaluate Agentic RAG routing, grading, rewriting, and grading
    test_queries = [
        # 1. Routing test (should route to retrieve)
        "What was ACME's total revenue in Q3 2024?",
        # 2. Distractor & Grading test (should filter distractors and locate remote stipend info)
        "What is the home office stipend for remote workers?",
        # 3. Query transformation & keyword matching (requires exact matches like "RS256" and "HS256")
        "What was the RS256 migration and when did it happen?",
        # 4. Direct answer route test (should answer directly without DB search)
        "Who wrote the play Hamlet and when was it written?",
        # 5. Complex answer grading & grounded check (requires synthesis of board decisions)
        "What is ACME's overall AI strategy and how does it connect to their current products?"
    ]

    for i, query in enumerate(test_queries, 1):
        print("\n" + "#" * 60)
        print(f"📊 Test Case {i}: Query: '{query}'")
        print("#" * 60)

        initial_state = AgentState(
            question=query,
            original_question=query,
            generation="",
            documents=[],
            steps=[],
            retries=0,
            max_retries=2,
            route="retrieve",
            relevant_found=False
        )

        final_state = graph.invoke(initial_state)

        print("\n💬 Final Answer:")
        print("-" * 50)
        print(final_state["generation"])
        print("-" * 50)
        print(f"🔄 Steps taken: {final_state['steps']}")
        print(f"🔄 Query rewrites (retries): {final_state['retries']}")

if __name__ == "__main__":
    test_agentic_rag()
