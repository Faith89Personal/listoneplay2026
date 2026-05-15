import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          background: "transparent",
        }}
      >
        <div
          style={{
            width: 74,
            height: 14,
            borderRadius: 3,
            background: "white",
          }}
        />
        <div
          style={{
            width: 74,
            height: 14,
            borderRadius: 3,
            background: "white",
          }}
        />
        <div
          style={{
            width: 74,
            height: 14,
            borderRadius: 3,
            background: "white",
          }}
        />
      </div>
    ),
    { width: 96, height: 96 },
  );
}
