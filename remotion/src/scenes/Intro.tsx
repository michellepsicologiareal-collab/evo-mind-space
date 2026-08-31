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
import { bodyFont, colors, displayFont } from "../theme";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logo = spring({ frame, fps, config: { damping: 15, stiffness: 90 } });
  const title = spring({ frame: frame - 14, fps, config: { damping: 20, stiffness: 110 } });
  const sub = spring({ frame: frame - 30, fps, config: { damping: 200 } });
  const float = Math.sin(frame / 28) * 8;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 700px at 70% 20%, ${colors.bgSoft}, ${colors.bg})`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 620,
          height: 620,
          borderRadius: "50%",
          border: `2px solid ${colors.lilas}33`,
          top: -180,
          right: -140,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 420,
          height: 420,
          borderRadius: "50%",
          border: `2px solid ${colors.dourado}44`,
          bottom: -160,
          left: -100,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            transform: `scale(${interpolate(logo, [0, 1], [0.6, 1])}) translateY(${float}px)`,
            opacity: logo,
          }}
        >
          <Img src={staticFile("images/logo-psireal.png")} style={{ width: 190, height: 190, objectFit: "contain" }} />
        </div>
        <div
          style={{
            fontFamily: displayFont,
            fontWeight: 800,
            fontSize: 110,
            color: colors.ink,
            letterSpacing: -3,
            marginTop: 18,
            opacity: title,
            transform: `translateY(${interpolate(title, [0, 1], [40, 0])}px)`,
          }}
        >
          PsiReal<span style={{ color: colors.terracota }}>.</span>
        </div>
        <div
          style={{
            fontFamily: bodyFont,
            fontWeight: 500,
            fontSize: 34,
            color: colors.inkSoft,
            marginTop: 10,
            opacity: sub,
            transform: `translateY(${interpolate(sub, [0, 1], [24, 0])}px)`,
          }}
        >
          O espaço digital do psicólogo — do cadastro ao cuidado.
        </div>
      </div>
    </AbsoluteFill>
  );
};
