import Link from "next/link";
import { getAdminOverviewStats } from "@/lib/db/getAdminOverviewStats";
import AdminDashboardStats from "./components/AdminDashboardStats";

const cards = [
  {
    href: "/admin/categories",
    title: "Categories",
    desc: "Create and organize catalog categories, slugs, and parent trees.",
    cta: "Open categories",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
      </svg>
    ),
  },
  {
    href: "/admin/products",
    title: "Products",
    desc: "Manage SKUs, pricing, images, and catalog details in MongoDB.",
    cta: "Open products",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    ),
  },
  {
    href: "/admin/blogs",
    title: "Blogs",
    desc: "Manage company news, industry updates, and blog posts.",
    cta: "Open blogs",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h8" />
        <path d="M8 9h2" />
      </svg>
    ),
  },
  {
    href: "/admin/coupons",
    title: "Coupons",
    desc: "Discount codes, eligibility rules, and campaign windows.",
    cta: "Open coupons",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
        <path d="M7 7h.01" />
      </svg>
    ),
  },
  {
    href: "/admin/combos",
    title: "Combo rules",
    desc: "Bundle logic and cross-sell rules for the storefront.",
    cta: "Open combo rules",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
        <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
        <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
      </svg>
    ),
  },
  {
    href: "/admin/media",
    title: "Media",
    desc: "Browse and remove Cloudinary uploads tied to the catalog.",
    cta: "Open media library",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    ),
  },
  {
    href: "/admin/banner",
    title: "Banner",
    desc: "Homepage hero and promotional strip content.",
    cta: "Edit banner",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 20h16" />
        <path d="M5 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
        <path d="M8 8h8" />
      </svg>
    ),
  },
  {
    href: "/admin/settings",
    title: "Settings",
    desc: "App-wide options and integration toggles.",
    cta: "Open settings",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

export default async function AdminHomePage() {
  const stats = await getAdminOverviewStats();

  return (
    <div>
      <header className="admin-dashboard-header">
        <p className="admin-dashboard-kicker">Welcome back</p>
        <h1 className="admin-dashboard-title">Store administration</h1>
        <p className="admin-dashboard-lead">
          Use this panel to manage categories, products, coupons, banners, and media for your store.
          If admin pages are not loading, ask your developer to check the database connection settings.
        </p>
      </header>

      <section className="admin-dashboard-analytics" aria-labelledby="admin-analytics-heading">
        <h2 id="admin-analytics-heading" className="admin-dashboard-analytics-title">
          Analytics
        </h2>
        <AdminDashboardStats
          totalOrders={stats.totalOrders}
          totalLeads={stats.totalLeads}
          totalBlogs={stats.totalBlogs}
        />
      </section>

      <div className="admin-dashboard-grid">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="admin-dashboard-card">
            <span className="admin-dashboard-card-icon">{c.icon}</span>
            <h2 className="admin-dashboard-card-title">{c.title}</h2>
            <p className="admin-dashboard-card-desc">{c.desc}</p>
            <span className="admin-dashboard-card-cta">{c.cta} →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
