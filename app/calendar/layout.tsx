import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "캘린더",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
