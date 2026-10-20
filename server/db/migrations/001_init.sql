-- Team-building schema. Idempotent so it can be re-applied safely.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS rooms (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  join_code             text NOT NULL UNIQUE,
  host_participant_id   uuid,  -- no FK on purpose: avoids a rooms<->participants cycle
  phase                 text NOT NULL DEFAULT 'lobby'
                        CHECK (phase IN ('lobby','pick_a_side','about_me','finished')),
  current_question_id   text,
  current_category      text,
  current_presenter_id  uuid,
  gallery_visible       boolean NOT NULL DEFAULT false,
  gallery_category      text CHECK (gallery_category IN ('travel_destination','meaningful_object')),
  votes_open            boolean NOT NULL DEFAULT false,
  results_visible       boolean NOT NULL DEFAULT false,
  state_version         bigint NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS participants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  display_name        text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 24),
  session_token_hash  text NOT NULL UNIQUE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS participants_room_name_uq ON participants (room_id, lower(display_name));
CREATE INDEX IF NOT EXISTS participants_room_idx ON participants (room_id);

CREATE TABLE IF NOT EXISTS votes (
  room_id         uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  participant_id  uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  question_id     text NOT NULL,
  option_index    smallint NOT NULL CHECK (option_index IN (0,1)),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, participant_id, question_id)
);
CREATE INDEX IF NOT EXISTS votes_room_question_idx ON votes (room_id, question_id);

CREATE TABLE IF NOT EXISTS participant_images (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  participant_id  uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  category        text NOT NULL CHECK (category IN ('travel_destination','meaningful_object')),
  object_key      text NOT NULL,
  caption         text CHECK (caption IS NULL OR char_length(caption) <= 200),
  content_type    text NOT NULL,
  file_size       integer NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, participant_id, category)
);
CREATE INDEX IF NOT EXISTS participant_images_room_idx ON participant_images (room_id);
