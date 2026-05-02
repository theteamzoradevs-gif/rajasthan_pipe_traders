import React from 'react';
import HeroBanner from './components/HeroBanner/HeroBanner';
import HomeCategoryGrid from './components/HomeCategoryGrid/HomeCategoryGrid';
import HomeProductsSection from './components/HomeProductsSection/HomeProductsSection';
import { getHomeBanner } from '@/lib/banner/resolveHomeBanner';

export const revalidate = 60;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const banner = await getHomeBanner();

  return (
    <div className="home-root">
      <HeroBanner banner={banner} />
      <HomeCategoryGrid />
      <HomeProductsSection page={page} />
    </div>
  );
}
