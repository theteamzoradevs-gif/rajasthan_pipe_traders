import Link from "next/link";
import { notFound } from "next/navigation";
import { connectDb } from "@/lib/db/connect";
import { BlogModel } from "@/lib/db/models/Blog";
import styles from "./blog-detail.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BlogDetail = {
  _id: string;
  title: string;
  slug: string;
  image?: string;
  author?: string;
  content: string;
  createdAt?: Date | string;
};

type PageProps = {
  params: Promise<{ slug: string }>;
};

function formatBlogDate(value?: Date | string) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogDetailPage({ params }: PageProps) {
  const { slug } = await params;
  await connectDb();

  const blog = await BlogModel.findOne({ slug: slug.toLowerCase().trim() })
    .select("_id title slug image author content createdAt")
    .lean<BlogDetail | null>();

  if (!blog) notFound();

  const formattedDate = formatBlogDate(blog.createdAt);

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <article className={styles.article}>
          {blog.image ? (
            <div className={styles.hero}>
              <img src={blog.image} alt={blog.title} />
            </div>
          ) : null}
          <header className={styles.head}>
            <h1 className={styles.title}>{blog.title}</h1>
            <p className={styles.meta}>
              {formattedDate || "Date unavailable"}
              {blog.author?.trim() ? ` · ${blog.author.trim()}` : ""}
            </p>
          </header>
          <section className={styles.content}>
            <div dangerouslySetInnerHTML={{ __html: blog.content }} />
          </section>
        </article>

        <div className={styles.actions}>
          <Link href="/blogs" className={styles.backBtn}>
            Back to Blogs
          </Link>
        </div>
      </div>
    </main>
  );
}
