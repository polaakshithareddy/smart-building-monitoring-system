package com.sbms.servlet;

import com.sbms.util.DBConnection;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.*;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.*;
import com.google.gson.Gson;

@WebServlet("/api/buildings/*")
public class BuildingManagementServlet extends HttpServlet {

    private void initTables(Connection conn) throws Exception {
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("CREATE TABLE IF NOT EXISTS blocks (" +
                "block_id INT AUTO_INCREMENT PRIMARY KEY, " +
                "block_name VARCHAR(255) UNIQUE, " +
                "total_floors INT, " +
                "rooms_per_floor INT" +
            ")");
            stmt.execute("CREATE TABLE IF NOT EXISTS floors (" +
                "floor_id INT AUTO_INCREMENT PRIMARY KEY, " +
                "block_id INT, " +
                "floor_number INT, " +
                "FOREIGN KEY (block_id) REFERENCES blocks(block_id) ON DELETE CASCADE" +
            ")");
            
            // Re-create rooms table if needed or handle existing one. We'll ensure it has right columns.
            // Since older code had a rooms table, we might need to recreate it. For safety:
            stmt.execute("CREATE TABLE IF NOT EXISTS rooms_new (" +
                "id INT AUTO_INCREMENT PRIMARY KEY, " +
                "room_id VARCHAR(50) UNIQUE, " +
                "block_id INT, " +
                "floor_number INT, " +
                "room_number VARCHAR(50), " +
                "status VARCHAR(50) DEFAULT 'Empty', " +
                "FOREIGN KEY (block_id) REFERENCES blocks(block_id) ON DELETE CASCADE" +
            ")");
        }
    }

    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        String pathInfo = request.getPathInfo();
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        Gson gson = new Gson();

        try (Connection conn = DBConnection.getConnection()) {
            initTables(conn);

            if ("/blocks".equals(pathInfo)) {
                List<Map<String, Object>> blocks = new ArrayList<>();
                try (ResultSet rs = conn.createStatement().executeQuery("SELECT * FROM blocks ORDER BY block_name")) {
                    while (rs.next()) {
                        Map<String, Object> block = new HashMap<>();
                        block.put("block_id", rs.getInt("block_id"));
                        block.put("block_name", rs.getString("block_name"));
                        block.put("total_floors", rs.getInt("total_floors"));
                        block.put("rooms_per_floor", rs.getInt("rooms_per_floor"));
                        blocks.add(block);
                    }
                }
                response.getWriter().write(gson.toJson(blocks));

            } else if ("/rooms".equals(pathInfo)) {
                String blockIdStr = request.getParameter("block_id");
                String query = "SELECT r.*, b.block_name FROM rooms_new r JOIN blocks b ON r.block_id = b.block_id";
                if (blockIdStr != null && !blockIdStr.isEmpty()) {
                    query += " WHERE r.block_id = " + Integer.parseInt(blockIdStr);
                }
                query += " ORDER BY r.room_id";

                List<Map<String, Object>> rooms = new ArrayList<>();
                try (ResultSet rs = conn.createStatement().executeQuery(query)) {
                    while (rs.next()) {
                        Map<String, Object> room = new HashMap<>();
                        room.put("id", rs.getInt("id"));
                        room.put("room_id", rs.getString("room_id"));
                        room.put("block_id", rs.getInt("block_id"));
                        room.put("block_name", rs.getString("block_name"));
                        room.put("floor_number", rs.getInt("floor_number"));
                        room.put("room_number", rs.getString("room_number"));
                        room.put("status", rs.getString("status"));
                        rooms.add(room);
                    }
                }
                response.getWriter().write(gson.toJson(rooms));
            } else {
                response.setStatus(404);
                response.getWriter().write("{\"error\": \"Not Found\"}");
            }
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(500);
            response.getWriter().write("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        String pathInfo = request.getPathInfo();
        
        try (Connection conn = DBConnection.getConnection()) {
            initTables(conn);

            if ("/blocks/create".equals(pathInfo)) {
                String blockName = request.getParameter("blockName");
                int totalFloors = Integer.parseInt(request.getParameter("totalFloors"));
                int roomsPerFloor = Integer.parseInt(request.getParameter("roomsPerFloor"));

                try (PreparedStatement psBlock = conn.prepareStatement("INSERT INTO blocks (block_name, total_floors, rooms_per_floor) VALUES (?, ?, ?)", Statement.RETURN_GENERATED_KEYS)) {
                    psBlock.setString(1, blockName);
                    psBlock.setInt(2, totalFloors);
                    psBlock.setInt(3, roomsPerFloor);
                    psBlock.executeUpdate();

                    try (ResultSet rsKeys = psBlock.getGeneratedKeys()) {
                        if (rsKeys.next()) {
                            int blockId = rsKeys.getInt(1);
                            String blockLetter = blockName.substring(0, 1).toUpperCase();

                            // Generate floors & rooms
                            try (PreparedStatement psFloor = conn.prepareStatement("INSERT INTO floors (block_id, floor_number) VALUES (?, ?)");
                                 PreparedStatement psRoom = conn.prepareStatement("INSERT INTO rooms_new (room_id, block_id, floor_number, room_number, status) VALUES (?, ?, ?, ?, 'Empty')")) {
                                
                                for (int f = 1; f <= totalFloors; f++) {
                                    psFloor.setInt(1, blockId);
                                    psFloor.setInt(2, f);
                                    psFloor.addBatch();

                                    for (int r = 1; r <= roomsPerFloor; r++) {
                                        String roomNumberStr = String.format("%02d", r);
                                        String fullRoomId = blockLetter + f + roomNumberStr; // e.g. A101
                                        psRoom.setString(1, fullRoomId);
                                        psRoom.setInt(2, blockId);
                                        psRoom.setInt(3, f);
                                        psRoom.setString(4, roomNumberStr);
                                        psRoom.addBatch();
                                    }
                                }
                                psFloor.executeBatch();
                                psRoom.executeBatch();
                            }
                        }
                    }
                }
                response.setContentType("application/json");
                response.getWriter().write("{\"status\":\"success\"}");

            } else if ("/rooms/status".equals(pathInfo)) {
                int id = Integer.parseInt(request.getParameter("id"));
                String status = request.getParameter("status"); // Empty, Occupied, Maintenance

                try (PreparedStatement ps = conn.prepareStatement("UPDATE rooms_new SET status = ? WHERE id = ?")) {
                    ps.setString(1, status);
                    ps.setInt(2, id);
                    ps.executeUpdate();
                }
                response.setContentType("application/json");
                response.getWriter().write("{\"status\":\"success\"}");
            } else {
                response.setStatus(404);
            }
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(500);
            response.getWriter().write("{\"status\":\"error\", \"message\":\"" + e.getMessage() + "\"}");
        }
    }
}
