-- Cleanup/Drop unused duplicate stored functions from legacy migrations

DROP FUNCTION IF EXISTS assign_seat_safe(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS deduct_sms_credit(UUID, TEXT, TEXT);
