# Multi-stage build для оптимизации размера образа

# Stage 1: Сборка приложения
FROM golang:1.21-alpine AS builder

# Установка необходимых инструментов
RUN apk add --no-cache git ca-certificates

# Рабочая директория
WORKDIR /app

# Копируем go.mod и go.sum для кеширования зависимостей
COPY go.mod go.sum ./
RUN go mod download

# Копируем весь исходный код
COPY . .

# Собираем приложение
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -installsuffix cgo -o server ./cmd/server

# Stage 2: Финальный образ
FROM alpine:latest

# Установка необходимых runtime зависимостей
RUN apk --no-cache add ca-certificates tzdata

# Создаем непривилегированного пользователя
RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser

WORKDIR /app

# Копируем скомпилированный бинарник из builder
COPY --from=builder /app/server .

# Копируем шрифты для PDF генерации
COPY --from=builder /app/fonts ./fonts

# Создаем директории для данных
RUN mkdir -p /app/data /app/reports && \
    chown -R appuser:appuser /app

# Переключаемся на непривилегированного пользователя
USER appuser

# Открываем порт (по умолчанию 3001)
EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Запуск приложения
CMD ["./server"]
