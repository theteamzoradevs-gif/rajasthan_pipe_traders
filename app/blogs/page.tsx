import Link from "next/link";
import { connectDb } from "@/lib/db/connect";
import { BlogModel } from "@/lib/db/models/Blog";
import styles from "./blogs.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BlogCard = {
  _id: string;
  title: string;
  slug: string;
  image?: string;
  author?: string;
  createdAt?: string;
  content?: string;
};

type BlogsPageProps = {
  searchParams: Promise<{ page?: string }>;
};

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function BlogsPage({ searchParams }: BlogsPageProps) {
  const sp = await searchParams;
  const limit = 10;
  const page = Math.max(1, Number(sp.page) || 1);
  const skip = (page - 1) * limit;

  await connectDb();
  const [rows, total] = await Promise.all([
    BlogModel.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("_id title slug image author createdAt content")
      .lean<BlogCard[]>(),
    BlogModel.countDocuments({}),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
  const withExcerpt = rows.map((blog) => ({
    ...blog,
    excerpt: (blog.content ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  }));

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.title}>Blogs</h1>
        </div>
      </section>

      <section className={styles.gridWrap}>
        {withExcerpt.length === 0 ? (
          <div className={styles.empty}>No blogs published yet.</div>
        ) : (
          <>
            <div className={styles.grid}>
              {withExcerpt.map((blog) => (
                <Link key={blog._id} href={`/blogs/${blog.slug}`} className={styles.card}>
                  <div className={styles.imageWrap}>
                    {blog.image ? <img src={blog.image} alt={blog.title} className={styles.image} /> : <div className={styles.noImage}>No image</div>}
                  </div>
                  <div className={styles.content}>
                    <h2 className={styles.cardTitle}>{blog.title}</h2>
                    <p className={styles.excerpt}>{blog.excerpt || "Read this blog to explore more insights."}</p>
                    <span className={styles.readMore}>Read More</span>
                    <div className={styles.meta}>
                      <p className={styles.author}>{blog.author?.trim() || "RPT Team"}</p>
                      {blog.createdAt ? <p className={styles.date}>{formatDate(blog.createdAt)}</p> : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className={styles.pagination}>
              <Link
                href={`/blogs?page=${Math.max(1, page - 1)}`}
                className={`${styles.pageBtn} ${page <= 1 ? styles.disabled : ""}`}
                aria-disabled={page <= 1}
              >
                Previous
              </Link>
              {pageNumbers.map((n) => (
                <Link key={n} href={`/blogs?page=${n}`} className={`${styles.pageBtn} ${n === page ? styles.active : ""}`}>
                  {n}
                </Link>
              ))}
              <Link
                href={`/blogs?page=${Math.min(totalPages, page + 1)}`}
                className={`${styles.pageBtn} ${page >= totalPages ? styles.disabled : ""}`}
                aria-disabled={page >= totalPages}
              >
                Next
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
