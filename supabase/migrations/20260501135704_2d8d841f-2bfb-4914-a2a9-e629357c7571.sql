-- Create subscription status enum
CREATE TYPE public.subscription_status AS ENUM ('free', 'pending', 'active');

-- Add column to profiles
ALTER TABLE public.profiles
ADD COLUMN subscription_status public.subscription_status NOT NULL DEFAULT 'free';

-- Allow admins to read all profiles (for admin panel)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any profile (to change subscription status)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));