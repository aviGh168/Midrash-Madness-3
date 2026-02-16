-- Midrash Madness Database Schema
-- MySQL Script to create all required tables

-- Drop tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS completed_bracket;
DROP TABLE IF EXISTS round_6;
DROP TABLE IF EXISTS round_5;
DROP TABLE IF EXISTS round_4;
DROP TABLE IF EXISTS round_3;
DROP TABLE IF EXISTS round_2;
DROP TABLE IF EXISTS round_1;
DROP TABLE IF EXISTS midrash_list;
DROP TABLE IF EXISTS midrash_users;

-- Create midrash_users table
CREATE TABLE midrash_users (
                               user_id INT AUTO_INCREMENT PRIMARY KEY,
                               name VARCHAR(255) NOT NULL,
                               email VARCHAR(255) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create midrash_list table
CREATE TABLE midrash_list (
                              midrash_id INT AUTO_INCREMENT PRIMARY KEY,
                              `group` VARCHAR(100),
                              seed INT,
                              short_desc VARCHAR(500),
                              long_desc TEXT,
                              source VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create round_1 table (32 winners)
CREATE TABLE round_1 (
                         r1_id INT AUTO_INCREMENT PRIMARY KEY,
                         winner1 INT,
                         winner2 INT,
                         winner3 INT,
                         winner4 INT,
                         winner5 INT,
                         winner6 INT,
                         winner7 INT,
                         winner8 INT,
                         winner9 INT,
                         winner10 INT,
                         winner11 INT,
                         winner12 INT,
                         winner13 INT,
                         winner14 INT,
                         winner15 INT,
                         winner16 INT,
                         winner17 INT,
                         winner18 INT,
                         winner19 INT,
                         winner20 INT,
                         winner21 INT,
                         winner22 INT,
                         winner23 INT,
                         winner24 INT,
                         winner25 INT,
                         winner26 INT,
                         winner27 INT,
                         winner28 INT,
                         winner29 INT,
                         winner30 INT,
                         winner31 INT,
                         winner32 INT,
                         FOREIGN KEY (winner1) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner2) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner3) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner4) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner5) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner6) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner7) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner8) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner9) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner10) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner11) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner12) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner13) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner14) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner15) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner16) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner17) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner18) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner19) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner20) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner21) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner22) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner23) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner24) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner25) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner26) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner27) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner28) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner29) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner30) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner31) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner32) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create round_2 table (16 winners)
CREATE TABLE round_2 (
                         r2_id INT AUTO_INCREMENT PRIMARY KEY,
                         winner1 INT,
                         winner2 INT,
                         winner3 INT,
                         winner4 INT,
                         winner5 INT,
                         winner6 INT,
                         winner7 INT,
                         winner8 INT,
                         winner9 INT,
                         winner10 INT,
                         winner11 INT,
                         winner12 INT,
                         winner13 INT,
                         winner14 INT,
                         winner15 INT,
                         winner16 INT,
                         FOREIGN KEY (winner1) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner2) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner3) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner4) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner5) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner6) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner7) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner8) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner9) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner10) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner11) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner12) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner13) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner14) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner15) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner16) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create round_3 table (8 winners)
CREATE TABLE round_3 (
                         r3_id INT AUTO_INCREMENT PRIMARY KEY,
                         winner1 INT,
                         winner2 INT,
                         winner3 INT,
                         winner4 INT,
                         winner5 INT,
                         winner6 INT,
                         winner7 INT,
                         winner8 INT,
                         FOREIGN KEY (winner1) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner2) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner3) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner4) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner5) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner6) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner7) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner8) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create round_4 table (4 winners)
CREATE TABLE round_4 (
                         r4_id INT AUTO_INCREMENT PRIMARY KEY,
                         winner1 INT,
                         winner2 INT,
                         winner3 INT,
                         winner4 INT,
                         FOREIGN KEY (winner1) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner2) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner3) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner4) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create round_5 table (2 winners)
CREATE TABLE round_5 (
                         r5_id INT AUTO_INCREMENT PRIMARY KEY,
                         winner1 INT,
                         winner2 INT,
                         FOREIGN KEY (winner1) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE,
                         FOREIGN KEY (winner2) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create round_6 table (1 winner - champion)
CREATE TABLE round_6 (
                         r6_id INT AUTO_INCREMENT PRIMARY KEY,
                         winner1 INT,
                         FOREIGN KEY (winner1) REFERENCES midrash_list(midrash_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create completed_bracket table
CREATE TABLE completed_bracket (
                                   bracket_id INT AUTO_INCREMENT PRIMARY KEY,
                                   user_id INT NOT NULL,
                                   round_1_id INT,
                                   round_2_id INT,
                                   round_3_id INT,
                                   round_4_id INT,
                                   round_5_id INT,
                                   round_6_id INT,
                                   FOREIGN KEY (user_id) REFERENCES midrash_users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
                                   FOREIGN KEY (round_1_id) REFERENCES round_1(r1_id) ON DELETE CASCADE ON UPDATE CASCADE,
                                   FOREIGN KEY (round_2_id) REFERENCES round_2(r2_id) ON DELETE CASCADE ON UPDATE CASCADE,
                                   FOREIGN KEY (round_3_id) REFERENCES round_3(r3_id) ON DELETE CASCADE ON UPDATE CASCADE,
                                   FOREIGN KEY (round_4_id) REFERENCES round_4(r4_id) ON DELETE CASCADE ON UPDATE CASCADE,
                                   FOREIGN KEY (round_5_id) REFERENCES round_5(r5_id) ON DELETE CASCADE ON UPDATE CASCADE,
                                   FOREIGN KEY (round_6_id) REFERENCES round_6(r6_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;