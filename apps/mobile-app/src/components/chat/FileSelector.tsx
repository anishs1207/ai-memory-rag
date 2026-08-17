import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { chatService } from "../../lib/api";

interface FileSelectorProps {
  selectedFile?: string;
  onSelectFile: (fileName: string) => void;
  files: string[];
  onRefreshFiles: () => Promise<void>;
}

type UploadStatus = "idle" | "uploading" | "queued" | "indexing" | "completed" | "failed";

export default function FileSelector({
  selectedFile,
  onSelectFile,
  files,
  onRefreshFiles,
}: FileSelectorProps) {
  const [uploadState, setUploadState] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshFiles();
    } catch (err) {
      console.error("Refresh files failed:", err);
    } finally {
      setRefreshing(false);
    }
  };

  // Poll indexing job status
  const startPollingJob = (jobId: string, fileName: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await chatService.getUploadStatus(jobId);
        if (res.success) {
          const { state, progress, failedReason } = res.data;

          if (state === "completed") {
            clearInterval(interval);
            setUploadState("completed");
            setUploadProgress(100);
            await onRefreshFiles();
            onSelectFile(fileName); // Select the uploaded file automatically
            
            // Reset state after a delay
            setTimeout(() => {
              setUploadState("idle");
              setUploadProgress(0);
              setUploadFileName("");
            }, 3000);
          } else if (state === "failed") {
            clearInterval(interval);
            setUploadState("failed");
            setUploadError(failedReason || "Document indexing failed");
          } else {
            // Update progress
            const percentage = typeof progress === "object" && progress !== null 
              ? (progress.percentage || 0) 
              : (typeof progress === "number" ? progress : 0);

            setUploadState(state === "active" ? "indexing" : "queued");
            setUploadProgress(Math.max(10, percentage));
          }
        }
      } catch (err: any) {
        console.error("Error polling job status:", err);
        clearInterval(interval);
        setUploadState("failed");
        setUploadError("Failed to fetch upload status");
      }
    }, 1500);
  };

  const handlePickAndUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const fileAsset = result.assets[0];
      if (!fileAsset) return;
      
      setUploadFileName(fileAsset.name);
      setUploadState("uploading");
      setUploadProgress(10);
      setUploadError(null);

      // Create FormData
      const formData = new FormData();
      
      // On native, we must construct the file object using URI
      const fileData = {
        uri: fileAsset.uri,
        name: fileAsset.name,
        type: fileAsset.mimeType || "application/pdf",
      } as any;

      formData.append("file", fileData);

      const uploadResult = await chatService.uploadFile(formData, (percent) => {
        setUploadProgress(Math.min(90, percent));
      });

      if (uploadResult.success && uploadResult.jobId) {
        setUploadState("queued");
        setUploadProgress(95);
        startPollingJob(uploadResult.jobId, fileAsset.name);
      } else {
        setUploadState("failed");
        setUploadError(uploadResult.error || "File upload failed");
      }
    } catch (err: any) {
      console.error("Pick and upload document failed:", err);
      setUploadState("failed");
      setUploadError(err.message || "An unexpected error occurred");
    }
  };

  return (
    <View className="bg-[#f7f8f5] dark:bg-[#151916] border-b border-[#e5e8e3] dark:border-[#29302b] px-4 py-4 space-y-3">
      {/* Title & Actions Row */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center space-x-2">
          <Ionicons name="document-text-outline" size={19} color="#7c3aed" />
          <Text className="text-[14px] font-semibold text-gray-800 dark:text-zinc-200">
            Document context
          </Text>
        </View>

        <View className="flex-row items-center space-x-2">
          <Pressable
            onPress={handleRefresh}
            disabled={refreshing}
            className="size-10 items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 active:opacity-60 disabled:opacity-55"
          >
            <Ionicons
              name="refresh-outline"
              size={16}
              color="#687069"
            />
          </Pressable>

          <Pressable
            onPress={handlePickAndUpload}
            disabled={uploadState !== "idle" && uploadState !== "completed" && uploadState !== "failed"}
            className="h-10 flex-row items-center space-x-1.5 px-3.5 rounded-xl bg-[#171b18] dark:bg-[#f0f2ee] active:opacity-80 disabled:opacity-60"
          >
            <Ionicons name="cloud-upload-outline" size={17} color="#8b5cf6" />
            <Text className="text-[13px] font-semibold text-white dark:text-[#171b18]">Upload PDF</Text>
          </Pressable>
        </View>
      </View>

      {/* Upload Progress Overlay Widget */}
      {uploadState !== "idle" && (
        <View className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800/80 shadow-sm space-y-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center space-x-2 flex-1 pr-4">
              {uploadState === "uploading" && <ActivityIndicator size="small" color="#f97316" />}
              {uploadState === "queued" && <ActivityIndicator size="small" color="#f97316" />}
              {uploadState === "indexing" && <ActivityIndicator size="small" color="#f97316" />}
              {uploadState === "completed" && <Ionicons name="checkmark-circle-outline" size={18} color="#22c55e" />}
              {uploadState === "failed" && <Ionicons name="alert-circle-outline" size={18} color="#ef4444" />}
              
              <Text numberOfLines={1} className="text-[14px] font-semibold text-gray-700 dark:text-zinc-300 flex-1">
                {uploadFileName}
              </Text>
            </View>
            <Text className="text-[13px] font-bold text-gray-500 dark:text-zinc-400">
              {uploadProgress}%
            </Text>
          </View>

          {/* Progress bar */}
          <View className="h-1.5 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <View
              className={`h-full rounded-full ${
                uploadState === "completed" ? "bg-green-500" : uploadState === "failed" ? "bg-red-500" : "bg-orange-500"
              }`}
              style={{ width: `${uploadProgress}%` }}
            />
          </View>

          {/* Status hint text */}
          <View className="flex-row justify-between items-center">
            <Text className="text-[12px] leading-5 text-gray-500 dark:text-zinc-400 font-medium">
              {uploadState === "uploading" && "Uploading document to server..."}
              {uploadState === "queued" && "Queued: Waiting for indexing worker..."}
              {uploadState === "indexing" && "Indexing: Parsing pages & text embeddings..."}
              {uploadState === "completed" && "Successfully indexed!"}
              {uploadState === "failed" && `Failed: ${uploadError || "unknown error"}`}
            </Text>
            {uploadState === "failed" && (
              <Pressable onPress={() => setUploadState("idle")}>
                <Text className="text-[12px] font-bold text-violet-600">Dismiss</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Uploaded Files horizontal selector */}
      <View>
        {files.length === 0 ? (
          <View className="py-2.5 items-center bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-gray-200 dark:border-zinc-800">
            <Text className="text-[13px] text-gray-500 dark:text-zinc-400 font-medium">
              No files uploaded yet. Click Upload PDF to start.
            </Text>
          </View>
        ) : (
          <FlatList
            data={files}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => {
              const isSelected = selectedFile === item;
              return (
                <Pressable
                  onPress={() => onSelectFile(item)}
                  className={`flex-row items-center space-x-1.5 px-3 py-2 rounded-xl border transition-colors ${
                    isSelected
                      ? "bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-900/50"
                      : "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800"
                  }`}
                >
                  <Ionicons name="document-text-outline" size={16} color={isSelected ? "#7c3aed" : "#9ca3af"} />
                  <Text
                    numberOfLines={1}
                    className={`text-[13px] font-semibold max-w-[140px] ${
                      isSelected ? "text-violet-700 dark:text-violet-300 font-bold" : "text-gray-600 dark:text-zinc-400"
                    }`}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </View>
  );
}
