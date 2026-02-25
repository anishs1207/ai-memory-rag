"use client"

import { NavUser } from "@/components/chat/NavUser"
import {
    ChatContainerContent,
    ChatContainerRoot,
    ChatContainerScrollAnchor,
} from "@/components/prompt-kit/chat-container"
import {
    Message,
    MessageAction,
    MessageActions,
    MessageContent,
} from "@/components/prompt-kit/message"
import {
    PromptInput,
    PromptInputAction,
    PromptInputActions,
    PromptInputTextarea,
} from "@/components/prompt-kit/prompt-input"
import { ScrollButton } from "@/components/prompt-kit/scroll-button"
import { Button } from "@/components/ui/button"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils"
import {
    ArrowUp,
    Copy,
    Globe,
    Mic,
    MoreHorizontal,
    Plus,
    PlusIcon,
    Search,
    ThumbsDown,
    ThumbsUp,
    Trash,
    Bot,
    FileText,
    Hash,
    Upload,
    AlertCircle,
    CheckCircle2,
    Clock,
    Zap,
    ChevronDown,
    ChevronUp,
} from "lucide-react"
import { useRef, useState, useEffect } from "react"
import axios from "axios"
import { Loader } from "@/components/prompt-kit/loader"
import { ModeToggle } from "@/components/mode-toggle"

const SERVER_URL = "http://localhost:3001";

const ROUTE_MAP = {
    general: `${SERVER_URL}/api/v1/message/general`,
    finance: `${SERVER_URL}/api/v1/message/finance`,
    legal: `${SERVER_URL}/api/v1/message/legal`,
    pdf: `${SERVER_URL}/api/v1/message/chat-file`,
} as const;

type ModelType = "general" | "finance" | "legal" | "pdf";

type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    error?: boolean;
    reasoning?: {
        steps: {
            title: string;
            content: string;
            status: "complete" | "running" | "pending";
        }[];
    };
    toolCalls?: {
        name: string;
        args: Record<string, any>;
        status: "pending" | "success" | "error";
    }[];
    requiresConfirmation?: boolean;
    confirmed?: boolean;
};

type Conversation = {
    id: string;
    title: string;
    model: ModelType;
    messages: ChatMessage[];
    selectedFile?: string;
    timestamp: number;
};

const MODEL_CONFIGS: Record<ModelType, { label: string; icon: any; color: string }> = {
    general: { label: "General", icon: Bot, color: "text-blue-500" },
    finance: { label: "Finance", icon: Hash, color: "text-green-500" },
    legal: { label: "Legal", icon: FileText, color: "text-purple-500" },
    pdf: { label: "PDF Chat", icon: FileText, color: "text-orange-500" },
};

function ReasoningStep({ icon: Icon, title, content, status }: {
    icon?: any,
    title: string,
    content: string,
    status: "complete" | "running" | "pending"
}) {
    return (
        <div className="flex gap-3 mb-4 last:mb-0">
            <div className="flex flex-col items-center">
                <div className={cn(
                    "size-6 rounded-full flex items-center justify-center border text-[10px]",
                    status === "complete" ? "bg-primary border-primary text-primary-foreground" :
                        status === "running" ? "bg-muted border-primary text-primary animate-pulse" :
                            "bg-muted border-border text-muted-foreground"
                )}>
                    {status === "complete" ? <CheckCircle2 className="size-3" /> : Icon ? <Icon className="size-3" /> : <Clock className="size-3" />}
                </div>
                <div className="w-[1px] h-full bg-border mt-1 opacity-50 last:hidden" />
            </div>
            <div className="flex-1 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">{title}</span>
                    <Badge variant="outline" className="text-[8px] h-3 px-1 uppercase tracking-tighter opacity-70">
                        {status}
                    </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{content}</p>
                {status === "running" && (
                    <div className="mt-2 bg-muted/50 rounded p-2 border border-border/50 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                        <Search className="size-3 text-primary animate-spin" />
                        <span className="text-[10px] font-mono opacity-80">Executing internal search...</span>
                    </div>
                )}
            </div>
        </div>
    );
}

