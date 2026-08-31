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

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logo = spring({ frame, fps, config: { damping: 16, stiffness: 100 } });
  const url = spring({ frame: frame - 16, fps, config: { damping: 200 } });
  const line = interpolate(frame, [20, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(150deg, ${colors.terracota} 0%, ${colors.terracotaDark} 100%)`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          transform: `scale(${interpolate(logo, [0, 1], [0.7, 1])})`,
          opacity: logo,
          background: colors.card,
          borderRadius: 40,
          padding: 26,
          boxShadow: "0 30px 70px rgba(0,0,0,0.25)",
        }}
      >
        <Img src={staticFile("images/logo-psireal.png")} style={{ width: 130, height: 130, objectFit: "contain" }} />
      </div>
      <div
        style={{
          marginTop: 44,
          height: 5,
          width: 160,
          borderRadius: 3,
          background: colors.dourado,
          transform: `scaleX(${line})`,
        }}
      />
      <div
        style={{
          fontFamily: displayFont,
          fontWeight: 800,
          fontSize: 84,
          color: "#FFFFFF",
          letterSpacing: -2,
          marginTop: 26,
          opacity: url,
          transform: `translateY(${interpolate(url, [0, 1], [30, 0])}px)`,
        }}
      >
        psireal.app
      </div>
      <div
        style={{
          fontFamily: bodyFont,
          fontWeight: 500,
          fontSize: 30,
          color: "#FFFFFFCC",
          marginTop: 14,
          opacity: url,
        }}
      >
        Organize sua clínica. Cuide de quem cuida.
      </div>
    </AbsoluteFill>
  );
};
