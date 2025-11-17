# Accessibility Analyzer - Backend

Backend сервер для анализа доступности веб-сайтов.

## Требования

- Go 1.21+
- Docker и Docker Compose (для контейнеризации)

## Быстрый старт

### Запуск с Docker Compose

```bash
# Создать .env файл (опционально)
cp .env.example .env
# Добавить OPENAI_API_KEY в .env если нужен AI-перевод

# Запустить сервер
docker-compose up -d

# Проверить логи
docker-compose logs -f

# Остановить
docker-compose down
```

### Локальный запуск (без Docker)

```bash
# Установить зависимости
go mod download

# Запустить сервер
go run ./cmd/server/main.go

# Или собрать и запустить
go build -o server ./cmd/server
./server
```

## Конфигурация

Переменные окружения:
- `PORT` - порт сервера (по умолчанию: 3001)
- `GIN_MODE` - режим Gin (release/debug)
- `OPENAI_API_KEY` - API ключ для AI-перевода (опционально)

## API

### Основные эндпоинты
- `POST /api/v1/analyze` - Запуск анализа доступности
- `GET /api/v1/status/:task_id` - Получение статуса задачи
- `GET /api/v1/report/:report_id` - Получение полного отчета
- `GET /api/v1/report/:report_id/pdf` - Скачивание PDF-отчета
- `GET /api/v1/health` - Проверка состояния сервиса

Подробная документация по всем эндпоинтам находится в корневом файле [API.md](../API.md).

## Разработка

```bash
# Запустить тесты
go test ./...

# Запустить с hot-reload (требует air)
air

# Проверить код
go vet ./...
go fmt ./...
```

## Структура проекта

```
backend/
├── cmd/
│   └── server/       # Точка входа приложения
├── internal/
│   ├── api/          # HTTP handlers и routes
│   ├── config/       # Конфигурация
│   ├── domain/       # Domain модели
│   ├── service/      # Бизнес-логика
│   └── translator/   # AI-переводчик
├── fonts/            # Шрифты для PDF
├── testdata/         # Тестовые данные
├── Dockerfile        # Docker образ
├── docker-compose.yml # Docker Compose конфигурация
├── .dockerignore     # Игнорируемые файлы для Docker
└── go.mod            # Go модули
```
