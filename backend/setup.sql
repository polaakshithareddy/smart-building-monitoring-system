-- Database Schema for SBMS
CREATE DATABASE IF NOT EXISTS sbms_db;
USE sbms_db;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fullname VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'maintenance', 'resident') NOT NULL,
    phone VARCHAR(20)
);

-- Seed Initial Users
INSERT IGNORE INTO users (fullname, username, email, password, role, phone) VALUES
('System Administrator', 'admin', 'admin@sbms.com', 'admin123', 'admin', '123-456-7890'),
('Maintenance Staff', 'staff', 'staff@sbms.com', 'staff123', 'maintenance', '098-765-4321'),
('Resident A-305', 'resident', 'resident@sbms.com', 'resident123', 'resident', '555-555-5555');

-- Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
    room_id VARCHAR(20) PRIMARY KEY,
    room_type VARCHAR(50) NOT NULL,
    floor_number INT NOT NULL,
    occupancy_status VARCHAR(20) NOT NULL
);

-- Seed Sample Rooms
INSERT IGNORE INTO rooms (room_id, room_type, floor_number, occupancy_status) VALUES
('A-101', 'Office', 1, 'Occupied'),
('B-205', 'Lab', 2, 'Available'),
('C-309', 'Meeting Room', 3, 'Occupied'),
('D-401', 'Storage', 4, 'Maintenance');

-- Energy Logs Table (Seed)
INSERT IGNORE INTO energy_logs (room_id, log_date, power_kwh) VALUES
('A-101', CURRENT_DATE, 150.5),
('B-205', CURRENT_DATE, 45.2),
('C-309', CURRENT_DATE, 300.7);

-- Issues Table
CREATE TABLE IF NOT EXISTS issues (
    issue_id INT AUTO_INCREMENT PRIMARY KEY,
    resident_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(100) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    image_path VARCHAR(255),
    status VARCHAR(20) DEFAULT 'Pending',
    assigned_to VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    issue_id INT NOT NULL,
    assigned_by VARCHAR(50) NOT NULL,
    assigned_to VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (issue_id) REFERENCES issues(issue_id) ON DELETE CASCADE
);

-- Status Updates Table
CREATE TABLE IF NOT EXISTS status_updates (
    update_id INT AUTO_INCREMENT PRIMARY KEY,
    issue_id INT NOT NULL,
    updated_by VARCHAR(50) NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (issue_id) REFERENCES issues(issue_id) ON DELETE CASCADE
);

-- Energy Logs Table
CREATE TABLE IF NOT EXISTS energy_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id VARCHAR(20),
    log_date DATE NOT NULL,
    power_kwh DECIMAL(10, 2) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
);
