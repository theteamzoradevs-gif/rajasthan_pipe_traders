import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CategoryPage from "../../components/CategoryPage/CategoryPage";
import { categories, getCategoryBySlug, type CategoryConfig } from "../../data/categories";
import { products as staticProducts, type Product } from "../../data/products";
import { apiProductToProduct } from "../../lib/api/mapApiProduct";
import type { ApiProduct } from "../../lib/api/types";
import { getApiBaseUrl, resolveAssetUrl } from "../../lib/api/baseUrl";
import {
  getStorefrontCategoryBySlug,
  getStorefrontProductsFromSearchParams,
} from "@/lib/catalog/storefront";
import { loadActiveComboGuardRules } from "@/lib/combo/loadActiveComboGuardRules";
import {
  sortApiProductsForDisplayOrder,
  sortProductsForDisplayOrder,
} from "@/app/lib/sortApiProductsDisplay";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** ISR: category pages revalidate hourly (Mongo-backed categories + product lists). */
export const revalidate = 3600;

const CATEGORY_BG_PALETTE = ["#ffccd5", "#b3e5fc", "#c8e6c9", "#e1bee7", "#ffe0b2", "#d7ccc8"];

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (Math.imul(31, h) + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function dbCategoryRowToConfig(row: Record<string, unknown>, slug: string): CategoryConfig {
  const name = typeof row.name === "string" && row.name.trim() ? row.name : slug;
  const imageRaw = typeof row.image === "string" ? row.image : undefined;
  const image = resolveAssetUrl(imageRaw, getApiBaseUrl());
  const description = typeof row.description === "string" ? row.description : "";
  const bgColor = CATEGORY_BG_PALETTE[hashSlug(slug) % CATEGORY_BG_PALETTE.length];
  return {
    id: name,
    slug,
    name,
    image,
    bgColor,
    description,
  };
}

export async function generateStaticParams() {
  return categories.map((cat) => ({ slug: cat.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const staticCategory = getCategoryBySlug(slug);
  if (staticCategory) {
    return {
      title: `${staticCategory.name} | Rajasthan Pipe Traders`,
      description: staticCategory.description,
      keywords: [staticCategory.name, "Hitech Square", "Tejas Craft", "N-Star", "Rajasthan Pipe Traders", "Ahmedabad"].join(", "),
      openGraph: {
        title: `${staticCategory.name} | Rajasthan Pipe Traders`,
        description: staticCategory.description,
        images: [staticCategory.image],
      },
    };
  }

  const row = await getStorefrontCategoryBySlug(slug);
  if (!row) {
    return { title: "Category Not Found | Rajasthan Pipe Traders" };
  }
  const name = typeof row.name === "string" ? row.name : slug;
  const description = typeof row.description === "string" ? row.description : "";
  const image = resolveAssetUrl(typeof row.image === "string" ? row.image : undefined, getApiBaseUrl());
  return {
    title: `${name} | Rajasthan Pipe Traders`,
    description,
    keywords: [name, "Rajasthan Pipe Traders", "Ahmedabad"].join(", "),
    openGraph: {
      title: `${name} | Rajasthan Pipe Traders`,
      description,
      images: [image],
    },
  };
}

export default async function CategorySlugPage({ params }: PageProps) {
  const { slug } = await params;

  let category: CategoryConfig;
  let products: Product[];
  let comboTriggerSlugs: string[] = [];

  const staticCategory = getCategoryBySlug(slug);
  if (staticCategory) {
    category = staticCategory;
    products = sortProductsForDisplayOrder(staticProducts.filter((p) => p.category === category.id));
  } else {
    const row = await getStorefrontCategoryBySlug(slug);
    if (!row) notFound();

    category = dbCategoryRowToConfig(row, slug);

    const sp = new URLSearchParams({
      categorySlug: slug,
      productKind: "catalog",
      limit: "500",
      skip: "0",
    });
    const result = await getStorefrontProductsFromSearchParams(sp);
    if (!result.ok) notFound();

    const apiProducts = sortApiProductsForDisplayOrder(result.data as unknown as ApiProduct[]);
    products = apiProducts.map((doc) => apiProductToProduct(doc as unknown as ApiProduct));
  }

  try {
    const rules = await loadActiveComboGuardRules();
    const target = new Set<string>();
    for (const r of rules) {
      for (const s of r.targetSlugs ?? []) {
        const n = String(s).trim().toLowerCase();
        if (n) target.add(n);
      }
    }
    comboTriggerSlugs = [...target];
  } catch {
    comboTriggerSlugs = [];
  }

  return <CategoryPage category={category} products={products} comboTriggerSlugs={comboTriggerSlugs} />;
}
