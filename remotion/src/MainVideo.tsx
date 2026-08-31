import React from "react";
import { springTiming, TransitionSeries } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { Intro } from "./scenes/Intro";
import { Outro } from "./scenes/Outro";
import {
  SceneAgenda,
  SceneAutocuidado,
  SceneFinanceiro,
  ScenePacientes,
  ScenePainel,
  SceneTCC,
} from "./scenes/Scenes";

const T = () => (
  <TransitionSeries.Transition
    presentation={wipe({ direction: "from-left" })}
    timing={springTiming({ config: { damping: 200 }, durationInFrames: 24 })}
  />
);

export const MainVideo: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={180}>
        <Intro />
      </TransitionSeries.Sequence>
      <T />
      <TransitionSeries.Sequence durationInFrames={240}>
        <ScenePainel />
      </TransitionSeries.Sequence>
      <T />
      <TransitionSeries.Sequence durationInFrames={300}>
        <SceneAgenda />
      </TransitionSeries.Sequence>
      <T />
      <TransitionSeries.Sequence durationInFrames={300}>
        <ScenePacientes />
      </TransitionSeries.Sequence>
      <T />
      <TransitionSeries.Sequence durationInFrames={240}>
        <SceneTCC />
      </TransitionSeries.Sequence>
      <T />
      <TransitionSeries.Sequence durationInFrames={300}>
        <SceneFinanceiro />
      </TransitionSeries.Sequence>
      <T />
      <TransitionSeries.Sequence durationInFrames={204}>
        <SceneAutocuidado />
      </TransitionSeries.Sequence>
      <T />
      <TransitionSeries.Sequence durationInFrames={180}>
        <Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
