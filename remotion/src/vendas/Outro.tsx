import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C } from "./theme";

/** Encerramento (~6s): único momento com preço. */
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logo = spring({ frame, fps, config: { damping: 18 } });
  const line1 = spring({ frame: frame - 14, fps, config: { damping: 22 } });
  const price = spring({ frame: frame - 26, fps, config: { damping: 15, stiffness: 120 } });
  const foot = spring({ frame: frame - 48, fps, config: { damping: 22 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22, opacity: logo }}>
        <Img src={staticFile("logo.png")} style={{ width: 104, mixBlendMode: "darken" }} />
        <div
          style={{
            fontFamily: "'Inter Tight', Inter, sans-serif",
            fontSize: 80,
            fontWeight: 700,
            letterSpacing: -2.6,
            color: C.ink,
          }}
        >
          Psi<span style={{ color: C.lilac }}>Real</span>
        </div>
      </div>

      <div
        style={{
          marginTop: 46,
          fontFamily: "'Inter Tight', Inter, sans-serif",
          fontSize: 44,
          fontWeight: 600,
          color: C.ink,
          letterSpacing: -1,
          opacity: line1,
          transform: `translateY(${interpolate(line1, [0, 1], [18, 0])}px)`,
        }}
      >
        6 meses de acesso
      </div>

      <div
        style={{
          marginTop: 18,
          display: "flex",
          alignItems: "flex-end",
          gap: 14,
          opacity: price,
          transform: `scale(${interpolate(price, [0, 1], [0.9, 1])})`,
        }}
      >
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 36, color: C.inkSoft, paddingBottom: 20 }}>
          R$
        </div>
        <div
          style={{
            fontFamily: "'Inter Tight', Inter, sans-serif",
            fontSize: 170,
            fontWeight: 700,
            letterSpacing: -7,
            color: C.terra,
            lineHeight: 1,
          }}
        >
          58,90
        </div>
      </div>

      <div
        style={{
          marginTop: 34,
          fontFamily: "Inter, sans-serif",
          fontSize: 30,
          color: C.ink,
          opacity: foot,
        }}
      >
        Menos de R$ 10 por mês
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: "Inter, sans-serif",
          fontSize: 22,
          color: C.inkSoft,
          opacity: foot,
        }}
      >
        Renovação a cada 6 meses
      </div>
    </AbsoluteFill>
  );
};
