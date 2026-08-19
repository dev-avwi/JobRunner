-- Initial project setup fields used by the guided mobile creation flow.
ALTER TABLE job_phases
  ADD COLUMN IF NOT EXISTS budgeted_cost decimal(12,2);

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS planned_percentage decimal(5,2);

-- The setup flow links initial POs to phases. Keep this here as well as in the
-- earlier phase-attribution migration so installations that missed that
-- migration can still apply the complete setup feature safely.
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS phase_id varchar;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS creation_request_id varchar(100);

-- Earlier compatibility builds indexed this value without enforcing
-- uniqueness. Preserve every job while deterministically clearing the request
-- ID from later duplicates before adding the durable replay constraint.
WITH duplicate_creation_requests AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, creation_request_id
           ORDER BY created_at ASC NULLS LAST, id ASC
         ) AS duplicate_rank
  FROM jobs
  WHERE creation_request_id IS NOT NULL
)
UPDATE jobs
SET creation_request_id = NULL
FROM duplicate_creation_requests
WHERE jobs.id = duplicate_creation_requests.id
  AND duplicate_creation_requests.duplicate_rank > 1;

DROP INDEX IF EXISTS idx_jobs_creation_request_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_user_creation_request_id
  ON jobs (user_id, creation_request_id)
  WHERE creation_request_id IS NOT NULL;

ALTER TABLE project_documents
  ADD COLUMN IF NOT EXISTS client_generated_id varchar(100);

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_documents_job_client_generated_id
  ON project_documents (job_id, user_id, client_generated_id)
  WHERE client_generated_id IS NOT NULL;