package translator

import (
	"fmt"

	"regexp"
	"strings"

	"github.com/danil/accessibility-analyzer/internal/domain"
)

// Processor обрабатывает результаты axe-core
type Processor struct {
	aiClient *AIClient
}

// NewProcessor создает новый процессор
func NewProcessor(aiClient *AIClient) *Processor {
	return &Processor{
		aiClient: aiClient,
	}
}

// ProcessViolations обрабатывает нарушения и создает отчет
func (p *Processor) ProcessViolations(url string, violations []domain.AxeViolation, jobID string) (*domain.Report, error) {
	report := &domain.Report{
		ID:             jobID,
		URL:            url,
		IssuesByImpact: make(map[string][]domain.Issue),
		Summary: domain.ReportSummary{
			ImpactScores: make(map[string]int),
		},
	}

	// Группируем проблемы по уровню важности
	impactLevels := []string{"critical", "serious", "moderate", "minor"}
	for _, level := range impactLevels {
		report.IssuesByImpact[level] = []domain.Issue{}
	}

	// Батчинг: группируем нарушения по 10 штук для обработки AI
	batchSize := 10
	batches := p.createBatches(violations, batchSize)

	// Обрабатываем каждый батч (максимум 5 запросов к AI для типичного сайта до 50 нарушений)
	for _, batch := range batches {
		// Готовим промпты для батчевой обработки в AI
		prompts := make([]string, len(batch))
		for i, violation := range batch {
			prompts[i] = fmt.Sprintf("Проблема: %s - %s", violation.ID, violation.Help)
		}

		// Отправляем батч в AI для получения улучшенных описаний (1 запрос вместо 10)
		aiDescriptions, err := p.aiClient.TranslateBatch(prompts)
		if err != nil {
			// Если AI недоступен, используем базовые переводы
			aiDescriptions = make([]string, len(batch))
			for i := range aiDescriptions {
				aiDescriptions[i] = ""
			}
		}

		// Обрабатываем нарушения из батча
		for i, violation := range batch {
			issue := p.convertViolationToIssueWithAI(violation, aiDescriptions[i])

			// Добавляем в соответствующую группу
			if _, exists := report.IssuesByImpact[violation.Impact]; !exists {
				report.IssuesByImpact[violation.Impact] = []domain.Issue{}
			}
			report.IssuesByImpact[violation.Impact] = append(report.IssuesByImpact[violation.Impact], issue)

			// Обновляем статистику
			report.Summary.TotalIssues++
			report.Summary.ImpactScores[violation.Impact]++

			switch violation.Impact {
			case "critical":
				report.Summary.Critical++
			case "serious":
				report.Summary.Serious++
			case "moderate":
				report.Summary.Moderate++
			case "minor":
				report.Summary.Minor++
			}
		}
	}

	// Генерируем общие рекомендации
	report.Recommendations = p.generateRecommendations(report)

	return report, nil
}

// createBatches разбивает нарушения на батчи для оптимизации запросов к AI
func (p *Processor) createBatches(violations []domain.AxeViolation, batchSize int) [][]domain.AxeViolation {
	var batches [][]domain.AxeViolation

	for i := 0; i < len(violations); i += batchSize {
		end := i + batchSize
		if end > len(violations) {
			end = len(violations)
		}
		batches = append(batches, violations[i:end])
	}

	return batches
}

// convertViolationToIssue конвертирует нарушение в проблему
func (p *Processor) convertViolationToIssue(violation domain.AxeViolation) domain.Issue {
	// Собираем примеры HTML
	examples := []string{}
	for i, node := range violation.Nodes {
		if i >= 3 { // Ограничиваем 3 примерами
			break
		}
		examples = append(examples, node.HTML)
	}

	// Генерируем описание на русском
	description := p.translateDescription(violation)
	howToFix := p.generateHowToFix(violation)

	// Переводим заголовок на русский
	title := p.translateTitle(violation.Help, violation.ID)

	return domain.Issue{
		ID:               violation.ID,
		Impact:           violation.Impact,
		Title:            title,
		Description:      description,
		HowToFix:         howToFix,
		AffectedElements: len(violation.Nodes),
		Tags:             violation.Tags,
		HelpURL:          violation.HelpURL,
		Examples:         examples,
	}
}

