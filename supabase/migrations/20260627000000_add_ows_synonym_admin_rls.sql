-- Add admin policies for the ows table

CREATE POLICY "Allow admin to insert ows"
ON "public"."ows"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  ((auth.jwt() ->> 'email'::text) = 'admin@mindflow.com'::text)
);

CREATE POLICY "Allow admin to update ows"
ON "public"."ows"
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  ((auth.jwt() ->> 'email'::text) = 'admin@mindflow.com'::text)
)
WITH CHECK (
  ((auth.jwt() ->> 'email'::text) = 'admin@mindflow.com'::text)
);

CREATE POLICY "Allow admin to delete ows"
ON "public"."ows"
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  ((auth.jwt() ->> 'email'::text) = 'admin@mindflow.com'::text)
);


-- Add admin policies for the synonym table

CREATE POLICY "Allow admin to insert synonym"
ON "public"."synonym"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  ((auth.jwt() ->> 'email'::text) = 'admin@mindflow.com'::text)
);

CREATE POLICY "Allow admin to update synonym"
ON "public"."synonym"
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  ((auth.jwt() ->> 'email'::text) = 'admin@mindflow.com'::text)
)
WITH CHECK (
  ((auth.jwt() ->> 'email'::text) = 'admin@mindflow.com'::text)
);

CREATE POLICY "Allow admin to delete synonym"
ON "public"."synonym"
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  ((auth.jwt() ->> 'email'::text) = 'admin@mindflow.com'::text)
);
