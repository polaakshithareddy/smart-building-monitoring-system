package com.sbms.servlet;

import com.sbms.util.DBConnection;
import java.io.IOException;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.sql.*;
import java.util.*;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.*;
import com.google.gson.Gson;
import java.util.concurrent.*;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

// PDF Imports
import com.itextpdf.text.Document;
import com.itextpdf.text.Paragraph;
import com.itextpdf.text.Phrase;
import com.itextpdf.text.pdf.PdfPCell;
import com.itextpdf.text.pdf.PdfPTable;
import com.itextpdf.text.pdf.PdfWriter;

// Excel Imports
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

@WebServlet(urlPatterns = {"/ReportServlet", "/api/reports/download/*"})
public class ReportServlet extends HttpServlet {

    private static ScheduledExecutorService scheduler;
    private static boolean initialized = false;

    @Override
    public void init() throws ServletException {
        if (!initialized) {
            setupDatabase();
            startScheduler();
            initialized = true;
        }
    }

    private void setupDatabase() {
        try (Connection conn = DBConnection.getConnection();
             Statement stmt = conn.createStatement()) {
            
            stmt.executeUpdate("CREATE TABLE IF NOT EXISTS reports (" +
                    "report_id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "report_type VARCHAR(50), " +
                    "file_format VARCHAR(10), " +
                    "generated_by VARCHAR(50), " +
                    "file_name VARCHAR(100), " +
                    "file_data LONGTEXT, " +
                    "generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")");

            stmt.executeUpdate("CREATE TABLE IF NOT EXISTS report_schedules (" +
                    "schedule_id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "report_type VARCHAR(50), " +
                    "format VARCHAR(10), " +
                    "frequency VARCHAR(20), " +
                    "created_by VARCHAR(50), " +
                    "last_run TIMESTAMP NULL, " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void startScheduler() {
        if (scheduler == null) {
            scheduler = Executors.newSingleThreadScheduledExecutor();
            scheduler.scheduleAtFixedRate(() -> {
                try {
                    runScheduledReports();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }, 1, 60, TimeUnit.MINUTES); // Run every hour
        }
    }

    // --- REPORT GENERATION ENGINE ---

    private String generateBase64Report(String reportType, String format) throws Exception {
        if ("PDF".equalsIgnoreCase(format)) {
            return generatePDF(reportType);
        } else if ("Excel".equalsIgnoreCase(format)) {
            return generateExcel(reportType);
        }
        return "";
    }

    private String generatePDF(String reportType) throws Exception {
        byte[] pdfBytes = generatePDFBytes(reportType);
        return "data:application/pdf;base64," + Base64.getEncoder().encodeToString(pdfBytes);
    }

    private byte[] generatePDFBytes(String reportType) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document();
        PdfWriter.getInstance(document, out);
        document.open();
        
        document.add(new Paragraph("Smart Building Management System (SBMS Pro)"));
        document.add(new Paragraph(reportType));
        document.add(new Paragraph("Generated at: " + LocalDateTime.now().toString()));
        document.add(new Paragraph(" "));
        
        try (Connection conn = DBConnection.getConnection()) {
            if (reportType.toLowerCase().contains("issue") || reportType.toLowerCase().contains("maintenance")) {
                PdfPTable table = new PdfPTable(6);
                table.setWidthPercentage(100);
                table.addCell(new Phrase("Issue ID"));
                table.addCell(new Phrase("Resident Name"));
                table.addCell(new Phrase("Block / Location"));
                table.addCell(new Phrase("Issue Type"));
                table.addCell(new Phrase("Status"));
                table.addCell(new Phrase("Date Created"));
                
                try (PreparedStatement st = conn.prepareStatement("SELECT * FROM issues ORDER BY created_at DESC LIMIT 100");
                     ResultSet rs = st.executeQuery()) {
                    while (rs.next()) {
                        table.addCell(String.valueOf(rs.getInt("issue_id")));
                        table.addCell(rs.getString("resident_id") != null ? rs.getString("resident_id") : "N/A");
                        table.addCell(rs.getString("location") != null ? rs.getString("location") : "N/A");
                        table.addCell(rs.getString("title") != null ? rs.getString("title") : "N/A");
                        table.addCell(rs.getString("status") != null ? rs.getString("status") : "N/A");
                        table.addCell(rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toString() : "");
                    }
                }
                document.add(table);
            } else if (reportType.toLowerCase().contains("bill")) {
                PdfPTable table = new PdfPTable(5);
                table.setWidthPercentage(100);
                table.addCell(new Phrase("Bill ID"));
                table.addCell(new Phrase("Resident"));
                table.addCell(new Phrase("Amount"));
                table.addCell(new Phrase("Due Date"));
                table.addCell(new Phrase("Status"));
                
                try (PreparedStatement st = conn.prepareStatement("SELECT * FROM bills ORDER BY due_date DESC LIMIT 100");
                     ResultSet rs = st.executeQuery()) {
                    while (rs.next()) {
                        table.addCell(String.valueOf(rs.getInt("bill_id")));
                        table.addCell(rs.getString("resident_id"));
                        table.addCell("$" + rs.getDouble("amount"));
                        table.addCell(rs.getDate("due_date") != null ? rs.getDate("due_date").toString() : "");
                        table.addCell(rs.getString("status"));
                    }
                }
                document.add(table);
            } else {
                // Fallback for generic empty
                document.add(new Paragraph("No data available for this report type."));
            }
        }
        
        document.close();
        return out.toByteArray();
    }

    private String generateExcel(String reportType) throws Exception {
        byte[] excelBytes = generateExcelBytes(reportType);
        return "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," + Base64.getEncoder().encodeToString(excelBytes);
    }

    private byte[] generateExcelBytes(String reportType) throws Exception {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream();
             Connection conn = DBConnection.getConnection()) {
                 
            Sheet sheet = workbook.createSheet(reportType.replaceAll("[^a-zA-Z0-9 ]", ""));
            Row headerRow = sheet.createRow(0);
            
            if (reportType.toLowerCase().contains("issue") || reportType.toLowerCase().contains("maintenance")) {
                String[] columns = {"Issue ID", "Resident Name", "Block / Location", "Issue Type", "Status", "Date Created"};
                for(int i = 0; i < columns.length; i++) {
                    Cell cell = headerRow.createCell(i);
                    cell.setCellValue(columns[i]);
                }
                
                try (PreparedStatement st = conn.prepareStatement("SELECT * FROM issues ORDER BY created_at DESC LIMIT 500");
                     ResultSet rs = st.executeQuery()) {
                    int rowIdx = 1;
                    while (rs.next()) {
                        Row row = sheet.createRow(rowIdx++);
                        row.createCell(0).setCellValue(rs.getInt("issue_id"));
                        row.createCell(1).setCellValue(rs.getString("resident_id") != null ? rs.getString("resident_id") : "N/A");
                        row.createCell(2).setCellValue(rs.getString("location") != null ? rs.getString("location") : "N/A");
                        row.createCell(3).setCellValue(rs.getString("title") != null ? rs.getString("title") : "N/A");
                        row.createCell(4).setCellValue(rs.getString("status") != null ? rs.getString("status") : "N/A");
                        row.createCell(5).setCellValue(rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toString() : "");
                    }
                }
            } else if (reportType.toLowerCase().contains("bill")) {
                String[] columns = {"Bill ID", "Resident", "Amount", "Due Date", "Status", "Payment Date"};
                for(int i = 0; i < columns.length; i++) {
                    Cell cell = headerRow.createCell(i);
                    cell.setCellValue(columns[i]);
                }
                
                try (PreparedStatement st = conn.prepareStatement("SELECT * FROM bills ORDER BY due_date DESC LIMIT 500");
                     ResultSet rs = st.executeQuery()) {
                    int rowIdx = 1;
                    while (rs.next()) {
                        Row row = sheet.createRow(rowIdx++);
                        row.createCell(0).setCellValue(rs.getInt("bill_id"));
                        row.createCell(1).setCellValue(rs.getString("resident_id"));
                        row.createCell(2).setCellValue(rs.getDouble("amount"));
                        row.createCell(3).setCellValue(rs.getDate("due_date") != null ? rs.getDate("due_date").toString() : "");
                        row.createCell(4).setCellValue(rs.getString("status"));
                        row.createCell(5).setCellValue(rs.getTimestamp("payment_date") != null ? rs.getTimestamp("payment_date").toString() : "");
                    }
                }
            } else {
                headerRow.createCell(0).setCellValue("Report Type");
                headerRow.createCell(1).setCellValue("Status");
                Row r = sheet.createRow(1);
                r.createCell(0).setCellValue(reportType);
                r.createCell(1).setCellValue("Auto-generated empty fallback");
            }
            
            // Auto size columns
            for(int i = 0; i < 6; i++) {
                sheet.autoSizeColumn(i);
            }
            
            workbook.write(out);
            return out.toByteArray();
        }
    }


    private void runScheduledReports() {
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement st = conn.prepareStatement("SELECT * FROM report_schedules");
             ResultSet rs = st.executeQuery()) {
            
            while (rs.next()) {
                int id = rs.getInt("schedule_id");
                String type = rs.getString("report_type");
                String freq = rs.getString("frequency");
                String format = rs.getString("format");
                Timestamp lastRun = rs.getTimestamp("last_run");
                boolean shouldRun = false;
                
                LocalDateTime now = LocalDateTime.now();
                if (lastRun == null) {
                    shouldRun = true;
                } else {
                    long hours = ChronoUnit.HOURS.between(lastRun.toLocalDateTime(), now);
                    if (freq.equalsIgnoreCase("Daily") && hours >= 24) shouldRun = true;
                    if (freq.equalsIgnoreCase("Weekly") && hours >= 168) shouldRun = true;
                    if (freq.equalsIgnoreCase("Monthly") && hours >= 720) shouldRun = true;
                }

                if (shouldRun) {
                    // Generate actual content using Backend Engine
                    String fileDataUrl = generateBase64Report(type, format);
                    String fileName = type.toLowerCase().replaceAll("\\s+", "-") + "-report-" + java.time.LocalDate.now().toString() + "." + (format.equalsIgnoreCase("Excel") ? "xlsx" : "pdf");

                    try (PreparedStatement insert = conn.prepareStatement(
                            "INSERT INTO reports (report_type, file_format, generated_by, file_name, file_data) VALUES (?, ?, 'System', ?, ?)")) {
                        insert.setString(1, type + " (Auto)");
                        insert.setString(2, format);
                        insert.setString(3, fileName);
                        insert.setString(4, fileDataUrl);
                        insert.executeUpdate();
                    }
                    
                    try (PreparedStatement update = conn.prepareStatement("UPDATE report_schedules SET last_run = NOW() WHERE schedule_id = ?")) {
                        update.setInt(1, id);
                        update.executeUpdate();
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void destroy() {
        if (scheduler != null) {
            scheduler.shutdownNow();
        }
    }

    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        if (!initialized) init();
        String action = request.getParameter("action");
        String pathInfo = request.getPathInfo();
        String downloadId = request.getParameter("id");
        
        if (pathInfo != null && pathInfo.length() > 1) { // e.g., /123
            String[] parts = pathInfo.split("/");
            if (parts.length > 1) {
                downloadId = parts[parts.length - 1]; // get the last part as ID
                action = "download";
            }
        }
        
        if ("download".equals(action)) {
            String id = downloadId;
            try (Connection conn = DBConnection.getConnection();
                 PreparedStatement st = conn.prepareStatement("SELECT file_name, report_type, file_format FROM reports WHERE report_id=?")) {
                st.setInt(1, Integer.parseInt(id));
                try (ResultSet rs = st.executeQuery()) {
                    if (rs.next()) {
                        String name = rs.getString("file_name");
                        String format = rs.getString("file_format");
                        String reportType = rs.getString("report_type");
                        
                        if ("pdf".equalsIgnoreCase(format) || name.endsWith(".pdf")) {
                            response.setContentType("application/pdf");
                        } else if ("excel".equalsIgnoreCase(format) || name.endsWith(".xlsx")) {
                            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                        } else {
                            response.setContentType("application/octet-stream");
                        }

                        response.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
                        response.setHeader("Content-Disposition", "attachment; filename=\"" + name + "\"");
                        
                        // Regenerate binary payload on the fly so it's fresh and correct binary.
                        byte[] fileBytes;
                        if ("Excel".equalsIgnoreCase(format) || name.endsWith(".xlsx")) {
                            fileBytes = generateExcelBytes(reportType);
                        } else {
                            fileBytes = generatePDFBytes(reportType);
                        }
                        
                        response.setContentLength(fileBytes.length);
                        try (OutputStream out = response.getOutputStream()) {
                            out.write(fileBytes);
                            out.flush();
                        }
                    } else {
                        response.setStatus(404);
                        response.getWriter().write("Report not found.");
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
                response.setStatus(500);
            }
        } else if ("schedules".equals(action)) {
             try (Connection conn = DBConnection.getConnection();
                 PreparedStatement st = conn.prepareStatement("SELECT * FROM report_schedules ORDER BY created_at DESC");
                 ResultSet rs = st.executeQuery()) {
                List<Map<String, Object>> list = new ArrayList<>();
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", rs.getInt("schedule_id"));
                    map.put("type", rs.getString("report_type"));
                    map.put("format", rs.getString("format"));
                    map.put("frequency", rs.getString("frequency"));
                    list.add(map);
                }
                response.setContentType("application/json");
                response.getWriter().write(new Gson().toJson(list));
            } catch (Exception e) {
                e.printStackTrace();
            }
        } else {
            // history
            try (Connection conn = DBConnection.getConnection();
                 PreparedStatement st = conn.prepareStatement("SELECT report_id, report_type, file_format, generated_by, file_name, generated_at FROM reports ORDER BY generated_at DESC");
                 ResultSet rs = st.executeQuery()) {
                
                List<Map<String, Object>> list = new ArrayList<>();
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", rs.getInt("report_id"));
                    map.put("type", rs.getString("report_type"));
                    map.put("format", rs.getString("file_format"));
                    map.put("generated_by", rs.getString("generated_by"));
                    map.put("file_name", rs.getString("file_name"));
                    map.put("date", rs.getTimestamp("generated_at").toString());
                    list.add(map);
                }
                
                response.setContentType("application/json");
                response.getWriter().write(new Gson().toJson(list));
            } catch (Exception e) {
                e.printStackTrace();
                response.setStatus(500);
            }
        }
    }

    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        if (!initialized) init();
        String action = request.getParameter("action");
        if (action == null) return;
        
        try (Connection conn = DBConnection.getConnection()) {
            if ("upload".equals(action)) {
                String type = request.getParameter("report_type");
                String format = request.getParameter("file_format");
                String by = request.getParameter("generated_by");
                String name = request.getParameter("file_name");
                
                // --- We instantly generate the data ourselves natively! ---
                String generatedBase64Uri = generateBase64Report(type, format);
                
                int newId = -1;
                try (PreparedStatement st = conn.prepareStatement(
                        "INSERT INTO reports (report_type, file_format, generated_by, file_name, file_data) VALUES (?, ?, ?, ?, ?)",
                        Statement.RETURN_GENERATED_KEYS)) {
                    st.setString(1, type);
                    st.setString(2, format);
                    st.setString(3, by);
                    st.setString(4, name);
                    st.setString(5, generatedBase64Uri);
                    st.executeUpdate();
                    
                    try (ResultSet rs = st.getGeneratedKeys()) {
                        if (rs.next()) {
                            newId = rs.getInt(1);
                        }
                    }
                }
                response.setContentType("application/json");
                response.getWriter().write("{\"status\":\"success\", \"id\":" + newId + "}");

            } else if ("schedule".equals(action)) {
                String type = request.getParameter("report_type");
                String format = request.getParameter("format");
                String freq = request.getParameter("frequency");
                String by = request.getParameter("created_by");
                
                try (PreparedStatement st = conn.prepareStatement("INSERT INTO report_schedules (report_type, format, frequency, created_by) VALUES (?, ?, ?, ?)")) {
                    st.setString(1, type);
                    st.setString(2, format);
                    st.setString(3, freq);
                    st.setString(4, by);
                    st.executeUpdate();
                }
                response.setContentType("application/json");
                response.getWriter().write("{\"status\":\"success\"}");
                
            } else if ("delete".equals(action)) {
                String id = request.getParameter("id");
                try (PreparedStatement st = conn.prepareStatement("DELETE FROM reports WHERE report_id = ?")) {
                    st.setInt(1, Integer.parseInt(id));
                    st.executeUpdate();
                }
                response.setContentType("application/json");
                response.getWriter().write("{\"status\":\"success\"}");
                
            } else if ("deleteSchedule".equals(action)) {
                String id = request.getParameter("id");
                try (PreparedStatement st = conn.prepareStatement("DELETE FROM report_schedules WHERE schedule_id = ?")) {
                    st.setInt(1, Integer.parseInt(id));
                    st.executeUpdate();
                }
                response.setContentType("application/json");
                response.getWriter().write("{\"status\":\"success\"}");
            }
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(500);
            response.setContentType("application/json");
            response.getWriter().write("{\"status\":\"error\", \"message\":\"" + e.getMessage() + "\"}");
        }
    }
}
