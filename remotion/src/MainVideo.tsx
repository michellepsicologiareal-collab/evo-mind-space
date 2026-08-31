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

const makeTransition = (key: string) => (
  <TransitionSeries.Transition
    key={key}
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
      {makeTransition("t1")}
      <TransitionSeries.Sequence durationInFrames={240}>
        <ScenePainel />
      </TransitionSeries.Sequence>
      {makeTransition("t2")}
      <TransitionSeries.Sequence durationInFrames={300}>
        <SceneAgenda />
      </TransitionSeries.Sequence>
      {makeTransition("t3")}
      <TransitionSeries.Sequence durationInFrames={300}>
        <ScenePacientes />
      </TransitionSeries.Sequence>
      {makeTransition("t4")}
      <TransitionSeries.Sequence durationInFrames={240}>
        <SceneTCC />
      </TransitionSeries.Sequence>
      {makeTransition("t5")}
      <TransitionSeries.Sequence durationInFrames={300}>
        <SceneFinanceiro />
      </TransitionSeries.Sequence>
      {makeTransition("t6")}
      <TransitionSeries.Sequence durationInFrames={204}>
        <SceneAutocuidado />
      </TransitionSeries.Sequence>
      {makeTransition("t7")}
      <TransitionSeries.Sequence durationInFrames={180}>
        <Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
