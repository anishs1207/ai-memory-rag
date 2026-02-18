import os
import json
import time
import hashlib
from pathlib import Path
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor

from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

# ------------------ CONFIG ------------------
ROOT_DIR = Path("apps/backend/src/assistants/legal-coach/resources-rag")
VECTOR_DB_PARENT = Path("apps/backend/src/assistants/legal-coach/vector-db")
CHECKPOINT_FILE = Path(__file__).parent / "processed_files.json"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
CHUNK_BATCH_SIZE = 100   # number of chunks per batch
CHUNK_WORKERS = 4         # threads per PDF embedding
# --------------------------------------------

# Embeddings (shared for all PDFs)
embeddings = HuggingFaceEmbeddings(model_name=EMBED_MODEL)

# ----------------- Helpers -----------------
def load_checkpoints():
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE, "r") as f:
            return json.load(f)
    return {}

def save_checkpoint(data):
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump(data, f, indent=2)

def list_pdfs():
    return list(ROOT_DIR.rglob("*.pdf"))

def hash_file(path):
    with open(path, "rb") as f:
        return hashlib.md5(f.read(2048)).hexdigest()

def load_and_chunk(pdf_path):
    loader = PyPDFLoader(str(pdf_path))
    docs = loader.load()
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP
    )
    chunks = splitter.split_documents(docs)
    for chunk in chunks:
        chunk.metadata["source"] = str(pdf_path)
    return chunks

def embed_and_store_chunks(chunks, db, start_idx=0):
    """Embed chunks in batches using threads"""
    total_chunks = len(chunks)
    with ThreadPoolExecutor(max_workers=CHUNK_WORKERS) as executor:
        for i in range(start_idx, total_chunks, CHUNK_BATCH_SIZE):
            batch = chunks[i : i + CHUNK_BATCH_SIZE]
            db.add_documents(batch)
            db.persist()
            yield i + len(batch)

def process_pdf(pdf_path_str, processed):
    pdf_path = Path(pdf_path_str)
    pdf_hash = hash_file(pdf_path)

    # Skip if PDF fully processed
    if pdf_path_str in processed:
        data = processed[pdf_path_str]
        if data.get("processed_chunks", 0) >= data.get("chunks", 0) and data.get("hash") == pdf_hash:
            print(f"✅ Skipping {pdf_path.name}, already completed.")
            return {"path": pdf_path_str, "chunks": data.get("chunks", 0), "error": None}

    # Each PDF gets its own Chroma folder
    pdf_name_safe = pdf_path.stem.replace(" ", "_").replace(".", "_")
    pdf_db_folder = VECTOR_DB_PARENT / pdf_name_safe
    pdf_db_folder.mkdir(parents=True, exist_ok=True)
    db = Chroma(persist_directory=str(pdf_db_folder), embedding_function=embeddings)

    try:
        chunks = load_and_chunk(pdf_path)
        total_chunks = len(chunks)
        resume_idx = processed.get(pdf_path_str, {}).get("processed_chunks", 0)

        if resume_idx > 0:
            print(f"⏩ Resuming {pdf_path.name} from chunk {resume_idx}/{total_chunks}")

        chunk_bar = tqdm(
            total=total_chunks,
            initial=resume_idx,
            desc=f"  {pdf_path.name}",
            ncols=100,
            leave=True,
            unit="chunk",
        )

        start_pdf_time = time.time()
        for next_idx in embed_and_store_chunks(chunks, db, resume_idx):
            processed[pdf_path_str] = {
                "hash": pdf_hash,
                "chunks": total_chunks,
                "processed_chunks": next_idx,
            }
            save_checkpoint(processed)

            # Update per-PDF ETA
            elapsed = time.time() - start_pdf_time
            done = next_idx
            remaining = total_chunks - done
            avg_time = elapsed / max(1, done)
            eta = remaining * avg_time
            chunk_bar.set_postfix_str(f"ETA: {eta/60:.1f} min")
            chunk_bar.update(next_idx - chunk_bar.n)

        chunk_bar.close()
        return {"path": pdf_path_str, "chunks": total_chunks, "error": None}

    except Exception as e:
        return {"path": pdf_path_str, "chunks": 0, "error": str(e)}

