CREATE TABLE IF NOT EXISTS invite_codes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code varchar(6) NOT NULL UNIQUE,
  role_type text NOT NULL DEFAULT 'worker',
  role_id varchar REFERENCES user_roles(id) ON DELETE SET NULL,
  max_uses integer NOT NULL DEFAULT 10,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamp NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);
