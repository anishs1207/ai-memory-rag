"use client";

import React from "react";
import { Bot, MousePointerClick, Settings } from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "Visual Assistant",
    text: "Captures local screen frames and interprets active code context or mockups.",
  },
  {
    icon: MousePointerClick,
    title: "Guided Highlights",
    text: "Draws coordinate focus rings above standard OS windows to direct attention.",
  },
  {
    icon: Settings,
    title: "Overlay Customizer",
    text: "Features click-through, custom translucency, and security blurs.",
  },
];

export const BlinkyFeatures: React.FC = () => {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {features.map((feat) => {
        const IconComponent = feat.icon;
        return (
          <div
            key={feat.title}
            className="flex items-start gap-3.5 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconComponent className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                {feat.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {feat.text}
              </p>
            </div>
          </div>
        );
      })}
    </section>
  );
};

export default BlinkyFeatures;
