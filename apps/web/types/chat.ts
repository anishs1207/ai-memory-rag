export type ModelType = "general" | "finance" | "legal" | "pdf" | "budget" | "research";

export interface ReasoningStep {
  title: string;
  content: string;
  status: "complete" | "running" | "pending";
}

export interface ToolCall {
  name: string;
  args: Record<string, any>;
  status: "pending" | "success" | "error";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  reasoning?: {
    steps: ReasoningStep[];
  };
  toolCalls?: ToolCall[];
  requiresConfirmation?: boolean;
  confirmed?: boolean;
  pdfUrl?: string;
  sources?: {
    name: string;
    chunkIndex: number;
    content: string;
    score: number;
  }[];
}

export interface Conversation {
  id: string;
  title: string;
  model: ModelType;
  messages: ChatMessage[];
  selectedFile?: string;
  timestamp: number;
  llm?: "claude" | "gemini" | "smollm" | "sf_financial_qa" | "dpo_adapter";
}

export interface ChatState {
  conversations: Conversation[];
  activeId: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
}

export interface BudgetData {
  totalBudget: number;
  expenses: Expense[];
}

export interface AgentCardProps {
  model: ModelType;
  onSelectModel?: (model: ModelType) => void;
}

export interface BudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: BudgetData;
  onUpdateBudget?: (newBudget: number) => void;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
}

export interface NavUserProps {
  user: UserProfile;
}

export interface ChatSidebarProps {
  conversations: Conversation[];
  activeId: string;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
}
