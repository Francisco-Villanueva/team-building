-- The "talent" topic reuses participant_images: a text-only item (caption = the talent, no object).
ALTER TABLE participant_images ALTER COLUMN object_key DROP NOT NULL;
ALTER TABLE participant_images ALTER COLUMN content_type DROP NOT NULL;
ALTER TABLE participant_images ALTER COLUMN file_size DROP NOT NULL;

ALTER TABLE participant_images DROP CONSTRAINT IF EXISTS participant_images_category_check;
ALTER TABLE participant_images ADD CONSTRAINT participant_images_category_check
  CHECK (category IN ('travel_destination', 'meaningful_object', 'talent'));

ALTER TABLE participant_images DROP CONSTRAINT IF EXISTS participant_items_shape_check;
ALTER TABLE participant_images ADD CONSTRAINT participant_items_shape_check
  CHECK (
    (category = 'talent' AND object_key IS NULL AND caption IS NOT NULL)
    OR (category <> 'talent' AND object_key IS NOT NULL AND content_type IS NOT NULL AND file_size IS NOT NULL)
  );
