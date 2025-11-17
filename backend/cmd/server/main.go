package main

import (
	"fmt"
	"log"

	"github.com/danil/accessibility-analyzer/internal/api"
	"github.com/danil/accessibility-analyzer/internal/config"
	"github.com/danil/accessibility-analyzer/internal/service"
	"github.com/danil/accessibility-analyzer/internal/translator"
)

func main() {
	// Загружаем конфигурацию
	cfg := config.Load()

	// Инициализируем хранилище
	storage := service.NewStorage()

	// Инициализируем транслятор
	trans := translator.NewTranslator(cfg.OpenAIKey, storage)

	// Инициализируем обработчик
	handler := api.NewHandler(storage, trans)

	// Настраиваем роутер
	router := api.SetupRouter(handler, cfg.GinMode)

	// Запускаем сервер
	addr := fmt.Sprintf(":%s", cfg.ServerPort)
	log.Printf("Starting server on %s", addr)
	log.Printf("GinMode: %s", cfg.GinMode)

	if cfg.OpenAIKey == "" {
		log.Println("⚠️  OPENAI_API_KEY не установлен. Работа в демо-режиме.")
	} else {
		log.Println("✅ OpenAI API настроен")
	}

	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
