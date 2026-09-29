import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "내 체험단",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function MyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
