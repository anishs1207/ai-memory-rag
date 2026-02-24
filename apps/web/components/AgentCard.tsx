"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
    PromptInput,
    PromptInputAction,
    PromptInputActions,
    PromptInputTextarea,
} from "@/components/prompt-kit/prompt-input";
import {
    ChatContainerRoot,
    ChatContainerContent,
    ChatContainerScrollAnchor,
} from "@/components/prompt-kit/chat-container";
import { Markdown } from "@/components/prompt-kit/markdown";
import { Loader } from "@/components/prompt-kit/loader";
import { ScrollButton } from "@/components/prompt-kit/scroll-button";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    ArrowUp,
    X,
    Paperclip,
    Square,
    Bot,
    User,
    Upload,
    FileText,
    AlertCircle,
    Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    general: { label: "General", icon: Bot, color: "bg-blue-500" },
    finance: { label: "Finance", icon: Hash, color: "bg-green-500" },
    legal: { label: "Legal", icon: FileText, color: "bg-purple-500" },
    pdf: { label: "PDF Chat", icon: FileText, color: "bg-orange-500" },
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
                content: `❌ Error: ${errorMessage}`,
                error: true,
            };
            setMessages((prev) => [...prev, errMsg]);
        } finally {
            setLoading(false);
        }
    };

    return (
        // <Card className="w-full max-w-4xl flex flex-col h-[85vh] bg-background border shadow-2xl overflow-hidden rounded-3xl">
        <Card className="w-full h-screen flex flex-col bg-background overflow-hidden rounded-none">
            <CardHeader className="border-b bg-muted/30 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Bot className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Agentic Intelligence</CardTitle>
                            <CardDescription className="text-xs">
                                Switch models to specialize in different domains
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                            className="h-8 rounded-full text-xs gap-2"
                        >
                            {uploading ? (
                                <Loader variant="circular" size="sm" />
                            ) : (
                                <Upload className="w-3.5 h-3.5" />
                            )}
                            {uploading ? "Uploading..." : "Upload Context"}
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-4">
                    {(Object.keys(MODEL_CONFIGS) as ModelType[]).map((m) => {
                        const Config = MODEL_CONFIGS[m];
                        return (
                            <Button
                                key={m}
                                variant={model === m ? "default" : "secondary"}
                                size="sm"
                                onClick={() => setModel(m)}
                                className={cn(
                                    "h-8 rounded-full text-xs font-semibold gap-2 transition-all",
                                    model === m ? "shadow-lg scale-105" : "hover:bg-muted"
                                )}
                            >
                                <Config.icon className="w-3.5 h-3.5" />
                                {Config.label}
                            </Button>
                        );
                    })}
                </div>

                {model === "pdf" && files.length > 0 && (
                    <div className="flex items-center gap-2 mt-3 animate-in fade-in slide-in-from-top-2">
                        <Badge variant="outline" className="h-6 text-[10px] uppercase tracking-wider font-bold text-gray-400 border-dashed">
                            Active Context
                        </Badge>
                        <Select value={selectedFile} onValueChange={setSelectedFile}>
                            <SelectTrigger className="h-7 text-xs w-[240px] bg-transparent border-none p-0 focus:ring-0">
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
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-0 relative overflow-hidden">
                <ChatContainerRoot className="flex-1 px-6 py-6 scrollbar-thin scrollbar-thumb-muted-foreground/10 hover:scrollbar-thumb-muted-foreground/20">
                    <ChatContainerContent className="gap-6 pb-4">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full mt-24 text-center space-y-4 opacity-50">
                                <div className="p-4 bg-muted rounded-full">
                                    <Bot className="w-12 h-12" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Start a Conversation</h3>
                                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                        {model === "pdf"
                                            ? selectedFile
                                                ? `How can I help you with "${selectedFile}"?`
                                                : "Upload a PDF to begin document-aware chatting."
                                            : `I'm ready to assist with ${MODEL_CONFIGS[model].label.toLowerCase()} tasks.`}
                                    </p>
                                </div>
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
                                <Avatar className={cn("w-8 h-8 mt-1", msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                    <AvatarFallback className="text-[10px] font-bold">
                                        {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                    </AvatarFallback>
                                </Avatar>

                                <div className={cn(
                                    "relative max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed transition-all",
                                    msg.role === "user"
                                        ? "bg-primary text-primary-foreground rounded-tr-none shadow-sm"
                                        : msg.error
                                            ? "bg-destructive/10 text-destructive border border-destructive/20 rounded-tl-none"
                                            : "bg-muted/50 text-foreground border border-border rounded-tl-none"
                                )}>
                                    {msg.role === "agent" && !msg.error && (
                                        <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-border/50">
                                            <div className={cn("size-2 rounded-full", MODEL_CONFIGS[model].color)} />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                {model === "pdf" ? selectedFile : `${MODEL_CONFIGS[model].label} Intelligence`}
                                            </span>
                                        </div>
                                    )}
                                    {msg.role === "agent" ? (
                                        <Markdown className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0">
                                            {msg.content}
                                        </Markdown>
                                    ) : (
                                        msg.content
                                    )}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex items-start gap-4">
                                <Avatar className="w-8 h-8 mt-1 bg-muted">
                                    <AvatarFallback>
                                        <Bot className="w-4 h-4" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="bg-muted/30 px-4 py-3 rounded-2xl rounded-tl-none border border-border flex items-center gap-3">
                                    <Loader variant="typing" size="sm" />
                                    <span className="text-xs text-muted-foreground font-medium animate-pulse">
                                        Synthesizing response...
                                    </span>
                                </div>
                            </div>
                        )}
                        <ChatContainerScrollAnchor />
                    </ChatContainerContent>
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
                        <ScrollButton className="shadow-2xl hover:scale-110 active:scale-95 transition-all bg-background/80 backdrop-blur-sm" />
                    </div>
                </ChatContainerRoot>

                <div className="px-6 py-6 border-t bg-muted/20">
                    <PromptInput
                        value={input}
                        onValueChange={setInput}
                        onSubmit={sendMessage}
                        disabled={loading || (model === "pdf" && !selectedFile)}
                        className="rounded-[2rem] border-border shadow-xl ring-offset-background focus-within:ring-2 focus-within:ring-primary/20 transition-all max-w-full"
                    >
                        <PromptInputTextarea
                            placeholder={
                                model === "pdf"
                                    ? selectedFile
                                        ? `Ask about ${selectedFile}...`
                                        : "Selection required..."
                                    : `Consulting ${MODEL_CONFIGS[model].label} Brain...`
                            }
                            className="px-4 py-3"
                        />

                        <PromptInputActions className="px-4 pb-2 flex items-center justify-between">
                            <div className="flex items-center gap-1">
                                <PromptInputAction tooltip="Context Protocol">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="h-8 w-8 rounded-full text-muted-foreground hover:bg-primary/5 hover:text-primary transition-colors"
                                    >
                                        <Paperclip className="size-4" />
                                    </Button>
                                </PromptInputAction>
                                <div className="h-4 w-px bg-border mx-1" />
                                <Badge variant="outline" className="h-6 text-[10px] font-bold text-muted-foreground border-border/50 bg-background/50">
                                    {model.toUpperCase()}
                                </Badge>
                            </div>

                            <PromptInputAction tooltip={loading ? "Interrupt generation" : "Transmit"}>
                                <Button
                                    variant="default"
                                    size="icon"
                                    className={cn(
                                        "h-10 w-10 rounded-full transition-all",
                                        input.trim() ? "scale-100 opacity-100" : "scale-90 opacity-50"
                                    )}
                                    onClick={sendMessage}
                                    disabled={loading || !input.trim() || (model === "pdf" && !selectedFile)}
                                >
                                    {loading ? (
                                        <Square className="size-4 fill-current" />
                                    ) : (
                                        <ArrowUp className="size-5" />
                                    )}
                                </Button>
                            </PromptInputAction>
                        </PromptInputActions>
                    </PromptInput>

                    <div className="flex justify-center mt-3">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                            <AlertCircle className="w-3 h-3" />
                            Shift + Enter for multiline
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
