package com.sbms.servlet;

import com.sbms.util.DBConnection;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.*;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.*;
import com.google.gson.Gson;

@WebServlet("/api/buildingConfig")
public class BuildingConfigServlet extends HttpServlet {

    private void ensureTableExists(Connection conn) throws Exception {
        conn.createStatement().execute("CREATE TABLE IF NOT EXISTS building_blocks (" +
            "id INT AUTO_INCREMENT PRIMARY KEY, " +
            "block_name VARCHAR(255) UNIQUE, " +
            "total_capacity INT" +
        ")");
    }

    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        try (Connection conn = DBConnection.getConnection()) {
            ensureTableExists(conn);
            List<Map<String, Object>> blocks = new ArrayList<>();
            try (ResultSet rs = conn.createStatement().executeQuery("SELECT * FROM building_blocks ORDER BY block_name")) {
                while (rs.next()) {
                    Map<String, Object> block = new HashMap<>();
                    block.put("id", rs.getInt("id"));
                    block.put("block_name", rs.getString("block_name"));
                    block.put("total_capacity", rs.getInt("total_capacity"));
                    blocks.add(block);
                }
            }
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write(new Gson().toJson(blocks));
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(500);
            response.getWriter().write("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        String blockName = request.getParameter("blockName");
        String roomsParam = request.getParameter("totalRooms");

        if (blockName == null || blockName.trim().isEmpty() || roomsParam == null) {
            response.setStatus(400);
            response.getWriter().write("{\"status\":\"error\", \"message\":\"Invalid parameters.\"}");
            return;
        }

        try (Connection conn = DBConnection.getConnection()) {
            ensureTableExists(conn);
            int totalRooms = Integer.parseInt(roomsParam);

            String sql = "INSERT INTO building_blocks (block_name, total_capacity) VALUES (?, ?) ON DUPLICATE KEY UPDATE total_capacity = ?";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, blockName);
                ps.setInt(2, totalRooms);
                ps.setInt(3, totalRooms);
                ps.executeUpdate();
            }
            response.setContentType("application/json");
            response.getWriter().write("{\"status\":\"success\"}");
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(500);
            response.getWriter().write("{\"status\":\"error\", \"message\":\"" + e.getMessage() + "\"}");
        }
    }

    protected void doDelete(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        String idParam = request.getParameter("id");
        if (idParam == null) {
            response.setStatus(400);
            return;
        }

        try (Connection conn = DBConnection.getConnection()) {
            ensureTableExists(conn);
            int id = Integer.parseInt(idParam);
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM building_blocks WHERE id = ?")) {
                ps.setInt(1, id);
                ps.executeUpdate();
            }
            response.setContentType("application/json");
            response.getWriter().write("{\"status\":\"success\"}");
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(500);
            response.getWriter().write("{\"status\":\"error\", \"message\":\"" + e.getMessage() + "\"}");
        }
    }
}
