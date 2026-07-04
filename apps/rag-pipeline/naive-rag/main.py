# imports
from sentence_transformers import CrossEncoder, SentenceTransformer
from sklearn.cluster import KMeans
import networkx as nx
from langgraph.graph import StateGraph, END
from typing import TypedDict, List
from dotenv import load_dotenv
import os
from openai import OpenAI
import chromadb
from typing import List, Tuple, Dict
from rank_bm25 import BM25Okapi
import re
from anthropic import Anthropic
import numpy as np
import json
import time
import re
import json
from data import DOCUMENTS, DISTRACTOR_DOCUMENTS

# production level rag pipeline, add api routes to support upload of pds, doc, etc rather here
load_dotenv()

# Global Variables
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai"
MODEL_NAME = "gemini-2.5-flash"
API_KEY = os.environ["GEMINI_API_KEY"]

class RAGV1:
    def __init__(self, base_url: str, api_key: str, DOCUMENTS, model_name: str):
        # created client for openai usage (for calling llms)
        self.client = OpenAI(
            base_url=base_url,
            api_key=api_key,
        )  # created client for openai usage (for calling llms)
        self.chroma = chromadb.Client()  # client for chromdb (local vector database)
        self.DOCUMENTS = DOCUMENTS
        # store the documents parsed here, all the chunks stored here with metadata also
        self.chunk_meta = []
        self.all_chunks = []
        # collections is the chromadbd
        self.collection = []
        self.embedder = SentenceTransformer(
            "all-MiniLM-L6-v2"
        )
        self.MODEL_NAME = model_name

    # INGESTION: CHUNKING (fixed chunking)
    def chunking_fixed_v1(self, text: str, chunk_size: int = 200, overlap: int = 50) -> List[str]:
        words = text.split()
        chunks = []

        for i in range(0, len(words), chunk_size - overlap):
            chunk = " ".join(words[i:i + chunk_size])
            if chunk.strip():
                chunks.append(chunk.strip())
        return chunks

    # INGESTION: Recursive/Semantic (senetnce based chuning)
    def chunking_recursive_v2(self, text: str, max_size: int = 200) -> List[str]:
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

        chunks = []
        for para in paragraphs:
            words = para.split()
            if len(words) <= max_size:
                chunks.append(para)
            else:
                sentences = para.replace(". ", ".\n").split("\n")
                current, current_len = [], 0
                for sent in sentences:
                    sent_len = len(sent.split())
                    if current_len + sent_len > max_size and current:
                        chunks.append(" ".join(current))
                        current, current_len = [sent], sent_len
                    else:
                        current.append(sent)
                        current_len += sent_len
                if current:
                    chunks.append(" ".join(current))

        return [c for c in chunks if len(c.split()) > 10]

    # print the chunking
    def print_chunking_v1(self, fixed_chunking: List[str]):
        print("=" * 60)
        print("FIXED-SIZE CHUNKING")
        print("=" * 60)
        for i, c in enumerate(fixed_chunking[:3]):
            print(f"\nChunk {i+1} ({len(c.split())} words):")
            print(c[:150], "...")

    # INGESTION: print the recursive chunking
    def print_chunking_v2(self, recursive_chunking: List[str]):
        print("\n" + "=" * 60)
        print("RECURSIVE CHUNKING")
        print("=" * 60)
        for i, c in enumerate(recursive_chunking[:3]):
            print(f"\nChunk {i+1} ({len(c.split())} words):")
            print(c[:150], "...")

        print("\n💡 Fixed cuts mid-thought. Recursive respects paragraph boundaries.")

      # NAIVE RAG:

    # INGESTION: embeddings (via use of text-embedding-3-small of openai)
    def get_embeddings_v1(self, texts: List[str], model: str = "text-embedding-3-small") -> List[List[float]]:
        """Batch embed texts with OpenAI."""
        cleaned = [t.replace("\n", " ").strip() for t in texts]
        resp = self.client.embeddings.create(input=cleaned, model=model)
        return [d.embedding for d in resp.data]

    # local for it
    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings locally using Sentence Transformers."""
        cleaned = [t.replace("\n", " ").strip() for t in texts]

        print("wrok1")

        embeddings = self.embedder.encode(
            cleaned,
            normalize_embeddings=True,
            convert_to_numpy=True,
            batch_size=32,
            show_progress_bar=False
        )

        return embeddings.tolist()

    # INGESTION: to get the embeddings
    def get_embedding(self, text: str) -> List[float]:
        return self.get_embeddings([text])[0]

    # INGESTION: to store embeddings here
    def store_embedding(self):
        try:
            self.chroma.delete_collection("naive_rag")
        except:
            pass

        self.collection = self.chroma.create_collection(
            "naive_rag", metadata={"hnsw:space": "cosine"})

        embs = self.get_embeddings(self.all_chunks)

        self.collection.add(
            ids=[f"chunk_{i}" for i in range(len(self.all_chunks))],
            embeddings=embs,
            documents=self.all_chunks,
            metadatas=self.chunk_meta
        )

        print(f"✅ Stored {len(self.all_chunks)} chunks in ChromaDB")

    # RETREIVAL: semantic search
    def sematic_search_v1(self, question: str, k: int = 5):
        print("isnide it")
        results = self.collection.query(
            query_embeddings=[self.get_embedding(question)],
            n_results=k
        )
        return results

    def naive_rag(self, question: str, k: int = 5, verbose: bool = True) -> str:
        """Simplest RAG: semantic search → stuff prompt → generate."""

        results = self.sematic_search_v1(question, k)

        docs = results["documents"][0]
        metas = results["metadatas"][0]
        dists = results["distances"][0]

        if verbose:
            print(f"\n🔍 Query: '{question}'")
            print(f"\nRetrieved {k} chunks:")
            for i, (d, m, dist) in enumerate(zip(docs, metas, dists)):
                print(f"  [{i+1}] dist={dist:.3f} | {m['title']}")
                print(f"      {d[:80]}...")

        context = "\n".join(
            f"[Source: {m['title']}]\n{d}" for d, m in zip(docs, metas)
        )

        # @WORKS

        resp = self.client.chat.completions.create(
            model=self.MODEL_NAME,
            temperature=0.0,
            messages=[{
                "role": "user",
                "content": f"""Answer based ONLY on the context below.
    If the context doesn't have the answer, say \"I don't have enough information.\"
    Cite your sources.

    Context:
    {context}

    Question: {question}

    Answer:"""}]
        )

        answer = resp.choices[0].message.content
        if verbose:
            print(f"\n💬 Answer:\n{answer}")
        return answer

# print the lodaded docs (rather add a pipeline for it)
# print(f"Loaded {len(DOCUMENTS)} documents")
# for doc in DOCUMENTS:
#     print(f"  • {doc['title']} ({len(doc['content'].split())} words)")

def test_ragv1():
    # apis to parse then it
    ragV1 = RAGV1(
        base_url=BASE_URL,
        api_key=API_KEY,
        DOCUMENTS=DOCUMENTS,
        model_name=MODEL_NAME
    )

    # view the loaded chunks here
    for doc in ragV1.DOCUMENTS:
        chunks = ragV1.chunking_recursive_v2(doc["content"], max_size=100)
        for chunk in chunks:
            ragV1.all_chunks.append(chunk)
            ragV1.chunk_meta.append(
                {"title": doc["title"], "source": doc["source"]})

    print(f"Total chunks: {len(ragV1.all_chunks)}")
    for doc in ragV1.DOCUMENTS:
        n = sum(1 for m in ragV1.chunk_meta if m["title"] == doc["title"])
        print(f"  {doc['title']}: {n} chunks")

    ragV1.store_embedding()

    # to test the naive rag pipeline (some smaple queries)
    print(ragV1.naive_rag("What was ACME's total revenue in Q3 2024?"))
    print(ragV1.naive_rag("What is the home office stipend for remote workers?"))
    print(ragV1.naive_rag("What changed on 2024-09-15?"))
    print(ragV1.naive_rag("What is the Slack command to trigger a rollback?"))
    print(ragV1.naive_rag("What was the RS256 migration and when did it happen?"))
    print(ragV1.naive_rag(
        "What is ACME's overall AI strategy and how does it connect to their current products?"))

# @WORKS (check once)
test_ragv1()