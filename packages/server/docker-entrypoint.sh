#!/bin/sh
set -e

cd /app/packages/server
prisma migrate deploy --schema=prisma/schema.prisma

if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  node -e "
    const { PrismaClient } = require('@prisma/client');
    const bcrypt = require('bcryptjs');
    const prisma = new PrismaClient();
    (async () => {
      const existing = await prisma.user.findUnique({ where: { email: process.env.ADMIN_EMAIL } });
      if (!existing) {
        const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
        await prisma.user.create({ data: { email: process.env.ADMIN_EMAIL, passwordHash } });
        console.log('Created admin user ' + process.env.ADMIN_EMAIL);
      }
      await prisma.\$disconnect();
    })();
  "
fi

cd /app
exec "$@"
