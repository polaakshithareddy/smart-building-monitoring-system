package com.sbms.servlet;

import com.sbms.util.DBConnection;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Date;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

@WebServlet("/LogEnergyServlet")
public class LogEnergyServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String roomId    = request.getParameter("roomId");
        String logDate   = request.getParameter("logDate");
        String powerKwh  = request.getParameter("powerKwh");

        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        if (roomId == null || logDate == null || powerKwh == null ||
            roomId.trim().isEmpty() || logDate.trim().isEmpty() || powerKwh.trim().isEmpty()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().write("{\"success\":false,\"message\":\"Missing required fields\"}");
            return;
        }

        try (Connection conn = DBConnection.getConnection()) {
            String sql = "INSERT INTO energy_logs (room_id, log_date, power_kwh) VALUES (?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, roomId.trim());
                ps.setDate(2, Date.valueOf(logDate.trim()));
                ps.setDouble(3, Double.parseDouble(powerKwh.trim()));
                ps.executeUpdate();
            }
            response.setStatus(HttpServletResponse.SC_CREATED);
            response.getWriter().write("{\"success\":true,\"message\":\"Energy log saved\"}");
        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().write("{\"success\":false,\"message\":\"Invalid power value\"}");
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().write("{\"success\":false,\"message\":\"" + e.getMessage() + "\"}");
        }
    }
}
