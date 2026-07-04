import { spawn, ChildProcess } from "child_process";
import path from "path";
import axios from "axios";

// Rule 5: Prefer clear variable names over short ones
let smollmServerProcess: ChildProcess | null = null;
const SMOL_LM_SERVER_PORT = 5002;
const SMOL_LM_SERVER_URL = `http://127.0.0.1:${SMOL_LM_SERVER_PORT}/generate`;

// Rule 2: Add comments explaining important logic
/**
 * Spawns the local Python HTTP microservice using the virtual environment's interpreter.
 * It configures thread-limiting environment variables for OpenBLAS on Windows.
 */
export function startSmolLMServer(): void {
    // Rule 3: Log each major step
    console.log("[LOG] Initializing local SmolLM server startup sequence...");

    const resolvedPythonPath = path.resolve(
        process.cwd(),
        "../rag-pipeline/.venv/Scripts/python.exe"
    );
    const resolvedScriptPath = path.resolve(
        process.cwd(),
        "scripts/run_smollm_server.py"
    );

    console.log(`[LOG] Launching Python process: ${resolvedPythonPath} with script: ${resolvedScriptPath}`);

    smollmServerProcess = spawn(resolvedPythonPath, ["-u", resolvedScriptPath, String(SMOL_LM_SERVER_PORT)], {
        env: {
            ...process.env,
            OPENBLAS_NUM_THREADS: "1",
            MKL_NUM_THREADS: "1",
            OMP_NUM_THREADS: "1",
            NUMEXPR_NUM_THREADS: "1",
            VECLIB_MAXIMUM_THREADS: "1"
        }
    });

    // Pipe the python script stdout to server console for monitoring
    smollmServerProcess.stdout?.on("data", (stdoutBuffer: Buffer) => {
        console.log(`[SmolLM-Server Stdout] ${stdoutBuffer.toString().trim()}`);
    });

    // Pipe stderr to console error output
    smollmServerProcess.stderr?.on("data", (stderrBuffer: Buffer) => {
        console.error(`[SmolLM-Server Stderr] ${stderrBuffer.toString().trim()}`);
    });

    smollmServerProcess.on("close", (exitCode: number | null) => {
        console.log(`[LOG] SmolLM server child process exited with status code: ${exitCode}`);
        smollmServerProcess = null;
    });
}

/**
 * Terminates the spawned Python server subprocess cleanly.
 */
export function stopSmolLMServer(): void {
    if (smollmServerProcess) {
        console.log("[LOG] Terminating SmolLM server child process...");
        smollmServerProcess.kill();
        smollmServerProcess = null;
    }
}

/**
 * Client function to query the local HTTP server.
 * Returns a response object matching the format expected by the backend controllers/utils.
 * @param promptText The user or system prompt to run inference on.
 */
export async function smollmClient(promptText: string): Promise<any> {
    console.log(`[LOG] Routing inference request to local SmolLM server on port ${SMOL_LM_SERVER_PORT}...`);
    try {
        const serverResponse = await axios.post(SMOL_LM_SERVER_URL, {
            prompt: promptText
        }, {
            headers: { "Content-Type": "application/json" },
            timeout: 180000 // 3-minute timeout for local CPU generation
        });

        const generatedResponseText = serverResponse.data.response || "";

        // Return a mock result structure that replicates standard Gemini SDK response
        return {
            text: () => generatedResponseText,
            response: {
                text: () => generatedResponseText
            },
            candidates: [
                {
                    content: {
                        parts: [
                            {
                                text: generatedResponseText
                            }
                        ]
                    }
                }
            ]
        };
    } catch (requestError: any) {
        console.error(`[ERROR] SmolLM server query failed: ${requestError.message}`);
        throw new Error(`Local model inference failure: ${requestError.message}`);
    }
}
