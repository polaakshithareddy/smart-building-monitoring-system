package com.sbms.servlet;

import com.sbms.util.DBConnection;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

@WebServlet("/AddMaintenanceRequestServlet")
public class AddMaintenanceRequestServlet extends HttpServlet {
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        String roomId = request.getParameter("roomId");
        String issueType = request.getParameter("issueType");
        String description = request.getParameter("description");
        String priority = request.getParameter("priority");

        try (Connection conn = DBConnection.getConnection()) {
            String sql = "INSERT INTO maintenance_requests (room_id, issue_type, description, priority) VALUES (?, ?, ?, ?)";
            PreparedStatement ps = conn.prepareStatement(sql);
            ps.setString(1, roomId);
            ps.setString(2, issueType);
            ps.setString(3, description);
            ps.setString(4, priority);
            
            ps.executeUpdate();
            response.sendRedirect("index.jsp?success=requestSubmitted");
        } catch (Exception e) {
            e.printStackTrace();
            response.sendRedirect("index.jsp?error=dbError");
        }
    }
}
