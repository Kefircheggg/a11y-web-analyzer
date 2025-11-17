#!/bin/bash

# Скрипт для установки Chrome Extension

echo "🚀 Установка Accessibility Analyzer Chrome Extension..."
echo ""

# Создаем необходимые директории
echo "📁 Создание директорий..."
mkdir -p icons
mkdir -p libs/axe-core

# Скачиваем axe-core
echo "📦 Скачивание axe-core..."
curl -L https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js -o libs/axe-core/axe.min.js

if [ $? -eq 0 ]; then
    echo "✅ axe-core успешно скачан"
else
    echo "❌ Ошибка при скачивании axe-core"
    exit 1
fi

# Создаем простые иконки-заглушки (если их еще нет)
echo "🎨 Проверка иконок..."

# Для macOS можно создать простые PNG иконки с помощью sips
if command -v sips &> /dev/null; then
    if [ ! -f "icons/icon16.png" ]; then
        echo "Создание временных иконок..."
        # Создаем временный файл с цветом
        sips -z 128 128 -c 128 128 --setProperty format png --setProperty formatOptions best -s format png --out icons/icon128.png /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/BookmarkIcon.icns 2>/dev/null || echo "⚠️  Пожалуйста, добавьте иконки вручную"
        sips -z 48 48 icons/icon128.png --out icons/icon48.png 2>/dev/null
        sips -z 16 16 icons/icon128.png --out icons/icon16.png 2>/dev/null
    fi
fi

echo ""
echo "✅ Установка завершена!"
echo ""
echo "📝 Следующие шаги:"
echo "1. Откройте Chrome и перейдите на chrome://extensions/"
echo "2. Включите 'Режим разработчика' в правом верхнем углу"
echo "3. Нажмите 'Загрузить распакованное расширение'"
echo "4. Выберите папку: $(pwd)"
echo "5. Настройте URL бэкенда в background/background.js"
echo ""
echo "💡 Не забудьте добавить свои иконки в icons/ если нужно"
echo ""
