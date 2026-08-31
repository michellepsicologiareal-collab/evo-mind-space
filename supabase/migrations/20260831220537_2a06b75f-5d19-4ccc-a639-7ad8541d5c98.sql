create policy "Authenticated users can read tutoriais"
on storage.objects for select
to authenticated
using (bucket_id = 'tutoriais');