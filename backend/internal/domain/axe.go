package domain

// AxeViolation представляет одну проблему доступности из axe-core
type AxeViolation struct {
	ID          string    `json:"id"`
	Impact      string    `json:"impact"`
	Tags        []string  `json:"tags"`
	Description string    `json:"description"`
	Help        string    `json:"help"`
	HelpURL     string    `json:"helpUrl"`
	Nodes       []AxeNode `json:"nodes"`
}

// AxeNode представляет конкретный элемент с проблемой
type AxeNode struct {
	Any            []AxeCheck `json:"any"`
	All            []AxeCheck `json:"all"`
	None           []AxeCheck `json:"none"`
	Impact         string     `json:"impact"`
	HTML           string     `json:"html"`
	Target         []string   `json:"target"`
	FailureSummary string     `json:"failureSummary"`
}

// AxeCheck представляет результат проверки правила
type AxeCheck struct {
	ID           string       `json:"id"`
	Data         interface{}  `json:"data"`
	RelatedNodes []AxeRelated `json:"relatedNodes"`
	Impact       string       `json:"impact"`
	Message      string       `json:"message"`
}

// AxeRelated представляет связанный элемент
type AxeRelated struct {
	HTML   string   `json:"html"`
	Target []string `json:"target"`
}

// AnalysisRequest представляет запрос на анализ
type AnalysisRequest struct {
	URL        string         `json:"url" binding:"required"`
	Violations []AxeViolation `json:"violations" binding:"required"`
}
