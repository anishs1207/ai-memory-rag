"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardFooter,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
    ArrowUp,
    Bot,
    User,
    Upload,
    FileText,
    Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/mode-toggle";
import { Markdown } from "@/components/prompt-kit/markdown";
import { Loader } from "@/components/prompt-kit/loader";
import {
    ChatContainerRoot,
    ChatContainerContent,
    ChatContainerScrollAnchor,
} from "@/components/prompt-kit/chat-container";
import { ScrollButton } from "@/components/prompt-kit/scroll-button";

const SERVER_URL = "http://localhost:3001";

const ROUTE_MAP = {
    general: `${SERVER_URL}/api/v1/message/general`,
    finance: `${SERVER_URL}/api/v1/message/finance`,
    legal: `${SERVER_URL}/api/v1/message/legal`,
    pdf: `${SERVER_URL}/api/v1/message/chat-file`,
} as const;

type ModelType = "general" | "finance" | "legal" | "pdf";

type Message = {
    id: string;
    role: "user" | "agent";
    content: string;
    error?: boolean;
};

const MODEL_CONFIGS: Record<ModelType, { label: string; icon: any; color: string }> = {
    general: { label: "General", icon: Bot, color: "text-blue-500" },
    finance: { label: "Finance", icon: Hash, color: "text-green-500" },
    legal: { label: "Legal", icon: FileText, color: "text-purple-500" },
    pdf: { label: "PDF Chat", icon: FileText, color: "text-orange-500" },
};

