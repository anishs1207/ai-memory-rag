"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";

const SERVER_URL = "http://localhost:3001";

const ROUTE_MAP = {
    general: `${SERVER_URL}/api/v1/message/general`,
    finance: `${SERVER_URL}/api/v1/message/finance`,
    legal: `${SERVER_URL}/api/v1/message/legal`,
    pdf: `${SERVER_URL}/api/v1/message/chat-file`,
} as const;

type ModelType = "general" | "finance" | "legal" | "pdf";

type Message = {
    role: "user" | "agent";
    content: string;
    error?: boolean;
};

export default function AgentChat() {
    const [model, setModel] = useState<ModelType>("general");
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [files, setFiles] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<string>("");
    const [uploading, setUploading] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    // Fetch files on mount
    useEffect(() => {
        fetchFiles();
    }, []);

    const fetchFiles = async () => {
        try {
            const res = await axios.get<{ success: boolean; data: string[] }>(`${SERVER_URL}/api/v1/message/get-files`);
            if (res.data.success) {
                setFiles(res.data.data);
                if (res.data.data.length > 0 && !selectedFile) {
                    const firstFile = res.data.data[0];
                    if (firstFile) setSelectedFile(firstFile);
                }
            }
        } catch (err) {
            console.error("Failed to fetch files", err);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        setUploading(true);
        try {
            const res = await axios.post<{ success: boolean; data?: any; error?: string }>(`${SERVER_URL}/api/v1/message/upload-file`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            if (res.data.success) {
                alert("File uploaded successfully!");
                fetchFiles();
                setModel("pdf");
                setSelectedFile(file.name);
            }
        } catch (err: any) {
            alert("Upload failed: " + (err.response?.data?.error || err.message));
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const sendMessage = async () => {
        const prompt = input.trim();
        if (!prompt || loading) return;

        if (model === "pdf" && !selectedFile) {
            alert("Please upload and select a PDF first.");
            return;
        }

        const userMsg: Message = { role: "user", content: prompt };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const url = ROUTE_MAP[model];
            const payload = model === "pdf"
                ? { prompt, fileName: selectedFile }
                : { prompt };

            const response = await axios.post<{ success: boolean; data?: string; error?: string }>(url, payload);

            const agentMsg: Message = {
                role: "agent",
                content: response.data.data || "No response received.",
            };
            setMessages((prev) => [...prev, agentMsg]);
        } catch (err: any) {
            const errorMessage = err.response?.data?.error || err.message;
            const errMsg: Message = {
                role: "agent",
                content: `❌ Error: ${errorMessage}`,
                error: true,
            };
            setMessages((prev) => [...prev, errMsg]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const MODEL_LABELS: Record<ModelType, string> = {
        general: "🤖 General",
        finance: "💰 Finance",
        legal: "⚖️ Legal",
        pdf: "📄 PDF Chat",
    };

    return (
        <div className="w-full max-w-3xl flex flex-col space-y-4 p-4 border rounded-xl bg-white shadow-md min-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="font-semibold text-xl">Agent Chat</h2>
                <div className="flex items-center gap-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".pdf,.txt,.md"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded border transition-colors disabled:opacity-50"
                    >
                        {uploading ? "Uploading..." : "Upload PDF"}
                    </button>
                    <span className="text-xs text-gray-400">
                        {ROUTE_MAP[model].replace(SERVER_URL, "")}
                    </span>
                </div>
            </div>

            {/* Model Selector & PDF Selector */}
            <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                    {(Object.keys(MODEL_LABELS) as ModelType[]).map((m) => (
                        <button
                            key={m}
                            onClick={() => setModel(m)}
                            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${model === m
                                ? "bg-black text-white border-black"
                                : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"
                                }`}
                        >
                            {MODEL_LABELS[m]}
                        </button>
                    ))}
                </div>

                {model === "pdf" && files.length > 0 && (
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-gray-500">Active Document:</label>
                        <select
                            value={selectedFile}
                            onChange={(e) => setSelectedFile(e.target.value)}
                            className="text-xs border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-black"
                        >
                            {files.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 border rounded-lg p-3 space-y-3 overflow-y-auto bg-gray-50 min-h-[400px] max-h-[500px]">
                {messages.length === 0 && (
                    <p className="text-sm text-gray-400 text-center mt-16">
                        {model === "pdf"
                            ? selectedFile
                                ? `Chatting with: ${selectedFile}`
                                : "Upload a PDF to start chatting with it."
                            : `Send a message to start chatting with the ${MODEL_LABELS[model]} agent.`
                        }
                    </p>
                )}

                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                        <div
                            className={`px-4 py-2 rounded-2xl text-sm max-w-[80%] whitespace-pre-wrap ${msg.role === "user"
                                ? "bg-black text-white rounded-br-sm"
                                : msg.error
                                    ? "bg-red-50 text-red-700 border border-red-200 rounded-bl-sm"
                                    : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"
                                }`}
                        >
                            {msg.role === "agent" && !msg.error && (
                                <span className="text-xs text-gray-400 block mb-1">
                                    {model === "pdf" ? `📄 ${selectedFile}` : `${MODEL_LABELS[model]} Agent`}
                                </span>
                            )}
                            {msg.content}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="px-4 py-2 rounded-2xl rounded-bl-sm bg-white border border-gray-200 text-sm text-gray-500 flex items-center gap-2">
                            <span className="animate-pulse">●</span>
                            <span className="animate-pulse delay-100">●</span>
                            <span className="animate-pulse delay-200">●</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2">
                <input
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={model === "pdf" ? `Ask about ${selectedFile || "document"}...` : `Ask the ${MODEL_LABELS[model]} agent...`}
                    disabled={loading}
                />
                <button
                    onClick={sendMessage}
                    disabled={loading || !input.trim() || (model === "pdf" && !selectedFile)}
                    className="px-5 py-2 bg-black text-white text-sm rounded-lg disabled:opacity-40 hover:bg-gray-800 transition-colors"
                >
                    {loading ? "..." : "Send"}
                </button>
            </div>

            {/* Footer note */}
            <p className="text-xs text-gray-400 text-center">
                Press <kbd className="border rounded px-1">Enter</kbd> to send. Switch agents above to change model.
            </p>
        </div>
    );
}
