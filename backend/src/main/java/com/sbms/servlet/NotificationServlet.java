package com.sbms.servlet;

import com.sbms.util.DBConnection;
import com.google.gson.Gson;
import java.io.IOException;
import java.sql.*;
import java.util.*;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.*;

@WebServlet("/api/notifications")
public class NotificationServlet extends HttpServlet {
    private Gson gson = new Gson();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String userId = request.getParameter("user_id");
        List<Map<String, Object>> notifs = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection()) {
            // Ensure notifications table exists
            conn.createStatement().execute(
                "CREATE TABLE IF NOT EXISTS notifications (" +
                "  notification_id INT AUTO_INCREMENT PRIMARY KEY," +
                "  type VARCHAR(50)," +
                "  message TEXT," +
                "  issue_id INT," +
                "  user_id VARCHAR(100)," +
                "  is_read TINYINT(1) DEFAULT 0," +
                "  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")"
            );

            String sql = "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20";
            PreparedStatement ps;
            if (userId != null && !userId.isEmpty()) {
                sql = "SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT 20";
                ps = conn.prepareStatement(sql);
                ps.setString(1, userId);
            } else {
                ps = conn.prepareStatement(sql);
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> n = new HashMap<>();
                    n.put("notification_id", rs.getInt("notification_id"));
                    n.put("type", rs.getString("type"));
                    n.put("message", rs.getString("message"));
                    n.put("issue_id", rs.getInt("issue_id"));
                    n.put("is_read", rs.getInt("is_read") == 1);
                    n.put("created_at", rs.getTimestamp("created_at"));
                    notifs.add(n);
                }
            }
            Map<String, Object> resp = new HashMap<>();
            resp.put("success", true);
            resp.put("data", notifs);
            sendJson(response, 200, resp);
        } catch (Exception e) {
            e.printStackTrace();
            sendJson(response, 500, Map.of("success", false, "message", e.getMessage()));
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String action = request.getParameter("action");
        try (Connection conn = DBConnection.getConnection()) {
            if ("mark_read".equals(action)) {
                Map<String, Object> body = gson.fromJson(request.getReader(), Map.class);
                int id = ((Number) body.get("notification_id")).intValue();
                conn.prepareStatement("UPDATE notifications SET is_read=1 WHERE notification_id=" + id)
                    .executeUpdate();
                sendJson(response, 200, Map.of("success", true));
            } else if ("mark_all_read".equals(action)) {
                conn.createStatement().executeUpdate("UPDATE notifications SET is_read=1");
                sendJson(response, 200, Map.of("success", true));
            } else if ("create".equals(action)) {
                Map<String, Object> body = gson.fromJson(request.getReader(), Map.class);
                PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO notifications (type, message, issue_id, user_id) VALUES (?,?,?,?)");
                ps.setString(1, String.valueOf(body.getOrDefault("type", "info")));
                ps.setString(2, String.valueOf(body.getOrDefault("message", "")));
                Object issId = body.get("issue_id");
                if (issId != null) ps.setInt(3, ((Number) issId).intValue()); else ps.setNull(3, Types.INTEGER);
                Object uid = body.get("user_id");
                if (uid != null) ps.setString(4, String.valueOf(uid)); else ps.setNull(4, Types.VARCHAR);
                ps.executeUpdate();
                sendJson(response, 201, Map.of("success", true));
            } else {
                sendJson(response, 400, Map.of("success", false, "message", "Invalid action"));
            }
        } catch (Exception e) {
            e.printStackTrace();
            sendJson(response, 500, Map.of("success", false, "message", e.getMessage()));
        }
    }

    private void sendJson(HttpServletResponse response, int status, Object data) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(gson.toJson(data));
    }
}
