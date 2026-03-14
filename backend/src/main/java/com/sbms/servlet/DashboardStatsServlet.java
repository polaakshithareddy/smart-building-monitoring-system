package com.sbms.servlet;

import com.sbms.util.DBConnection;
import java.io.IOException;
import java.sql.Connection;
import java.sql.ResultSet;
import java.util.*;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.*;
import com.google.gson.Gson;

@WebServlet("/api/dashboard/stats")
public class DashboardStatsServlet extends HttpServlet {
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        Map<String, Object> data = new HashMap<>();

        try (Connection conn = DBConnection.getConnection()) {
            ResultSet rs;

            try {
                rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM blocks");
                if (rs.next())
                    data.put("totalBlocks", rs.getInt(1));
            } catch (Exception e) {
                data.put("totalBlocks", 0);
            }

            try {
                rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM residents");
                if (rs.next())
                    data.put("totalResidents", rs.getInt(1));
            } catch (Exception e) {
                // fallback to users role='resident' if residents table does not exist
                try {
                    rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM users WHERE role='resident'");
                    if (rs.next())
                        data.put("totalResidents", rs.getInt(1));
                } catch (Exception ex) {
                    data.put("totalResidents", 0);
                }
            }

            try {
                rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM issues WHERE status='Pending'");
                if (rs.next())
                    data.put("pendingRequests", rs.getInt(1));
            } catch (Exception e) {
                data.put("pendingRequests", 0);
            }

            try {
                rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM issues WHERE status='Completed'");
                if (rs.next())
                    data.put("issuesResolved", rs.getInt(1));
            } catch (Exception e) {
                data.put("issuesResolved", 0);
            }

            // Also keep the charts data so the dashboard does not break
            // Chart: Issue Status Distribution
            Map<String, Integer> statusDist = new LinkedHashMap<>();
            try {
                rs = conn.createStatement().executeQuery(
                        "SELECT status, COUNT(*) FROM issues GROUP BY status ORDER BY FIELD(status,'Pending','Assigned','In Progress','Completed')");
                while (rs.next())
                    statusDist.put(rs.getString(1), rs.getInt(2));
                data.put("issueStatusDist", statusDist);
            } catch (Exception ignore) {
            }

            // Chart: Issues by Location
            Map<String, Integer> locationDist = new LinkedHashMap<>();
            try {
                rs = conn.createStatement().executeQuery(
                        "SELECT location, COUNT(*) FROM issues GROUP BY location ORDER BY COUNT(*) DESC LIMIT 8");
                while (rs.next())
                    locationDist.put(rs.getString(1), rs.getInt(2));
                data.put("issuesByLocation", locationDist);
            } catch (Exception ignore) {
            }

            // Chart: Issues over time (monthly count)
            Map<String, Integer> issuesOverTime = new LinkedHashMap<>();
            try {
                rs = conn.createStatement().executeQuery(
                        "SELECT DATE_FORMAT(created_at, '%Y-%m') as m, COUNT(*) FROM issues " +
                                "GROUP BY m ORDER BY m");
                while (rs.next())
                    issuesOverTime.put(rs.getString(1), rs.getInt(2));
                data.put("issuesOverTime", issuesOverTime);
            } catch (Exception ignore) {
            }

            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write(new Gson().toJson(data));

        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().write("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }
}
