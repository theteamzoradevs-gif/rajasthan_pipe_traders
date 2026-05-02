import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "All categories | Rajasthan Pipe Traders",
  description: "Browse every product category in our catalog.",
};

export default function CategoriesLayout({ children }: { children: ReactNode }) {
  return children;
}