function ToolCall({ name, args, status }: { name: string, args: any, status: string }) {
    return (
        <div className="my-2 bg-muted/30 border border-border/50 rounded-md overflow-hidden">
            <div className="bg-muted/50 px-3 py-1.5 flex items-center justify-between border-b border-border/50">
                <div className="flex items-center gap-2">
                    <div className="size-4 bg-orange-500 rounded flex items-center justify-center">
                        <Zap className="size-2.5 text-white" />
                    </div>
                    <span className="text-[10px] font-mono font-bold">Tool Execution: {name}</span>
                </div>
                <Badge variant="outline" className="text-[8px] h-4 py-0">{status}</Badge>
            </div>
            <div className="p-2">
                <pre className="text-[10px] font-mono text-muted-foreground overflow-x-auto">
                    {JSON.stringify(args, null, 2)}
                </pre>
            </div>
        </div>
    );
}

function ChatSidebar({
    conversations,
    activeId,
    setActiveId,
    onNewChat,
    onDeleteChat
}: {
    conversations: Conversation[],
    activeId: string,
    setActiveId: (id: string) => void,
    onNewChat: () => void,
    onDeleteChat: (id: string) => void
}) {
    // Group conversations by period (Today, Yesterday, etc.)
    const grouped = conversations.reduce((acc, chat) => {
        const date = new Date(chat.timestamp);
        const today = new Date();
        let period = "Older";

        if (date.toDateString() === today.toDateString()) period = "Today";
        else if (date.toDateString() === new Date(today.setDate(today.getDate() - 1)).toDateString()) period = "Yesterday";

        if (!acc[period]) acc[period] = [];
        acc[period]?.push(chat);
        return acc;
    }, {} as Record<string, Conversation[]>);

    return (
        <Sidebar>
            <SidebarHeader className="flex flex-row items-center justify-between gap-2 px-2 py-4">
                <div className="flex flex-row items-center gap-2 px-2">
                    <div className="bg-primary size-8 rounded-md flex items-center justify-center">
                        <Bot className="text-primary-foreground size-5" />
                    </div>
                    <div className="text-md font-bold text-primary tracking-tight">
                        Agentic RAG
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <ModeToggle />
                    <Button variant="ghost" className="size-8">
                        <Search className="size-4" />
                    </Button>
                </div>
            </SidebarHeader>
            <SidebarContent className="pt-4">
                <div className="px-4">
                    <Button
                        variant="outline"
                        className="cursor-pointer mb-4 flex w-full items-center gap-2"
                        onClick={onNewChat}
                    >
                        <PlusIcon className="size-4" />
                        <span>New Chat</span>
                    </Button>
                </div>
                {Object.entries(grouped).map(([period, chats]) => (
                    <SidebarGroup key={period}>
                        <SidebarGroupLabel>{period}</SidebarGroupLabel>
                        <SidebarMenu>
                            {chats.map((chat) => (
                                <SidebarMenuButton
                                    key={chat.id}
                                    isActive={activeId === chat.id}
                                    onClick={() => setActiveId(chat.id)}
                                    className="group relative"
                                >
                                    <span className="truncate pr-6">{chat.title}</span>
                                    <Trash
                                        className="absolute right-2 size-3.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteChat(chat.id);
                                        }}
                                    />
                                </SidebarMenuButton>
                            ))}
                        </SidebarMenu>
                    </SidebarGroup>
                ))}
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={{
                    name: "User",
                    email: "user@example.com",
                    avatar: "/avatars/user.jpg",
                }} />
            </SidebarFooter>
        </Sidebar>
    )
}