// convertViolationToIssueWithAI конвертирует нарушение в проблему с использованием AI-описания
func (p *Processor) convertViolationToIssueWithAI(violation domain.AxeViolation, aiDescription string) domain.Issue {
	// Собираем примеры HTML
	examples := []string{}
	for i, node := range violation.Nodes {
		if i >= 3 { // Ограничиваем 3 примерами
			break
		}
		examples = append(examples, node.HTML)
	}

	// Используем AI-описание, если доступно, иначе базовый перевод
	description := p.translateDescription(violation)
	howToFix := p.generateHowToFix(violation)

	if aiDescription != "" {
		// AI вернул описание, парсим его на description и howToFix
		parts := strings.Split(aiDescription, "Решение:")
		if len(parts) == 2 {
			description = p.cleanFormatting(strings.TrimSpace(parts[0]))
			howToFix = p.cleanFormatting(strings.TrimSpace(parts[1]))
		} else {
			// Если AI вернул просто текст, используем его как описание
			description = p.cleanFormatting(aiDescription)
		}
	}

	// Переводим заголовок на русский
	title := p.translateTitle(violation.Help, violation.ID)

	return domain.Issue{
		ID:               violation.ID,
		Impact:           violation.Impact,
		Title:            title,
		Description:      description,
		HowToFix:         howToFix,
		AffectedElements: len(violation.Nodes),
		Tags:             violation.Tags,
		HelpURL:          violation.HelpURL,
		Examples:         examples,
	}
}

// translateTitle переводит заголовок проблемы на русский язык
func (p *Processor) translateTitle(title string, violationID string) string {
	// Прямой перевод по ID нарушения
	titleTranslations := map[string]string{
		"aria-hidden-focus":           "ARIA-скрытые элементы не должны получать фокус",
		"button-name":                 "Кнопки должны иметь понятный текст",
		"color-contrast":              "Недостаточный контраст цвета",
		"image-alt":                   "Изображения должны иметь альтернативный текст",
		"label":                       "Элементы формы должны иметь метки",
		"link-name":                   "Ссылки должны иметь понятный текст",
		"html-has-lang":               "HTML-элемент должен иметь атрибут lang",
		"valid-lang":                  "Атрибут lang должен содержать корректное значение",
		"document-title":              "Документ должен иметь заголовок",
		"landmark-one-main":           "Страница должна содержать один главный landmark",
		"region":                      "Контент должен быть в landmark-регионах",
		"page-has-heading-one":        "Страница должна содержать заголовок первого уровня",
		"bypass":                      "Страница должна иметь возможность пропуска повторяющегося контента",
		"heading-order":               "Заголовки должны следовать в правильном порядке",
		"list":                        "Списки должны содержать только элементы li",
		"listitem":                    "Элементы списка должны быть внутри ul или ol",
		"definition-list":             "Списки определений должны быть правильно структурированы",
		"dlitem":                      "Элементы списка определений должны быть внутри dl",
		"duplicate-id":                "ID элементов должны быть уникальными",
		"duplicate-id-active":         "ID активных элементов должны быть уникальными",
		"duplicate-id-aria":           "ID элементов в ARIA должны быть уникальными",
		"form-field-multiple-labels":  "Поля формы не должны иметь несколько меток",
		"frame-title":                 "Фреймы должны иметь заголовок",
		"input-image-alt":             "Кнопки-изображения должны иметь альтернативный текст",
		"meta-refresh":                "Не используйте meta refresh",
		"meta-viewport":               "Meta viewport не должен запрещать масштабирование",
		"object-alt":                  "Object-элементы должны иметь альтернативный текст",
		"role-img-alt":                "Элементы с role=img должны иметь альтернативный текст",
		"scrollable-region-focusable": "Прокручиваемые области должны быть фокусируемыми",
		"select-name":                 "Select-элементы должны иметь доступное имя",
		"server-side-image-map":       "Серверные карты изображений не рекомендуются",
		"svg-img-alt":                 "SVG-элементы с role=img должны иметь альтернативный текст",
		"td-headers-attr":             "Ячейки таблицы с атрибутом headers должны ссылаться на существующие ячейки",
		"th-has-data-cells":           "Заголовки таблицы должны иметь связанные ячейки данных",
		"valid-aria-role":             "ARIA role должен быть корректным",
		"video-caption":               "Видео должно иметь субтитры",
		"aria-allowed-attr":           "ARIA-атрибуты должны быть разрешены для данной роли",
		"aria-required-attr":          "Обязательные ARIA-атрибуты должны присутствовать",
		"aria-valid-attr":             "ARIA-атрибуты должны быть корректными",
		"aria-valid-attr-value":       "Значения ARIA-атрибутов должны быть корректными",
	}

	if translated, exists := titleTranslations[violationID]; exists {
		return translated
	}

	// Если перевода нет, очищаем оригинальный заголовок от спецсимволов
	return p.cleanFormatting(title)
}

