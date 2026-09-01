import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { Background } from "./Background";
import { Caption } from "./Caption";
import { Intro } from "./Intro";
import { Outro } from "./Outro";
import { ShotFrame } from "./ShotFrame";
import { BLOCKS } from "./scenes";
import { BOUNDS } from "./timeline";

const BlockScene: React.FC<{ index: number; duration: number }> = ({ index, duration }) => {
  const b = BLOCKS[index];
  const per = Math.max(24, Math.floor(duration / b.shots.length));
  return (
    <AbsoluteFill>
      {b.shots.map((s, i) => (
        <Sequence
          key={`${s}-${i}`}
          from={i * per}
          durationInFrames={i === b.shots.length - 1 ? duration - i * per + 4 : per + 8}
        >
          <ShotFrame
            shot={s}
            focus={b.focus ?? { x: 0.5, y: 0.4, from: 1.0, to: 1.06 }}
            width={1420}
            height={800}
            y={-34}
          />
        </Sequence>
      ))}
      <Caption kicker={b.kicker} title={b.title} accent={b.accent} align={b.align} />
    </AbsoluteFill>
  );
};

export const VendasVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background />
      {BOUNDS.map((b, i) => (
        <Sequence key={i} from={b.from} durationInFrames={b.duration}>
          {i === 0 ? (
            <Intro shots={["01_painel", "10_agenda", "60_financeiro"]} />
          ) : i === BOUNDS.length - 1 ? (
            <Outro />
          ) : (
            <BlockScene index={i - 1} duration={b.duration} />
          )}
        </Sequence>
      ))}
      <Audio src={staticFile("audio/narration.wav")} />
    </AbsoluteFill>
  );
};
