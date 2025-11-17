package translator

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
)

// AIClient представляет клиент для работы с AI API (Groq для Qwen)
type AIClient struct {
	apiKey     string
	httpClient *http.Client
	apiURL     string
}

// NewAIClient создает новый клиент AI
func NewAIClient(apiKey string) *AIClient {
	return &AIClient{
		apiKey:     apiKey,
		httpClient: &http.Client{},
		apiURL:     "https://api.groq.com/openai/v1/chat/completions",
	}
}

// OpenAIRequest представляет запрос к OpenAI
type OpenAIRequest struct {
	Model     string    `json:"model"`
	Messages  []Message `json:"messages"`
	MaxTokens int       `json:"max_tokens,omitempty"`
}

// Message представляет сообщение в чате
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// OpenAIResponse представляет ответ от OpenAI
type OpenAIResponse struct {
	Choices []Choice  `json:"choices"`
	Error   *APIError `json:"error,omitempty"`
}

// Choice представляет вариант ответа
type Choice struct {
	Message Message `json:"message"`
}

// APIError представляет ошибку API
type APIError struct {
	Message string `json:"message"`
	Type    string `json:"type"`
}

// Translate отправляет запрос к AI для перевода
func (c *AIClient) Translate(prompt string) (string, error) {
	// Если API ключ не настроен, возвращаем заглушку
	if c.apiKey == "" {
		return c.mockTranslate(prompt), nil
	}

	// Добавляем строгие инструкции к пользовательскому промпту, чтобы исключить
	// использование Markdown/выделения через звездочки и получить предсказуемый
	// plain-text ответ.
	finalPrompt := "Переведи и объясни проблему доступа. Ответ строго на русском языке. " +
		"Формат ответа: краткий чистый текст. НЕЛЬЗЯ использовать Markdown, звёздочки (* или **), " +
		"подчёркивания (_), обратные кавычки, тильды или HTML-теги. Если нужно выделить, " +
		"используй ПРОПИСНЫЕ БУКВЫ или метки в квадратных скобках, например [ВАЖНО]. " +
		"Начинай ответ по делу и коротко.\n\n" + prompt

	reqBody := OpenAIRequest{
		Model: "qwen/qwen3-32b",
		Messages: []Message{
			{
				Role:    "system",
				Content: "Ты эксперт по веб-доступности. Переводи технические описания проблем доступности на русский язык и давай практические рекомендации по исправлению.",
			},
			{
				Role:    "user",
				Content: finalPrompt,
			},
		},
		MaxTokens: 1500,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	log.Printf("[AI] Sending request to %s with model %s, prompt length: %d chars", c.apiURL, reqBody.Model, len(prompt))

	req, err := http.NewRequest("POST", c.apiURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	var openAIResp OpenAIResponse
	if err := json.Unmarshal(body, &openAIResp); err != nil {
		return "", fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if openAIResp.Error != nil {
		log.Printf("[AI] API error: %s", openAIResp.Error.Message)
		return "", fmt.Errorf("OpenAI API error: %s", openAIResp.Error.Message)
	}

	if len(openAIResp.Choices) == 0 {
		log.Printf("[AI] No choices in response")
		return "", fmt.Errorf("no response from OpenAI")
	}

	responseText := openAIResp.Choices[0].Message.Content
	log.Printf("[AI] Received response, length: %d chars", len(responseText))
	log.Printf("[AI] Response text:\n%s", responseText)

	// Убираем теги <think> из ответа
	responseText = removeThinkTags(responseText)

	return responseText, nil
}

// mockTranslate возвращает заглушку для демонстрации без API ключа
func (c *AIClient) mockTranslate(prompt string) string {
	return "Это демо-режим. Для полноценной работы с AI установите OPENAI_API_KEY. " +
		"Проблема требует внимания и исправления согласно стандартам WCAG 2.1."
}

// TranslateBatch обрабатывает несколько нарушений в одном запросе к AI
// Это позволяет сократить количество запросов с ~50 до 5 для типичного сайта
func (c *AIClient) TranslateBatch(violations []string) ([]string, error) {
	if len(violations) == 0 {
		return []string{}, nil
	}

	// Если API ключ не настроен, возвращаем заглушки
	if c.apiKey == "" {
		results := make([]string, len(violations))
		for i := range violations {
			results[i] = c.mockTranslate(violations[i])
		}
		return results, nil
	}

	// Формируем промпт с несколькими нарушениями
	// Строгие инструкции для пакетной обработки: явный запрет на любую разметку/выделение
	// и требование формата для надёжного парсинга.
	prompt := fmt.Sprintf(`Переведи и объясни следующие %d проблем доступности веб-сайта.
Требования к ответу:
- Язык: русский.
- Формат: пронумерованный список (1., 2., ...). Для каждой проблемы: сначала краткое описание, затем строка "Решение: <текст>".
- Ответ должен быть ЧИСТЫМ ТЕКСТОМ. Категорически НЕЛЬЗЯ использовать Markdown или символы/теги разметки: звёздочки (* или **), подчёркивания (_), обратные кавычки, тильды (~) или HTML-теги.
- Не используйте кавычки или другие символы для выделения. Для акцентов используйте ПРОПИСНЫЕ БУКВЫ или метки в квадратных скобках, например [ВАЖНО].
Начинайте каждый пункт как "1. <описание>\n   Решение: <текст>".
Проблемы:
`, len(violations))

	for i, v := range violations {
		prompt += fmt.Sprintf("\n%d. %s", i+1, v)
	}

	reqBody := OpenAIRequest{
		Model: "qwen/qwen3-32b",
		Messages: []Message{
			{
				Role:    "system",
				Content: "Ты эксперт по веб-доступности. Переводи технические описания проблем доступности на русский язык и давай практические рекомендации по исправлению.",
			},
			{
				Role:    "user",
				Content: prompt,
			},
		},
		MaxTokens: 2000,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	log.Printf("[AI] Sending batch request with %d violations, model: %s", len(violations), reqBody.Model)

	req, err := http.NewRequest("POST", c.apiURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var openAIResp OpenAIResponse
	if err := json.Unmarshal(body, &openAIResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if openAIResp.Error != nil {
		log.Printf("[AI] Batch API error: %s", openAIResp.Error.Message)
		return nil, fmt.Errorf("OpenAI API error: %s", openAIResp.Error.Message)
	}

	if len(openAIResp.Choices) == 0 {
		log.Printf("[AI] No choices in batch response")
		return nil, fmt.Errorf("no response from OpenAI")
	}

	// Парсим ответ AI и разбиваем на отдельные рекомендации
	content := openAIResp.Choices[0].Message.Content
	log.Printf("[AI] Received batch response, content length: %d chars", len(content))
	log.Printf("[AI] Batch response text:\n%s", content)

	// Убираем теги <think> из ответа
	content = removeThinkTags(content)

	results := c.parseBatchResponse(content, len(violations))
	log.Printf("[AI] Parsed %d results from batch response", len(results))

	return results, nil
}

// parseBatchResponse парсит ответ AI и извлекает рекомендации для каждого нарушения
func (c *AIClient) parseBatchResponse(content string, expectedCount int) []string {
	// Простой парсинг по номерам: "1. ", "2. ", и т.д.
	results := make([]string, expectedCount)
	lines := strings.Split(content, "\n")

	currentIndex := -1
	var currentText strings.Builder

	for _, line := range lines {
		// Проверяем, начинается ли строка с номера
		for i := 1; i <= expectedCount; i++ {
			prefix := fmt.Sprintf("%d.", i)
			if strings.HasPrefix(strings.TrimSpace(line), prefix) {
				// Сохраняем предыдущий текст
				if currentIndex >= 0 && currentIndex < expectedCount {
					results[currentIndex] = strings.TrimSpace(currentText.String())
				}
				// Начинаем новый блок
				currentIndex = i - 1
				currentText.Reset()
				// Добавляем текст после номера
				text := strings.TrimPrefix(strings.TrimSpace(line), prefix)
				currentText.WriteString(strings.TrimSpace(text))
				goto nextLine
			}
		}
		// Если не нашли номер, добавляем к текущему блоку
		if currentIndex >= 0 {
			currentText.WriteString(" ")
			currentText.WriteString(strings.TrimSpace(line))
		}
	nextLine:
	}

	// Сохраняем последний блок
	if currentIndex >= 0 && currentIndex < expectedCount {
		results[currentIndex] = strings.TrimSpace(currentText.String())
	}

	// Заполняем пустые значения заглушками
	for i := range results {
		if results[i] == "" {
			results[i] = "Требует внимания и исправления согласно стандартам WCAG 2.1."
		}
	}

	return results
}

// GenerateSummary генерирует общее резюме с комплексными рекомендациями по всему отчёту
func (c *AIClient) GenerateSummary(reportJSON string) (string, error) {
	// Если API ключ не настроен, возвращаем заглушку
	if c.apiKey == "" {
		return "Это демо-режим. Для получения комплексных рекомендаций установите OPENAI_API_KEY.", nil
	}

	prompt := fmt.Sprintf(`Проанализируй следующий отчёт о доступности веб-сайта и составь комплексное резюме.

Отчёт:
%s

Твоя задача:
1. Проанализировать все проблемы доступности на сайте
2. Выявить основные категории проблем
3. Дать рекомендации по дальнейшему поддержанию доступности

Формат ответа:
- Общая оценка доступности сайта
- Основные проблемы
- Рекомендации по поддержке

ТРЕБОВАНИЯ К ФОРМАТУ:
- Ответ должен быть на русском языке, структурированным и практичным
- Ответ должен быть ЧИСТЫМ ТЕКСТОМ без разметки
- КАТЕГОРИЧЕСКИ НЕЛЬЗЯ использовать Markdown или символы разметки: звёздочки (* или **), подчёркивания (_), обратные кавычки, тильды (~) или HTML-теги
- Не используйте кавычки или другие символы для выделения
- Для акцентов и заголовков используйте ПРОПИСНЫЕ БУКВЫ или метки в квадратных скобках, например [ВАЖНО], [ПРИОРИТЕТ 1]
- Используйте простые списки с дефисами или нумерацией (1., 2., 3.)`, reportJSON)

	reqBody := OpenAIRequest{
		Model: "qwen/qwen3-32b",
		Messages: []Message{
			{
				Role:    "system",
				Content: "Ты эксперт по веб-доступности и стандартам WCAG. Ты анализируешь отчёты о доступности и даёшь комплексные практические рекомендации по улучшению сайтов.",
			},
			{
				Role:    "user",
				Content: prompt,
			},
		},
		MaxTokens: 2500,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	log.Printf("[AI] Generating summary for report, model: %s", reqBody.Model)

	req, err := http.NewRequest("POST", c.apiURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	var openAIResp OpenAIResponse
	if err := json.Unmarshal(body, &openAIResp); err != nil {
		return "", fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if openAIResp.Error != nil {
		log.Printf("[AI] Summary API error: %s", openAIResp.Error.Message)
		return "", fmt.Errorf("OpenAI API error: %s", openAIResp.Error.Message)
	}

	if len(openAIResp.Choices) == 0 {
		log.Printf("[AI] No choices in summary response")
		return "", fmt.Errorf("no response from OpenAI")
	}

	summary := openAIResp.Choices[0].Message.Content
	log.Printf("[AI] Generated summary, length: %d chars", len(summary))

	// Убираем теги <think> из ответа
	summary = removeThinkTags(summary)

	return summary, nil
}

// removeThinkTags удаляет теги <think> и </think> вместе с содержимым из текста
func removeThinkTags(text string) string {
	// Удаляем все блоки <think>...</think>
	for {
		startIdx := strings.Index(text, "<think>")
		if startIdx == -1 {
			break
		}
		endIdx := strings.Index(text[startIdx:], "</think>")
		if endIdx == -1 {
			// Если нет закрывающего тега, удаляем до конца
			text = text[:startIdx]
			break
		}
		endIdx += startIdx + len("</think>")
		text = text[:startIdx] + text[endIdx:]
	}

	// Убираем лишние пробелы и переносы строк
	text = strings.TrimSpace(text)

	return text
}
