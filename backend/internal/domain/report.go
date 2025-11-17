package domain

import "time"

// Report представляет итоговый отчет о доступности
type Report struct {
	ID              string             `json:"id"`
	URL             string             `json:"url"`
	CreatedAt       time.Time          `json:"created_at"`
	Summary         ReportSummary      `json:"summary"`
	IssuesByImpact  map[string][]Issue `json:"issues_by_impact"`
	Recommendations []string           `json:"recommendations"`
}

// ReportSummary содержит общую статистику
type ReportSummary struct {
	TotalIssues  int            `json:"total_issues"`
	Critical     int            `json:"critical"`
	Serious      int            `json:"serious"`
	Moderate     int            `json:"moderate"`
	Minor        int            `json:"minor"`
	ImpactScores map[string]int `json:"impact_scores"`
}

// Issue представляет одну проблему доступности
type Issue struct {
	ID               string   `json:"id"`
	Impact           string   `json:"impact"`
	Title            string   `json:"title"`
	Description      string   `json:"description"`
	HowToFix         string   `json:"how_to_fix"`
	AffectedElements int      `json:"affected_elements"`
	Tags             []string `json:"tags"`
	HelpURL          string   `json:"help_url"`
	Examples         []string `json:"examples"`
}
