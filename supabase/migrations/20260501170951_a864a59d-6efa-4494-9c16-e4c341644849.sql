
-- Add is_approved column to profiles
ALTER TABLE public.profiles 
ADD COLUMN is_approved boolean NOT NULL DEFAULT false;

-- Auto-approve all existing users (they were already using the system)
UPDATE public.profiles SET is_approved = true;

-- Update handle_new_user to auto-approve admin emails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, profile_type, is_approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'profile_type', '')::public.profile_type,
      'standard'::public.profile_type
    ),
    CASE 
      WHEN lower(NEW.email) IN ('michellepsicologiareal@gmail.com', 'michelledonegas@gmail.com') THEN true
      ELSE false
    END
  );

  IF lower(NEW.email) IN ('michellepsicologiareal@gmail.com', 'michelledonegas@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
