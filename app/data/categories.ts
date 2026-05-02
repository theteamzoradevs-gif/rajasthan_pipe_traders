export interface CategoryConfig {
  id: string;
  slug: string;
  name: string;
  image: string;
  bgColor: string;
  description: string;
}

export const categories: CategoryConfig[] = [
  {
    id: 'Cable Clips',
    slug: 'cable-clips',
    name: 'Cable Clips',
    image: '/Cable_Clip.png',
    bgColor: '#ffccd5',
    description: 'Nail clips, double nail clamps, UPVC & CPVC pipe clamps, nylon cable ties and more for secure wire management.',
  },
  {
    id: 'Fasteners & Hardware',
    slug: 'fasteners-hardware',
    name: 'Fasteners & Hardware',
    image: '/Nail_Cable_Clip.png',
    bgColor: '#b3e5fc',
    description: 'Heavy-duty wall plugs, concrete nails and anchoring fasteners for masonry and concrete surfaces.',
  },
  {
    id: 'Electrical Accessories',
    slug: 'electrical-accessories',
    name: 'Electrical Accessories',
    image: '/Cable_Clip.png',
    bgColor: '#c8e6c9',
    description: 'FR insulation tapes, bulb holders, ceiling roses, modular switches, sockets and complete wiring accessories.',
  },
  {
    id: 'Boxes & Plates',
    slug: 'boxes-plates',
    name: 'Boxes & Plates',
    image: '/Cable_Clip.png',
    bgColor: '#e1bee7',
    description: 'ABS modular gang boxes, surface boxes, metal concealed boxes, distribution boxes and modular plates.',
  },
  {
    id: 'Sanitaryware',
    slug: 'sanitaryware',
    name: 'Sanitaryware',
    image: '/Cable_Clip.png',
    bgColor: '#ffe0b2',
    description: 'PP & UPVC ball valves, bib cocks, health faucets, nani traps, waste couplings and complete plumbing fittings.',
  },
];

export function getCategoryBySlug(slug: string): CategoryConfig | undefined {
  return categories.find(c => c.slug === slug);
}

export function categoryToSlug(category: string): string {
  return category
    .toLowerCase()
    .replace(/[&]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}
