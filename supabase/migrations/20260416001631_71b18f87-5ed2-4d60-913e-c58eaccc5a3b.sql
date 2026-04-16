
-- ============================================
-- 1. Fix documents storage bucket policies
-- ============================================

-- Drop all existing policies on storage.objects for 'documents' bucket
DROP POLICY IF EXISTS "Allow authenticated uploads to documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from documents" ON storage.objects;
DROP POLICY IF EXISTS "Document owners or clinic members can read" ON storage.objects;
DROP POLICY IF EXISTS "Clinic members can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Document owners or clinic members can delete" ON storage.objects;
DROP POLICY IF EXISTS "Document owners can update" ON storage.objects;

-- SELECT: Only document owner or clinic members can read
CREATE POLICY "Document owners or clinic members can read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.path = name
        AND (
          d.user_id = auth.uid()
          OR public.user_has_clinic_access(auth.uid(), d.clinic_id)
        )
    )
  );

-- INSERT: User must be a clinic member and upload path must start with their clinic_id
CREATE POLICY "Clinic members can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.user_clinic_roles ucr
      WHERE ucr.user_id = auth.uid()
        AND ucr.clinic_id::text = (storage.foldername(name))[1]
    )
  );

-- UPDATE: Only document owner can update
CREATE POLICY "Document owners can update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.path = name AND d.user_id = auth.uid()
    )
  );

-- DELETE: Only document owner or clinic members can delete
CREATE POLICY "Document owners or clinic members can delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.path = name
        AND (
          d.user_id = auth.uid()
          OR public.user_has_clinic_access(auth.uid(), d.clinic_id)
        )
    )
  );

-- ============================================
-- 2. Lock down audit_log direct inserts
-- ============================================
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.audit_log;
