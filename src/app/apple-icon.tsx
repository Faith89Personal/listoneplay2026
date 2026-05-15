import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#15803d",
          display: "flex",
          flexDirection: "column",
          padding: 24,
          gap: 10,
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 10,
              height: 16,
            }}
          >
            <div
              style={{
                width: 64,
                height: 16,
                borderRadius: 4,
                background: "rgba(255,255,255,1)",
              }}
            />
            <div
              style={{
                flex: 1,
                height: 16,
                borderRadius: 4,
                background: "rgba(255,255,255,0.55)",
              }}
            />
          </div>
        ))}
      </div>
    ),
    size,
  );
}
