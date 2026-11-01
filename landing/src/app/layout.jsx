import "../reference.css";
import "../styles.css";

export const metadata = {
  title: "Senspace — 우리의 감각이 연결되는 사무실",
  description: "실제 사무실 평면도 위에서 동료의 상태와 감각을 함께 나누는 B2B 메타버스 오피스, Senspace.",
};

export const viewport = { themeColor: "#f8f1e2" };

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/galmuri/dist/galmuri.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
