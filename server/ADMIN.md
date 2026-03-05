# Управление лицензиями

## Генерация ключа

```bash
# Формат: RKL-XXXX-XXXX-XXXX (19 символов)
# Без перезапуска сервера — работает через API

ADMIN_SECRET=$(grep ADMIN_SECRET .env | cut -d= -f2)

# Генерация ключа (план: trial, start, business, corp)
curl -s https://alexbottest.ru/api/admin/gen-key \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -d '{"plan":"start"}' | python3 -m json.tool

# С кастомным сроком (в днях)
curl -s https://alexbottest.ru/api/admin/gen-key \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -d '{"plan":"trial", "days": 30}' | python3 -m json.tool
```

## Тарифы

| План     | Лимит/мес | Срок по умолчанию |
|----------|-----------|-------------------|
| trial    | 50        | 14 дней           |
| start    | 300       | 365 дней          |
| business | 1000      | 365 дней          |
| corp     | 5000      | 365 дней          |

## Просмотр всех ключей

```bash
curl -s https://alexbottest.ru/api/admin/keys \
  -H "Authorization: Bearer $ADMIN_SECRET" | python3 -m json.tool
```

## Изменение ключа

```bash
# Сбросить счётчик и изменить лимит
curl -s https://alexbottest.ru/api/admin/update-key \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -d '{"key":"TRIAL-TEST-0001", "limit":1000, "used":0}' | python3 -m json.tool

# Только сбросить счётчик
curl -s https://alexbottest.ru/api/admin/update-key \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -d '{"key":"RKL-XXXX-XXXX-XXXX", "used":0}' | python3 -m json.tool

# Деактивировать ключ
curl -s https://alexbottest.ru/api/admin/update-key \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -d '{"key":"RKL-XXXX-XXXX-XXXX", "active":false}' | python3 -m json.tool
```

Параметры: `limit` (лимит/мес), `used` (счётчик), `active` (true/false).

## Локальная генерация (альтернатива, требует остановки Docker)

```bash
cd server
npm run gen-key -- start        # start 300/мес, 365 дней
npm run gen-key -- business 30  # business 1000/мес, 30 дней
```
