import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "./theme";

export const Caption: React.FC<{
  kicker: string;
  title: string;
  accent?: string;
  align?: "left" | "right";
}> = ({ kicker, title, accent = C.terra, align = "left" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 8, fps, config: { damping: 22, stiffness: 110 } });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: align === "left" ? "flex-start" : "flex-end",
        padding: "0 90px 54px",
      }}
    >
      <div
        style={{
          opacity: s,
          transform: `translateY(${interpolate(s, [0, 1], [26, 0])}px)`,
          background: "rgba(255,255,255,0.94)",
          borderRadius: 20,
          padding: "20px 30px",
          maxWidth: 980,
          boxShadow: "0 22px 60px rgba(36,31,43,0.16)",
          borderLeft: align === "left" ? `6px solid ${accent}` : undefined,
          borderRight: align === "right" ? `6px solid ${accent}` : undefined,
          textAlign: align,
        }}
      >
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 20,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: accent,
            fontWeight: 600,
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            marginTop: 8,
            fontFamily: "'Inter Tight', Inter, sans-serif",
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: -1.2,
            color: C.ink,
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>
      </div>
    </AbsoluteFill>
  );
};
