import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "./theme";

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 120) * 40;
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(155deg, ${C.bg} 0%, ${C.bgDeep} 100%)`,
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 620px at ${58 + drift / 40}% 18%, rgba(155,141,184,0.20), transparent 70%),
                       radial-gradient(760px 560px at 12% 88%, rgba(165,113,100,0.16), transparent 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};
