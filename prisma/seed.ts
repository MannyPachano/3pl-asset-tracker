import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const SEED_ORG_NAME = "Acme 3PL";
const SEED_ADMIN_EMAIL = "admin@example.com";
const SEED_ADMIN_PASSWORD = "admin123";

async function main() {
  let org = await prisma.organization.findFirst({
    where: { name: SEED_ORG_NAME },
  });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: SEED_ORG_NAME },
    });
  }

  const passwordHash = await hash(SEED_ADMIN_PASSWORD, 10);

  await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: org.id,
        email: SEED_ADMIN_EMAIL,
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      email: SEED_ADMIN_EMAIL,
      passwordHash,
      role: "admin",
      fullName: "Admin",
      isActive: true,
    },
  });

  console.log("Seed complete.");
  console.log("Organization:", org.name, "(id:", org.id + ")");
  console.log("Admin user:", SEED_ADMIN_EMAIL, "| password:", SEED_ADMIN_PASSWORD);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
