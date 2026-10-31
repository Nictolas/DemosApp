-- DEMOS: one active proposal per user and category; unpublished until an Admin review.
-- Grazia is deliberately excluded: its sole queue is pre-existing public.richieste_grazia (PR #495).
-- Intentionally private: application API accesses it only through authenticated server routes.
CREATE TABLE IF NOT EXISTS public.subject_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('capo_stato', 'amnistia', 'attivisti', 'organizzazioni')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 150),
  details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 1000),
  source_url text CHECK (source_url IS NULL OR (char_length(source_url) <= 2048 AND source_url ~ '^https://')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  published_ref text,
  review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 500)
);

-- Existing staging copies may still have the old five-category CHECK. CREATE TABLE
-- IF NOT EXISTS does not update it. Refuse to delete or silently migrate any
-- legacy Grazia record: these belong in richieste_grazia after DPO review.
-- This DO block is atomic: a failed check cannot leave the constraint dropped.
DO $subject_category_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.subject_proposals WHERE category = 'grazia' LIMIT 1) THEN
    RAISE EXCEPTION 'Subject-proposal migration blocked: Grazia rows require explicit review and reconciliation';
  END IF;
  ALTER TABLE public.subject_proposals
    DROP CONSTRAINT IF EXISTS subject_proposals_category_check;
  ALTER TABLE public.subject_proposals
    ADD CONSTRAINT subject_proposals_category_check
      CHECK (category IN ('capo_stato', 'amnistia', 'attivisti', 'organizzazioni'));
END
$subject_category_guard$;

CREATE UNIQUE INDEX IF NOT EXISTS subject_proposals_one_pending_per_user_category
 ON public.subject_proposals(proposer_user_id, category) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS subject_proposals_no_duplicate_open_titles
 ON public.subject_proposals(category, lower(btrim(title))) WHERE status IN ('pending','approved');
CREATE INDEX IF NOT EXISTS subject_proposals_admin_queue_idx
 ON public.subject_proposals(created_at ASC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS subject_proposals_approved_directory_idx
 ON public.subject_proposals(category, created_at DESC) WHERE status = 'approved';

ALTER TABLE public.subject_proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subject_proposals FROM PUBLIC, anon, authenticated;
-- No direct Data API policies: only the authenticated backend can manage proposals.

CREATE TABLE IF NOT EXISTS public.capo_stato_soggetti_approvati (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 nome text NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 3 AND 150),
 active boolean NOT NULL DEFAULT true,
 source_proposal_id uuid UNIQUE REFERENCES public.subject_proposals(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS capo_stato_soggetti_approvati_name
 ON public.capo_stato_soggetti_approvati(lower(btrim(nome)));
ALTER TABLE public.capo_stato_soggetti_approvati ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.capo_stato_soggetti_approvati FROM PUBLIC, anon, authenticated;
