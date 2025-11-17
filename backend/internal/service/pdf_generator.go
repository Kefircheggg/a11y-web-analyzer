package service

import (
	"fmt"
	"time"

	"github.com/danil/accessibility-analyzer/internal/domain"
	"github.com/jung-kurt/gofpdf"
)

// PDFGenerator генерирует PDF-отчёты
type PDFGenerator struct {
	tr func(string) string
}

// NewPDFGenerator создаёт новый генератор PDF
func NewPDFGenerator() *PDFGenerator {
	return &PDFGenerator{}
}

// GenerateReport создаёт PDF-отчёт из данных Report
func (g *PDFGenerator) GenerateReport(report *domain.Report) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(true, 20)

	// Добавляем шрифты DejaVu Sans с поддержкой кириллицы
	pdf.AddUTF8Font("DejaVu", "", "fonts/DejaVuSans.ttf")
	pdf.AddUTF8Font("DejaVu", "B", "fonts/DejaVuSans-Bold.ttf")
	pdf.AddUTF8Font("DejaVu", "I", "fonts/DejaVuSans-Oblique.ttf")
	pdf.AddUTF8Font("DejaVu", "BI", "fonts/DejaVuSans-BoldOblique.ttf")
	pdf.AddUTF8Font("DejaVuMono", "", "fonts/DejaVuSansMono.ttf")
	pdf.AddUTF8Font("DejaVuMono", "B", "fonts/DejaVuSansMono-Bold.ttf")

	// Устанавливаем UTF-8 транслятор (теперь не нужен, т.к. используем UTF-8 шрифты)
	g.tr = func(s string) string { return s }

	// Добавляем первую страницу
	pdf.AddPage()

	// Заголовок отчёта
	g.addHeader(pdf, report)

	// Сводка (Summary)
	g.addSummary(pdf, report)

	// Рекомендации
	g.addRecommendations(pdf, report)

	// Детальные проблемы по категориям
	g.addIssuesByImpact(pdf, report)

	// Футер с датой генерации
	g.addFooter(pdf)

	// Генерируем PDF в память
	var buf []byte
	w := &bytesBuffer{buf: &buf}
	err := pdf.Output(w)
	if err != nil {
		return nil, fmt.Errorf("failed to generate PDF: %w", err)
	}

	return buf, nil
}

// bytesBuffer - обёртка для записи PDF в []byte
type bytesBuffer struct {
	buf *[]byte
}

func (b *bytesBuffer) Write(p []byte) (n int, err error) {
	*b.buf = append(*b.buf, p...)
	return len(p), nil
}

// addHeader добавляет заголовок отчёта
func (g *PDFGenerator) addHeader(pdf *gofpdf.Fpdf, report *domain.Report) {
	// Заголовок
	pdf.SetFont("DejaVu", "B", 24)
	pdf.SetTextColor(31, 115, 232) // Синий цвет
	pdf.CellFormat(0, 15, g.tr("Отчёт о доступности"), "", 1, "C", false, 0, "")

	pdf.Ln(5)

	// URL сайта
	pdf.SetFont("DejaVu", "", 12)
	pdf.SetTextColor(100, 100, 100)
	pdf.CellFormat(0, 8, g.tr(fmt.Sprintf("URL: %s", report.URL)), "", 1, "C", false, 0, "")

	// Дата создания
	createdAt := report.CreatedAt.Format("02.01.2006 15:04")
	pdf.CellFormat(0, 8, g.tr(fmt.Sprintf("Дата анализа: %s", createdAt)), "", 1, "C", false, 0, "")

	pdf.Ln(10)
}

