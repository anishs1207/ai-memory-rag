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
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Bot, PlusIcon, Search, Trash } from "lucide-react";
import { ModeToggle } from "../mode-toggle";
import { NavUser } from "./NavUser";

type ModelType = "general" | "finance" | "legal" | "pdf" | "budget" | "research";

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


export default function ChatSidebar({
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