function ChatContent({
    conversation,
    updateConversation,
    files,
    fetchFiles
}: {
    conversation: Conversation,
    updateConversation: (id: string, updates: Partial<Conversation>) => void,
    files: string[],
    fetchFiles: () => Promise<void>
}) {
    const [prompt, setPrompt] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [showReasoning, setShowReasoning] = useState<Record<string, boolean>>({})
    const fileInputRef = useRef<HTMLInputElement>(null)

    const toggleReasoning = (msgId: string) => {
        setShowReasoning(prev => ({ ...prev, [msgId]: !prev[msgId] }))
    }

    const handleConfirm = (msgId: string) => {
        const updatedMessages = conversation.messages.map(m =>
            m.id === msgId ? { ...m, confirmed: true } : m
        );
        updateConversation(conversation.id, { messages: updatedMessages });
    }

    const handleSubmit = async () => {
        const input = prompt.trim();
        if (!input || isLoading) return

        if (conversation.model === "pdf" && !conversation.selectedFile) {
            return;
        }

        setPrompt("")
        setIsLoading(true)

        // Add user message
        const newUserMessage: ChatMessage = {
            id: Date.now().toString(),
            role: "user",
            content: input,
        }

        const updatedMessages = [...conversation.messages, newUserMessage];
        updateConversation(conversation.id, {
            messages: updatedMessages,
            title: conversation.messages.length === 0 ? input.slice(0, 30) + (input.length > 30 ? "..." : "") : conversation.title
        });

        try {
            const url = ROUTE_MAP[conversation.model];
            const payload = conversation.model === "pdf"
                ? { prompt: input, fileName: conversation.selectedFile }
                : { prompt: input };

            const response = await axios.post<{
                success: boolean;
                data?: string;
                error?: string;
            }>(url, payload);

            const isAnalyze = input.toLowerCase().includes("analyze");
            const isConfirm = input.toLowerCase().includes("confirm");

            const assistantMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: response.data.data || "No response received.",
                ...(isAnalyze && {
                    reasoning: {
                        steps: [
                            { title: "Context Analysis", content: "Identifying core entities and relationships in the prompt.", status: "complete" },
                            { title: "Document Scanning", content: "Parsing through uploaded context for matching patterns.", status: "complete" },
                            { title: "Logical Synthesis", content: "Applying domain-specific reasoning to the extracted facts.", status: "complete" }
                        ]
                    },
                    toolCalls: [
                        { name: "semantic_search", args: { query: input, limit: 3 }, status: "success" }
                    ]
                }),
                ...(isConfirm && {
                    requiresConfirmation: true,
                    confirmed: false
                })
            };

            updateConversation(conversation.id, {
                messages: [...updatedMessages, assistantMsg]
            });
        } catch (err: any) {
            const errorMessage = err.response?.data?.error || err.message;
            const errMsg: ChatMessage = {
                id: (Date.now() + 2).toString(),
                role: "assistant", // Changed from "agent" to "assistant" to match role check
                content: `Error: ${errorMessage}`,
                error: true,
            };
            updateConversation(conversation.id, {
                messages: [...updatedMessages, errMsg]
            });
        } finally {
            setIsLoading(false)
        }
    }

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
                await fetchFiles();
                updateConversation(conversation.id, {
                    model: "pdf",
                    selectedFile: file.name
                });
            }
        } catch (err: any) {
            console.error("Upload failed", err);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <main className="flex h-screen flex-col overflow-hidden bg-background">
            <header className="bg-background z-10 flex flex-col w-full shrink-0 border-b">
                <div className="flex h-16 items-center gap-2 px-4 justify-between">
                    <div className="flex items-center gap-2">
                        <SidebarTrigger className="-ml-1" />
                        <div className="text-foreground font-medium truncate max-w-[200px] sm:max-w-[400px]">
                            {conversation.title}
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
                            className="gap-2 cursor-pointer h-8 rounded-full"
                        >
                            {uploading ? (
                                <Loader variant="circular" size="sm" />
                            ) : (
                                <Upload className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline text-xs">{uploading ? "Uploading..." : "Add Context"}</span>
                        </Button>
                    </div>
                </div>

                <div className="px-4 py-2 flex flex-wrap items-center gap-2 bg-muted/20">
                    {(Object.keys(MODEL_CONFIGS) as ModelType[]).map((m) => {
                        const Config = MODEL_CONFIGS[m];
                        return (
                            <Button
                                key={m}
                                variant={conversation.model === m ? "default" : "ghost"}
                                size="sm"
                                onClick={() => updateConversation(conversation.id, { model: m })}
                                className="gap-1.5 h-7 rounded-full text-xs cursor-pointer"
                            >
                                <Config.icon className={cn("w-3 h-3", conversation.model === m ? "text-primary-foreground" : Config.color)} />
                                {Config.label}
                            </Button>
                        );
                    })}

                    {conversation.model === "pdf" && files.length > 0 && (
                        <div className="flex items-center gap-2 ml-2 animate-in fade-in">
                            <Badge variant="outline" className="h-5 text-[9px] uppercase font-bold border-dashed">
                                PDF
                            </Badge>
                            <Select
                                value={conversation.selectedFile}
                                onValueChange={(val) => updateConversation(conversation.id, { selectedFile: val })}
                            >
                                <SelectTrigger className="h-6 text-[10px] w-[180px] border-none bg-transparent hover:bg-muted p-1">
                                    <SelectValue placeholder="Select document" />
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
            </header>

            <div className="relative flex-1 overflow-hidden">
                <ChatContainerRoot className="h-full">
                    <ChatContainerContent className="space-y-0 py-8">
                        {conversation.messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                                <Bot className="w-16 h-16 mb-4" />
                                <h3 className="text-xl font-bold">Ready to assist</h3>
                                <p className="text-sm max-w-sm">Choose a model and ask anything about your documents or data.</p>
                            </div>
                        )}

                        {conversation.messages.map((message) => {
                            const isAssistant = message.role === "assistant"

                            return (
                                <Message
                                    key={message.id}
                                    className={cn(
                                        "mx-auto flex w-full max-w-3xl flex-col gap-2 px-6 py-4 animate-in fade-in slide-in-from-bottom-2",
                                        isAssistant ? "items-start" : "items-end"
                                    )}
                                >
                                    {isAssistant ? (
                                        <div className="group flex w-full gap-4">
                                            <Avatar className="h-8 w-8 border bg-muted">
                                                <AvatarFallback><Bot className="size-4" /></AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col gap-1 flex-1">
                                                {message.reasoning && (
                                                    <div className="mb-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => toggleReasoning(message.id)}
                                                            className="h-6 gap-1 px-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground"
                                                        >
                                                            {showReasoning[message.id] ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                                                            {showReasoning[message.id] ? "HIDE REASONING" : "SHOW REASONING"}
                                                        </Button>

                                                        {showReasoning[message.id] && (
                                                            <div className="mt-2 p-4 rounded-xl bg-muted/30 border border-border/50 animate-in fade-in slide-in-from-top-2">
                                                                {message.reasoning.steps.map((step, i) => (
                                                                    <ReasoningStep key={i} {...step} />
                                                                ))}
                                                                {message.toolCalls?.map((tool, i) => (
                                                                    <ToolCall key={i} {...tool} />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {message.requiresConfirmation && !message.confirmed ? (
                                                    <div className="mt-2 p-4 border border-yellow-500/20 bg-yellow-500/5 rounded-xl animate-in fade-in slide-in-from-top-2">
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <div className="size-8 rounded-full bg-yellow-500/10 flex items-center justify-center">
                                                                <AlertCircle className="size-4 text-yellow-600" />
                                                            </div>
                                                            <div>
                                                                <h4 className="text-xs font-bold">Action Confirmation</h4>
                                                                <p className="text-[10px] text-muted-foreground mt-0.5">Sensitive operation detected. Choose authorize to continue.</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button size="sm" className="h-7 rounded-full px-3 text-[10px]" onClick={() => handleConfirm(message.id)}>
                                                                Authorize
                                                            </Button>
                                                            <Button size="sm" variant="outline" className="h-7 rounded-full px-3 text-[10px]">
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <MessageContent
                                                        className={cn(
                                                            "text-foreground prose flex-1 rounded-lg bg-transparent p-0 min-w-0 max-w-full",
                                                            message.error ? "text-destructive break-all" : "break-words"
                                                        )}
                                                        markdown
                                                    >
                                                        {message.content}
                                                    </MessageContent>
                                                )}

                                                {!message.error && (!message.requiresConfirmation || message.confirmed) && (
                                                    <MessageActions className="opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                                                        <MessageAction tooltip="Copy">
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => navigator.clipboard.writeText(message.content)}>
                                                                <Copy className="size-3.5" />
                                                            </Button>
                                                        </MessageAction>
                                                        <MessageAction tooltip="Upvote">
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full"><ThumbsUp className="size-3.5" /></Button>
                                                        </MessageAction>
                                                    </MessageActions>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="group flex flex-col items-end gap-1 w-full max-w-full">
                                            <MessageContent className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl px-4 py-2 sm:max-w-[75%] border-none min-w-[100px] w-fit break-words">
                                                {message.content}
                                            </MessageContent>
                                        </div>
                                    )}
                                </Message>
                            )
                        })}

                        {isLoading && (
                            <div className="mx-auto w-full max-w-3xl flex items-start gap-4 px-6 py-4">
                                <Avatar className="h-8 w-8 border bg-muted">
                                    <AvatarFallback><Bot className="size-4" /></AvatarFallback>
                                </Avatar>
                                <div className="bg-muted border border-border px-4 py-3 rounded-lg flex items-center gap-3">
                                    <Loader variant="typing" size="sm" />
                                    <span className="text-xs text-muted-foreground">Synthesizing...</span>
                                </div>
                            </div>
                        )}
                        <ChatContainerScrollAnchor />
                    </ChatContainerContent>
                    <div className="absolute bottom-4 left-1/2 flex w-full max-w-3xl -translate-x-1/2 justify-center px-5 pointer-events-none">
                        <ScrollButton className="shadow-lg pointer-events-auto bg-background/80 backdrop-blur" />
                    </div>
                </ChatContainerRoot>
            </div>

            <div className="bg-background z-10 shrink-0 px-3 pb-4 md:px-5 md:pb-6">
                <div className="mx-auto max-w-3xl">
                    <PromptInput
                        isLoading={isLoading}
                        value={prompt}
                        onValueChange={setPrompt}
                        onSubmit={handleSubmit}
                        className="border-border bg-popover relative z-10 w-full rounded-2xl border p-0 pt-1 shadow-sm focus-within:ring-1 ring-primary/20"
                    >
                        <div className="flex flex-col">
                            <PromptInputTextarea
                                placeholder={conversation.model === "pdf" ? `Ask about ${conversation.selectedFile || "document"}...` : "Ask a question..."}
                                className="min-h-[50px] pt-3 pl-4 text-sm leading-relaxed"
                            />

                            <PromptInputActions className="mt-2 flex w-full items-center justify-between gap-2 px-3 pb-2">
                                <div className="flex items-center gap-1.5">
                                    <PromptInputAction tooltip="Upload">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-8 rounded-full"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <Plus size={16} />
                                        </Button>
                                    </PromptInputAction>
                                    <Badge variant="secondary" className="text-[10px] h-5 rounded-md px-1.5 opacity-60">
                                        {conversation.model.toUpperCase()}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="icon"
                                        disabled={!prompt.trim() || isLoading || (conversation.model === "pdf" && !conversation.selectedFile)}
                                        onClick={handleSubmit}
                                        className="size-8 rounded-full transition-all"
                                    >
                                        {!isLoading ? (
                                            <ArrowUp size={16} />
                                        ) : (
                                            <span className="size-2 rounded-sm bg-white animate-pulse" />
                                        )}
                                    </Button>
                                </div>
                            </PromptInputActions>
                        </div>
                    </PromptInput>
                </div>
            </div>
        </main>
    )
}

export default function FullChatApp() {
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [activeId, setActiveId] = useState<string>("")
    const [files, setFiles] = useState<string[]>([])

    // Load from localStorage on mount or create initial
    useEffect(() => {
        const saved = localStorage.getItem("rag_conversations");
        if (saved) {
            const parsed = JSON.parse(saved);
            setConversations(parsed);
            if (parsed.length > 0) setActiveId(parsed[0].id);
        } else {
            handleNewChat();
        }
        fetchFiles();
    }, []);

    // Save to localStorage
    useEffect(() => {
        if (conversations.length > 0) {
            localStorage.setItem("rag_conversations", JSON.stringify(conversations));
        }
    }, [conversations]);

    const fetchFiles = async () => {
        try {
            const res = await axios.get<{ success: boolean; data: string[] }>(
                `${SERVER_URL}/api/v1/message/get-files`
            );
            if (res.data.success) {
                setFiles(res.data.data);
            }
        } catch (err) {
            console.error("Failed to fetch files", err);
        }
    };

    const handleNewChat = () => {
        const newChat: Conversation = {
            id: Date.now().toString(),
            title: "New Conversation",
            model: "general",
            messages: [],
            timestamp: Date.now()
        };
        setConversations(prev => [newChat, ...prev]);
        setActiveId(newChat.id);
    };

    const handleDeleteChat = (id: string) => {
        setConversations(prev => {
            const filtered = prev.filter(c => c.id !== id);
            if (activeId === id && filtered.length > 0) setActiveId(filtered[0]?.id || "");
            else if (filtered.length === 0) handleNewChat();
            return filtered;
        });
    };

    const updateConversation = (id: string, updates: Partial<Conversation>) => {
        setConversations(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const activeConversation = conversations.find(c => c.id === activeId) || conversations[0];

    if (!activeConversation) return null;

    return (
        <SidebarProvider>
            <ChatSidebar
                conversations={conversations}
                activeId={activeId}
                setActiveId={setActiveId}
                onNewChat={handleNewChat}
                onDeleteChat={handleDeleteChat}
            />
            <SidebarInset>
                <ChatContent
                    conversation={activeConversation}
                    updateConversation={updateConversation}
                    files={files}
                    fetchFiles={fetchFiles}
                />
            </SidebarInset>
        </SidebarProvider>
    )
}

export { FullChatApp }
