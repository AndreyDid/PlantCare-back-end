CREATE TABLE "plant_care_events" (
    "id" TEXT NOT NULL,
    "plant_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "event_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount_ml" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plant_care_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "plant_care_events_plant_id_event_at_idx" ON "plant_care_events"("plant_id", "event_at");

ALTER TABLE "plant_care_events" ADD CONSTRAINT "plant_care_events_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "user_plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
