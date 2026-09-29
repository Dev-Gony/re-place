import { ImageResponse } from "next/og";

export const alt = "Re:Place 체험단 캠페인 통합 검색";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          color: "#171717",
          padding: "72px",
          border: "24px solid #171717",
        }}
      >
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>
          Re:Place
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800 }}>
            체험단을 한곳에서 비교하세요
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#666666" }}>
            혜택 · 경쟁률 · 마감 · 지역을 한눈에
          </div>
        </div>
      </div>
    ),
    size,
  );
}
