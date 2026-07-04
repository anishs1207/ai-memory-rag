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
from data.data import DOCUMENTS

load_dotenv()

# Global Variables
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai"
MODEL_NAME = "gemini-2.5-flash"
API_KEY = os.environ["GEMINI_API_KEY"]

class RAGV2():
    def __init__(self, base_url: str, api_key: str, DOCUMENTS, model_name: str):
        self.client = OpenAI(
            base_url=base_url,
            api_key=api_key,
        )
        self.ant = Anthropic()
        self.reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        self.chroma = chromadb.Client()
        self.chunk_meta = []
        self.all_chunks = []
        self.DOCUMENTS = DOCUMENTS
        self.collection = []
        self.ctx_collection = []
        self.reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        self.MODEL_NAME = model_name
        self.embedder = SentenceTransformer(
            "all-MiniLM-L6-v2"
        )
        self.ctx_chunks = []
        self.ctx_bm25 = None

    def tokenize(self, text: str) -> List[str]:
        """Simple whitespace + lowercase tokenizer for BM25."""
        return re.findall(r'\w+', text.lower())

    # RETREIVAL: add contextual reteival (the anthropic approach)
    # TAKES TOO MICH TIME TO RUN HERE
    def contextualize_chunk(self, chunk: str, full_doc: str, title: str) -> str:
        """Prepend LLM-generated context to a chunk before embedding."""
        # resp = self.ant.messages.create(
        resp = self.client.chat.completions.create(
            model=self.MODEL_NAME,
            temperature=0.0,
            # model="claude-sonnet-4-20250514",
            # max_tokens=150,
            messages=[{"role": "user", "content": f"""<document title="{title}">
    {full_doc}
    </document>

    Here is a chunk from that document:
    <chunk>
    {chunk}
    </chunk>

    Write a SHORT (2-3 sentence) context that situates this chunk within the document.
    Include: which document, what section/topic, key entities or time periods.
    This will be prepended to the chunk for search.

    Context:"""}]
        )
        # ctx = resp.content[0].text.strip()
        ctx = resp.choices[0].message.content
        # print("DONEONDNENENE")
        # it is too expsive to cal for all
        return f"{ctx}\n\n{chunk}"

    # Contextualize all chunks (makes LLM calls — takes 1-2 min) ---

    def create_contextualize_chunking(self):
        print("Contextualizing chunks... (LLM call per chunk, patience)")

        # @WORKS

        ctx_chunks = []
        for i, (chunk, meta) in enumerate(zip(self.all_chunks, self.chunk_meta)):
            doc = next(
                d for d in self.DOCUMENTS if d["title"] == meta["title"])
            ctx_chunks.append(self.contextualize_chunk(
                chunk, doc["content"], doc["title"]))
            if (i + 1) % 5 == 0:
                print(f"  {i+1}/{len(self.all_chunks)} done")

        print(f"\n✅ Contextualized {len(ctx_chunks)} chunks")
        self.ctx_chunks = ctx_chunks

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

    # RETREVIAL: hybrid search (semantic search + keyword search - bm25)

    def hybrid_search(self, question: str, k: int = 5) -> List[Dict]:
        """Combine semantic + BM25 with RRF."""

        # Semantic search (broad, top 20)
        sem = self.collection.query(
            query_embeddings=[self.get_embedding(question)], n_results=20)
        sem_ranked = [
            (int(id.split("_")[1]), dist)
            for id, dist in zip(sem["ids"][0], sem["distances"][0])
        ]

       
        # hyrid search - Build BM25 index over the same chunks
        # print(f"✅ Built BM25 index over {len(self.all_chunks)} chunks")

        # BM25 keyword search (top 20)
        scores = self.bm25.get_scores(self.tokenize(question))
        bm25_ranked = sorted(
            enumerate(scores), key=lambda x: x[1], reverse=True)[:20]

        # Fuse
        fused = self.reciprocal_rank_fusion(sem_ranked, bm25_ranked)

        return [
            {"chunk": self.all_chunks[idx],
                "meta": self.chunk_meta[idx], "score": sc}
            for idx, sc in fused[:k]
        ]

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

       # Re-embed and store contextualized chunks ---

    def create_embedding_and_store_contextualized_chunks(self):
        try:
            self.chroma.delete_collection("ctx_rag")
        except:
            pass

        self.ctx_collection = self.chroma.create_collection(
            "ctx_rag", metadata={"hnsw:space": "cosine"})

        ctx_embs = self.get_embeddings(self.ctx_chunks)
        self.ctx_collection.add(
            ids=[f"ctx_{i}" for i in range(len(self.ctx_chunks))],
            embeddings=ctx_embs,
            documents=self.ctx_chunks,
            metadatas=self.chunk_meta
        )

        # BM25 on contextualized chunks too

        print(f"✅ Stored {len(self.ctx_chunks)} contextualized chunks")

    def rerank(self, question: str, results: List[Dict], top_k: int = 3) -> List[Dict]:
        """Rerank results with cross-encoder."""
        pairs = [(question, r["chunk"]) for r in results]
        scores = self.reranker.predict(pairs)
        for r, s in zip(results, scores):
            r["rerank_score"] = float(s)
        return sorted(results, key=lambda x: x["rerank_score"], reverse=True)[:top_k]

    # RETREVIAL: Reciprocal Rank Fusion

    def reciprocal_rank_fusion(
        self,
        semantic: List[Tuple[int, float]],
        keyword: List[Tuple[int, float]],
        k: int = 60
    ) -> List[Tuple[int, float]]:
        """
        Merge two ranked lists with RRF.
        Simple, effective, no hyperparameters to tune.
        """
        scores = {}
        for rank, (idx, _) in enumerate(semantic):
            scores[idx] = scores.get(idx, 0) + 1 / (k + rank + 1)
        for rank, (idx, _) in enumerate(keyword):
            scores[idx] = scores.get(idx, 0) + 1 / (k + rank + 1)
        return sorted(scores.items(), key=lambda x: x[1], reverse=True)

    def ctx_hybrid_search(self, question: str, k: int = 5) -> List[Dict]:
        """Hybrid search over contextualized chunks."""
        sem = self.ctx_collection.query(
            query_embeddings=[self.get_embedding(question)], n_results=20)
        sem_ranked = [
            (int(id.split("_")[1]), dist)
            for id, dist in zip(sem["ids"][0], sem["distances"][0])
        ]

        scores = self.ctx_bm25.get_scores(self.tokenize(question))
        bm25_ranked = sorted(
            enumerate(scores), key=lambda x: x[1], reverse=True)[:20]

        fused = self.reciprocal_rank_fusion(sem_ranked, bm25_ranked)

        return [
            {
                "chunk": self.ctx_chunks[idx],
                "original": self.all_chunks[idx],
                "meta": self.chunk_meta[idx],
                "score": sc
            }
            for idx, sc in fused[:k]
        ]

    # HYBRID SEARCH RAG:
    def hybrid_rag_v1(self, question: str, k: int = 5, verbose: bool = True) -> str:
        """RAG with hybrid search."""

        results = self.hybrid_search(question, k)

        if verbose:
            print(f"\n🔍 Query: '{question}'")
            print(f"\nRetrieved {len(results)} chunks (hybrid):")
            for i, r in enumerate(results):
                print(f"  [{i+1}] RRF={r['score']:.4f} | {r['meta']['title']}")
                print(f"      {r['chunk'][:80]}...")

        context = "\n".join(
            f"[Source: {r['meta']['title']}]\n{r['chunk']}" for r in results
        )

        resp = self.client.chat.completions.create(
            model=self.MODEL_NAME,
            temperature=0.0,
            messages=[{"role": "user", "content": f"""Answer based ONLY on the context below.
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

    # HYBRID SEARCH + CONTEXT
    def full_rag_v2(self, question: str, verbose: bool = True) -> str:
        """
        The full pipeline:
        Contextual chunks → Hybrid search (top 10) → Rerank (top 3) → Generate
        """
        results = self.ctx_hybrid_search(question, k=10)
        top = self.rerank(question, results, top_k=3)

        if verbose:
            print(f"\n🔍 Query: '{question}'")
            print(f"\nTop 3 after reranking:")
            for i, r in enumerate(top):
                print(
                    f"  [{i+1}] rerank={r['rerank_score']:.3f} | {r['meta']['title']}")
                print(f"      {r['chunk'][:100]}...")

        context = "\n".join(
            f"[Source: {r['meta']['title']}]\n{r['chunk']}" for r in top
        )

        resp = self.client.chat.completions.create(
            model=self.MODEL_NAME,
            temperature=0.0,
            messages=[{"role": "user", "content": f"""Answer based ONLY on the context below.
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


def test_ragv2():
    ragV2 = RAGV2(
        base_url=BASE_URL,
        api_key=API_KEY,
        DOCUMENTS=DOCUMENTS,
        model_name=MODEL_NAME
    )

    # view the loaded chunks here
    for doc in ragV2.DOCUMENTS:
        chunks = ragV2.chunking_recursive_v2(doc["content"], max_size=100)
        for chunk in chunks:
            ragV2.all_chunks.append(chunk)
            ragV2.chunk_meta.append(
                {"title": doc["title"], "source": doc["source"]})

    # can show to display it
    print(f"Total chunks: {len(ragV2.all_chunks)}")
    for doc in ragV2.DOCUMENTS:
        n = sum(1 for m in ragV2.chunk_meta if m["title"] == doc["title"])
        print(f"  {doc['title']}: {n} chunks")

    ragV2.store_embedding()

    ragV2.bm25 = BM25Okapi(
        [ragV2.tokenize(c) for c in ragV2.all_chunks]
    )

    # now better perromane ater naive RAG (since it also uses keyword based chunking)
    # The date query — BM25 matches "2024-09-15" as a literal string
    # The slash command — BM25 finds "/deploy rollback" instantly
    # The acronym — BM25 distinguishes "RS256" from other tokens
    # print(ragV2.hybrid_rag_v1("What changed on 2024-09-15?"))
    # print(ragV2.hybrid_rag_v1(
    #     "What is the Slack command to trigger a rollback?"))
    # print(ragV2.hybrid_rag_v1(
    #     "What was the RS256 migration and when did it happen?"))

    # print("DONE HERE AND HERE")

    # now to add contet retreival (add context by llm (claude)) which addds context before chunk
    # BEFORE: "The company's revenue grew by 3%..."
    # AFTER:  "[From ACME Corp Q2 2023 SEC filing] The company's revenue grew by 3%..."
    # --- Test: the cross-doc question that's hard for naive RAG ---
    ragV2.create_contextualize_chunking()

    ragV2.ctx_bm25 = BM25Okapi(
        [ragV2.tokenize(c) for c in ragV2.ctx_chunks]
    )

    results = ragV2.ctx_hybrid_search(
        "What is ACME's AI strategy and how does it connect to current products?")
    print("Top 3 contextualized results:")

    for i, r in enumerate(results[:3]):
        print(f"\n[{i+1}] {r['meta']['title']}")
        print(f"    {r['chunk'][:150]}...")

    # test full pipeline:
    print(ragV2.full_rag_v2(
        "What are the known issues with ACME's authentication system?"))
    print(ragV2.full_rag_v2(
        "How much is ACME investing in AI and what are the board's concerns?"))
    print(ragV2.full_rag_v2(
        "What security measures protect remote workers and the authentication system?"))

# TEST RATHER SINCE THE CONTEXTUALISED PART GETS 90 APi CALLS
# add a fake one for ctx usage here and then do it
# AND THUS GETS RATE LIMITED
# test_ragv2()
# now check it

# can also add here contextal reranking
class RAGV3():
    def __init__(self, base_url: str, api_key: str, DOCUMENTS, model_name: str):
        self.client = OpenAI(
            base_url=base_url,
            api_key=api_key
        )
        self.chroma = chromadb.Client()
        self.ant = Anthropic()
        # LOAD the documents first
        self.DOCUMENTS = DOCUMENTS
        self.embedder = SentenceTransformer("all-MiniLM-L6-v2")
        self.doc_texts = ["%s. %s" %
                          (d['title'], d['content']) for d in self.DOCUMENTS]
        self.doc_embeddings = self.embedder.encode(
            self.doc_texts, normalize_embeddings=True)
        self.tokenized_docs = [text.lower().split() for text in self.doc_texts]
        self.bm25 = BM25Okapi(self.tokenized_docs)
        self.reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        self.all_chunks = []
        self.chunk_meta = []
        self.collection = []
        # add here {id, title, content}
        self.MODEL_NAME = model_name

    def chat(self, messages, temperature=0.3, max_tokens=1024):
        resp = self.client.chat.completions.create(
            model=self.MODEL_NAME, 
            messages=messages,
            temperature=temperature, 
            max_tokens=max_tokens
        )
        return resp.choices[0].message.content

    def semantic_search(self, query, top_k=3):
        q_emb = self.embedder.encode([query], normalize_embeddings=True)
        scores = np.dot(self.doc_embeddings, q_emb.T).flatten()
        top_idx = np.argsort(scores)[::-1][:top_k]
        return [(self.DOCUMENTS[i], float(scores[i])) for i in top_idx]

    def bm25_search(self, query, top_k=3):
        tokenized_query = query.lower().split()
        scores = self.bm25.get_scores(tokenized_query)
        top_idx = np.argsort(scores)[::-1][:top_k]
        return [(self.DOCUMENTS[i], float(scores[i])) for i in top_idx]

    def hybrid_search(self, query, top_k=3, k=60):
        """Reciprocal Rank Fusion: combines rankings from BM25 and semantic search."""
        sem_results = self.semantic_search(query, top_k=len(self.DOCUMENTS))
        bm25_results = self.bm25_search(query, top_k=len(self.DOCUMENTS))
        sem_ranks = {doc['id']: rank for rank,
                     (doc, _) in enumerate(sem_results)}
        bm25_ranks = {doc['id']: rank for rank,
                      (doc, _) in enumerate(bm25_results)}
        rrf_scores = {}
        for doc in self.DOCUMENTS:
            did = doc['id']
            rrf_scores[did] = 1.0/(k + sem_ranks[did]) + \
                1.0/(k + bm25_ranks[did])
        sorted_ids = sorted(rrf_scores, key=rrf_scores.get,
                            reverse=True)[:top_k]
        return [(next(d for d in self.DOCUMENTS if d['id'] == did), rrf_scores[did]) for did in sorted_ids]

    # local usgae
    def rerank(self, query, candidates, top_k=3):
        """Local, free, fast cross-encoder reranking that burns zero API tokens."""
        if not candidates:
            return []
        
        # format pairs for the sentence-transformer cross encoder
        pairs = [[query, f"{doc['title']} {doc['content']}"] for doc, _ in candidates]
        scores = self.reranker.predict(pairs)
        
        # Zip back with original candidates
        scored_candidates = [(candidates[i][0], float(scores[i])) for i in range(len(candidates))]
        
        # Sort descending by cross-encoder score
        return sorted(scored_candidates, key=lambda x: x[1], reverse=True)[:top_k]

    def hyde_search(self, query, top_k=3):
        msg = [{"role": "user", "content": "Write a short, factual paragraph that would answer this question. Do not say you don't know.\n\nQuestion: %s\n\nHypothetical answer:" % query}]
        hypo_answer = self.chat(msg, max_tokens=200)
        print("   Hypothetical answer: %s..." % hypo_answer[:150])
        hypo_emb = self.embedder.encode(
            [hypo_answer], normalize_embeddings=True)
        scores = np.dot(self.doc_embeddings, hypo_emb.T).flatten()
        top_idx = np.argsort(scores)[::-1][:top_k]
        return [(self.DOCUMENTS[i], float(scores[i])) for i in top_idx]

    def advanced_rag(self, query, use_hyde=True, use_rerank=True):
        print("\n" + "=" * 60)
        print("Query: %s" % query)
        print("   HyDE: %s | Reranking: %s" %
              ('ON' if use_hyde else 'OFF', 'ON' if use_rerank else 'OFF'))
        print("=" * 60)
        if use_hyde:
            print("\nStep 1: HyDE query transformation...")
            candidates = self.hyde_search(query, top_k=5)
        else:
            print("\nStep 1: Hybrid search...")
            candidates = self.hybrid_search(query, top_k=5)
        print("   Retrieved %d candidates" % len(candidates))
        if use_rerank:
            print("\nStep 2: Reranking...")
            final_docs = self.rerank(query, candidates, top_k=3)
        else:
            final_docs = candidates[:3]
        print("   Final docs:")
        for doc, _ in final_docs:
            print("      - Doc %d: %s" % (doc['id'], doc['title']))
        print("\nStep 3: Generating answer...")
        context = "\n\n".join("[%s]: %s" % (
            doc['title'], doc['content']) for doc, _ in final_docs)
        msg = [
            {"role": "system",
                "content": "Answer based on the provided context. Cite which document(s) you used."},
            {"role": "user", "content": "Context:\n%s\n\nQuestion: %s" %
                (context, query)}
        ]

        answer = self.chat(msg, max_tokens=500)
        print("\nAnswer: %s" % answer)
        return answer


def test_ragv3():
    ragV3 = RAGV3(
        base_url=BASE_URL,
        api_key=API_KEY,
        DOCUMENTS=DOCUMENTS_NEW,
        model_name=MODEL_NAME
    )

    # print to show the loaded documents here
    print("Loaded %d documents" % len(ragV3.DOCUMENTS))
    for d in ragV3.DOCUMENTS:
        print("   Doc %d: %s" % (d['id'], d['title']))

    # testing the semnatic search results
    query = "How do I handle an expired authentication token?"
    results = ragV3.semantic_search(query)
    print("Query: %s\n" % query)
    for doc, score in results:
        print("   [%.3f] Doc %d: %s" % (score, doc['id'], doc['title']))

    # testing the keyword based bm25 seaqrch here
    query = "HTTP 429 rate limit error"
    print("BM25 Query: %s\n" % query)
    for doc, score in ragV3.bm25_search(query):
        print("   [%.3f] Doc %d: %s" % (score, doc['id'], doc['title']))

    # testing semantic search
    print("\n--- Compare with semantic search ---\n")
    for doc, score in ragV3.semantic_search(query):
        print("   [%.3f] Doc %d: %s" % (score, doc['id'], doc['title']))

    print("\n--> BM25 catches exact keyword matches that semantic search might rank differently.")

    # hybrid seaqrch testing here (keyword + semantic search)
    query = "What happens when I get a 429 error on the authentication endpoint?"

    print("Query: %s\n" % query)

    print("Semantic only:")
    for doc, _ in ragV3.semantic_search(query):
        print("   Doc %d: %s" % (doc['id'], doc['title']))

    print("\nBM25 only:")
    for doc, _ in ragV3.bm25_search(query):
        print("   Doc %d: %s" % (doc['id'], doc['title']))

    print("\nHybrid (RRF):")
    for doc, score in ragV3.hybrid_search(query):
        print("   [%.4f] Doc %d: %s" % (score, doc['id'], doc['title']))
    print("\n--> Hybrid captures BOTH semantic meaning AND keyword matches.")

    # rerank testing here
    query = "How do I debug a login failure related to token expiry or rate limiting?"

    print("Query: %s\n" % query)
    candidates = ragV3.hybrid_search(query, top_k=6)
    print("Before reranking (hybrid top-6):")
    for doc, _ in candidates:
        print("   Doc %d: %s" % (doc['id'], doc['title']))
    reranked = ragV3.rerank(query, candidates, top_k=3)
    print("\nAfter LLM reranking (top-3):")
    for doc, _ in reranked:
        print("   Doc %d: %s" % (doc['id'], doc['title']))

    # testing hyde search
    query = "Our users can't log in, what could be wrong?"

    print("Query: %s\n" % query)
    print("Standard semantic search:")
    for doc, score in ragV3.semantic_search(query):
        print("   [%.3f] Doc %d: %s" % (score, doc['id'], doc['title']))
    print("\nHyDE search:")
    for doc, score in ragV3.hyde_search(query):
        print("   [%.3f] Doc %d: %s" % (score, doc['id'], doc['title']))
    print("\n--> HyDE generates a hypothetical answer mentioning tokens, auth, etc.")
    print("   This pulls in more relevant docs than the vague original query.")

    # tesing the full rag pipeline
    ragV3.advanced_rag(
        "Our users are getting 429 errors when trying to log in during peak hours. How should we fix this?")

    print("DONE HERE")

# works complelty
test_ragv3()

