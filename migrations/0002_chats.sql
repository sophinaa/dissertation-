-- Saved assistant chats for signed-in customers (see lib/auth/db.ts).
CREATE TABLE IF NOT EXISTS chats (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
