-- Migrasi database telemetry DompetKu (jalankan SEKALI via phpMyAdmin).
-- Kompatibel dengan MariaDB 10.11 (cPanel). Aman diulang.
--
-- Database: xfag9686_dompetku_user

ALTER TABLE telemetry_events
  ADD COLUMN IF NOT EXISTS origin VARCHAR(190) NULL AFTER device_id,
  ADD INDEX IF NOT EXISTS idx_ev_origin (origin);

ALTER TABLE telemetry_devices
  ADD COLUMN IF NOT EXISTS last_origin VARCHAR(190) NULL AFTER user_key;
