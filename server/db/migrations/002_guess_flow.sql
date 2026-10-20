-- Topic-by-topic "guess whose photo it is" flow. Idempotent.
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS topic text
    CHECK (topic IN ('travel_destination','meaningful_object','talent')),
  ADD COLUMN IF NOT EXISTS topic_stage text
    CHECK (topic_stage IN ('show','guess','reveal','summary','prompt')),
  ADD COLUMN IF NOT EXISTS slide_index integer NOT NULL DEFAULT 0;

-- The old gallery model is replaced by topics.
ALTER TABLE rooms
  DROP COLUMN IF EXISTS gallery_visible,
  DROP COLUMN IF EXISTS gallery_category,
  DROP COLUMN IF EXISTS current_category;

CREATE TABLE IF NOT EXISTS guesses (
  room_id                  uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  guesser_id               uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  image_id                 uuid NOT NULL REFERENCES participant_images(id) ON DELETE CASCADE,
  guessed_participant_id   uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, guesser_id, image_id)
);
CREATE INDEX IF NOT EXISTS guesses_image_idx ON guesses (image_id);
