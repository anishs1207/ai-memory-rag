"use client";

import React, { useEffect, useState } from "react";
import { Download, Laptop, CheckCircle2, Clock } from "lucide-react";

/**
 * Metadata interface for distribution binary packages.
 */
export interface PackageMeta {
  /** Target OS platform name */
  platform: string;
  /** Binary file name */
  filename: string;
  /** Download URL path */
  path: string;
  /** File format summary */
  format?: string;
  /** Size in bytes */
  size_bytes: number;
  /** Status tag */
  status: string;
  /** Availability flag */
  available: boolean;
  /** Whether Windows primary build */
  isPrimary?: boolean;
}

/**
 * Minimalist downloads component for Blinky distribution payloads.
 */
export const BlinkyDownloads: React.FC = () => {
  const [packages, setPackages] = useState<PackageMeta[]>([]);

  useEffect(() => {
    fetch("/downloads/manifest.json")
      .then((res) => res.json())
      .then((data) => {
        if (data.packages) {
          setPackages(data.packages);
        }
      })
      .catch(() => {
        setPackages([
          {
            platform: "Windows 64-bit",
            filename: "desktop-app 0.0.0.exe",
            path: "/api/download/win",
            format: "Standalone Executable",
            size_bytes: 80900000,
            status: "Ready",
            available: true,
            isPrimary: true,
          },
          {
            platform: "macOS ARM64",
            filename: "blinkity-macos-arm64.dmg",
            path: "#",
            format: "Apple Disk Image",
            size_bytes: 14200000,
            status: "Coming Soon",
            available: false,
          },
          {
            platform: "Linux AppImage",
            filename: "blinkity-linux-x64.AppImage",
            path: "#",
            format: "ELF Standalone",
            size_bytes: 16800000,
            status: "Coming Soon",
            available: false,
          },
          {
            platform: "Source Bundle",
            filename: "blinkity-source.zip",
            path: "#",
            format: "Monorepo Source",
            size_bytes: 5200000,
            status: "Coming Soon",
            available: false,
          },
        ]);
      });
  }, []);

  return (
    <section id="downloads" className="py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Downloads
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {packages.map((pkg) => (
          <div
            key={pkg.platform}
            className={`flex flex-col justify-between rounded-3xl border p-6 backdrop-blur-2xl transition-all duration-300 ${
              pkg.isPrimary
                ? "border-primary/30 bg-primary/5 shadow-xl shadow-primary/5"
                : "border-border/40 bg-card/30 opacity-75 hover:opacity-100 hover:border-border"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Laptop className="h-3.5 w-3.5 text-muted-foreground" />
                  {pkg.platform}
                </span>
                {pkg.available ? (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    {pkg.status}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {pkg.status}
                  </span>
                )}
              </div>

              <p className="text-[11px] font-mono text-muted-foreground truncate" title={pkg.filename}>
                {pkg.filename}
              </p>
            </div>

            <div className="mt-6">
              {pkg.available ? (
                <a
                  href={pkg.path}
                  download={pkg.filename}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-background py-2.5 text-xs font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Executable</span>
                </a>
              ) : (
                <button
                  disabled
                  className="flex w-full items-center justify-center rounded-2xl border border-border/40 bg-muted/20 py-2.5 text-xs font-medium text-muted-foreground cursor-not-allowed"
                >
                  Coming Soon
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default BlinkyDownloads;