# ----------------- Main -----------------
def build_rag():
    pdf_paths = list_pdfs()
    processed = load_checkpoints()

    pending_pdfs = []
    for pdf_path in pdf_paths:
        pdf_str = str(pdf_path)
        pdf_hash = hash_file(pdf_path)
        if pdf_str not in processed or processed[pdf_str].get("hash") != pdf_hash:
            pending_pdfs.append(pdf_str)

    total_files = len(pdf_paths)
    remaining_files = len(pending_pdfs)
    print(f"\n📚 Total PDFs: {total_files} | To Process: {remaining_files}\n")

    if remaining_files == 0:
        print("✅ All PDFs are up to date.\n")
        return

    start_time = time.time()
    global_bar = tqdm(total=remaining_files, desc="Overall Progress", ncols=100)

    # Process PDFs **one by one**
    for pdf_str in pending_pdfs:
        result = process_pdf(pdf_str, processed)
        if result["error"]:
            print(f"❌ {pdf_str}: {result['error']}")
        else:
            print(f"✅ {Path(pdf_str).name} ({result['chunks']} chunks)")

        global_bar.update(1)
        done = global_bar.n
        remaining = remaining_files - done
        avg_time = (time.time() - start_time) / max(1, done)
        eta = remaining * avg_time
        global_bar.set_postfix_str(f"ETA: {eta/60:.1f} min")

    global_bar.close()
    total_time = time.time() - start_time
    print(f"\n🏁 Completed all PDFs in {total_time/60:.1f} minutes.\n")

if __name__ == "__main__":
    VECTOR_DB_PARENT.mkdir(parents=True, exist_ok=True)
    build_rag()

# import os
# import json
# import time
# import hashlib
# from pathlib import Path
# from tqdm import tqdm
# from concurrent.futures import ThreadPoolExecutor

# from langchain_community.document_loaders import PyPDFLoader
# from langchain.text_splitter import RecursiveCharacterTextSplitter
# from langchain_community.vectorstores import Chroma
# from langchain_community.embeddings import HuggingFaceEmbeddings

# # ------------------ CONFIG ------------------
# ROOT_DIR = Path("apps/backend/src/assistants/legal-coach/resources-rag")
# VECTOR_DB_PARENT = Path("apps/backend/src/assistants/legal-coach/vector-db")
# CHECKPOINT_FILE = Path(__file__).parent / "processed_files.json"
# CHUNK_SIZE = 1000
# CHUNK_OVERLAP = 200
# EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
# CHUNK_BATCH_SIZE = 100  # number of chunks per batch
# CHUNK_WORKERS = 4        # threads per PDF embedding
# # --------------------------------------------

# # Embeddings (shared for all PDFs)
# embeddings = HuggingFaceEmbeddings(model_name=EMBED_MODEL)

# # ----------------- Helpers -----------------
# def load_checkpoints():
#     if CHECKPOINT_FILE.exists():
#         with open(CHECKPOINT_FILE, "r") as f:
#             return json.load(f)
#     return {}

# def save_checkpoint(data):
#     with open(CHECKPOINT_FILE, "w") as f:
#         json.dump(data, f, indent=2)

# def list_pdfs():
#     return list(ROOT_DIR.rglob("*.pdf"))

# def hash_file(path):
#     with open(path, "rb") as f:
#         return hashlib.md5(f.read(2048)).hexdigest()

# def load_and_chunk(pdf_path):
#     loader = PyPDFLoader(str(pdf_path))
#     docs = loader.load()
#     splitter = RecursiveCharacterTextSplitter(
#         chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP
#     )
#     chunks = splitter.split_documents(docs)
#     for chunk in chunks:
#         chunk.metadata["source"] = str(pdf_path)
#     return chunks

# def embed_and_store_chunks(chunks, db, start_idx=0):
#     """Embed chunks in batches with thread pool"""
#     total_chunks = len(chunks)
#     with ThreadPoolExecutor(max_workers=CHUNK_WORKERS) as executor:
#         for i in range(start_idx, total_chunks, CHUNK_BATCH_SIZE):
#             batch = chunks[i : i + CHUNK_BATCH_SIZE]
#             db.add_documents(batch)
#             db.persist()  # Chroma now auto-persist, but safe
#             yield i + len(batch)

# def process_pdf(pdf_path_str, processed):
#     pdf_path = Path(pdf_path_str)
#     pdf_hash = hash_file(pdf_path)

#     # Each PDF gets its own Chroma folder
#     pdf_name_safe = pdf_path.stem.replace(" ", "_").replace(".", "_")
#     pdf_db_folder = VECTOR_DB_PARENT / pdf_name_safe
#     pdf_db_folder.mkdir(parents=True, exist_ok=True)
#     db = Chroma(persist_directory=str(pdf_db_folder), embedding_function=embeddings)

