---
id: doctor-summary-agent
type: agent_spec
status: active
updated: 2026-05-06
---

# Doctor Summary Agent / агент сводок врачу

Read-only агент для быстрых markdown-сводок врачу.

## Что делает

- Собирает сводки по человеку и врачебному направлению.
- Читает только уже внесённые `medical_event` и `person_profile`.
- Генерирует markdown в `05 Индексы/Сводки врачу/`.
- Генерирует JSON для сайта в `09 Наблюдение/doctor-summaries.json`.
- Подключён к `prebuild`, поэтому при публикации сайта сводки обновляются автоматически.
- Не меняет медицинские события, профили и документы-источники.
- Не ставит диагнозы и не добавляет новые медицинские рекомендации.

## Где смотреть

- В Obsidian: `05 Индексы/Сводки врачу/`.
- На сайте: `/doctor-summaries`.

## Команды

```powershell
cd "06 Сайт"
npm run agent:doctor-summaries
```

```powershell
cd "06 Сайт"
npm run build
```
