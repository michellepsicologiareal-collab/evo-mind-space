import { loadFont as loadInterTight } from "@remotion/google-fonts/InterTight";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

export const { fontFamily: displayFont } = loadInterTight("normal", {
  weights: ["600", "700", "800"],
  subsets: ["latin"],
});

export const { fontFamily: bodyFont } = loadInter("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

export const colors = {
  bg: "#F0E9DE",
  bgSoft: "#F7F2EA",
  card: "#FFFFFF",
  terracota: "#A57164",
  terracotaDark: "#8A5A4F",
  lilas: "#9B8DB8",
  verde: "#3D5C35",
  dourado: "#C9A961",
  ink: "#3A332E",
  inkSoft: "#6E655C",
};