#     try:
#         chunks = load_and_chunk(pdf_path)
#         total_chunks = len(chunks)

#         resume_idx = processed.get(pdf_path_str, {}).get("processed_chunks", 0)
#         if resume_idx > 0:
#             print(f"⏩ Resuming {pdf_path.name} from chunk {resume_idx}/{total_chunks}")

#         chunk_bar = tqdm(
#             total=total_chunks,
#             initial=resume_idx,
#             desc=f"  {pdf_path.name}",
#             ncols=100,
#             leave=False,
#         )

#         for next_idx in embed_and_store_chunks(chunks, db, resume_idx):
#             processed[pdf_path_str] = {
#                 "hash": pdf_hash,
#                 "chunks": total_chunks,
#                 "processed_chunks": next_idx,
#             }
#             save_checkpoint(processed)
#             chunk_bar.update(next_idx - chunk_bar.n)

#         chunk_bar.close()
#         return {"path": pdf_path_str, "chunks": total_chunks, "error": None}

#     except Exception as e:
#         return {"path": pdf_path_str, "chunks": 0, "error": str(e)}

# # ----------------- Main -----------------
# def build_rag():
#     pdf_paths = list_pdfs()
#     processed = load_checkpoints()

#     # Filter PDFs to process
#     pending_pdfs = []
#     for pdf_path in pdf_paths:
#         pdf_str = str(pdf_path)
#         pdf_hash = hash_file(pdf_path)
#         if pdf_str not in processed or processed[pdf_str].get("hash") != pdf_hash:
#             pending_pdfs.append(pdf_str)

#     total_files = len(pdf_paths)
#     remaining_files = len(pending_pdfs)
#     print(f"\n📚 Total PDFs: {total_files} | To Process: {remaining_files}\n")

#     if remaining_files == 0:
#         print("✅ All PDFs are up to date.\n")
#         return

#     start_time = time.time()
#     global_bar = tqdm(total=remaining_files, desc="Overall Progress", ncols=100)

#     # Process PDFs one by one (parallel chunks inside PDF)
#     for pdf_str in pending_pdfs:
#         result = process_pdf(pdf_str, processed)
#         if result["error"]:
#             print(f"❌ {pdf_str}: {result['error']}")
#         else:
#             print(f"✅ {Path(pdf_str).name} ({result['chunks']} chunks)")

#         global_bar.update(1)
#         done = global_bar.n
#         remaining = remaining_files - done
#         avg_time = (time.time() - start_time) / max(1, done)
#         eta = remaining * avg_time
#         global_bar.set_postfix_str(f"ETA: {eta/60:.1f} min")

#     global_bar.close()
#     total_time = time.time() - start_time
#     print(f"\n🏁 Completed all PDFs in {total_time/60:.1f} minutes.\n")


# if __name__ == "__main__":
#     VECTOR_DB_PARENT.mkdir(parents=True, exist_ok=True)
#     build_rag()



# import os
# import json
# import time
# import hashlib
# import multiprocessing
# from pathlib import Path
# from tqdm import tqdm
# from concurrent.futures import ProcessPoolExecutor, as_completed, ThreadPoolExecutor

# from langchain_community.document_loaders import PyPDFLoader
# from langchain.text_splitter import RecursiveCharacterTextSplitter
# from langchain_community.vectorstores import Chroma
# from langchain_community.embeddings import HuggingFaceEmbeddings

# # ------------------ CONFIG ------------------
# ROOT_DIR = Path("apps/backend/src/assistants/legal-coach/resources-rag")
# VECTOR_DB_PATH = "./vector-db/legal"
# CHECKPOINT_FILE = "processed_files.json"
# CHUNK_SIZE = 1000
# CHUNK_OVERLAP = 200
# EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
# PDF_WORKERS = max(1, multiprocessing.cpu_count() - 1)  # parallel PDFs
# CHUNK_BATCH_SIZE = 100  # batch size per embedding
# CHUNK_WORKERS = 4  # threads per PDF to embed chunks
# # --------------------------------------------

# embeddings = HuggingFaceEmbeddings(model_name=EMBED_MODEL)
# db = Chroma(persist_directory=VECTOR_DB_PATH, embedding_function=embeddings)


# # ----------------- Helpers -----------------
# def load_checkpoints():
#     if Path(CHECKPOINT_FILE).exists():
#         with open(CHECKPOINT_FILE, "r") as f:
#             return json.load(f)
#     return {}


