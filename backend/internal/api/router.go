package api

import (
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// SetupRouter настраивает роутинг для API
func SetupRouter(handler *Handler, ginMode string) *gin.Engine {
	gin.SetMode(ginMode)

	router := gin.New()
	router.Use(gin.Recovery())

	// CORS
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Health check
	router.GET("/health", handler.HealthCheck)

	// API v1
	v1 := router.Group("/api/v1")
	{
		// POST /api/v1/analyze - создать задачу анализа
		v1.POST("/analyze", handler.CreateAnalysis)

		// GET /api/v1/jobs/:id - получить статус задачи
		v1.GET("/jobs/:id", handler.GetJobStatus)

		// GET /api/v1/jobs/:id/report - получить готовый отчет
		v1.GET("/jobs/:id/report", handler.GetReport)

		// GET /api/v1/jobs/:id/report/pdf - скачать отчет в PDF
		v1.GET("/jobs/:id/report/pdf", handler.GetReportPDF)

		// GET /api/v1/jobs/:id/report/summary - получить комплексное резюме с рекомендациями
		v1.GET("/jobs/:id/report/summary", handler.GetReportSummary)

		// DELETE /api/v1/jobs/:id - удалить задачу
		v1.DELETE("/jobs/:id", handler.DeleteJob)
	}

	return router
}
