# SBMS - Smart Building Monitoring System

SBMS Pro is a comprehensive, role-based automation and monitoring platform designed for modern building management. It provides real-time insights into energy consumption, maintenance requests, and building occupancy through an intuitive, premium dashboard.

## 🚀 Key Features

- **Role-Based Dashboards**: Tailored interfaces for Administrators, Maintenance Staff, and Residents.
- **Real-Time Analytics**: Live tracking of issues, energy logs, and resident status using Chart.js.
- **Maintenance Management**: Streamlined workflow for reporting, assigning, and resolving building issues.
- **Energy Monitoring**: Log and analyze power consumption (kWh) per room/floor.
- **Room Management**: Dynamic room registration and status tracking (Available, Occupied, Maintenance).
- **Automated Reporting**: Generate PDF and Excel reports for building activities.

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom Design), JavaScript (ES6+), Bootstrap 5, Chart.js.
- **Backend**: Java Servlets, Maven.
- **Database**: MySQL.
- **Tools**: Apache Tomcat Server, Git.

## 📋 Prerequisites

- **Java JDK 11** or higher.
- **Maven** for dependency management.
- **MySQL Server**.
- **Apache Tomcat 9.0+**.

## ⚙️ Setup Instructions

1. **Database Setup**:
   - Import `setup.sql` into your MySQL server.
   - Configure your database credentials in the project (typically in the DB connection utility).

2. **Build the Project**:
   ```bash
   mvn clean install
   ```

3. **Deploy**:
   - Deploy the generated `.war` file from the `target/` directory to your Tomcat `webapps/` folder.
   - Alternatively, run via Maven:
   ```bash
   mvn jetty:run
   ```

4. **Access**:
   - Open `http://localhost:8080/SBMS` in your browser.

## 🔑 Default Credentials

- **Admin**: `admin` / `admin123`
- **Maintenance**: `staff` / `staff123`
- **Resident**: `resident` / `resident123`

---
*Developed as a professional Smart Building Solution.*
