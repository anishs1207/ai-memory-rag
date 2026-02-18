// // hekps to visluae the memory (given a promot)
// see what all memrt is rteuend and visuliation of the memory here
// create a chat ui (for handking the memort part)
// add the ui form prompt kit ui later here

"use client";

import { useState } from "react";

/* ------------------ Types ------------------ */
type ModelType = "general" | "finance" | "legal";

type Message = {
    role: "user" | "agent";
    content: string;
};

type MemoryItem = {
    key: string;
    value: string;
    source: string;
};

/* ------------------ Page ------------------ */
export default function Page() {
    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-50">
            <AgentChat />
        </main>
    );
}

/* ------------------ Chat Component ------------------ */
function AgentChat() {
    const [model, setModel] = useState<ModelType>("general");
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [memory, setMemory] = useState<MemoryItem[]>([]);

    const sendMessage = () => {
        if (!input.trim()) return;

        const userMessage: Message = {
            role: "user",
            content: input,
        };

        // 🔹 MOCK memory extraction
        const extractedMemory: MemoryItem[] = [
            {
                key: "intent",
                value: input.slice(0, 40) + "...",
                source: model,
            },
            {
                key: "domain",
                value: model,
                source: "model-selector",
            },
        ];

        // 🔹 MOCK agent response
        const agentMessage: Message = {
            role: "agent",
            content: `🤖 (${model.toUpperCase()} AGENT): processed your request`,
        };

        setMessages((prev) => [...prev, userMessage, agentMessage]);
        setMemory((prev) => [...prev, ...extractedMemory]);
        setInput("");
    };

    return (
        <div className="w-full max-w-4xl grid grid-cols-3 gap-4 p-4 border rounded-xl bg-white">

            {/* ------------------ Chat Section ------------------ */}
            <div className="col-span-2 flex flex-col space-y-3">
                <h2 className="font-semibold text-lg">Agent Chat</h2>

                {/* Model Selector */}
                <select
                    value={model}
                    onChange={(e) => setModel(e.target.value as ModelType)}
                    className="border rounded px-2 py-1 w-40"
                >
                    <option value="general">General</option>
                    <option value="finance">Finance</option>
                    <option value="legal">Legal</option>
                </select>

                {/* Messages */}
                <div className="flex-1 border rounded p-2 space-y-2 overflow-y-auto">
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`p-2 rounded text-sm ${msg.role === "user"
                                ? "bg-blue-100 text-right"
                                : "bg-gray-100 text-left"
                                }`}
                        >
                            {msg.content}
                        </div>
                    ))}
                </div>

                {/* Input */}
                <div className="flex gap-2">
                    <input
                        className="flex-1 border rounded px-2 py-1"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Enter prompt..."
                    />
                    <button
                        onClick={sendMessage}
                        className="px-4 py-1 bg-black text-white rounded"
                    >
                        Send
                    </button>
                </div>
            </div>

            {/* ------------------ Memory Visualization ------------------ */}
            <MemoryPanel memory={memory} />
        </div>
    );
}

/* ------------------ Memory UI ------------------ */
function MemoryPanel({ memory }: { memory: MemoryItem[] }) {
    return (
        <div className="border rounded p-3 space-y-2">
            <h3 className="font-semibold">Memory State</h3>

            {memory.length === 0 && (
                <p className="text-sm text-gray-400">No memory yet</p>
            )}

            {memory.map((item, idx) => (
                <div
                    key={idx}
                    className="text-xs border rounded p-2 bg-gray-50"
                >
                    <div>
                        <strong>Key:</strong> {item.key}
                    </div>
                    <div>
                        <strong>Value:</strong> {item.value}
                    </div>
                    <div className="text-gray-400">
                        Source: {item.source}
                    </div>
                </div>
            ))}
        </div>
    );
}
