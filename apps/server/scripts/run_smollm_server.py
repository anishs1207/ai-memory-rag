import os
import sys
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

# Rule 2: Add comments explaining important logic
# Rule 5: Prefer clear variable names over short ones
# Set critical environment variables before importing PyTorch/NumPy to prevent OpenBLAS memory errors on Windows
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"

# Rule 3: Log each major step
print("[LOG] Starting SmolLM 135 SFT Server initialization...")

try:
    import torch
    # Limit PyTorch CPU threads to 1 to prevent Windows STATUS_ACCESS_VIOLATION (0xC0000005)
    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import PeftModel
except ImportError as import_error:
    print(f"[ERROR] Failed to import model libraries: {import_error}", flush=True)
    sys.exit(1)

# Paths for the local adapter weights and merged model weights
CPT_ADAPTER_DIRECTORY_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "models", "cpt_sec_adapter")
)
DPO_ADAPTER_DIRECTORY_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "models", "dpo_adapter")
)
FINANCIAL_MODEL_DIRECTORY_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "models", "sft_financial_qa_merged")
)

print(f"[LOG] Resolved CPT adapter path to: {CPT_ADAPTER_DIRECTORY_PATH}")
print(f"[LOG] Resolved DPO adapter path to: {DPO_ADAPTER_DIRECTORY_PATH}")
print(f"[LOG] Resolved Financial SFT model path to: {FINANCIAL_MODEL_DIRECTORY_PATH}")

# Active model states to allow dynamic, on-demand loading and save CPU memory
loaded_model_name = None
active_model = None
active_tokenizer = None

print("[LOG] Local SmolLM-135M CPT model and Financial SFT model initialization wrapper ready.")

class SmolLMRequestHandler(BaseHTTPRequestHandler):
    """
    HTTP Request handler that exposes a single POST endpoint at /generate
    to process incoming prompt requests and perform text generation.
    """
    def do_POST(self):
        if self.path == "/generate":
            content_length = int(self.headers.get('Content-Length', 0))
            raw_post_data = self.rfile.read(content_length)
            request_payload = json.loads(raw_post_data.decode('utf-8'))
            
            user_prompt = request_payload.get("prompt", "")
            requested_model = request_payload.get("model", "smollm")
            print(f"[LOG] Processing generation request for model: {requested_model}, prompt: {user_prompt[:60]}...", flush=True)
            
            # Format using standard chat templates for ChatML compatibility
            formatted_input_prompt = f"<|im_start|>user\n{user_prompt}<|im_end|>\n<|im_start|>assistant\n"
            
            # Dynamically load/switch model to save memory
            global loaded_model_name, active_model, active_tokenizer
            if requested_model != loaded_model_name:
                print(f"[LOG] Switching/Loading model from {loaded_model_name} to {requested_model}...", flush=True)
                # Clear previous model weights to free memory
                active_model = None
                active_tokenizer = None
                import gc
                gc.collect()
                
                if requested_model == "sf_financial_qa":
                    print("[LOG] Loading Financial SFT model tokenizer (use_fast=False)...", flush=True)
                    active_tokenizer = AutoTokenizer.from_pretrained(FINANCIAL_MODEL_DIRECTORY_PATH, use_fast=False)
                    print("[LOG] Loading local Financial SFT merged model...", flush=True)
                    active_model = AutoModelForCausalLM.from_pretrained(FINANCIAL_MODEL_DIRECTORY_PATH)
                elif requested_model in ("dpo", "dpo_adapter"):
                    print("[LOG] Loading DPO model tokenizer (use_fast=False)...", flush=True)
                    active_tokenizer = AutoTokenizer.from_pretrained(DPO_ADAPTER_DIRECTORY_PATH, use_fast=False)
                    print("[LOG] Loading HuggingFaceTB/SmolLM-135M-Instruct base model for DPO...", flush=True)
                    dpo_base_causal_model = AutoModelForCausalLM.from_pretrained("HuggingFaceTB/SmolLM-135M-Instruct")
                    print("[LOG] Loading local PEFT adapter weights for DPO...", flush=True)
                    active_model = PeftModel.from_pretrained(dpo_base_causal_model, DPO_ADAPTER_DIRECTORY_PATH)
                else:
                    # Fallback to CPT model configuration
                    print("[LOG] Loading CPT model tokenizer (use_fast=False)...", flush=True)
                    active_tokenizer = AutoTokenizer.from_pretrained(CPT_ADAPTER_DIRECTORY_PATH, use_fast=False)
                    print("[LOG] Loading HuggingFaceTB/SmolLM-135M-Instruct base model for CPT...", flush=True)
                    cpt_base_causal_model = AutoModelForCausalLM.from_pretrained("HuggingFaceTB/SmolLM-135M-Instruct")
                    print("[LOG] Loading local PEFT adapter weights for CPT...", flush=True)
                    active_model = PeftModel.from_pretrained(cpt_base_causal_model, CPT_ADAPTER_DIRECTORY_PATH)
                
                active_model.eval()
                loaded_model_name = requested_model
                print(f"[LOG] Model {requested_model} loaded successfully.", flush=True)
            
            input_tokens = active_tokenizer(formatted_input_prompt, return_tensors="pt")
            
            print(f"[LOG] Running {requested_model} model.generate on CPU...", flush=True)
            # Define end-of-generation stop tokens (tokenizer.eos_token and <|im_end|>)
            generation_eos_token_ids = [active_tokenizer.eos_token_id]
            im_end_token_id = active_tokenizer.convert_tokens_to_ids("<|im_end|>")
            if im_end_token_id is not None:
                generation_eos_token_ids.append(im_end_token_id)

            # Generate the response using PyTorch on CPU without gradients
            with torch.no_grad():
                generated_token_outputs = active_model.generate(
                    **input_tokens,
                    max_new_tokens=150,
                    temperature=0.7,
                    do_sample=True,
                    repetition_penalty=1.2,
                    eos_token_id=generation_eos_token_ids,
                    pad_token_id=active_tokenizer.eos_token_id
                )
            
            print("[LOG] Generation complete. Decoding tokens...", flush=True)
            # Extract the new assistant response slice from the generated outputs
            prompt_token_count = input_tokens.input_ids.shape[1]
            response_text = active_tokenizer.decode(
                generated_token_outputs[0][prompt_token_count:],
                skip_special_tokens=True
            )
            
            # Send HTTP response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            response_body = json.dumps({"response": response_text.strip()})
            self.wfile.write(response_body.encode('utf-8'))
            print("[LOG] Request completed successfully.", flush=True)
        else:
            self.send_response(404)
            self.end_headers()

def run_server(port_number=5002):
    server_address = ('127.0.0.1', port_number)
    http_daemon = HTTPServer(server_address, SmolLMRequestHandler)
    print(f"[LOG] SmolLM Server running at http://127.0.0.1:{port_number}")
    try:
        http_daemon.serve_forever()
    except KeyboardInterrupt:
        print("[LOG] Shutting down SmolLM Server...")
        http_daemon.server_close()

if __name__ == "__main__":
    target_port = 5002
    if len(sys.argv) > 1:
        target_port = int(sys.argv[1])
    run_server(target_port)
