
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Healthcare Appointment System",
  description: "Manage healthcare appointments efficiently.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
