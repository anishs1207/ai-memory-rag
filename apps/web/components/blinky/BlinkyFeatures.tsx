"use client";

import React from "react";
import { Bot, MousePointerClick, Sliders } from "lucide-react";

/**
 * Feature items with ultra-concise text.
 */
const featuresList = [
  {
    icon: Bot,
    title: "Visual AI Assistant",
    description: "Interprets screen frames and active code context in real time.",
  },
  {
    icon: MousePointerClick,
    title: "Guided Focus Rings",
    description: "Draws animated highlight coordinates over OS windows.",
  },
  {
    icon: Sliders,
    title: "Overlay Controls",
    description: "Customizable translucency, click-through, and privacy blurs.",
  },
];

/**
 * Minimalist features bento grid with ample whitespace.
 */
export const BlinkyFeatures: React.FC = () => {
  return (
    <section id="features" className="py-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {featuresList.map((featureItem) => {
          const IconComponent = featureItem.icon;
          return (
            <div
              key={featureItem.title}
              className="group relative flex flex-col justify-between rounded-3xl border border-border/40 bg-card/30 p-7 backdrop-blur-2xl transition-all duration-300 hover:border-border hover:bg-card/50"
            >
              <div className="space-y-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-foreground border border-border/40">
                  <IconComponent className="h-4 w-4" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    {featureItem.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {featureItem.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default BlinkyFeatures;


