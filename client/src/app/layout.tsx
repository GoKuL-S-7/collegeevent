import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "CampusConnect India",
  description: "Aggregating and hosting college events across India",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#0f0f1a] text-white">
        <Navbar />
        <main className="min-h-screen pt-16">
          {children}
        </main>
      </body>
    </html>
  );
}
