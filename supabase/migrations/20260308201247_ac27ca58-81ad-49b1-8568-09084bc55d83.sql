ALTER TABLE credentials ADD COLUMN IF NOT EXISTS escopo VARCHAR(20) NOT NULL DEFAULT 'vision_ai';

UPDATE credentials SET escopo = 'vision_ai' WHERE escopo = 'vision_ai';