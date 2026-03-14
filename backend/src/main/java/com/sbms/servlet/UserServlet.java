package com.sbms.servlet;

import com.sbms.util.DBConnection;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.HashMap;
import java.util.Map;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import com.google.gson.Gson;

@WebServlet("/api/users")
public class UserServlet extends HttpServlet {
    private Gson gson = new Gson();

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        String action = request.getParameter("action");
        if ("signup".equals(action)) {
            handleSignup(request, response);
        } else if ("login".equals(action)) {
            handleLogin(request, response);
        } else {
            Map<String, Object> errMap = new HashMap<>();
            errMap.put("success", false);
            errMap.put("message", "Invalid action");
            sendJsonResponse(response, 400, errMap);
        }
    }

    @SuppressWarnings("unchecked")
    private void handleSignup(HttpServletRequest request, HttpServletResponse response) throws IOException {
        try {
            Map<String, Object> data = gson.fromJson(request.getReader(), Map.class);
            String email = String.valueOf(data.get("email"));
            String username = String.valueOf(data.get("username"));
            
            try (Connection conn = DBConnection.getConnection()) {
                // Check if email or username exists
                String checkSql = "SELECT * FROM users WHERE email = ? OR username = ?";
                try (PreparedStatement checkPs = conn.prepareStatement(checkSql)) {
                    checkPs.setString(1, email);
                    checkPs.setString(2, username);
                    try (ResultSet rs = checkPs.executeQuery()) {
                        if (rs.next()) {
                            Map<String, Object> errMap = new HashMap<>();
                            errMap.put("success", false);
                            if (email.equalsIgnoreCase(rs.getString("email"))) {
                                errMap.put("message", "Email already registered");
                            } else {
                                errMap.put("message", "Username already exists");
                            }
                            sendJsonResponse(response, 400, errMap);
                            return;
                        }
                    }
                }

                // Insert new user
                String insertSql = "INSERT INTO users (fullname, username, email, password, role, phone) VALUES (?, ?, ?, ?, ?, ?)";
                try (PreparedStatement ps = conn.prepareStatement(insertSql)) {
                    ps.setString(1, String.valueOf(data.get("name")));
                    ps.setString(2, username);
                    ps.setString(3, email);
                    ps.setString(4, String.valueOf(data.get("password")));
                    ps.setString(5, String.valueOf(data.get("role")));
                    ps.setString(6, String.valueOf(data.get("phone")));
                    ps.executeUpdate();
                }
                
                Map<String, Object> respMap = new HashMap<>();
                respMap.put("success", true);
                respMap.put("message", "User registered successfully");
                sendJsonResponse(response, 201, respMap);
            }
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> errMap = new HashMap<>();
            errMap.put("success", false);
            errMap.put("message", "Registration failed: " + e.getMessage());
            sendJsonResponse(response, 500, errMap);
        }
    }

    @SuppressWarnings("unchecked")
    private void handleLogin(HttpServletRequest request, HttpServletResponse response) throws IOException {
        try {
            Map<String, Object> data = gson.fromJson(request.getReader(), Map.class);
            String identifier = String.valueOf(data.get("username")); // can be email or username
            String password = String.valueOf(data.get("password"));
            
            try (Connection conn = DBConnection.getConnection()) {
                String sql = "SELECT * FROM users WHERE (username = ? OR email = ?) AND password = ?";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setString(1, identifier);
                    ps.setString(2, identifier);
                    ps.setString(3, password);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            Map<String, Object> user = new HashMap<>();
                            user.put("username", rs.getString("username"));
                            user.put("role", rs.getString("role"));
                            user.put("name", rs.getString("fullname"));
                            user.put("email", rs.getString("email"));
                            user.put("phone", rs.getString("phone"));

                            Map<String, Object> respMap = new HashMap<>();
                            respMap.put("success", true);
                            respMap.put("user", user);
                            sendJsonResponse(response, 200, respMap);
                        } else {
                            Map<String, Object> errMap = new HashMap<>();
                            errMap.put("success", false);
                            errMap.put("message", "Invalid username/email or password");
                            sendJsonResponse(response, 401, errMap);
                        }
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> errMap = new HashMap<>();
            errMap.put("success", false);
            errMap.put("message", "Login failed: " + e.getMessage());
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
