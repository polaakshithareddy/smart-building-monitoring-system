package com.sbms.servlet;

import com.sbms.util.DBConnection;
import com.google.gson.Gson;
import java.io.IOException;
import java.sql.*;
import java.util.*;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.*;

@WebServlet("/api/activity-log")
public class ActivityLogServlet extends HttpServlet {
    private Gson gson = new Gson();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        List<Map<String, Object>> logs = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection()) {
            // Ensure table exists
            conn.createStatement().execute(
                "CREATE TABLE IF NOT EXISTS activity_log (" +
                "  activity_id INT AUTO_INCREMENT PRIMARY KEY," +
                "  activity_type VARCHAR(100)," +
                "  description TEXT," +
                "  user_id VARCHAR(100)," +
                "  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")"
            );

            // Pull latest 10 entries
            String sql = "SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 10";
            try (ResultSet rs = conn.createStatement().executeQuery(sql)) {
                while (rs.next()) {
                    Map<String, Object> log = new HashMap<>();
                    log.put("activity_id",   rs.getInt("activity_id"));
                    log.put("activity_type", rs.getString("activity_type"));
                    log.put("description",   rs.getString("description"));
                    log.put("user_id",       rs.getString("user_id"));
                    log.put("created_at",    rs.getTimestamp("created_at"));
                    logs.add(log);
                }
            }
            Map<String, Object> resp = new HashMap<>();
            resp.put("success", true);
            resp.put("data", logs);
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
        try (Connection conn = DBConnection.getConnection()) {
            Map<String, Object> body = gson.fromJson(request.getReader(), Map.class);
            PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO activity_log (activity_type, description, user_id) VALUES (?,?,?)");
            ps.setString(1, String.valueOf(body.getOrDefault("activity_type", "info")));
            ps.setString(2, String.valueOf(body.getOrDefault("description", "")));
            Object uid = body.get("user_id");
            if (uid != null) ps.setString(3, String.valueOf(uid)); else ps.setNull(3, Types.VARCHAR);
            ps.executeUpdate();
            sendJson(response, 201, Map.of("success", true));
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
