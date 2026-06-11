-- Migration: Add SET search_path = public to all SECURITY DEFINER functions
-- This prevents search_path manipulation attacks

-- assign_seat
ALTER FUNCTION public.assign_seat(UUID, UUID, UUID, UUID) SET search_path = public;

-- reassign_seat
ALTER FUNCTION public.reassign_seat(UUID, UUID, UUID, UUID) SET search_path = public;

-- deduct_sms_credit_atomic
ALTER FUNCTION public.deduct_sms_credit_atomic(UUID, TEXT) SET search_path = public;

-- increment_sms_credits
ALTER FUNCTION public.increment_sms_credits(UUID, INTEGER) SET search_path = public;

-- approve_event_cash
ALTER FUNCTION public.approve_event_cash(UUID, UUID, INTEGER) SET search_path = public;

-- is_super_admin
ALTER FUNCTION public.is_super_admin(UUID) SET search_path = public;

-- handle_rsvp_modification (trigger function - no args needed)
ALTER FUNCTION public.handle_rsvp_modification() SET search_path = public;
