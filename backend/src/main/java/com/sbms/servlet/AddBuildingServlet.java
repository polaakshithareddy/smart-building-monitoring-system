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

@WebServlet("/AddBuildingServlet")
public class AddBuildingServlet extends HttpServlet {
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        String roomId = request.getParameter("roomId");
        String roomType = request.getParameter("roomType");
        int floor = Integer.parseInt(request.getParameter("floor"));
        String occupancy = request.getParameter("occupancy");

        try (Connection conn = DBConnection.getConnection()) {
            String sql = "INSERT INTO rooms (room_id, room_type, floor_number, occupancy_status) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE room_type=?, floor_number=?, occupancy_status=?";
            PreparedStatement ps = conn.prepareStatement(sql);
            ps.setString(1, roomId);
            ps.setString(2, roomType);
            ps.setInt(3, floor);
            ps.setString(4, occupancy);
            ps.setString(5, roomType);
            ps.setInt(6, floor);
            ps.setString(7, occupancy);
            
            ps.executeUpdate();
            response.sendRedirect("index.jsp?success=roomAdded");
        } catch (Exception e) {
            e.printStackTrace();
            response.sendRedirect("index.jsp?error=dbError");
        }
    }
}
