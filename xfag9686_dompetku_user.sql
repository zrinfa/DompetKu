-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Waktu pembuatan: 13 Okt 2026 pada 17.38
-- Versi server: 10.11.19-MariaDB-cll-lve
-- Versi PHP: 8.4.26

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Basis data: `xfag9686_dompetku_user`
--

-- --------------------------------------------------------

--
-- Struktur dari tabel `telemetry_devices`
--

CREATE TABLE `telemetry_devices` (
  `id` int(11) NOT NULL,
  `device_id` varchar(64) NOT NULL,
  `user_key` varchar(64) NOT NULL DEFAULT '',
  `fingerprint_hash` char(64) NOT NULL DEFAULT '',
  `user_agent` text DEFAULT NULL,
  `platform` varchar(120) DEFAULT NULL,
  `language` varchar(20) DEFAULT NULL,
  `timezone` varchar(80) DEFAULT NULL,
  `screen` varchar(30) DEFAULT NULL,
  `cores` int(11) DEFAULT NULL,
  `memory_gb` varchar(20) DEFAULT NULL,
  `touch_points` int(11) DEFAULT NULL,
  `is_pwa` tinyint(1) NOT NULL DEFAULT 0,
  `canvas_fp` varchar(64) DEFAULT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `first_seen` datetime NOT NULL DEFAULT current_timestamp(),
  `last_seen` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `telemetry_devices`
--

INSERT INTO `telemetry_devices` (`id`, `device_id`, `user_key`, `fingerprint_hash`, `user_agent`, `platform`, `language`, `timezone`, `screen`, `cores`, `memory_gb`, `touch_points`, `is_pwa`, `canvas_fp`, `ip`, `first_seen`, `last_seen`) VALUES
(1, '5178cc74f3c048c09c6ff28115506dfc', 'usr_main', '140222de4d941b16', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36', 'Android', 'id-ID', 'Asia/Jakarta', '800x360@3.389789342880249', 8, '8', 5, 1, 'cba8eb5e', '157.10.89.106', '2026-10-13 17:31:54', '2026-10-13 17:31:54'),
(15, '5178cc74f3c048c09c6ff28115506dfc', 'usr_mv4rbrc7_z3pnq9r', '570cd27aa332f837', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36', 'Android', 'id-ID', 'Asia/Jakarta', '360x800@3.389789342880249', 8, '8', 5, 1, 'cba8eb5e', '157.10.89.106', '2026-10-13 17:31:57', '2026-10-13 17:32:57');

-- --------------------------------------------------------

--
-- Struktur dari tabel `telemetry_events`
--

CREATE TABLE `telemetry_events` (
  `id` bigint(20) NOT NULL,
  `user_key` varchar(64) NOT NULL DEFAULT '',
  `device_id` varchar(64) NOT NULL DEFAULT '',
  `business_name` varchar(120) NOT NULL DEFAULT '',
  `event_type` varchar(40) NOT NULL DEFAULT '',
  `source` varchar(20) NOT NULL DEFAULT '',
  `hour_local` tinyint(4) DEFAULT NULL,
  `client_time` datetime DEFAULT NULL,
  `server_time` datetime NOT NULL DEFAULT current_timestamp(),
  `google_linked` tinyint(1) NOT NULL DEFAULT 0,
  `google_email` varchar(190) DEFAULT NULL,
  `google_name` varchar(190) DEFAULT NULL,
  `amount` bigint(20) DEFAULT NULL,
  `tx_type` varchar(20) DEFAULT NULL,
  `entity` varchar(20) DEFAULT NULL,
  `tab_name` varchar(40) DEFAULT NULL,
  `app_version` varchar(40) DEFAULT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `telemetry_events`
--

INSERT INTO `telemetry_events` (`id`, `user_key`, `device_id`, `business_name`, `event_type`, `source`, `hour_local`, `client_time`, `server_time`, `google_linked`, `google_email`, `google_name`, `amount`, `tx_type`, `entity`, `tab_name`, `app_version`, `ip`, `user_agent`) VALUES
(1, 'usr_main', '5178cc74f3c048c09c6ff28115506dfc', 'DompetKu', 'app_open', '', 9, '2026-10-13 02:55:11', '2026-10-13 17:31:54', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(2, 'usr_main', '5178cc74f3c048c09c6ff28115506dfc', 'DompetKu', 'app_open', '', 9, '2026-10-13 02:55:14', '2026-10-13 17:31:54', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(3, 'usr_main', '5178cc74f3c048c09c6ff28115506dfc', 'DompetKu', 'heartbeat', '', 9, '2026-10-13 02:56:40', '2026-10-13 17:31:54', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(4, 'usr_main', '5178cc74f3c048c09c6ff28115506dfc', 'DompetKu', 'app_open', '', 10, '2026-10-13 03:04:36', '2026-10-13 17:31:54', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(5, 'usr_main', '5178cc74f3c048c09c6ff28115506dfc', 'DompetKu', 'app_open', '', 10, '2026-10-13 03:06:59', '2026-10-13 17:31:54', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(6, 'usr_main', '5178cc74f3c048c09c6ff28115506dfc', 'DompetKu', 'heartbeat', '', 10, '2026-10-13 03:07:13', '2026-10-13 17:31:54', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(7, 'usr_main', '5178cc74f3c048c09c6ff28115506dfc', 'DompetKu', 'heartbeat', '', 10, '2026-10-13 03:12:23', '2026-10-13 17:31:54', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(8, 'usr_main', '5178cc74f3c048c09c6ff28115506dfc', 'DompetKu', 'heartbeat', '', 10, '2026-10-13 03:24:13', '2026-10-13 17:31:54', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(9, 'usr_main', '5178cc74f3c048c09c6ff28115506dfc', 'DompetKu', 'heartbeat', '', 10, '2026-10-13 03:30:51', '2026-10-13 17:31:54', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(10, 'usr_main', '5178cc74f3c048c09c6ff28115506dfc', 'DompetKu', 'app_open', '', 12, '2026-10-13 05:12:23', '2026-10-13 17:31:54', 0, NULL, NULL, NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(11, 'usr_main', '5178cc74f3c048c09c6ff28115506dfc', 'DompetKu', 'heartbeat', '', 12, '2026-10-13 05:13:24', '2026-10-13 17:31:54', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(12, 'usr_main', '5178cc74f3c048c09c6ff28115506dfc', 'DompetKu', 'app_open', '', 12, '2026-10-13 05:45:33', '2026-10-13 17:31:54', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(13, 'usr_main', '5178cc74f3c048c09c6ff28115506dfc', 'DompetKu', 'heartbeat', '', 12, '2026-10-13 05:46:33', '2026-10-13 17:31:54', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(14, 'usr_main', '5178cc74f3c048c09c6ff28115506dfc', 'DompetKu', 'heartbeat', '', 17, '2026-10-13 10:31:52', '2026-10-13 17:31:54', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(15, 'usr_mv4rbrc7_z3pnq9r', '5178cc74f3c048c09c6ff28115506dfc', 'Shafa Laundry', 'heartbeat', '', 17, '2026-10-13 10:31:55', '2026-10-13 17:31:55', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(16, 'usr_mv4rbrc7_z3pnq9r', '5178cc74f3c048c09c6ff28115506dfc', 'Shafa Laundry', 'app_open', '', 17, '2026-10-13 10:31:56', '2026-10-13 17:31:57', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(17, 'usr_mv4rbrc7_z3pnq9r', '5178cc74f3c048c09c6ff28115506dfc', 'Shafa Laundry', 'heartbeat', '', 17, '2026-10-13 10:32:18', '2026-10-13 17:32:18', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(18, 'usr_mv4rbrc7_z3pnq9r', '5178cc74f3c048c09c6ff28115506dfc', 'Shafa Laundry', 'heartbeat', '', 17, '2026-10-13 10:32:18', '2026-10-13 17:32:19', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(19, 'usr_mv4rbrc7_z3pnq9r', '5178cc74f3c048c09c6ff28115506dfc', 'Shafa Laundry', 'app_open', '', 17, '2026-10-13 10:32:19', '2026-10-13 17:32:21', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(20, 'usr_mv4rbrc7_z3pnq9r', '5178cc74f3c048c09c6ff28115506dfc', 'Shafa Laundry', 'heartbeat', '', 17, '2026-10-13 10:32:21', '2026-10-13 17:32:21', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(21, 'usr_mv4rbrc7_z3pnq9r', '5178cc74f3c048c09c6ff28115506dfc', 'Shafa Laundry', 'heartbeat', '', 17, '2026-10-13 10:32:23', '2026-10-13 17:32:23', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(22, 'usr_mv4rbrc7_z3pnq9r', '5178cc74f3c048c09c6ff28115506dfc', 'Shafa Laundry', 'app_open', '', 17, '2026-10-13 10:32:19', '2026-10-13 17:32:25', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(23, 'usr_mv4rbrc7_z3pnq9r', '5178cc74f3c048c09c6ff28115506dfc', 'Shafa Laundry', 'app_open', '', 17, '2026-10-13 10:32:22', '2026-10-13 17:32:25', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(24, 'usr_mv4rbrc7_z3pnq9r', '5178cc74f3c048c09c6ff28115506dfc', 'Shafa Laundry', 'app_open', '', 17, '2026-10-13 10:32:23', '2026-10-13 17:32:25', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36'),
(25, 'usr_mv4rbrc7_z3pnq9r', '5178cc74f3c048c09c6ff28115506dfc', 'Shafa Laundry', 'app_open', '', 17, '2026-10-13 10:32:55', '2026-10-13 17:32:57', 1, 'mauzafazrin@gmail.com', 'mauzafazrin', NULL, NULL, NULL, NULL, 'dompetku-pwa-v57', '157.10.89.106', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36');

-- --------------------------------------------------------

--
-- Struktur dari tabel `telemetry_users`
--

CREATE TABLE `telemetry_users` (
  `user_key` varchar(64) NOT NULL,
  `business_name` varchar(120) NOT NULL DEFAULT 'DompetKu',
  `google_email` varchar(190) DEFAULT NULL,
  `google_name` varchar(190) DEFAULT NULL,
  `google_linked` tinyint(1) NOT NULL DEFAULT 0,
  `first_seen` datetime NOT NULL DEFAULT current_timestamp(),
  `last_seen` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `tx_total` int(11) NOT NULL DEFAULT 0,
  `tx_manual` int(11) NOT NULL DEFAULT 0,
  `tx_ai` int(11) NOT NULL DEFAULT 0,
  `tx_nota` int(11) NOT NULL DEFAULT 0,
  `tx_telpon` int(11) NOT NULL DEFAULT 0,
  `tx_transfer` int(11) NOT NULL DEFAULT 0,
  `app_opens` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `telemetry_users`
--

INSERT INTO `telemetry_users` (`user_key`, `business_name`, `google_email`, `google_name`, `google_linked`, `first_seen`, `last_seen`, `tx_total`, `tx_manual`, `tx_ai`, `tx_nota`, `tx_telpon`, `tx_transfer`, `app_opens`) VALUES
('usr_main', 'DompetKu', 'mauzafazrin@gmail.com', 'mauzafazrin', 1, '2026-10-13 17:31:54', '2026-10-13 17:31:54', 0, 0, 0, 0, 0, 0, 6),
('usr_mv4rbrc7_z3pnq9r', 'Shafa Laundry', 'mauzafazrin@gmail.com', 'mauzafazrin', 1, '2026-10-13 17:31:55', '2026-10-13 17:32:57', 0, 0, 0, 0, 0, 0, 6);

--
-- Indeks untuk tabel yang dibuang
--

--
-- Indeks untuk tabel `telemetry_devices`
--
ALTER TABLE `telemetry_devices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_device_user` (`device_id`,`user_key`),
  ADD KEY `idx_devices_user` (`user_key`),
  ADD KEY `idx_devices_lastseen` (`last_seen`);

--
-- Indeks untuk tabel `telemetry_events`
--
ALTER TABLE `telemetry_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ev_user` (`user_key`),
  ADD KEY `idx_ev_type` (`event_type`),
  ADD KEY `idx_ev_source` (`source`),
  ADD KEY `idx_ev_hour` (`hour_local`),
  ADD KEY `idx_ev_server` (`server_time`),
  ADD KEY `idx_ev_client` (`client_time`);

--
-- Indeks untuk tabel `telemetry_users`
--
ALTER TABLE `telemetry_users`
  ADD PRIMARY KEY (`user_key`),
  ADD KEY `idx_users_email` (`google_email`),
  ADD KEY `idx_users_lastseen` (`last_seen`);

--
-- AUTO_INCREMENT untuk tabel yang dibuang
--

--
-- AUTO_INCREMENT untuk tabel `telemetry_devices`
--
ALTER TABLE `telemetry_devices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT untuk tabel `telemetry_events`
--
ALTER TABLE `telemetry_events`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
