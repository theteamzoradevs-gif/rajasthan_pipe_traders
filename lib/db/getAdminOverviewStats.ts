import { connectDb } from "@/lib/db/connect";
import { OrderModel } from "@/lib/db/models/Order";
import { LeadModel } from "@/lib/db/models/Lead";
import { BlogModel } from "@/lib/db/models/Blog";

export type AdminOverviewStats = {
  totalOrders: number;
  totalLeads: number;
  totalBlogs: number;
};

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  try {
    await connectDb();
    const [totalOrders, totalLeads, totalBlogs] = await Promise.all([
      OrderModel.countDocuments().exec(),
      LeadModel.countDocuments().exec(),
      BlogModel.countDocuments().exec(),
    ]);
    return { totalOrders, totalLeads, totalBlogs };
  } catch {
    return { totalOrders: 0, totalLeads: 0, totalBlogs: 0 };
  }
}
