package translator

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/danil/accessibility-analyzer/internal/domain"
)

// TestProcessorWithDemoJSON проверяет, что Processor успешно строит Report по demo JSON
func TestProcessorWithDemoJSON(t *testing.T) {
	violations, err := loadDemoJSON()
	if err != nil {
		t.Fatalf("failed to load demo json: %v", err)
	}

	if len(violations) == 0 {
		t.Fatalf("expected non-empty violations slice")
	}

	aiClient := NewAIClient("") // пустой ключ → mockTranslate внутри
	processor := NewProcessor(aiClient)

	report, err := processor.ProcessViolations("https://example.com", violations, "test-job")
	if err != nil {
		t.Fatalf("processor.ProcessViolations returned error: %v", err)
	}

	if report == nil {
		t.Fatal("report is nil")
	}

	if report.URL != "https://example.com" {
		t.Errorf("unexpected report URL: %s", report.URL)
	}

	if report.ID != "test-job" {
		t.Errorf("unexpected report ID: %s", report.ID)
	}

	if report.Summary.TotalIssues == 0 {
		t.Errorf("expected non-zero TotalIssues in report summary")
	}

	if len(report.IssuesByImpact) == 0 {
		t.Errorf("expected IssuesByImpact to be non-empty")
	}

	if len(report.Recommendations) == 0 {
		t.Errorf("expected at least one recommendation")
	}
}

// TestAIClientMockTranslate убеждается, что mock режим AIClient возвращает непустой текст
func TestAIClientMockTranslate(t *testing.T) {
	c := NewAIClient("")

	out, err := c.Translate("test prompt")
	if err != nil {
		t.Fatalf("Translate returned error in mock mode: %v", err)
	}

	if out == "" {
		t.Fatalf("expected non-empty mock translation text")
	}
}

// loadDemoJSON загружает violations из demo.json
func loadDemoJSON() ([]domain.AxeViolation, error) {
	// При запуске `go test ./...` рабочая директория — `backend`, а JSON лежит в `../files/axe_response_demo.json`
	path := filepath.Join("..", "..", "testdata", "axe_response_demo.json")

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var violations []domain.AxeViolation
	if err := json.Unmarshal(data, &violations); err != nil {
		return nil, err
	}

	return violations, nil
}
