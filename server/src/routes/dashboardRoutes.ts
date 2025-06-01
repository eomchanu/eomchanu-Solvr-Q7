import { FastifyInstance } from "fastify";
import { getDashboard } from "../controllers/dashboardController";

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.get("/stats", getDashboard);
}