// cleanFormatting удаляет специальные символы форматирования из текста
func (p *Processor) cleanFormatting(text string) string {
	// Удаляем множественные звездочки (**, ***, и т.д.)
	re := regexp.MustCompile(`\*+`)
	text = re.ReplaceAllString(text, "")

	// Удаляем другие символы форматирования markdown
	re = regexp.MustCompile("[_~`#]+")
	text = re.ReplaceAllString(text, "")

	// Удаляем лишние пробелы
	text = strings.TrimSpace(text)
	re = regexp.MustCompile(`\s+`)
	text = re.ReplaceAllString(text, " ")

	return text
}

// translateDescription переводит описание проблемы
func (p *Processor) translateDescription(violation domain.AxeViolation) string {
	// Базовые переводы для популярных проблем
	translations := map[string]string{
		"aria-hidden-focus": "Элементы со скрытым ARIA не должны получать фокус или содержать элементы с фокусом",
		"button-name":       "Кнопки должны иметь понятный текст",
		"color-contrast":    "Текст должен иметь достаточный контраст с фоном",
		"image-alt":         "Изображения должны иметь альтернативный текст",
		"label":             "Поля форм должны иметь метки",
		"link-name":         "Ссылки должны иметь понятный текст",
	}

	if translated, exists := translations[violation.ID]; exists {
		return p.cleanFormatting(translated)
	}

	return p.cleanFormatting(violation.Description)
}

// generateHowToFix генерирует рекомендации по исправлению
func (p *Processor) generateHowToFix(violation domain.AxeViolation) string {
	fixes := map[string]string{
		"aria-hidden-focus": "Добавьте tabindex=\"-1\" к элементам с aria-hidden=\"true\" или удалите их из DOM.",
		"button-name":       "Добавьте текст внутрь кнопки или используйте aria-label для описания действия.",
		"color-contrast":    "Увеличьте контраст между текстом и фоном до соотношения минимум 4.5:1 для обычного текста.",
		"image-alt":         "Добавьте атрибут alt с описанием содержимого изображения.",
		"label":             "Добавьте элемент <label> с атрибутом for или оберните поле в <label>.",
		"link-name":         "Добавьте понятный текст в ссылку или используйте aria-label.",
	}

	if fix, exists := fixes[violation.ID]; exists {
		return fix
	}

	// Общие рекомендации на основе первого сообщения об ошибке
	if len(violation.Nodes) > 0 && len(violation.Nodes[0].All) > 0 {
		return violation.Nodes[0].All[0].Message
	}

	return "Изучите документацию по ссылке для получения рекомендаций по исправлению."
}

// generateRecommendations генерирует общие рекомендации
func (p *Processor) generateRecommendations(report *domain.Report) []string {
	recommendations := []string{}

	if report.Summary.Critical > 0 {
		recommendations = append(recommendations,
			fmt.Sprintf("[!] Обнаружено %d критических проблем. Рекомендуется исправить их в первую очередь.", report.Summary.Critical))
	}

	if report.Summary.Serious > 0 {
		recommendations = append(recommendations,
			fmt.Sprintf("[!!] Найдено %d серьезных проблем, которые могут значительно затруднить использование сайта.", report.Summary.Serious))
	}

	if report.Summary.TotalIssues > 10 {
		recommendations = append(recommendations,
			"[i] Рекомендуется провести комплексный аудит доступности с участием экспертов.")
	}

	// Анализируем частые типы проблем
	commonIssues := p.findCommonIssues(report)
	if len(commonIssues) > 0 {
		recommendations = append(recommendations,
			"[*] Частые проблемы: "+strings.Join(commonIssues, ", ")+". Рассмотрите возможность автоматизации проверок.")
	}

	if len(recommendations) == 0 {
		recommendations = append(recommendations, "[OK] Отличная работа! Серьезных проблем с доступностью не обнаружено.")
	}

	return recommendations
}

// findCommonIssues находит наиболее частые типы проблем
func (p *Processor) findCommonIssues(report *domain.Report) []string {
	issueCount := make(map[string]int)
	issueNames := make(map[string]string)

	for _, issues := range report.IssuesByImpact {
		for _, issue := range issues {
			issueCount[issue.ID]++
			issueNames[issue.ID] = issue.Title
		}
	}

	// Находим топ-3 проблемы
	common := []string{}
	for id, count := range issueCount {
		if count >= 2 {
			common = append(common, fmt.Sprintf("%s (%d)", issueNames[id], count))
		}
	}

	if len(common) > 3 {
		common = common[:3]
	}

	return common
}