export default function AgentChat() {
    const [model, setModel] = useState<ModelType>("general");
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [files, setFiles] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<string>("");
    const [uploading, setUploading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch files on mount
    useEffect(() => {
        fetchFiles();
    }, []);

    const fetchFiles = async () => {
        try {
            const res = await axios.get<{ success: boolean; data: string[] }>(
                `${SERVER_URL}/api/v1/message/get-files`
            );
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
            const res = await axios.post<{
                success: boolean;
                data?: any;
                error?: string;
            }>(`${SERVER_URL}/api/v1/message/upload-file`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            if (res.data.success) {
                fetchFiles();
                setModel("pdf");
                setSelectedFile(file.name);
            }
        } catch (err: any) {
            console.error("Upload failed", err);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const sendMessage = async () => {
        const prompt = input.trim();
        if (!prompt || loading) return;

        if (model === "pdf" && !selectedFile) {
            return;
        }

        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: prompt,
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const url = ROUTE_MAP[model];
            const payload =
                model === "pdf" ? { prompt, fileName: selectedFile } : { prompt };

            const response = await axios.post<{
                success: boolean;
                data?: string;
                error?: string;
            }>(url, payload);

            const agentMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "agent",
                content: response.data.data || "No response received.",
            };
            setMessages((prev) => [...prev, agentMsg]);
        } catch (err: any) {
            const errorMessage = err.response?.data?.error || err.message;
            const errMsg: Message = {
                id: (Date.now() + 2).toString(),
                role: "agent",
                content: `Error: ${errorMessage}`,
                error: true,
            };
            setMessages((prev) => [...prev, errMsg]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4 sm:p-8">
            <Card className="w-full max-w-4xl h-[85vh] flex flex-col shadow-lg border-border overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
                    <div className="flex items-center gap-2">
                        <Bot className="w-6 h-6 text-primary" />
                        <CardTitle className="text-xl font-bold">Agentic RAG</CardTitle>
                    </div>
                    <div className="flex items-center gap-">
                        <ModeToggle />
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            className="hidden"
                            accept=".pdf,.txt,.md"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="gap-2"
                        >
                            {uploading ? (
                                <Loader variant="circular" size="sm" />
                            ) : (
                                <Upload className="w-4 h-4" />
                            )}
                            <span className="hidden sm:inline">{uploading ? "Uploading..." : "Context"}</span>
                        </Button>
                    </div>
                </CardHeader>

                <div className="px-6 py-4 border-b bg-muted/30">
                    <div className="flex flex-wrap items-center gap-2">
                        {(Object.keys(MODEL_CONFIGS) as ModelType[]).map((m) => {
                            const Config = MODEL_CONFIGS[m];
                            return (
                                <Button
                                    key={m}
                                    variant={model === m ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setModel(m)}
                                    className="gap-1.5 cursor-pointer"
                                >
                                    <Config.icon className={cn("w-4 h-4", model === m ? "text-primary-foreground" : Config.color)} />
                                    {Config.label}
                                </Button>
                            );
                        })}
                    </div>

                    {model === "pdf" && files.length > 0 && (
                        <div className="flex items-center gap-2 mt-3">
                            <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                                Document
                            </Badge>
                            <Select value={selectedFile} onValueChange={setSelectedFile}>
                                <SelectTrigger className="h-8 text-xs w-[240px]">
                                    <SelectValue placeholder="Select a document" />
                                </SelectTrigger>
                                <SelectContent>
                                    {files.map((f) => (
                                        <SelectItem key={f} value={f} className="text-xs">
                                            {f}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                <CardContent className="flex-1 overflow-hidden p-0 relative">
                    <ChatContainerRoot className="h-full  overflow-y-auto">
                        <ChatContainerContent className="gap-6 pb-4">
                            {messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                                    <Bot className="w-12 h-12 mb-4" />
                                    <h3 className="text-lg font-medium">Ready to assist</h3>
                                    <p className="text-sm">Choose a model and start chatting</p>
                                </div>
                            )}

                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2",
                                        msg.role === "user" ? "flex-row-reverse" : "flex-row"
                                    )}
                                >
                                    <Avatar className="w-8 h-8 border">
                                        <AvatarFallback className="text-[10px] font-bold">
                                            {msg.role === "user" ? "U" : "AI"}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className={cn(
                                        "max-w-[80%] px-4 py-3 rounded-lg text-sm",
                                        msg.role === "user"
                                            ? "bg-primary text-primary-foreground"
                                            : msg.error
                                                ? "bg-destructive/10 text-destructive border border-destructive/20"
                                                : "bg-muted border border-border"
                                    )}>
                                        {msg.role === "agent" ? (
                                            <Markdown className="prose prose-sm dark:prose-invert max-w-none">
                                                {msg.content}
                                            </Markdown>
                                        ) : (
                                            <p className="whitespace-pre-wrap">{msg.content}</p>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {loading && (
                                <div className="flex items-start gap-4">
                                    <Avatar className="w-8 h-8 border">
                                        <AvatarFallback className="text-[10px] font-bold">AI</AvatarFallback>
                                    </Avatar>
                                    <div className="bg-muted border border-border px-4 py-3 rounded-lg flex items-center gap-3">
                                        <Loader variant="typing" size="sm" />
                                        <span className="text-xs text-muted-foreground">Thinking...</span>
                                    </div>
                                </div>
                            )}
                            <ChatContainerScrollAnchor />
                        </ChatContainerContent>
                        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50">
                            <ScrollButton className="shadow-lg" />
                        </div>
                    </ChatContainerRoot>
                </CardContent>

                <CardFooter className="p-4 border-t bg-muted/10">
                    <div className="relative w-full flex items-end gap-2">
                        <Textarea
                            placeholder={model === "pdf" ? "Ask about the document..." : "Type your message..."}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    sendMessage();
                                }
                            }}
                            className="min-h-[60px] max-h-[200px] resize-none pr-12 pt-3"
                            disabled={loading || (model === "pdf" && !selectedFile)}
                        />
                        <Button
                            size="icon"
                            onClick={sendMessage}
                            disabled={loading || !input.trim() || (model === "pdf" && !selectedFile)}
                            className="absolute right-2 bottom-2 h-8 w-8 rounded-md"
                        >
                            <ArrowUp className="w-4 h-4" />
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
