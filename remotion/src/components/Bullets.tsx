import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { bodyFont, colors, displayFont } from "../theme";

export const Bullet: React.FC<{
  text: string;
  delay: number;
  color?: string;
}> = ({ text, delay, color = colors.terracota }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 160 } });
  const y = interpolate(s, [0, 1], [26, 0]);
  const opacity = interpolate(s, [0, 1], [0, 1]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        opacity,
        transform: `translateY(${y}px)`,
        marginBottom: 22,
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          background: color,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          fontFamily: bodyFont,
          fontWeight: 500,
          fontSize: 30,
          color: colors.ink,
          lineHeight: 1.3,
        }}
      >
        {text}
      </div>
    </div>
  );
};

export const SceneTitle: React.FC<{
  kicker: string;
  title: string;
  color?: string;
}> = ({ kicker, title, color = colors.terracota }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = spring({ frame, fps, config: { damping: 200 } });
  const t = spring({ frame: frame - 8, fps, config: { damping: 20, stiffness: 120 } });
  const underline = interpolate(frame, [14, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ marginBottom: 40 }}>
      <div
        style={{
          fontFamily: bodyFont,
          fontWeight: 600,
          fontSize: 20,
          letterSpacing: 4,
          textTransform: "uppercase",
          color,
          opacity: k,
          marginBottom: 12,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)`,
          opacity: t,
        }}
      >
        <div
          style={{
            fontFamily: displayFont,
            fontWeight: 800,
            fontSize: 58,
            color: colors.ink,
            lineHeight: 1.05,
            letterSpacing: -1,
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 14,
            height: 6,
            width: 120,
            borderRadius: 3,
            background: color,
            transform: `scaleX(${underline})`,
            transformOrigin: "left",
          }}
        />
      </div>
    </div>
  );
};
