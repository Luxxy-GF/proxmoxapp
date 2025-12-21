-- Add Coterm integration fields to Nodes if they do not already exist
ALTER TABLE "Node" ADD COLUMN IF NOT EXISTS "cotermEndpoint" TEXT;
ALTER TABLE "Node" ADD COLUMN IF NOT EXISTS "cotermSecret" TEXT;
