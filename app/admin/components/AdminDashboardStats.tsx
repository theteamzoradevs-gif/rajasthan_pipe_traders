"use client";

import Link from "next/link";
import { Package, Users, FileText } from "lucide-react";

type Props = {
  totalOrders: number;
  totalLeads: number;
  totalBlogs: number;
};

function formatCount(n: number) {
  return n.toLocaleString("en-IN");
}

export default function AdminDashboardStats({ totalOrders, totalLeads, totalBlogs }: Props) {
  const items = [
    {
      href: "/admin/orders",
      label: "Total Orders",
      sub: "Quotations placed",
      value: totalOrders,
      icon: Package,
      accent: "var(--admin-stat-orders, #0ea5e9)",
    },
    {
      href: "/admin/leads",
      label: "Total Leads",
      sub: "Phone captures & cart activity",
      value: totalLeads,
      icon: Users,
      accent: "var(--admin-stat-leads, #2563eb)",
    },
    {
      href: "/admin/blogs",
      label: "Total Blogs",
      sub: "Published posts",
      value: totalBlogs,
      icon: FileText,
      accent: "var(--admin-stat-blogs, #0369a1)",
    },
  ] as const;

  return (
    <div className="admin-dashboard-stats" role="region" aria-label="Analytics overview">
      {items.map((c) => {
        const Icon = c.icon;
        return (
          <Link key={c.href} href={c.href} className="admin-stat-card">
            <span className="admin-stat-icon-wrap" style={{ color: c.accent }}>
              <Icon size={26} strokeWidth={1.75} aria-hidden />
            </span>
            <div className="admin-stat-text">
              <span className="admin-stat-label">{c.label}</span>
              <span className="admin-stat-sub">{c.sub}</span>
            </div>
            <span className="admin-stat-value" style={{ color: c.accent }}>
              {formatCount(c.value)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
