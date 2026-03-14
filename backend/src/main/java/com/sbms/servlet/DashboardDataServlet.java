package com.sbms.servlet;

import com.sbms.util.DBConnection;
import java.io.IOException;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.PreparedStatement;
import java.util.*;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.*;
import com.google.gson.Gson;

@WebServlet("/DashboardDataServlet")
public class DashboardDataServlet extends HttpServlet {
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        Map<String, Object> data = new HashMap<>();

        try (Connection conn = DBConnection.getConnection()) {

            // ── Basic counts ──────────────────────────────────────
            ResultSet rs;

            try {
                rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM blocks");
                if (rs.next()) data.put("totalBlocks", rs.getInt(1));

                rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM floors");
                if (rs.next()) data.put("totalFloors", rs.getInt(1));

                rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM rooms_new");
                if (rs.next()) data.put("totalRooms", rs.getInt(1));

                rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM rooms_new WHERE status='Occupied'");
                if (rs.next()) data.put("occupiedRooms", rs.getInt(1));

                rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM rooms_new WHERE status='Empty'");
                if (rs.next()) data.put("availableRooms", rs.getInt(1));
            } catch (Exception ignore) {
                // Return 0 for everything if tables don't exist yet
                data.put("totalBlocks", 0);
                data.put("totalFloors", 0);
                data.put("totalRooms", 0);
                data.put("occupiedRooms", 0);
                data.put("availableRooms", 0);
            }

            rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM issues");
            if (rs.next()) data.put("totalIssues", rs.getInt(1));

            rs = conn.createStatement().executeQuery(
                "SELECT SUM(power_kwh) FROM energy_logs WHERE MONTH(log_date)=MONTH(CURRENT_DATE)");
            if (rs.next()) {
                double e = rs.getDouble(1);
                data.put("monthlyEnergy", rs.wasNull() ? 0.0 : e);
            }

            rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM issues WHERE status='Pending'");
            if (rs.next()) data.put("pendingRequests", rs.getInt(1));

            rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM issues WHERE status='Completed'");
            if (rs.next()) data.put("resolvedIssues", rs.getInt(1));

            rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM users WHERE role='resident'");
            if (rs.next()) data.put("activeResidents", rs.getInt(1));

            try {
                rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM bills");
                if (rs.next()) data.put("totalBills", rs.getInt(1));

                rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM bills WHERE status='Paid'");
                if (rs.next()) data.put("paidBills", rs.getInt(1));

                rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM bills WHERE status='Unpaid' OR status='Pending'");
                if (rs.next()) data.put("pendingBills", rs.getInt(1));
            } catch (Exception ignore) {}

            // ── Chart: Issue Status Distribution ──────────────────
            Map<String, Integer> statusDist = new LinkedHashMap<>();
            rs = conn.createStatement().executeQuery(
                "SELECT status, COUNT(*) FROM issues GROUP BY status ORDER BY FIELD(status,'Pending','Assigned','In Progress','Completed')");
            while (rs.next()) statusDist.put(rs.getString(1), rs.getInt(2));
            data.put("issueStatusDist", statusDist);

            // ── Chart: Issues by Location ─────────────────────────
            Map<String, Integer> locationDist = new LinkedHashMap<>();
            rs = conn.createStatement().executeQuery(
                "SELECT location, COUNT(*) FROM issues GROUP BY location ORDER BY COUNT(*) DESC LIMIT 8");
            while (rs.next()) locationDist.put(rs.getString(1), rs.getInt(2));
            data.put("issuesByLocation", locationDist);

            // ── Chart: Issues over time (last 7 days) ─────────────
            Map<String, Integer> issuesOverTime = new LinkedHashMap<>();
            rs = conn.createStatement().executeQuery(
                "SELECT DATE(created_at) as d, COUNT(*) FROM issues " +
                "WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY) " +
                "GROUP BY DATE(created_at) ORDER BY d");
            while (rs.next()) issuesOverTime.put(rs.getString(1), rs.getInt(2));
            data.put("issuesOverTime", issuesOverTime);

            // ── Chart: Daily energy (last 7 days) ────────────────
            Map<String, Double> dailyEnergy = new LinkedHashMap<>();
            rs = conn.createStatement().executeQuery(
                "SELECT DATE(log_date) as d, SUM(power_kwh) FROM energy_logs " +
                "WHERE log_date >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY) " +
                "GROUP BY DATE(log_date) ORDER BY d");
            while (rs.next()) dailyEnergy.put(rs.getString(1), rs.getDouble(2));
            data.put("dailyEnergy", dailyEnergy);

            // ── Chart: Energy by floor ────────────────────────────
            Map<String, Double> energyByFloor = new LinkedHashMap<>();
            rs = conn.createStatement().executeQuery(
                "SELECT r.floor_number, SUM(e.power_kwh) FROM energy_logs e " +
                "JOIN rooms r ON e.room_id = r.room_id " +
                "GROUP BY r.floor_number ORDER BY r.floor_number");
            while (rs.next()) energyByFloor.put("Floor " + rs.getInt(1), rs.getDouble(2));
            data.put("energyByFloor", energyByFloor);

            // ── Maintenance stats ─────────────────────────────────
            rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM issues WHERE assigned_to IS NOT NULL");
            if (rs.next()) data.put("maintAssigned", rs.getInt(1));

            rs = conn.createStatement().executeQuery(
                "SELECT COUNT(*) FROM issues WHERE assigned_to IS NOT NULL AND status='Completed'");
            if (rs.next()) data.put("maintCompleted", rs.getInt(1));

            rs = conn.createStatement().executeQuery(
                "SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)) FROM issues WHERE status='Completed'");
            if (rs.next()) {
                double avg = rs.getDouble(1);
                data.put("avgResolutionTime", rs.wasNull() ? 0 : avg);
            }

            // ── Technician performance ────────────────────────────
            List<Map<String, Object>> techPerf = new ArrayList<>();
            rs = conn.createStatement().executeQuery(
                "SELECT assigned_to, COUNT(*) as total, " +
                "SUM(CASE WHEN status='Completed' THEN 1 ELSE 0 END) as completed " +
                "FROM issues WHERE assigned_to IS NOT NULL " +
                "GROUP BY assigned_to ORDER BY completed DESC LIMIT 5");
            while (rs.next()) {
                Map<String, Object> t = new HashMap<>();
                t.put("name", rs.getString("assigned_to"));
                t.put("total", rs.getInt("total"));
                t.put("completed", rs.getInt("completed"));
                techPerf.add(t);
            }
            data.put("technicianPerformance", techPerf);

            // ── Predictive Maintenance ─────────────────────────────
            // Identify issue types / rooms with frequent failures
            List<Map<String, Object>> predictive = new ArrayList<>();
            rs = conn.createStatement().executeQuery(
                "SELECT location, title, COUNT(*) as freq, MAX(created_at) as last_seen " +
                "FROM issues " +
                "GROUP BY location, title " +
                "HAVING freq >= 2 " +
                "ORDER BY freq DESC, last_seen DESC LIMIT 5");
            while (rs.next()) {
                Map<String, Object> p = new HashMap<>();
                p.put("location", rs.getString("location"));
                p.put("title", rs.getString("title"));
                p.put("frequency", rs.getInt("freq"));
                p.put("last_seen", rs.getTimestamp("last_seen"));
                predictive.add(p);
            }
            data.put("predictiveMaintenance", predictive);

            // ── DB-persisted Notifications (unread count) ─────────
            try {
                conn.createStatement().execute(
                    "CREATE TABLE IF NOT EXISTS notifications (" +
                    "notification_id INT AUTO_INCREMENT PRIMARY KEY," +
                    "type VARCHAR(50), message TEXT, issue_id INT, user_id VARCHAR(100)," +
                    "is_read TINYINT(1) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
                rs = conn.createStatement().executeQuery(
                    "SELECT COUNT(*) FROM notifications WHERE is_read=0");
                if (rs.next()) data.put("unreadNotifications", rs.getInt(1));

                // Latest 10 notifications for bell dropdown
                List<Map<String, Object>> dbNotifs = new ArrayList<>();
                rs = conn.createStatement().executeQuery(
                    "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10");
                while (rs.next()) {
                    Map<String, Object> n = new HashMap<>();
                    n.put("id",         rs.getInt("notification_id"));
                    n.put("type",       rs.getString("type"));
                    n.put("message",    rs.getString("message"));
                    n.put("issue_id",   rs.getInt("issue_id"));
                    n.put("is_read",    rs.getInt("is_read") == 1);
                    n.put("created_at", rs.getTimestamp("created_at"));
                    dbNotifs.add(n);
                }
                data.put("dbNotifications", dbNotifs);
            } catch (Exception ignore) {}

            // ── Activity log (from DB or reconstructed) ───────────
            List<Map<String, String>> activities = new ArrayList<>();
            try {
                conn.createStatement().execute(
                    "CREATE TABLE IF NOT EXISTS activity_log (" +
                    "activity_id INT AUTO_INCREMENT PRIMARY KEY, activity_type VARCHAR(100)," +
                    "description TEXT, user_id VARCHAR(100)," +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
                rs = conn.createStatement().executeQuery(
                    "SELECT description, created_at FROM activity_log ORDER BY created_at DESC LIMIT 10");
                while (rs.next()) {
                    Map<String, String> act = new HashMap<>();
                    act.put("timestamp", rs.getString("created_at"));
                    act.put("description", rs.getString("description"));
                    activities.add(act);
                }
            } catch (Exception ignore) {}

            // Fallback: reconstruct from issues + bills
            if (activities.isEmpty()) {
                String q = "(SELECT created_at as ts, CONCAT('Resident reported: ', title, ' in ', location) as activity FROM issues) " +
                    "UNION ALL " +
                    "(SELECT updated_at as ts, CONCAT('Issue status updated to ', status) as activity FROM issues WHERE status != 'Pending') " +
                    "ORDER BY ts DESC LIMIT 10";
                rs = conn.createStatement().executeQuery(q);
                while (rs.next()) {
                    Map<String, String> act = new HashMap<>();
                    act.put("timestamp", rs.getString("ts"));
                    act.put("description", rs.getString("activity"));
                    activities.add(act);
                }
            }
            data.put("recentActivities", activities);

            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write(new Gson().toJson(data));

        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().write("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }
}
