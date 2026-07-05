## PlantCare Back-end

### Supabase database

Set these variables in `.env` locally or in the Render service environment:

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:SUPABASE_DB_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?schema=public"
DATABASE_SSL=true
```

Use the Supabase `Session pooler` connection string from Project Settings -> Database -> Connection string. Keep `?schema=public` at the end.

After changing the database URL, check the connection and regenerate the Prisma client:

```bash
npx prisma db pull
npx prisma generate
npm run build
```
