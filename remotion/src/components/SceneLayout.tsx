import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors } from "../theme";
import { BrowserCard } from "./BrowserCard";
import { Bullet, SceneTitle } from "./Bullets";

export const SceneLayout: React.FC<{
  kicker: string;
  title: string;
  bullets: string[];
  image: string;
  accent?: string;
  flip?: boolean;
}> = ({ kicker, title, bullets, image, accent = colors.terracota, flip = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const card = spring({ frame: frame - 6, fps, config: { damping: 18, stiffness: 90 } });
  const cardY = interpolate(card, [0, 1], [90, 0]);
  const cardRot = interpolate(card, [0, 1], [flip ? -4 : 4, 0]);
  const drift = Math.sin(frame / 40) * 6;

  const textCol = (
    <div style={{ width: 660, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <SceneTitle kicker={kicker} title={title} color={accent} />
      {bullets.map((b, i) => (
        <Bullet key={b} text={b} delay={22 + i * 10} color={accent} />
      ))}
    </div>
  );

  const cardCol = (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `translateY(${cardY + drift}px) rotate(${cardRot}deg)`,
        opacity: card,
      }}
    >
      <BrowserCard src={image} width={860} />
    </div>
  );

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${colors.bgSoft} 0%, ${colors.bg} 100%)`,
        padding: "70px 90px",
        flexDirection: "row",
        gap: 70,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: `${accent}14`,
          top: -200,
          [flip ? "left" : "right"]: -160,
        }}
      />
      {flip ? (
        <>
          {cardCol}
          {textCol}
        </>
      ) : (
        <>
          {textCol}
          {cardCol}
        </>
      )}
    </AbsoluteFill>
  );
};
