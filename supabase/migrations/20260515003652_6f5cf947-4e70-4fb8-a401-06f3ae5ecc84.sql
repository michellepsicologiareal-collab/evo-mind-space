-- Remove permissive public access policies; access is now mediated by edge function (service role)
DROP POLICY IF EXISTS "Anyone can read templates for public links" ON public.contract_templates;
DROP POLICY IF EXISTS "Anyone can insert signed contracts" ON public.signed_contracts;