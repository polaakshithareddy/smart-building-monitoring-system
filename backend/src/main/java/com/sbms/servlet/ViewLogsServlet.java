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

@WebServlet("/ViewLogsServlet")
public class ViewLogsServlet extends HttpServlet {
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String type = request.getParameter("type"); // 'maintenance' or 'energy'

        List<Map<String, Object>> logs = new ArrayList<>();

        try (Connection conn = DBConnection.getConnection()) {
            String sql = "";
            if ("energy".equals(type)) {
                sql = "SELECT room_id, log_date, power_kwh FROM energy_logs ORDER BY recorded_at DESC LIMIT 50";
            } else {
                sql = "SELECT location AS room_id, title AS issue_type, priority, status, created_at FROM issues ORDER BY created_at DESC LIMIT 50";
            }

            PreparedStatement ps = conn.prepareStatement(sql);
            ResultSet rs = ps.executeQuery();

            while (rs.next()) {
                Map<String, Object> log = new HashMap<>();
                if ("energy".equals(type)) {
                    log.put("roomId", rs.getString("room_id"));
                    log.put("date", rs.getDate("log_date").toString());
                    log.put("power", rs.getDouble("power_kwh"));
                } else {
                    log.put("roomId", rs.getString("room_id"));
                    log.put("issue", rs.getString("issue_type"));
                    log.put("priority", rs.getString("priority"));
                    log.put("status", rs.getString("status"));
                    log.put("date", rs.getTimestamp("created_at").toString());
                }
                logs.add(log);
            }

            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write(new Gson().toJson(logs));

        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }
}
