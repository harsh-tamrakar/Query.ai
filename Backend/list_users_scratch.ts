import { prisma } from "./db";

async function run() {
  try {
    const users = await prisma.user.findMany();
    console.log("USERS IN DATABASE:", users);
    const payments = await prisma.payment.findMany();
    console.log("PAYMENTS IN DATABASE:", payments);
  } catch (err) {
    console.error("Error inspecting database:", err);
  } finally {
    process.exit(0);
  }
}

run();
