import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C } from "./theme";
import { ShotFrame } from "./ShotFrame";

/**
 * Abertura: ~5s apenas com o logotipo, depois entra a interface real.
 * Nenhum slide promocional, nenhum preço aqui.
 */
export const Intro: React.FC<{ shots: string[] }> = ({ shots }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const logo = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const word = spring({ frame: frame - 12, fps, config: { damping: 20, stiffness: 110 } });

  const logoEnd = Math.round(fps * 5);
  const out = interpolate(frame, [logoEnd - 14, logoEnd], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const shotDur = Math.max(30, Math.round((durationInFrames - logoEnd) / Math.max(1, shots.length)));

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: out,
          transform: `scale(${interpolate(out, [0, 1], [0.94, 1])})`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 26, opacity: logo }}>
          <Img
            src={staticFile("logo.png")}
            style={{
              width: 150,
              mixBlendMode: "darken",
              transform: `scale(${interpolate(logo, [0, 1], [0.7, 1])})`,
            }}
          />
          <div
            style={{
              fontFamily: "'Inter Tight', Inter, sans-serif",
              fontSize: 108,
              fontWeight: 700,
              letterSpacing: -3.5,
              color: C.ink,
              opacity: word,
              transform: `translateY(${interpolate(word, [0, 1], [18, 0])}px)`,
            }}
          >
            Psi<span style={{ color: C.lilac }}>Real</span>
          </div>
        </div>
      </AbsoluteFill>

      {shots.map((s, i) => (
        <Sequence key={s} from={logoEnd + i * shotDur} durationInFrames={shotDur + 6}>
          <ShotFrame
            shot={s}
            width={1440}
            height={810}
            focus={{ x: 0.5, y: 0.34, from: 1.0, to: 1.05 }}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
