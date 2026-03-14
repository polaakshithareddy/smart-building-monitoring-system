package com.sbms.servlet;

import com.sbms.util.DBConnection;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import com.google.gson.Gson;

@WebServlet("/api/issues")
public class IssueServlet extends HttpServlet {
    private Gson gson = new Gson();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        String role = request.getParameter("role");
        String username = request.getParameter("username"); // or ID

        List<Map<String, Object>> issues = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection()) {
            String sql = "SELECT * FROM issues ORDER BY created_at DESC";
            if ("maintenance".equals(role)) {
                System.out.println("[SBMS LOG] Fetching issues for maintenance role: " + username);
                sql = "SELECT * FROM issues WHERE assigned_to = ? ORDER BY created_at DESC";
            } else if ("resident".equals(role)) {
                System.out.println("[SBMS LOG] Fetching issues for resident role: " + username);
                sql = "SELECT * FROM issues WHERE resident_id = ? ORDER BY created_at DESC";
            }

            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                if ("maintenance".equals(role) || "resident".equals(role)) {
                    ps.setString(1, username);
                }
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> issue = new HashMap<>();
                        issue.put("issue_id", rs.getInt("issue_id"));
                        issue.put("resident_id", rs.getString("resident_id"));
                        issue.put("title", rs.getString("title"));
                        issue.put("description", rs.getString("description"));
                        issue.put("location", rs.getString("location"));
                        issue.put("priority", rs.getString("priority"));
                        issue.put("status", rs.getString("status"));
                        issue.put("assigned_to", rs.getString("assigned_to"));
                        issue.put("created_at", rs.getTimestamp("created_at"));
                        issue.put("updated_at", rs.getTimestamp("updated_at"));
                        issues.add(issue);
                    }
                    System.out.println("[SBMS LOG] Successfully fetched " + issues.size() + " issues.");
                }
            }
            Map<String, Object> respMap = new HashMap<>();
            respMap.put("success", true);
            respMap.put("data", issues);
            sendJsonResponse(response, 200, respMap);
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> errMap = new HashMap<>();
            errMap.put("success", false);
            errMap.put("message", e.getMessage());
            sendJsonResponse(response, 500, errMap);
        }
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        String action = request.getParameter("action");
        if ("create".equals(action)) {
            createIssue(request, response);
        } else if ("assign".equals(action)) {
            assignIssue(request, response);
        } else if ("update_status".equals(action)) {
            updateStatus(request, response);
        } else {
            Map<String, Object> errMap = new HashMap<>();
            errMap.put("success", false);
            errMap.put("message", "Invalid action");
            sendJsonResponse(response, 400, errMap);
        }
    }

    @SuppressWarnings("unchecked")
    private void createIssue(HttpServletRequest request, HttpServletResponse response) throws IOException {
        try {
            Map<String, Object> data = gson.fromJson(request.getReader(), Map.class);
            try (Connection conn = DBConnection.getConnection()) {
                String sql = "INSERT INTO issues (resident_id, title, description, location, priority) VALUES (?, ?, ?, ?, ?)";
                try (PreparedStatement ps = conn.prepareStatement(sql, PreparedStatement.RETURN_GENERATED_KEYS)) {
                    ps.setString(1, String.valueOf(data.get("resident_id")));
                    ps.setString(2, String.valueOf(data.get("title")));
                    ps.setString(3, String.valueOf(data.get("description")));
                    ps.setString(4, String.valueOf(data.get("location")));
                    ps.setString(5, String.valueOf(data.get("priority")));
                    ps.executeUpdate();
                    // log activity
                    try {
                        String desc = "Resident reported: " + data.get("title") + " in " + data.get("location");
                        logActivity(conn, "issue_reported", desc, String.valueOf(data.get("resident_id")));
                        insertNotification(conn, "issue", "\uD83D\uDD14 New issue reported: " + data.get("title") + " in " + data.get("location"), null, null);
                    } catch (Exception ignore) {}
                }
                Map<String, Object> respMap = new HashMap<>();
                respMap.put("success", true);
                respMap.put("message", "Issue reported successfully");
                sendJsonResponse(response, 201, respMap);
            }
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> errMap = new HashMap<>();
            errMap.put("success", false);
            errMap.put("message", e.getMessage());
            sendJsonResponse(response, 500, errMap);
        }
    }

    @SuppressWarnings("unchecked")
    private void assignIssue(HttpServletRequest request, HttpServletResponse response) throws IOException {
        try {
            Map<String, Object> data = gson.fromJson(request.getReader(), Map.class);
            try (Connection conn = DBConnection.getConnection()) {
                conn.setAutoCommit(false);
                try {
                    String issueIdStr = String.valueOf(data.get("issue_id"));
                    if (issueIdStr.endsWith(".0")) issueIdStr = issueIdStr.substring(0, issueIdStr.length() - 2);
                    int issueId = Integer.parseInt(issueIdStr);
                    String assignedTo = String.valueOf(data.get("assigned_to"));
                    String adminId = String.valueOf(data.get("admin_id"));

                    // Verify current status before updating (prevent false notifications)
                    ResultSet prev = conn.createStatement().executeQuery(
                        "SELECT status FROM issues WHERE issue_id=" + issueId);
                    String prevStatus = prev.next() ? prev.getString(1) : "";

                    System.out.println("[SBMS LOG] Assigning issue " + issueId + " to staff " + assignedTo);
                    String updateSql = "UPDATE issues SET assigned_to = ?, status = 'Assigned', updated_at = CURRENT_TIMESTAMP WHERE issue_id = ?";
                    try (PreparedStatement ps = conn.prepareStatement(updateSql)) {
                        ps.setString(1, assignedTo);
                        ps.setInt(2, issueId);
                        ps.executeUpdate();
                    }

                    String logSql = "INSERT INTO assignments (issue_id, assigned_by, assigned_to) VALUES (?, ?, ?)";
                    try (PreparedStatement ps = conn.prepareStatement(logSql)) {
                        ps.setInt(1, issueId);
                        ps.setString(2, adminId);
                        ps.setString(3, assignedTo);
                        ps.executeUpdate();
                    }

                    // Log activity + notification only if status actually changed
                    if (!"Assigned".equals(prevStatus)) {
                        try {
                            logActivity(conn, "issue_assigned",
                                "Issue #" + issueId + " assigned to " + assignedTo + " by admin", adminId);
                            insertNotification(conn, "assign",
                                "\uD83D\uDD27 Issue #" + issueId + " assigned to " + assignedTo, issueId, null);
                        } catch (Exception ignore) {}
                    }

                    System.out.println("[SBMS LOG] Issue assignment persisted.");
                    conn.commit();
                    Map<String, Object> respMap = new HashMap<>();
                    respMap.put("success", true);
                    respMap.put("message", "Issue assigned successfully");
                    sendJsonResponse(response, 200, respMap);
                } catch (Exception ex) {
                    conn.rollback();
                    throw ex;
                } finally {
                    conn.setAutoCommit(true);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> errMap = new HashMap<>();
            errMap.put("success", false);
            errMap.put("message", e.getMessage());
            sendJsonResponse(response, 500, errMap);
        }
    }

    @SuppressWarnings("unchecked")
    private void updateStatus(HttpServletRequest request, HttpServletResponse response) throws IOException {
        try {
            Map<String, Object> data = gson.fromJson(request.getReader(), Map.class);
            try (Connection conn = DBConnection.getConnection()) {
                conn.setAutoCommit(false);
                try {
                    String issueIdStr = String.valueOf(data.get("issue_id"));
                    if (issueIdStr.endsWith(".0")) issueIdStr = issueIdStr.substring(0, issueIdStr.length() - 2);
                    int issueId = Integer.parseInt(issueIdStr);
                    String newStatus = String.valueOf(data.get("status"));
                    String updatedBy = data.containsKey("updated_by") ? String.valueOf(data.get("updated_by")) : "system";

                    // Read current status to detect real change
                    ResultSet prev = conn.createStatement().executeQuery(
                        "SELECT status FROM issues WHERE issue_id=" + issueId);
                    String prevStatus = prev.next() ? prev.getString(1) : "";

                    if (newStatus.equals(prevStatus)) {
                        // No actual change — return success without logging
                        sendJsonResponse(response, 200, Map.of("success", true, "message", "No change needed"));
                        return;
                    }

                    String updateSql = "UPDATE issues SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE issue_id = ?";
                    try (PreparedStatement ps = conn.prepareStatement(updateSql)) {
                        ps.setString(1, newStatus);
                        ps.setInt(2, issueId);
                        ps.executeUpdate();
                    }

                    String logSql = "INSERT INTO status_updates (issue_id, updated_by, new_status) VALUES (?, ?, ?)";
                    try (PreparedStatement ps = conn.prepareStatement(logSql)) {
                        ps.setInt(1, issueId);
                        ps.setString(2, updatedBy);
                        ps.setString(3, newStatus);
                        ps.executeUpdate();
                    }

                    // Write activity + notification only when status truly changes
                    try {
                        String actMsg = "Issue #" + issueId + " status changed: " + prevStatus + " \u2192 " + newStatus;
                        logActivity(conn, "status_updated", actMsg, updatedBy);
                        String notifMsg;
                        String notifType;
                        if ("Completed".equals(newStatus)) {
                            notifMsg = "\u2705 Issue #" + issueId + " completed by maintenance";
                            notifType = "resolved";
                        } else if ("In Progress".equals(newStatus)) {
                            notifMsg = "\uD83D\uDD27 Issue #" + issueId + " is now In Progress";
                            notifType = "progress";
                        } else {
                            notifMsg = "\uD83D\uDD14 Issue #" + issueId + " status: " + newStatus;
                            notifType = "info";
                        }
                        insertNotification(conn, notifType, notifMsg, issueId, null);
                    } catch (Exception ignore) {}

                    conn.commit();
                    Map<String, Object> respMap = new HashMap<>();
                    respMap.put("success", true);
                    respMap.put("message", "Status updated successfully");
                    sendJsonResponse(response, 200, respMap);
                } catch (Exception ex) {
                    conn.rollback();
                    throw ex;
                } finally {
                    conn.setAutoCommit(true);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> errMap = new HashMap<>();
            errMap.put("success", false);
            errMap.put("message", e.getMessage());
            sendJsonResponse(response, 500, errMap);
        }
    }

    // ── Helper: Write to activity_log ─────────────────────────────────
    private void logActivity(Connection conn, String type, String desc, String userId) throws Exception {
        try {
            conn.createStatement().execute(
                "CREATE TABLE IF NOT EXISTS activity_log (" +
                "activity_id INT AUTO_INCREMENT PRIMARY KEY, activity_type VARCHAR(100)," +
                "description TEXT, user_id VARCHAR(100)," +
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
            PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO activity_log (activity_type, description, user_id) VALUES (?,?,?)");
            ps.setString(1, type);
            ps.setString(2, desc);
            ps.setString(3, userId);
            ps.executeUpdate();
        } catch (Exception e) { System.err.println("[SBMS] logActivity failed: " + e.getMessage()); }
    }

    // ── Helper: Insert notification ───────────────────────────────────
    private void insertNotification(Connection conn, String type, String msg, Integer issueId, String userId)
            throws Exception {
        try {
            conn.createStatement().execute(
                "CREATE TABLE IF NOT EXISTS notifications (" +
                "notification_id INT AUTO_INCREMENT PRIMARY KEY," +
                "type VARCHAR(50), message TEXT, issue_id INT, user_id VARCHAR(100)," +
                "is_read TINYINT(1) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
            PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO notifications (type, message, issue_id, user_id) VALUES (?,?,?,?)");
            ps.setString(1, type);
            ps.setString(2, msg);
            if (issueId != null) ps.setInt(3, issueId); else ps.setNull(3, java.sql.Types.INTEGER);
            if (userId != null)  ps.setString(4, userId); else ps.setNull(4, java.sql.Types.VARCHAR);
            ps.executeUpdate();
        } catch (Exception e) { System.err.println("[SBMS] insertNotification failed: " + e.getMessage()); }
    }

    private void sendJsonResponse(HttpServletResponse response, int status, Object data) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(gson.toJson(data));
    }
}