// addSummary добавляет сводку
func (g *PDFGenerator) addSummary(pdf *gofpdf.Fpdf, report *domain.Report) {
	pdf.SetFont("DejaVu", "B", 16)
	pdf.SetTextColor(0, 0, 0)
	pdf.CellFormat(0, 10, g.tr("Сводка"), "", 1, "L", false, 0, "")
	pdf.Ln(3)

	// Рисуем карточки со статистикой
	cardWidth := 40.0
	cardHeight := 25.0
	spacing := 5.0

	stats := []struct {
		label string
		count int
		color []int
	}{
		{"Критических", report.Summary.Critical, []int{220, 53, 69}}, // Красный
		{"Серьёзных", report.Summary.Serious, []int{255, 152, 0}},    // Оранжевый
		{"Умеренных", report.Summary.Moderate, []int{255, 193, 7}},   // Жёлтый
		{"Незначительных", report.Summary.Minor, []int{76, 175, 80}}, // Зелёный
	}

	x := pdf.GetX()
	y := pdf.GetY()

	for i, stat := range stats {
		if i > 0 && i%4 == 0 {
			y += cardHeight + spacing
			x = pdf.GetX()
		}

		pdf.SetXY(x, y)

		// Рамка карточки
		pdf.SetFillColor(stat.color[0], stat.color[1], stat.color[2])
		pdf.Rect(x, y, cardWidth, cardHeight, "F")

		// Число
		pdf.SetXY(x, y+5)
		pdf.SetFont("DejaVu", "B", 20)
		pdf.SetTextColor(255, 255, 255)
		pdf.CellFormat(cardWidth, 8, fmt.Sprintf("%d", stat.count), "", 1, "C", false, 0, "")

		// Метка
		pdf.SetXY(x, y+15)
		pdf.SetFont("DejaVu", "", 10)
		pdf.SetTextColor(255, 255, 255)
		pdf.CellFormat(cardWidth, 5, g.tr(stat.label), "", 1, "C", false, 0, "")

		x += cardWidth + spacing
	}

	pdf.SetY(y + cardHeight + 10)
	pdf.SetTextColor(0, 0, 0)

	// Общее количество проблем
	pdf.SetFont("DejaVu", "B", 14)
	pdf.CellFormat(0, 8, g.tr(fmt.Sprintf("Всего проблем: %d", report.Summary.TotalIssues)), "", 1, "L", false, 0, "")
	pdf.Ln(5)
}

// addRecommendations добавляет рекомендации
func (g *PDFGenerator) addRecommendations(pdf *gofpdf.Fpdf, report *domain.Report) {
	if len(report.Recommendations) == 0 {
		return
	}

	pdf.SetFont("DejaVu", "B", 16)
	pdf.SetTextColor(0, 0, 0)
	pdf.CellFormat(0, 10, g.tr("Рекомендации"), "", 1, "L", false, 0, "")
	pdf.Ln(3)

	pdf.SetFont("DejaVu", "", 11)
	pdf.SetTextColor(60, 60, 60)

	for i, rec := range report.Recommendations {
		// Маркер
		pdf.SetX(20)
		pdf.SetFont("DejaVu", "B", 11)
		pdf.Cell(5, 6, fmt.Sprintf("%d.", i+1))

		// Текст рекомендации
		pdf.SetFont("DejaVu", "", 11)
		pdf.SetX(27)
		pdf.MultiCell(0, 6, g.tr(rec), "", "L", false)
		pdf.Ln(2)
	}

	pdf.Ln(5)
}

// addIssuesByImpact добавляет детальные проблемы по категориям
func (g *PDFGenerator) addIssuesByImpact(pdf *gofpdf.Fpdf, report *domain.Report) {
	impacts := []struct {
		key   string
		title string
		emoji string
		color []int
	}{
		{"critical", "Критические проблемы", "[!]", []int{220, 53, 69}},
		{"serious", "Серьёзные проблемы", "[*]", []int{255, 152, 0}},
		{"moderate", "Умеренные проблемы", "[~]", []int{255, 193, 7}},
		{"minor", "Незначительные проблемы", "[+]", []int{76, 175, 80}},
	}

	for _, impact := range impacts {
		issues := report.IssuesByImpact[impact.key]
		if len(issues) == 0 {
			continue
		}

		// Добавляем новую страницу для каждой категории
		pdf.AddPage()

		// Заголовок категории
		pdf.SetFont("DejaVu", "B", 16)
		pdf.SetTextColor(impact.color[0], impact.color[1], impact.color[2])
		pdf.CellFormat(0, 10, g.tr(fmt.Sprintf("%s %s (%d)", impact.emoji, impact.title, len(issues))), "", 1, "L", false, 0, "")
		pdf.Ln(5)

		// Проблемы
		for i, issue := range issues {
			if i > 0 {
				pdf.Ln(5)
			}

			g.addIssueCard(pdf, issue, i+1)

			// Проверка на конец страницы
			if pdf.GetY() > 250 {
				pdf.AddPage()
			}
		}
	}
}

