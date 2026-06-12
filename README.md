# Boxing & Kickboxing — Personal Training Booking

Статичний сайт для запису клієнтів на персональні тренування. Працює на GitHub Pages, використовує Firebase Firestore для спільного зберігання записів у реальному часі.

---

## Як це працює

- **Клієнт:** обирає локацію → день (поточний або наступні 4 тижні) → вільний час → залишає контакти → запис зберігається в Firestore.
- **Тренер:** натискає кнопку **«Тренер»** у правому верхньому куті → вводить код → бачить список усіх записів, відсортованих за датою. Може скасовувати записи або оновлювати список.
- **Real-time:** коли хтось бере слот, у всіх інших відкритих вкладках цей слот моментально стає перекресленим (без перезавантаження сторінки).

---

## Швидкий старт — налаштування за 15 хвилин

### Крок 1. Створити проєкт у Firebase

1. Відкрий https://console.firebase.google.com/
2. Натисни **Add project** → введи назву (наприклад `boxing-booking`) → можна вимкнути Google Analytics → **Create**.
3. У створеному проєкті натисни іконку **Web** (`</>`) у блоці «Get started by adding Firebase to your app».
4. Введи nickname для застосунку (наприклад `web`), **НЕ ставити галочку** «Set up Firebase Hosting» → **Register app**.
5. Скопіюй об'єкт `firebaseConfig` — він виглядає так:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "boxing-booking.firebaseapp.com",
     projectId: "boxing-booking",
     storageBucket: "boxing-booking.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef"
   };
   ```

### Крок 2. Увімкнути Firestore Database

1. У боковому меню Firebase: **Build → Firestore Database** → **Create database**.
2. Обери регіон **eur3 (europe-west)** (ближче до України, дешевше для майбутнього) → **Next**.
3. Стартовий режим: обери **Start in production mode** → **Enable**.
4. Перейди на вкладку **Rules** і встав ці правила:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /bookings/{bookingId} {
         // Будь-хто може читати записи (треба, щоб показувати зайняті слоти)
         allow read: if true;

         // Будь-хто може створювати запис, але з обов'язковими полями і без сміття
         allow create: if request.resource.data.keys().hasAll(['location','date','time','name','phone'])
                       && request.resource.data.name is string
                       && request.resource.data.name.size() >= 2
                       && request.resource.data.name.size() <= 50
                       && request.resource.data.phone is string
                       && request.resource.data.phone.size() <= 20
                       && request.resource.data.time in ['12:00','13:00','14:00','15:00','16:00'];

         // Видалення дозволено всім (захист на рівні UI — адмін-код).
         // Якщо хочеш суворіший захист — додай Firebase Authentication.
         allow delete: if true;

         // Оновлення заборонене (записи створюються і видаляються, не редагуються)
         allow update: if false;
       }
     }
   }
   ```
   Натисни **Publish**.

### Крок 3. Вставити налаштування у код

1. Відкрий `script.js`.
2. Знайди блок `const firebaseConfig = { ... }` (вгорі файлу) і встав свої значення з кроку 1.5.
3. Заміни локації:
   ```js
   const LOCATIONS = [
     { id: "loc1", name: "Зал на Шевченка", address: "вул. Шевченка 25" },
     { id: "loc2", name: "Зал на Стрийській", address: "вул. Стрийська 71" },
   ];
   ```
   (`id` можна не чіпати — це внутрішній ідентифікатор, який зберігається в БД.)
4. Зміни код адміна:
   ```js
   const ADMIN_CODE = "мій-секретний-код";
   ```
   > ⚠️ Цей код — це **захист від випадкових гостей**, а не справжня безпека. Видаляти записи може будь-хто, хто знає правила Firestore. Якщо це не влаштовує — див. розділ «Підвищення безпеки» нижче.

### Крок 4. Локальний тест

