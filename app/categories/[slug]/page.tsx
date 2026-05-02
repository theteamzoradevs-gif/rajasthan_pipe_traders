export { default, generateMetadata, generateStaticParams } from "../../category/[slug]/page";

/** Same category view as `/category/[slug]`; cached with ISR (see `app/category/[slug]/page.tsx`). */
export const revalidate = 3600;
