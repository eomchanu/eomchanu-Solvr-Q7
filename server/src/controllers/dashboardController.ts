import { FastifyRequest, FastifyReply } from "fastify";
import { getDashboardStats } from "../services/dashboardService";

// GET /api/dashboard
export async function getDashboard(req: FastifyRequest, reply: FastifyReply) {
  const stats = getDashboardStats();
  console.log(stats);
  return reply.send(stats);
}