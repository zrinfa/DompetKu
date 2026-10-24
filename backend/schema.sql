-- DompetKu Telemetry Schema
-- Database: xfag9686_dompetku_user
-- Cara pakai: import file ini sekali via phpMyAdmin > Import,
-- atau via terminal: mysql -u xfag9686_dompetku_user -p xfag9686_dompetku_user < schema.sql

CREATE TABLE IF NOT EXISTS telemetry_users (
  user_key     VARCHAR(64)  NOT NULL PRIMARY KEY,
  business_name VARCHAR(120) NOT NULL DEFAULT 'DompetKu',
  google_email VARCHAR(190)  NULL DEFAULT NULL,
  google_name  VARCHAR(190)  NULL DEFAULT NULL,
  google_linked TINYINT(1)   NOT NULL DEFAULT 0,
  first_seen   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  tx_total     INT NOT NULL DEFAULT 0,
  tx_manual    INT NOT NULL DEFAULT 0,
  tx_ai        INT NOT NULL DEFAULT 0,
  tx_nota      INT NOT NULL DEFAULT 0,
  tx_telpon    INT NOT NULL DEFAULT 0,
  tx_transfer  INT NOT NULL DEFAULT 0,
  app_opens    INT NOT NULL DEFAULT 0,
  KEY idx_users_email (google_email),
  KEY idx_users_lastseen (last_seen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS telemetry_devices (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  device_id        VARCHAR(64)  NOT NULL,
  user_key         VARCHAR(64)  NOT NULL DEFAULT '',
  last_origin      VARCHAR(190) NULL,
  fingerprint_hash CHAR(64)     NOT NULL DEFAULT '',
  user_agent       TEXT NULL,
  platform         VARCHAR(120) NULL,
  language         VARCHAR(20)  NULL,
  timezone         VARCHAR(80)  NULL,
  screen           VARCHAR(30)  NULL,
  cores            INT NULL,
  memory_gb        VARCHAR(20)  NULL,
  touch_points     INT NULL,
  is_pwa           TINYINT(1) NOT NULL DEFAULT 0,
  canvas_fp        VARCHAR(64)  NULL,
  ip               VARCHAR(45)  NULL,
  first_seen       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_device_user (device_id, user_key),
  KEY idx_devices_user (user_key),
  KEY idx_devices_lastseen (last_seen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS telemetry_events (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_key      VARCHAR(64)  NOT NULL DEFAULT '',
  device_id     VARCHAR(64)  NOT NULL DEFAULT '',
  origin        VARCHAR(190) NULL,
  business_name VARCHAR(120) NOT NULL DEFAULT '',
  event_type    VARCHAR(40)  NOT NULL DEFAULT '',
  source        VARCHAR(20)  NOT NULL DEFAULT '',
  hour_local    TINYINT NULL,
  client_time   DATETIME NULL,
  server_time   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  google_linked TINYINT(1) NOT NULL DEFAULT 0,
  google_email  VARCHAR(190) NULL,
  google_name   VARCHAR(190) NULL,
  amount        BIGINT NULL,
  tx_type       VARCHAR(20) NULL,
  entity        VARCHAR(20) NULL,
  tab_name      VARCHAR(40) NULL,
  app_version   VARCHAR(40) NULL,
  ip            VARCHAR(45) NULL,
  user_agent    TEXT NULL,
  KEY idx_ev_user (user_key),
  KEY idx_ev_type (event_type),
  KEY idx_ev_source (source),
  KEY idx_ev_origin (origin),
  KEY idx_ev_hour (hour_local),
  KEY idx_ev_server (server_time),
  KEY idx_ev_client (client_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
