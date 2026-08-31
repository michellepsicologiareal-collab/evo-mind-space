import React from "react";
import { Img, staticFile } from "remotion";
import { colors } from "../theme";

export const BrowserCard: React.FC<{
  src: string;
  width?: number;
  style?: React.CSSProperties;
}> = ({ src, width = 980, style }) => {
  return (
    <div
      style={{
        width,
        borderRadius: 22,
        overflow: "hidden",
        background: colors.card,
        boxShadow:
          "0 30px 80px rgba(58,51,46,0.22), 0 4px 16px rgba(58,51,46,0.10)",
        border: "1px solid rgba(58,51,46,0.08)",
        ...style,
      }}
    >
      <div
        style={{
          height: 40,
          background: colors.bgSoft,
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingLeft: 18,
          borderBottom: "1px solid rgba(58,51,46,0.06)",
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: 6, background: colors.terracota }} />
        <div style={{ width: 12, height: 12, borderRadius: 6, background: colors.dourado }} />
        <div style={{ width: 12, height: 12, borderRadius: 6, background: colors.verde }} />
        <div
          style={{
            marginLeft: 16,
            height: 20,
            width: 220,
            borderRadius: 10,
            background: "rgba(58,51,46,0.08)",
          }}
        />
      </div>
      <Img
        src={staticFile(src)}
        style={{ width: "100%", display: "block", objectFit: "cover" }}
      />
    </div>
  );
};
