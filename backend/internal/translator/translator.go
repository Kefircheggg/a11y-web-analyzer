package translator

import (
	"github.com/danil/accessibility-analyzer/internal/domain"
	"github.com/danil/accessibility-analyzer/internal/service"
)

// Translator обрабатывает анализ и создает отчеты
type Translator struct {
	processor *Processor
	storage   *service.Storage
}

// NewTranslator создает новый транслятор
func NewTranslator(apiKey string, storage *service.Storage) *Translator {
	aiClient := NewAIClient(apiKey)
	processor := NewProcessor(aiClient)

	return &Translator{
		processor: processor,
		storage:   storage,
	}
}

// ProcessAnalysis обрабатывает анализ асинхронно
func (t *Translator) ProcessAnalysis(job *service.Job, violations []domain.AxeViolation) {
	go func() {
		// Обновляем статус
		job.UpdateStatus(service.StatusProcessing)
		job.SetProgress(10)
		t.storage.SaveJob(job)

		// Обрабатываем нарушения
		job.SetProgress(50)
		t.storage.SaveJob(job)

		report, err := t.processor.ProcessViolations(job.URL, violations, job.ID)
		if err != nil {
			job.SetError(err.Error())
			t.storage.SaveJob(job)
			return
		}

		// Сохраняем отчет
		job.SetProgress(90)
		t.storage.SaveJob(job)

		if err := t.storage.SaveReport(report); err != nil {
			job.SetError(err.Error())
			t.storage.SaveJob(job)
			return
		}

		// Завершаем задачу
		job.UpdateStatus(service.StatusCompleted)
		job.SetProgress(100)
		t.storage.SaveJob(job)
	}()
}

// GenerateSummary генерирует комплексное резюме по отчёту через AI
func (t *Translator) GenerateSummary(reportJSON string) (string, error) {
	return t.processor.aiClient.GenerateSummary(reportJSON)
}
