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

@WebServlet("/api/bills")
public class BillServlet extends HttpServlet {
    private Gson gson = new Gson();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        String residentId = request.getParameter("resident_id");

        List<Map<String, Object>> bills = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection()) {
            String sql = "SELECT * FROM bills WHERE resident_id = ?";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, residentId);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> bill = new HashMap<>();
                        bill.put("bill_id", rs.getInt("bill_id"));
                        bill.put("resident_id", rs.getString("resident_id"));
                        bill.put("amount", rs.getDouble("amount"));
                        bill.put("due_date", rs.getDate("due_date"));
                        bill.put("status", rs.getString("status"));
                        bill.put("payment_date", rs.getTimestamp("payment_date"));
                        bills.add(bill);
                    }
                }
            }
            Map<String, Object> respMap = new HashMap<>();
            respMap.put("success", true);
            respMap.put("data", bills);
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
        if ("pay".equals(action)) {
            payBill(request, response);
        } else {
            Map<String, Object> errMap = new HashMap<>();
            errMap.put("success", false);
            errMap.put("message", "Invalid action");
            sendJsonResponse(response, 400, errMap);
        }
    }

    @SuppressWarnings("unchecked")
    private void payBill(HttpServletRequest request, HttpServletResponse response) throws IOException {
        try {
            Map<String, Object> data = gson.fromJson(request.getReader(), Map.class);
            try (Connection conn = DBConnection.getConnection()) {
                String billIdStr = String.valueOf(data.get("bill_id"));
                if (billIdStr.endsWith(".0")) billIdStr = billIdStr.substring(0, billIdStr.length() - 2);
                int billId = Integer.parseInt(billIdStr);

                String sql = "UPDATE bills SET status = 'Paid', payment_date = CURRENT_TIMESTAMP WHERE bill_id = ?";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setInt(1, billId);
                    ps.executeUpdate();
                }

                Map<String, Object> respMap = new HashMap<>();
                respMap.put("success", true);
                respMap.put("message", "Bill paid successfully");
                sendJsonResponse(response, 200, respMap);
            }
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> errMap = new HashMap<>();
            errMap.put("success", false);
            errMap.put("message", e.getMessage());
            sendJsonResponse(response, 500, errMap);
        }
    }

    private void sendJsonResponse(HttpServletResponse response, int status, Object data) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(gson.toJson(data));
    }
}
