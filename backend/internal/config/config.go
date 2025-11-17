package config

import (
	"os"
	"strconv"
)

// Config содержит конфигурацию приложения
type Config struct {
	ServerPort string
	GinMode    string
	OpenAIKey  string
}

// Load загружает конфигурацию из переменных окружения
func Load() *Config {
	cfg := &Config{
		ServerPort: getEnvWithFallback("PORT", "SERVER_PORT", "3001"),
		GinMode:    getEnv("GIN_MODE", "release"),
		OpenAIKey:  getEnv("OPENAI_API_KEY", ""),
	}

	return cfg
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvWithFallback пробует получить значение из primary, если нет - из fallback, если нет - defaultValue
func getEnvWithFallback(primary, fallback, defaultValue string) string {
	if value := os.Getenv(primary); value != "" {
		return value
	}
	if value := os.Getenv(fallback); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	valueStr := getEnv(key, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}
