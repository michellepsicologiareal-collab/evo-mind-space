import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

// Sequences sum: 1944, transitions: 7 x 24 = 168 -> total 1776 frames (~59.2s @ 30fps)
export const RemotionRoot = () => (
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={1776}
    fps={30}
    width={1920}
    height={1080}
  />
);
