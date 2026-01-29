-- Migration to add 'not_taken' value to attendance_status enum
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'not_taken';
