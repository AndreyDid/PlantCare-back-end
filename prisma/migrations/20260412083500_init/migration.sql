-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latinName" TEXT,
    "light" TEXT,
    "wateringInterval" INTEGER,
    "temperatureMin" INTEGER,
    "temperatureMax" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plant_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_plants" (
    "id" TEXT NOT NULL,
    "nickname" TEXT,
    "photo" TEXT,
    "plantTypeId" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lastWateredAt" TIMESTAMP(3),
    "nextWateringAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_plants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watering_logs" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "wateredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "watering_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "lastTriggered" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_diagnosis" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plant_diagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "plant_types_name_key" ON "plant_types"("name");

-- CreateIndex
CREATE INDEX "user_plants_user_id_idx" ON "user_plants"("user_id");

-- AddForeignKey
ALTER TABLE "user_plants" ADD CONSTRAINT "user_plants_plantTypeId_fkey" FOREIGN KEY ("plantTypeId") REFERENCES "plant_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plants" ADD CONSTRAINT "user_plants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watering_logs" ADD CONSTRAINT "watering_logs_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "user_plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "user_plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_diagnosis" ADD CONSTRAINT "plant_diagnosis_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "user_plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
