# Як викласти сайт на Vercel (безкоштовно, пряме посилання)

Сайт — статичний (HTML/CSS/JS) + Firebase. Збірка не потрібна. Vercel дасть пряме
посилання типу `https://boxing-booking.vercel.app` і автоматично оновлюватиме сайт
щоразу, коли ти робиш `git push`.

> Один раз ти маєш зайти у свій акаунт Vercel — це єдиний крок, який я не можу зробити
> за тебе. Далі все автоматично.

---

## Крок 0 (один раз) — онови правила Firebase

Це треба, щоб працювали записи, відгуки **і зміна порядку відгуків**.

1. Відкрий: https://console.firebase.google.com/project/boxing-booking-17e44/firestore/rules
2. Зітри все й встав вміст із файлу `firestore.rules` (або з `ВІДГУКИ-ПОЧИНАЮТЬ-ПРАЦЮВАТИ.md`).
3. Натисни **Publish**.

---

## Крок 1 — залий код на GitHub

У теці проєкту (`C:\Users\Admin\boxing-booking`) у терміналі:

```
git add -A
git commit -m "Розклад в адмінці, ручні записи, керування відгуками, Vercel"
git push
```

---

## Крок 2 — підключи репозиторій до Vercel

1. Відкрий https://vercel.com і натисни **Sign Up** / **Log In** → **Continue with GitHub**
   (увійди тим самим GitHub, де лежить `boxing-booking`).
2. На головній натисни **Add New… → Project**.
3. У списку репозиторіїв знайди **`boxing-booking`** → **Import**.
4. Нічого не міняй у налаштуваннях (Framework Preset = **Other**, Build Command — порожньо,
   Output Directory — порожньо). Просто натисни **Deploy**.
5. За ~20 секунд зʼявиться посилання на сайт. Готово.

> Якщо Vercel не бачить репозиторій — натисни **Adjust GitHub App Permissions** і дай
> доступ до репозиторію `boxing-booking`.

---

## Крок 3 — оновлення сайту в майбутньому

Просто роби `git push` — Vercel сам перевикладе сайт за кілька секунд.

```
git add -A
git commit -m "опис змін"
git push
```

---

## (Необовʼязково) Власний домен

У проєкті на Vercel: **Settings → Domains → Add** — і вкажи свій домен, якщо колись купиш.

---

## Що з GitHub Pages?

Старе посилання GitHub Pages (`arturov333.github.io/boxing-booking`) продовжить працювати —
вони не конфліктують. Можеш користуватись посиланням Vercel як основним, а Pages лишити
як запасне (або вимкнути в налаштуваннях репозиторію → Pages).
