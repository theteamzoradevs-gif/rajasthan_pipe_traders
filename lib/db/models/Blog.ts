import mongoose, { Schema, model, models } from "mongoose";

const createSlugFromTitle = (title: string) =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const blogSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, trim: true, lowercase: true, sparse: true },
    content: { type: String, required: true },
    image: { type: String, trim: true },
    author: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { suppressReservedKeysWarning: true }
);

blogSchema.pre("save", function () {
  if (!this.slug && this.title) {
    this.slug = createSlugFromTitle(this.title);
  }
});

// Ensure schema middleware changes apply during Next.js hot reload.
if (models.Blog) {
  mongoose.deleteModel("Blog");
}

export const BlogModel = model("Blog", blogSchema);