Відкрий `index.html` у браузері. **Важливо:** через ES-модулі браузер може блокувати завантаження з `file://`. Тому запусти простий локальний сервер:

```bash
# Якщо встановлено Python:
python -m http.server 8000

# Або через Node:
npx serve .
```

Відкрий http://localhost:8000 — мають з'явитись локації, дні тижня і часові слоти. Зроби тестовий запис → перевір у Firebase Console → **Firestore Database → Data** → колекція `bookings`.

### Крок 5. Деплой на GitHub Pages

1. Створи репозиторій на GitHub (наприклад `boxing-booking`).
2. У теці проєкту:
   ```bash
   git init
   git add .
   git commit -m "Initial booking site"
   git branch -M main
   git remote add origin https://github.com/ТВІЙ_НІК/boxing-booking.git
   git push -u origin main
   ```
3. На GitHub: **Settings → Pages → Branch: `main` / root → Save**.
4. Через 1–2 хвилини сайт буде доступний за `https://ТВІЙ_НІК.github.io/boxing-booking/`.
5. У Firebase Console → **Project Settings → Authorized domains** додай свій GitHub Pages домен (наприклад `ТВІЙ_НІК.github.io`).

---

## Структура файлів

```
boxing-booking/
├── index.html      ← розмітка
├── style.css       ← стилі Fight Brand
├── script.js       ← логіка + Firebase
└── README.md       ← цей файл
```

Усі константи, які треба міняти, зібрані вгорі `script.js` у блоці `CONFIG`.

---

## Безкоштовний ліміт Firebase Firestore

| Ресурс | Безкоштовно/день |
|---|---|
| Читання документів | 50 000 |
| Запис документів | 20 000 |
| Видалення документів | 20 000 |
| Сховище | 1 GB |

Для активного тренера це **на роки**. Один запис = 1 запис (write). Завантаження сторінки клієнтом = 1 запит + ~30 читань на тиждень. Перевищення = просто перестане працювати до наступного дня (не списують гроші, якщо не додав платіжну карту).

---

## Підвищення безпеки (опційно)

Поточна схема: код адміна — клієнтський, його можна знайти у вихідному коді сторінки. Для приватного сайту з посиланням «лише своїм» цього досить. Якщо хочеш зробити справжню авторизацію:

1. У Firebase Console → **Build → Authentication → Get started → Sign-in method → Email/Password → Enable**.
2. Створи свій акаунт у вкладці **Users → Add user**.
3. У Firestore Rules заміни `allow delete: if true;` на:
   ```
   allow delete: if request.auth != null && request.auth.token.email == 'твій-email@gmail.com';
   ```
4. У `script.js` додай імпорт `getAuth`, `signInWithEmailAndPassword` і відповідні виклики у блоці адмін-логіна.

Це повноцінний захист — навіть знаючи правила, ніхто не зможе видаляти записи без пароля.

---

## Альтернатива якщо Firebase не підходить

Якщо хочеться без Google-облікового запису і real-time не критичний:

- **Supabase** (Postgres-як-сервіс): API простіший, аналогічний безкоштовний план, real-time через WebSocket. Для нашого кейсу — повноцінна заміна Firebase.
- **JSONBin.io**: дуже просто, але **немає real-time** — слоти доведеться перезавантажувати кожні 5–10 сек через `setInterval`. Підходить, якщо одночасних користувачів зовсім мало.

Поточний код написаний під Firestore і потребує перепису ~`script.js`, якщо переходити.

---

## Що ще можна додати потім

- Email/SMS-сповіщення тренеру при новому записі (через Firebase Functions або Make/Zapier на webhook).
- Підтвердження клієнту через Telegram-бот.
- Календарний експорт (`.ics`) для клієнта.
- Знімок на ту саму годину в різних локаціях — зараз дозволено (два різні документи, бо `location` різний).

Якщо щось не запрацює — глянь у браузері **DevTools → Console**, там будуть зрозумілі повідомлення про помилки Firebase.
