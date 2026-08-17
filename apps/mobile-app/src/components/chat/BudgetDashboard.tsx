import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  Clipboard,
  Alert,
} from "react-native";
import {
  Ionicons,
} from "@expo/vector-icons";
import { storage } from "../../lib/storage";

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

interface BudgetDashboardProps {
  onClose?: () => void;
}

const CATEGORIES = ["General", "Food", "Transport", "Rent", "Subscriptions", "Utilities"];
const CATEGORY_COLORS: Record<string, string> = {
  General: "bg-gray-500",
  Food: "bg-orange-500",
  Transport: "bg-blue-500",
  Rent: "bg-green-500",
  Subscriptions: "bg-purple-500",
  Utilities: "bg-yellow-500",
};

export default function BudgetDashboard({ onClose }: BudgetDashboardProps) {
  const [budgetData, setBudgetData] = useState<BudgetData>({
    totalBudget: 0,
    expenses: [],
  });

  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "add" | "report">(
    "overview"
  );

  // Form states
  const [budgetInput, setBudgetInput] = useState("");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("General");

  // Load budget on mount
  useEffect(() => {
    const loadBudget = async () => {
      const saved = await storage.getItem("user_budget");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setBudgetData(parsed);
          setBudgetInput(parsed.totalBudget ? String(parsed.totalBudget) : "");
        } catch (e) {
          console.error("Failed to parse budget data", e);
        }
      }
    };
    loadBudget();
  }, []);

  // Save budget whenever state changes
  const saveBudget = async (newData: BudgetData) => {
    setBudgetData(newData);
    await storage.setItem("user_budget", JSON.stringify(newData));
  };

  const handleUpdateBudget = () => {
    const total = parseFloat(budgetInput) || 0;
    const updated = { ...budgetData, totalBudget: total };
    saveBudget(updated);
    if (Platform.OS === "web") {
      alert("Budget updated successfully!");
    } else {
      Alert.alert("Success", "Budget updated successfully!");
    }
  };

  const handleAddExpense = () => {
    if (!desc || !amount) {
      if (Platform.OS === "web") alert("Please enter description and amount");
      return;
    }

    const value = parseFloat(amount) || 0;
    const newExpense: Expense = {
      id: Date.now().toString(),
      description: desc,
      amount: value,
      date: new Date().toISOString().split("T")[0] || "",
      category: category,
    };

    const updated = {
      ...budgetData,
      expenses: [newExpense, ...budgetData.expenses],
    };

    saveBudget(updated);
    setDesc("");
    setAmount("");
    setActiveTab("overview");
  };

  const handleDeleteExpense = (id: string) => {
    const updated = {
      ...budgetData,
      expenses: budgetData.expenses.filter((e) => e.id !== id),
    };
    saveBudget(updated);
  };

  const totalSpent = budgetData.expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const remainingBudget = budgetData.totalBudget - totalSpent;
  const percentSpent = budgetData.totalBudget > 0 ? (totalSpent / budgetData.totalBudget) * 100 : 0;

  // Group expenses by category for stats
  const getCategoryStats = () => {
    const stats: Record<string, number> = {};
    CATEGORIES.forEach((cat) => (stats[cat] = 0));

    budgetData.expenses.forEach((e) => {
      const cat = e.category || "General";
      stats[cat] = (stats[cat] || 0) + e.amount;
    });

    return Object.entries(stats)
      .map(([name, val]) => ({
        name,
        value: val,
        percentage: totalSpent > 0 ? (val / totalSpent) * 100 : 0,
        color: CATEGORY_COLORS[name] || "bg-gray-500",
      }))
      .filter((s) => s.value > 0);
  };

  const categoryStats = getCategoryStats();

  // Generate copyable financial report
  const generateReportText = () => {
    return (
      `FINANCIAL BUDGET REPORT - ${new Date().toLocaleDateString()}\n` +
      `==========================================\n\n` +
      `Total Budget:      $${budgetData.totalBudget.toFixed(2)}\n` +
      `Total Spent:       $${totalSpent.toFixed(2)}\n` +
      `Remaining Budget:  $${remainingBudget.toFixed(2)}\n` +
      `Budget Utilization:${percentSpent.toFixed(1)}%\n\n` +
      `Category Breakdown:\n` +
      categoryStats
        .map((s) => `- ${s.name}: $${s.value.toFixed(2)} (${s.percentage.toFixed(1)}%)`)
        .join("\n") +
      `\n\nTransaction History:\n` +
      (budgetData.expenses.length === 0
        ? "No transactions recorded."
        : budgetData.expenses
            .map((e) => `- [${e.date}] ${e.description} (${e.category}): $${e.amount.toFixed(2)}`)
            .join("\n"))
    );
  };

  const handleCopyReport = () => {
    const text = generateReportText();
    Clipboard.setString(text);
    if (Platform.OS === "web") {
      alert("Report copied to clipboard!");
    } else {
      Alert.alert("Report Copied", "The financial report summary has been copied to your clipboard.");
    }
  };

  // Mock weekly data for SVG chart (replicating web)
  const mockWeeklyData = [
    { label: "Mon", amount: totalSpent * 0.08 || 12 },
    { label: "Tue", amount: totalSpent * 0.12 || 25 },
    { label: "Wed", amount: totalSpent * 0.15 || 40 },
    { label: "Thu", amount: totalSpent * 0.20 || 32 },
    { label: "Fri", amount: totalSpent * 0.25 || 65 },
    { label: "Sat", amount: totalSpent * 0.12 || 58 },
    { label: "Sun", amount: totalSpent * 0.08 || 15 },
  ];

  const maxWeeklyAmount = Math.max(...mockWeeklyData.map((d) => d.amount), 1);

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-xl max-w-4xl mx-auto w-full my-4">
      {/* Header */}
      <View className="flex-row items-center justify-between pb-4 border-b border-gray-100 dark:border-zinc-900/60 mb-5">
        <View className="flex-row items-center space-x-3">
          <View className="bg-[#171b18] dark:bg-[#f0f2ee] p-2.5 rounded-xl">
            <Ionicons name="wallet-outline" size={23} color="#8b5cf6" />
          </View>
          <View>
            <Text className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
              Personal Budget Dashboard
            </Text>
            <Text className="text-[12px] text-gray-500 font-medium">
              Private on-device overview
            </Text>
          </View>
        </View>
        
        {onClose && (
          <Pressable
            onPress={onClose}
            className="p-1.5 rounded-full bg-gray-50 dark:bg-zinc-900 active:opacity-60"
          >
            <Ionicons name="close" size={20} color="#687069" />
          </Pressable>
        )}
      </View>

      {/* Tabs */}
      <View className="flex-row bg-gray-50 dark:bg-zinc-900 p-1 rounded-xl mb-6">
        <Pressable
          onPress={() => setActiveTab("overview")}
          className={`flex-1 flex-row items-center justify-center space-x-1.5 py-2.5 rounded-lg ${
            activeTab === "overview" ? "bg-white dark:bg-zinc-800 shadow-sm" : ""
          }`}
        >
          <Ionicons name="bar-chart-outline" size={16} color={activeTab === "overview" ? "#7c3aed" : "#9ca3af"} />
          <Text className={`text-[13px] font-semibold ${activeTab === "overview" ? "text-gray-900 dark:text-white" : "text-gray-500"}`}>
            Overview
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("transactions")}
          className={`flex-1 flex-row items-center justify-center space-x-1.5 py-2.5 rounded-lg ${
            activeTab === "transactions" ? "bg-white dark:bg-zinc-800 shadow-sm" : ""
          }`}
        >
          <Ionicons name="receipt-outline" size={16} color={activeTab === "transactions" ? "#7c3aed" : "#9ca3af"} />
          <Text className={`text-[13px] font-semibold ${activeTab === "transactions" ? "text-gray-900 dark:text-white" : "text-gray-500"}`}>
            History
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("add")}
          className={`flex-1 flex-row items-center justify-center space-x-1.5 py-2.5 rounded-lg ${
            activeTab === "add" ? "bg-white dark:bg-zinc-800 shadow-sm" : ""
          }`}
        >
          <Ionicons name="add-circle-outline" size={17} color={activeTab === "add" ? "#7c3aed" : "#9ca3af"} />
          <Text className={`text-[13px] font-semibold ${activeTab === "add" ? "text-gray-900 dark:text-white" : "text-gray-500"}`}>
            Expense
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("report")}
          className={`flex-1 flex-row items-center justify-center space-x-1.5 py-2.5 rounded-lg ${
            activeTab === "report" ? "bg-white dark:bg-zinc-800 shadow-sm" : ""
          }`}
        >
          <Ionicons name="document-text-outline" size={16} color={activeTab === "report" ? "#7c3aed" : "#9ca3af"} />
          <Text className={`text-[13px] font-semibold ${activeTab === "report" ? "text-gray-900 dark:text-white" : "text-gray-500"}`}>
            Report
          </Text>
        </Pressable>
      </View>

      {/* Tab Content */}
      <ScrollView className="flex-1 max-h-[450px]" showsVerticalScrollIndicator={false}>
        {activeTab === "overview" && (
          <View className="space-y-6">
            {/* Metric Cards Grid */}
            <View className="flex-row flex-wrap gap-3">
              {/* Total Budget Card */}
              <View className="flex-1 min-w-[130px] p-4 bg-gray-50 dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800/80">
                <Text className="text-[12px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Total Budget
                </Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-lg font-bold text-gray-900 dark:text-white">
                    ${budgetData.totalBudget.toFixed(2)}
                  </Text>
                  <Ionicons name="cash-outline" size={18} color="#7c3aed" />
                </View>
              </View>

              {/* Total Spent Card */}
              <View className="flex-1 min-w-[130px] p-4 bg-gray-50 dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800/80">
                <Text className="text-[12px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Spent
                </Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-lg font-bold text-gray-900 dark:text-white">
                    ${totalSpent.toFixed(2)}
                  </Text>
                  <Ionicons name="trending-up-outline" size={18} color="#7c3aed" />
                </View>
              </View>

              {/* Remaining Card */}
              <View className="flex-1 min-w-[130px] p-4 bg-gray-50 dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800/80">
                <Text className="text-[12px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Remaining
                </Text>
                <View className="flex-row items-center justify-between">
                  <Text className={`text-lg font-bold ${remainingBudget >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                    ${remainingBudget.toFixed(2)}
                  </Text>
                  <Ionicons name="wallet-outline" size={18} color={remainingBudget >= 0 ? "#22c55e" : "#ef4444"} />
                </View>
              </View>
            </View>

            {/* Set Budget Form */}
            <View className="p-4 bg-gray-50/55 dark:bg-zinc-900/40 border border-gray-100 dark:border-zinc-800/50 rounded-2xl">
              <Text className="text-[14px] font-bold text-gray-800 dark:text-zinc-200 mb-2.5">
                Set Total Budget
              </Text>
              <View className="flex-row space-x-3">
                <TextInput
                  value={budgetInput}
                  onChangeText={setBudgetInput}
                  placeholder="Enter total budget (e.g. 2000)"
                  keyboardType="numeric"
                  placeholderTextColor="#71717a"
                  className="flex-1 px-4 py-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-[15px] text-gray-900 dark:text-white"
                />
                <Pressable
                  onPress={handleUpdateBudget}
                  className="px-5 py-3 bg-[#171b18] dark:bg-[#f0f2ee] rounded-xl items-center justify-center"
                >
                  <Text className="text-[14px] font-bold text-white dark:text-[#171b18]">Save</Text>
                </Pressable>
              </View>
            </View>

            {/* Progress Bar */}
            {budgetData.totalBudget > 0 && (
              <View className="space-y-1.5">
                <View className="flex-row justify-between">
                  <Text className="text-[14px] text-gray-500 dark:text-zinc-400 font-semibold">
                    Budget Utilization
                  </Text>
                  <Text className="text-[14px] text-gray-800 dark:text-zinc-300 font-bold">
                    {percentSpent.toFixed(1)}% Used
                  </Text>
                </View>
                <View className="h-2.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <View
                    className={`h-full rounded-full ${
                      percentSpent > 90 ? "bg-red-500" : percentSpent > 70 ? "bg-orange-500" : "bg-pink-500"
                    }`}
                    style={{ width: `${Math.min(100, percentSpent)}%` }}
                  />
                </View>
              </View>
            )}

            {/* Custom SVG Weekly Chart */}
            <View className="p-4 bg-gray-50/50 dark:bg-zinc-900/25 border border-gray-100 dark:border-zinc-900/60 rounded-2xl">
              <Text className="text-[14px] font-bold text-gray-800 dark:text-zinc-200 mb-4">
                Weekly Expenditures Trend
              </Text>
              
              <View className="h-40 flex-row items-end justify-between px-2 pt-2">
                {mockWeeklyData.map((d, index) => {
                  const barHeight = (d.amount / maxWeeklyAmount) * 100; // in percent
                  return (
                    <View key={index} className="items-center flex-1 mx-1.5 space-y-2">
                      <View className="flex-1 w-full justify-end items-center">
                        {/* Tooltip on hover/display */}
                        <Text className="text-[11px] font-bold text-gray-500 mb-1">
                          ${Math.round(d.amount)}
                        </Text>
                        {/* Bar */}
                        <View
                          className="w-full bg-pink-500/80 rounded-t-md"
                          style={{ height: `${Math.max(5, barHeight)}%` }}
                        />
                      </View>
                      <Text className="text-[12px] font-semibold text-gray-500 dark:text-zinc-400">
                        {d.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Category Stats list with Custom Progress Rings/Bars */}
            <View>
              <Text className="text-[14px] font-bold text-gray-800 dark:text-zinc-200 mb-3.5">
                Spending by Category
              </Text>

              {categoryStats.length === 0 ? (
                <Text className="text-[14px] leading-5 text-gray-500 dark:text-zinc-400 italic py-2">
                  No transaction data to analyze yet. Add expenses in the Expense tab.
                </Text>
              ) : (
                <View className="space-y-3">
                  {categoryStats.map((stat) => (
                    <View key={stat.name} className="space-y-1">
                      <View className="flex-row justify-between items-center">
                        <View className="flex-row items-center space-x-2">
                          <View className={`w-2.5 h-2.5 rounded-full ${stat.color}`} />
                          <Text className="text-[14px] font-semibold text-gray-700 dark:text-zinc-300">
                            {stat.name}
                          </Text>
                        </View>
                        <Text className="text-[14px] font-bold text-gray-900 dark:text-white">
                          ${stat.value.toFixed(2)} ({Math.round(stat.percentage)}%)
                        </Text>
                      </View>
                      {/* Horizontal progress bar */}
                      <View className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <View
                          className={`h-full rounded-full ${stat.color}`}
                          style={{ width: `${stat.percentage}%` }}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {activeTab === "transactions" && (
          <View className="space-y-4">
            <Text className="text-[14px] font-bold text-gray-800 dark:text-zinc-200">
              Transaction History
            </Text>

            {budgetData.expenses.length === 0 ? (
              <View className="py-12 items-center justify-center border border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl">
                <Text className="text-[14px] text-gray-500 dark:text-zinc-400">
                  No transactions recorded yet.
                </Text>
              </View>
            ) : (
              <View className="space-y-2">
                {budgetData.expenses.map((e) => (
                  <View
                    key={e.id}
                    className="flex-row items-center justify-between p-3.5 bg-gray-50 dark:bg-zinc-900/60 rounded-xl border border-gray-100 dark:border-zinc-800/80"
                  >
                    <View className="flex-row items-center space-x-3 flex-1 pr-4">
                      {/* Colored Indicator */}
                      <View className={`w-8 h-8 rounded-lg items-center justify-center ${CATEGORY_COLORS[e.category] || "bg-gray-500"}`}>
                        <Text className="text-[12px] text-white font-bold uppercase truncate px-1">
                          {e.category.slice(0, 3)}
                        </Text>
                      </View>
                      
                      <View className="flex-1">
                        <Text className="text-[14px] font-semibold text-gray-800 dark:text-zinc-200 truncate">
                          {e.description}
                        </Text>
                        <View className="flex-row items-center space-x-2 mt-0.5">
                          <Ionicons name="calendar-outline" size={12} color="#9ca3af" />
                          <Text className="text-[11px] text-gray-500 dark:text-zinc-400">
                            {e.date}
                          </Text>
                          <Text className="text-[11px] text-gray-500 dark:text-zinc-400">•</Text>
                          <Text className="text-[11px] text-gray-500 dark:text-zinc-400 font-medium">
                            {e.category}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View className="flex-row items-center space-x-3">
                      <Text className="text-[14px] font-bold text-gray-900 dark:text-white">
                        -${e.amount.toFixed(2)}
                      </Text>
                      <Pressable
                        onPress={() => handleDeleteExpense(e.id)}
                        className="p-1 rounded-md bg-white dark:bg-zinc-800 active:opacity-60 border border-gray-100 dark:border-zinc-700/50"
                      >
                        <Ionicons name="trash-outline" size={15} color="#ef4444" />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === "add" && (
          <View className="space-y-4">
            <Text className="text-[14px] font-bold text-gray-800 dark:text-zinc-200">
              Record New Expense
            </Text>

            <View className="space-y-3.5">
              <View>
                <Text className="text-[12px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1.5">
                  Description
                </Text>
                <TextInput
                  value={desc}
                  onChangeText={setDesc}
                  placeholder="What did you buy?"
                  placeholderTextColor="#71717a"
                  className="px-4 py-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-[15px] text-gray-900 dark:text-white"
                />
              </View>

              <View>
                <Text className="text-[12px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1.5">
                  Amount ($)
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  keyboardType="numeric"
                  placeholderTextColor="#71717a"
                  className="px-4 py-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-[15px] text-gray-900 dark:text-white"
                />
              </View>

              <View>
                <Text className="text-[12px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-2">
                  Category
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {CATEGORIES.map((cat) => {
                    const isSelected = category === cat;
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => setCategory(cat)}
                        className={`px-3.5 py-2 rounded-xl border text-xs font-semibold ${
                          isSelected
                            ? "bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-900/50 text-pink-600 dark:text-pink-400 font-bold"
                            : "bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400"
                        }`}
                      >
                        <Text className={`text-[14px] ${isSelected ? "text-violet-700 dark:text-violet-300 font-bold" : "text-gray-600 dark:text-zinc-400"}`}>
                          {cat}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Pressable
                onPress={handleAddExpense}
                className="mt-4 flex-row items-center justify-center space-x-2 py-3.5 bg-[#171b18] dark:bg-[#f0f2ee] rounded-xl"
              >
                <Ionicons name="add" size={19} color="#8b5cf6" />
                <Text className="text-[14px] font-bold text-white dark:text-[#171b18]">Add expense</Text>
              </Pressable>
            </View>
          </View>
        )}

        {activeTab === "report" && (
          <View className="space-y-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-[14px] font-bold text-gray-800 dark:text-zinc-200">
                Financial Report Summary
              </Text>
              <Pressable
                onPress={handleCopyReport}
                className="flex-row items-center space-x-1.5 px-3.5 py-2 bg-pink-600 active:bg-pink-700 rounded-xl"
              >
                <Ionicons name="copy-outline" size={15} color="#ffffff" />
                <Text className="text-[13px] font-bold text-white">Copy report</Text>
              </Pressable>
            </View>

            <View className="p-4 bg-gray-50 dark:bg-zinc-900 rounded-2xl border border-gray-150 dark:border-zinc-800">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text className="font-mono text-[12px] leading-5 text-gray-600 dark:text-zinc-400 select-all">
                  {generateReportText()}
                </Text>
              </ScrollView>
            </View>
            
            <Text className="text-[12px] leading-5 text-gray-500 dark:text-zinc-400 text-center italic mt-2">
              Note: Click &quot;Copy Report&quot; to copy the formatted text summary to your clipboard.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
