import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "캠페인 공개 관리",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function CampaignAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
