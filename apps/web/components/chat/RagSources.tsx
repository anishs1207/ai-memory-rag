"use client";

import { Badge } from "@/components/ui/badge";
import { BookOpen, ChevronDown, FileText } from "lucide-react";

export type RagSource = {
    name: string;
    chunkIndex: number;
    content: string;
    score: number;
};

export function RagSources({ sources }: { sources: RagSource[] }) {
    if (sources.length === 0) return null;

    return (
        <details className="group mt-4 overflow-hidden rounded-xl border border-border/70 bg-muted/20">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40">
                <span className="flex min-w-0 items-center gap-2 text-xs font-semibold">
                    <BookOpen className="size-4 shrink-0 text-primary" />
                    Sources used
                    <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">
                        {sources.length} chunks
                    </Badge>
                </span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>

            <div className="space-y-2 border-t border-border/60 p-3">
                {sources.map((source, index) => (
                    <details key={`${source.name}-${source.chunkIndex}-${index}`} className="group/chunk rounded-lg border bg-background/70">
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3 py-2.5">
                            <span className="flex min-w-0 items-start gap-2">
                                <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                <span className="min-w-0">
                                    <span className="block truncate text-[11px] font-medium">{source.name}</span>
                                    <span className="block text-[10px] text-muted-foreground">Chunk {source.chunkIndex + 1}</span>
                                </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                                <Badge variant="outline" className="h-5 text-[9px]">Score {source.score}</Badge>
                                <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-open/chunk:rotate-180" />
                            </span>
                        </summary>
                        <div className="border-t px-3 py-3 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
                            {source.content}
                        </div>
                    </details>
                ))}
            </div>
        </details>
    );
}