// addIssueCard добавляет карточку проблемы
func (g *PDFGenerator) addIssueCard(pdf *gofpdf.Fpdf, issue domain.Issue, number int) {
	// Рамка карточки
	x := pdf.GetX()
	y := pdf.GetY()

	pdf.SetFillColor(245, 245, 245)
	pdf.Rect(x, y, 180, 0, "F") // Высота будет определена содержимым

	// Номер и заголовок
	pdf.SetFont("DejaVu", "B", 12)
	pdf.SetTextColor(0, 0, 0)
	pdf.CellFormat(0, 7, g.tr(fmt.Sprintf("%d. %s", number, issue.Title)), "", 1, "L", false, 0, "")
	pdf.Ln(2)

	// ID правила
	pdf.SetFont("DejaVu", "I", 9)
	pdf.SetTextColor(100, 100, 100)
	pdf.CellFormat(0, 5, g.tr(fmt.Sprintf("ID: %s", issue.ID)), "", 1, "L", false, 0, "")
	pdf.Ln(2)

	// Описание
	pdf.SetFont("DejaVu", "", 10)
	pdf.SetTextColor(60, 60, 60)
	pdf.MultiCell(0, 5, g.tr(fmt.Sprintf("Описание: %s", issue.Description)), "", "L", false)
	pdf.Ln(1)

	// Как исправить
	pdf.SetFont("DejaVu", "B", 10)
	pdf.SetTextColor(0, 0, 0)
	pdf.Cell(0, 5, g.tr("Как исправить:"))
	pdf.Ln(5)

	pdf.SetFont("DejaVu", "", 10)
	pdf.SetTextColor(60, 60, 60)
	pdf.MultiCell(0, 5, g.tr(issue.HowToFix), "", "L", false)
	pdf.Ln(1)

	// Затронуто элементов
	pdf.SetFont("DejaVu", "", 9)
	pdf.SetTextColor(100, 100, 100)
	pdf.CellFormat(0, 5, g.tr(fmt.Sprintf("Затронуто элементов: %d", issue.AffectedElements)), "", 1, "L", false, 0, "")

	// Примеры (если есть)
	if len(issue.Examples) > 0 {
		pdf.Ln(2)
		pdf.SetFont("DejaVu", "B", 9)
		pdf.SetTextColor(0, 0, 0)
		pdf.Cell(0, 5, g.tr("Примеры HTML:"))
		pdf.Ln(5)

		pdf.SetFont("DejaVuMono", "", 8)
		pdf.SetTextColor(80, 80, 80)

		for _, example := range issue.Examples {
			if len(example) > 100 {
				example = example[:100] + "..."
			}
			pdf.MultiCell(0, 4, g.tr(example), "", "L", false)
			pdf.Ln(1)
		}
	}

	pdf.Ln(3)
}

// addFooter добавляет футер
func (g *PDFGenerator) addFooter(pdf *gofpdf.Fpdf) {
	pdf.SetY(-15)
	pdf.SetFont("DejaVu", "I", 8)
	pdf.SetTextColor(150, 150, 150)
	pdf.CellFormat(0, 10, g.tr(fmt.Sprintf("Сгенерировано %s | Accessibility Analyzer", time.Now().Format("02.01.2006 15:04"))), "", 0, "C", false, 0, "")
}
