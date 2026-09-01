import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C } from "./theme";

export type Focus = { x: number; y: number; from: number; to: number };

export const ShotFrame: React.FC<{
  shot: string;
  focus?: Focus;
  width?: number;
  height?: number;
  y?: number;
  fadeIn?: number;
}> = ({
  shot,
  focus = { x: 0.5, y: 0.4, from: 1.0, to: 1.06 },
  width = 1420,
  height = 800,
  y = -30,
  fadeIn = 12,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [focus.from, focus.to], {
    extrapolateRight: "clamp",
  });
  const appear = interpolate(frame, [0, fadeIn], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rise = interpolate(appear, [0, 1], [26, 0]);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width,
          height,
          transform: `translateY(${y + rise}px)`,
          opacity: appear,
          borderRadius: 20,
          overflow: "hidden",
          background: C.white,
          border: "1px solid rgba(36,31,43,0.08)",
          boxShadow: "0 40px 110px rgba(36,31,43,0.20), 0 6px 20px rgba(36,31,43,0.08)",
        }}
      >
        <Img
          src={staticFile(`shots/${shot}.png`)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: `${focus.x * 100}% ${focus.y * 100}%`,
            transform: `scale(${scale})`,
            transformOrigin: `${focus.x * 100}% ${focus.y * 100}%`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