# def save_checkpoint(data):
#     with open(CHECKPOINT_FILE, "w") as f:
#         json.dump(data, f, indent=2)


# def list_pdfs():
#     return list(ROOT_DIR.rglob("*.pdf"))


# def hash_file(path):
#     with open(path, "rb") as f:
#         return hashlib.md5(f.read(2048)).hexdigest()


# def load_and_chunk(pdf_path):
#     loader = PyPDFLoader(str(pdf_path))
#     docs = loader.load()
#     splitter = RecursiveCharacterTextSplitter(
#         chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP
#     )
#     chunks = splitter.split_documents(docs)
#     for chunk in chunks:
#         chunk.metadata["source"] = str(pdf_path)
#     return chunks


# def embed_and_store_chunks(chunks, start_idx=0):
#     """Embed chunks in batches with thread pool"""
#     total_chunks = len(chunks)
#     with ThreadPoolExecutor(max_workers=CHUNK_WORKERS) as executor:
#         for i in range(start_idx, total_chunks, CHUNK_BATCH_SIZE):
#             batch = chunks[i : i + CHUNK_BATCH_SIZE]
#             db.add_documents(batch)
#             db.persist()
#             yield i + len(batch)


# def process_pdf(pdf_path_str, processed):
#     pdf_path = Path(pdf_path_str)
#     pdf_hash = hash_file(pdf_path)
#     try:
#         chunks = load_and_chunk(pdf_path)
#         total_chunks = len(chunks)

#         resume_idx = processed.get(pdf_path_str, {}).get("processed_chunks", 0)
#         if resume_idx > 0:
#             print(f"⏩ Resuming {os.path.basename(pdf_path)} from chunk {resume_idx}/{total_chunks}")

#         chunk_bar = tqdm(
#             total=total_chunks,
#             initial=resume_idx,
#             desc=f"  {os.path.basename(pdf_path)}",
#             ncols=100,
#             leave=False,
#         )

#         for next_idx in embed_and_store_chunks(chunks, resume_idx):
#             processed[pdf_path_str] = {
#                 "hash": pdf_hash,
#                 "chunks": total_chunks,
#                 "processed_chunks": next_idx,
#             }
#             save_checkpoint(processed)
#             chunk_bar.update(next_idx - chunk_bar.n)

#         chunk_bar.close()
#         return {"path": pdf_path_str, "chunks": total_chunks, "error": None}

#     except Exception as e:
#         return {"path": pdf_path_str, "chunks": 0, "error": str(e)}


# # ----------------- Main -----------------
# def build_rag():
#     pdf_paths = list_pdfs()
#     processed = load_checkpoints()

#     # Filter PDFs to process
#     pending_pdfs = []
#     for pdf_path in pdf_paths:
#         pdf_str = str(pdf_path)
#         pdf_hash = hash_file(pdf_path)
#         if pdf_str not in processed or processed[pdf_str].get("hash") != pdf_hash:
#             pending_pdfs.append(pdf_str)

#     total_files = len(pdf_paths)
#     remaining_files = len(pending_pdfs)
#     print(f"\n📚 Total PDFs: {total_files} | To Process: {remaining_files}\n")

#     if remaining_files == 0:
#         print("✅ All PDFs are up to date.\n")
#         return

#     start_time = time.time()
#     global_bar = tqdm(total=remaining_files, desc="Overall Progress", ncols=100)

#     # Parallel PDF processing
#     with ProcessPoolExecutor(max_workers=PDF_WORKERS) as executor:
#         future_to_pdf = {executor.submit(process_pdf, pdf, processed): pdf for pdf in pending_pdfs}

#         for future in as_completed(future_to_pdf):
#             pdf_str = future_to_pdf[future]
#             try:
#                 result = future.result()
#                 if result["error"]:
#                     print(f"❌ {pdf_str}: {result['error']}")
#                 else:
#                     print(f"✅ {os.path.basename(pdf_str)} ({result['chunks']} chunks)")

#             except Exception as e:
#                 print(f"❌ Error processing {pdf_str}: {e}")

#             global_bar.update(1)
#             done = global_bar.n
#             remaining = remaining_files - done
#             avg_time = (time.time() - start_time) / max(1, done)
#             eta = remaining * avg_time
#             global_bar.set_postfix_str(f"ETA: {eta/60:.1f} min")

#     global_bar.close()
#     total_time = time.time() - start_time
#     print(f"\n🏁 Completed all PDFs in {total_time/60:.1f} minutes.\n")


# if __name__ == "__main__":
#     build_rag()
