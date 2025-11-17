package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/danil/accessibility-analyzer/internal/domain"
	"github.com/danil/accessibility-analyzer/internal/service"
	"github.com/danil/accessibility-analyzer/internal/translator"
	"github.com/gin-gonic/gin"
)

// Handler обрабатывает HTTP запросы
type Handler struct {
	storage    *service.Storage
	translator *translator.Translator
}

// NewHandler создает новый обработчик
func NewHandler(storage *service.Storage, trans *translator.Translator) *Handler {
	return &Handler{
		storage:    storage,
		translator: trans,
	}
}

// HealthCheck проверяет здоровье сервиса
func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"time":   time.Now().Format(time.RFC3339),
	})
}

// CreateAnalysis создает новую задачу анализа
func (h *Handler) CreateAnalysis(c *gin.Context) {
	var req domain.AnalysisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
		})
		return
	}

	// Создаем задачу
	job := service.NewJob(req.URL)
	if err := h.storage.SaveJob(job); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_error",
			Message: "Failed to create job",
		})
		return
	}

	// Запускаем обработку асинхронно
	h.translator.ProcessAnalysis(job, req.Violations)

	c.JSON(http.StatusCreated, JobResponse{
		ID:        job.ID,
		URL:       job.URL,
		Status:    string(job.Status),
		Progress:  job.Progress,
		CreatedAt: job.CreatedAt.Format(time.RFC3339),
		UpdatedAt: job.UpdatedAt.Format(time.RFC3339),
	})
}

// GetJobStatus возвращает статус задачи
func (h *Handler) GetJobStatus(c *gin.Context) {
	jobID := c.Param("id")

	job, err := h.storage.GetJob(jobID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "not_found",
			Message: "Job not found",
		})
		return
	}

	c.JSON(http.StatusOK, JobResponse{
		ID:        job.ID,
		URL:       job.URL,
		Status:    string(job.Status),
		Progress:  job.Progress,
		CreatedAt: job.CreatedAt.Format(time.RFC3339),
		UpdatedAt: job.UpdatedAt.Format(time.RFC3339),
		Error:     job.Error,
	})
}

// GetReport возвращает готовый отчет
func (h *Handler) GetReport(c *gin.Context) {
	jobID := c.Param("id")

	// Проверяем статус задачи
	job, err := h.storage.GetJob(jobID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "not_found",
			Message: "Job not found",
		})
		return
	}

	if job.Status != service.StatusCompleted {
		c.JSON(http.StatusAccepted, ErrorResponse{
			Error:   "not_ready",
			Message: "Report is not ready yet",
		})
		return
	}

	// Получаем отчет
	report, err := h.storage.GetReport(jobID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "not_found",
			Message: "Report not found",
		})
		return
	}

	c.JSON(http.StatusOK, report)
}

// GetReportPDF возвращает отчёт в формате PDF
func (h *Handler) GetReportPDF(c *gin.Context) {
	jobID := c.Param("id")

	// Проверяем статус задачи
	job, err := h.storage.GetJob(jobID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "not_found",
			Message: "Job not found",
		})
		return
	}

	if job.Status != service.StatusCompleted {
		c.JSON(http.StatusAccepted, ErrorResponse{
			Error:   "not_ready",
			Message: "Report is not ready yet",
		})
		return
	}

	// Получаем отчет
	report, err := h.storage.GetReport(jobID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "not_found",
			Message: "Report not found",
		})
		return
	}

	// Генерируем PDF
	pdfGenerator := service.NewPDFGenerator()
	pdfBytes, err := pdfGenerator.GenerateReport(report)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "pdf_generation_failed",
			Message: "Failed to generate PDF: " + err.Error(),
		})
		return
	}

	// Формируем имя файла
	filename := "accessibility_report_" + jobID + ".pdf"

	// Отправляем PDF как файл для скачивания
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Header("Content-Length", fmt.Sprintf("%d", len(pdfBytes)))
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

// DeleteJob удаляет задачу
func (h *Handler) DeleteJob(c *gin.Context) {
	jobID := c.Param("id")

	if err := h.storage.DeleteJob(jobID); err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "not_found",
			Message: "Job not found",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Message: "Job deleted successfully",
	})
}

// GetReportSummary генерирует комплексное резюме с рекомендациями по всему отчёту
func (h *Handler) GetReportSummary(c *gin.Context) {
	jobID := c.Param("id")

	// Проверяем статус задачи
	job, err := h.storage.GetJob(jobID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "not_found",
			Message: "Job not found",
		})
		return
	}

	if job.Status != service.StatusCompleted {
		c.JSON(http.StatusAccepted, ErrorResponse{
			Error:   "not_ready",
			Message: "Report is not ready yet",
		})
		return
	}

	// Получаем отчет
	report, err := h.storage.GetReport(jobID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "not_found",
			Message: "Report not found",
		})
		return
	}

	// Создаём упрощённую версию отчёта для AI (только ключевые данные)
	// Отправка полного JSON с тысячами строк технических деталей даёт странные результаты
	type SimplifiedIssue struct {
		Impact      string `json:"impact"`
		Title       string `json:"title"`
		Description string `json:"description"`
		Count       int    `json:"count"`
	}

	type SimplifiedReport struct {
		URL         string            `json:"url"`
		TotalIssues int               `json:"total_issues"`
		Critical    int               `json:"critical"`
		Serious     int               `json:"serious"`
		Moderate    int               `json:"moderate"`
		Minor       int               `json:"minor"`
		Issues      []SimplifiedIssue `json:"issues"`
	}

	// Собираем упрощённые данные
	var simplifiedIssues []SimplifiedIssue
	for _, issues := range report.IssuesByImpact {
		for _, issue := range issues {
			simplifiedIssues = append(simplifiedIssues, SimplifiedIssue{
				Impact:      issue.Impact,
				Title:       issue.Title,
				Description: issue.Description,
				Count:       issue.AffectedElements,
			})
		}
	}

	simplifiedReport := SimplifiedReport{
		URL:         report.URL,
		TotalIssues: report.Summary.TotalIssues,
		Critical:    report.Summary.Critical,
		Serious:     report.Summary.Serious,
		Moderate:    report.Summary.Moderate,
		Minor:       report.Summary.Minor,
		Issues:      simplifiedIssues,
	}

	// Конвертируем упрощённый отчёт в JSON для отправки в AI
	reportJSON, err := json.Marshal(simplifiedReport)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "internal_error",
			Message: "Failed to serialize report",
		})
		return
	}

	// Генерируем резюме через AI
	summary, err := h.translator.GenerateSummary(string(reportJSON))
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "summary_generation_failed",
			Message: fmt.Sprintf("Failed to generate summary: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"job_id":  jobID,
		"url":     report.URL,
		"summary": summary,
	})
}
