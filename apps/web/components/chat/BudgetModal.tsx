"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Wallet, Receipt, BarChart3, Download, Calendar, PieChart as PieIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@/components/ui/tabs";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line
} from "recharts";

export type Expense = {
    id: string;
    description: string;
    amount: number;
    date: string;
    category: string;
};

export type BudgetData = {
    totalBudget: number;
    expenses: Expense[];
};

export function BudgetModal({
    open,
    onOpenChange
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void
}) {
    const [budgetData, setBudgetData] = useState<BudgetData>({ totalBudget: 0, expenses: [] });

    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("user_budget");
            if (saved) setBudgetData(JSON.parse(saved));
        }
    }, []);

    const [desc, setDesc] = useState("");
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState("General");

    useEffect(() => {
        localStorage.setItem("user_budget", JSON.stringify(budgetData));
    }, [budgetData]);

    const addExpense = () => {
        if (!desc || !amount) return;
        const newExpense: Expense = {
            id: Date.now().toString(),
            description: desc,
            amount: parseFloat(amount),
            date: new Date().toISOString().split("T")[0],
            category: category as string
        };
        setBudgetData(prev => ({
            ...prev,
            expenses: [newExpense, ...prev.expenses]
        }));
        setDesc("");
        setAmount("");
    };

    const deleteExpense = (id: string) => {
        setBudgetData(prev => ({
            ...prev,
            expenses: prev.expenses.filter(e => e.id !== id)
        }));
    };

    const totalSpent = budgetData.expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const remainingBudget = budgetData.totalBudget - totalSpent;

    // Dummy data for charts
    const weeklyData = [
        { name: "Mon", amount: 45 },
        { name: "Tue", amount: 52 },
        { name: "Wed", amount: 38 },
        { name: "Thu", amount: 65 },
        { name: "Fri", amount: 48 },
        { name: "Sat", amount: 90 },
        { name: "Sun", amount: 70 },
    ];

    const monthlyData = [
        { name: "Week 1", amount: 320 },
        { name: "Week 2", amount: 450 },
        { name: "Week 3", amount: 280 },
        { name: "Week 4", amount: 510 },
    ];

    const categoryData = [
        { name: "Food", value: 400, color: "#f97316" },
        { name: "Transport", value: 200, color: "#3b82f6" },
        { name: "Rent", value: 1200, color: "#10b981" },
        { name: "Sub", value: 150, color: "#8b5cf6" },
    ];

    const downloadReport = () => {
        const reportContent = `FINANCIAL REPORT - ${new Date().toLocaleDateString()}\n\n` +
            `Total Budget: $${budgetData.totalBudget}\n` +
            `Total Spent: $${totalSpent.toFixed(2)}\n` +
            `Remaining: $${remainingBudget.toFixed(2)}\n\n` +
            `Transactions:\n` +
            budgetData.expenses.map(e => `- ${e.date}: ${e.description} ($${e.amount})`).join('\n');

        const blob = new Blob([reportContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Budget_Report_${Date.now()}.txt`;
        a.click();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
                <div className="bg-primary/10 p-6 pb-20">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-2xl font-bold italic tracking-tight">
                            <Wallet className="size-6 text-primary" />
                            Financial Intelligence
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground/80 italic">
                            Track your capital and optimize your spending patterns.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-6 -mt-16 pb-6 space-y-4">
                    <Card className="border-none shadow-lg bg-background/95 backdrop-blur">
                        <CardContent className="p-4 grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <div className="text-[10px] uppercase font-bold tracking-widest opacity-50">Total Budget</div>
                                <div className="flex items-center gap-1">
                                    <span className="text-xl font-mono">$</span>
                                    <Input
                                        type="number"
                                        value={budgetData.totalBudget}
                                        onChange={(e) => setBudgetData(prev => ({ ...prev, totalBudget: parseFloat(e.target.value) || 0 }))}
                                        className="h-8 border-none p-0 text-xl font-mono font-bold focus-visible:ring-0 bg-transparent"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1 text-right">
                                <div className="text-[10px] uppercase font-bold tracking-widest opacity-50">Remaining</div>
                                <div className={cn(
                                    "text-xl font-mono font-bold",
                                    remainingBudget < 0 ? "text-destructive" : "text-green-500"
                                )}>
                                    ${remainingBudget.toFixed(2)}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Tabs defaultValue="transactions" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 h-9 bg-muted/50 p-1">
                            <TabsTrigger value="transactions" className="text-[10px] uppercase font-bold tracking-tight">Transactions</TabsTrigger>
                            <TabsTrigger value="analytics" className="text-[10px] uppercase font-bold tracking-tight">Analytics</TabsTrigger>
                        </TabsList>

                        <TabsContent value="transactions" className="space-y-4 mt-4">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-70 flex items-center gap-2">
                                        <Plus className="size-3" /> Add Transaction
                                    </h4>
                                </div>
                                <div className="grid grid-cols-12 gap-2">
                                    <div className="col-span-12 flex gap-2">
                                        <Input
                                            placeholder="Description"
                                            value={desc}
                                            onChange={(e) => setDesc(e.target.value)}
                                            className="flex-1 h-9 text-xs"
                                        />
                                        <Select value={category} onValueChange={setCategory}>
                                            <SelectTrigger className="w-[100px] h-9 text-[10px] uppercase font-bold tracking-tighter">
                                                <SelectValue placeholder="Cat" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Food" className="text-[10px]">Food</SelectItem>
                                                <SelectItem value="Travel" className="text-[10px]">Travel</SelectItem>
                                                <SelectItem value="Tech" className="text-[10px]">Tech</SelectItem>
                                                <SelectItem value="Rent" className="text-[10px]">Rent</SelectItem>
                                                <SelectItem value="Misc" className="text-[10px]">Misc</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Input
                                        type="number"
                                        placeholder="Amt"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="col-span-9 h-9 text-xs font-mono"
                                    />
                                    <Button onClick={addExpense} className="col-span-3 h-9 rounded-md bg-primary hover:bg-primary/90">
                                        <Plus className="size-4" />
                                    </Button>
                                </div>
                            </div>

                            <ScrollArea className="h-[250px] pr-4">
                                <div className="space-y-2">
                                    {budgetData.expenses.length === 0 ? (
                                        <div className="text-center py-10 opacity-20 italic text-sm">No transactions recorded.</div>
                                    ) : (
                                        budgetData.expenses.map((expense) => (
                                            <div key={expense.id} className="group flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-8 rounded-lg bg-background flex items-center justify-center shadow-sm">
                                                        <Receipt className="size-4 opacity-50" />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-semibold">{expense.description}</div>
                                                        <div className="text-[10px] opacity-50">{expense.date} • {expense.category}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-xs font-mono font-bold">-${expense.amount.toFixed(2)}</div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                                        onClick={() => deleteExpense(expense.id)}
                                                    >
                                                        <Trash2 className="size-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="analytics" className="mt-4 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <Card className="bg-muted/20 border-border/50">
                                    <CardContent className="p-3 space-y-3">
                                        <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 flex items-center gap-2">
                                            <Calendar className="size-3" /> Weekly
                                        </div>
                                        <div className="h-[100px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={weeklyData}>
                                                    <Bar dataKey="amount" fill="var(--color-primary)" radius={[2, 2, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-muted/20 border-border/50">
                                    <CardContent className="p-3 space-y-3">
                                        <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 flex items-center gap-2">
                                            <PieIcon className="size-3" /> Allocation
                                        </div>
                                        <div className="h-[100px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={categoryData}
                                                        innerRadius={25}
                                                        outerRadius={40}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {categoryData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="bg-muted/20 border-border/50">
                                <CardContent className="p-3 space-y-3">
                                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 flex items-center gap-2">
                                        <BarChart3 className="size-3" /> Monthly Velocity
                                    </div>
                                    <div className="h-[120px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={monthlyData}>
                                                <Line
                                                    type="monotone"
                                                    dataKey="amount"
                                                    stroke="var(--color-primary)"
                                                    strokeWidth={2}
                                                    dot={{ r: 3, fill: "var(--color-primary)" }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            <Button
                                onClick={downloadReport}
                                className="w-full h-10 gap-2 font-bold text-xs uppercase tracking-tight"
                            >
                                <Download className="size-4" /> Export Report
                            </Button>
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}

