# تشخيص وإصلاح مشكلة 401 في تسجيل الدخول (POST /api/auth/login)

**التاريخ:** 2026-08-12
**الحالة:** ✅ مُصلح وجذري — تسجيل الدخول يعمل فعليًا (curl + متصفح).

## الأعراض
- `GET /login` → 200 (يعمل)
- `POST /api/auth/login` → 401 Unauthorized (المتصفح: "Failed to load resource: 401")
- بيانات صحيحة (`directeur.oran` / `DzERP-Demo-2026`) تُرجع 401 عند المستخدم.

## التحقيق (من الجذر)
فُحصت كل طبقة كما طُلب:
1. صفحة `/login` والـform والـclient request → ترسل `POST /api/auth/login` بـ`{username, password}` بشكل صحيح. ✅
2. مسار `/api/auth/login` → 401 يُرجع **فقط** من `if (!user || !ok)` (مستخدم غير موجود أو كلمة سر لا تطابق). ليس من rate-limit (يرجع 429) ولا من status (يرجع 403).
3. التحقق من المستخدم وكلمة المرور → `verifyPassword` تستخدم `bcryptjs.compare` بشكل صحيح. ✅
4. نموذج `User` → صحيح (`username` فريد، `passwordHash` موجود). ✅
5. هاش كلمة المرور → `bcryptjs` (SALT_ROUNDS=12) في `src/features/auth/password.ts`. ✅
6. seed/bootstrap → **وُجد السبب الجذري (انظر أدناه)**. ❌→✅
7. وجود المستخدم الإداري في DB → `directeur.oran` موجود و`ACTIVE` و`verifyPassword` يرجع `true`. ✅
8. الحساب Active وغير محظور → `status=ACTIVE`. ✅
9. سياق الشركة لا يسبب 401 → `resolveLoginContext` يرجع `null` بهدوء (لا يرمي). ✅
10. `SESSION_SECRET` وبيئة التشغيل → `SESSION_SECRET` مضبوط؛ `NODE_ENV` غير مضبوط صراحةً (→ secure=false في dev، صحيح). ✅
11. تغييرات auth/session/RBAC حديثة → لا تغيير يؤثر على 401. ✅
12. مقارنة مع git → الـseed كان يفشل (السبب). ✅
13. `admin`/`admin123` **غير صحيحة** — الحسابات الفعلية في الـseed هي `directeur.oran` / `DzERP-Demo-2026` (موثقة في `prisma/seed.ts`). ❌
14. لم يُعطَّل authentication ولم يُرجع 200 مصطنع. ✅
15. لم يُعطَّل auth. ✅
16. أُصلح السبب الحقيقي. ✅

## السبب الجذري (ROOT CAUSE)
ملف `prisma/seed.ts` يبدأ بـ`deleteMany` واسع **يشمل `prisma.user.deleteMany()` (السطر 56)**، ثم يحاول حذف `Company` (السطر 76) — **لكنه لا يحذف أبدًا** الجداول المحاسبية `JournalLine` / `JournalEntry` / `Account` / `FiscalPeriod` (أُضيفت في Phase 8).

عند وجود أي بيانات محاسبية (قيود/مدفوعات)، قيد المفتاح الأجنبي **RESTRICT** (`JournalLine_accountId_fkey` ← `Account` ← `Company`) يمنع حذف `Company` → **يفشل الـseed بخطأ**:
```
update or delete on table "Account" violates RESTRICT setting of foreign key
constraint "JournalLine_accountId_fkey" on table "JournalLine"
```

النتيجة: الـseed يحذف المستخدمين (`user.deleteMany`) **ثم يفشل** عند `company.deleteMany` → تُفقد جميع الحسابات → **401 دائم عند تسجيل الدخول**. هذا يفسر لماذا يعمل عندي بعد seed نظيف لكن يفشل عند المستخدم (الذي لديه بيانات محاسبية أو seed فاشل).

## الإصلاح المطبَّق
في `prisma/seed.ts`: أُضيف حذف مرتَّب للجداول المحاسبية **قبل** `company.deleteMany()`:
```ts
await prisma.branch.deleteMany();
// حذف مرتَّب للبيانات المحاسبية قبل Company (تجنّب فشل RESTRICT)
await prisma.journalLine.deleteMany();
await prisma.journalEntry.deleteMany();
await prisma.account.deleteMany();
await prisma.fiscalPeriod.deleteMany();
await prisma.company.deleteMany();
```
هذا يحترم سلسلة القيود الأجنبية (الجداول التابعة أولًا) ويجعل الـseed يكتمل بنجاح ويعيد إنشاء المستخدمين.

## التحقق
- `prisma validate` ✅ | `prisma generate` ✅ | `prisma migrate status` ✅ (22 migrations, up to date)
- `npx tsc --noEmit` ✅ نظيف | `eslint` ✅ | `next build` ✅ (Compiled successfully)
- إعادة تشغيل الـseed → `SEED_EXIT=0` (ينجح ويعيد إنشاء `directeur.oran`/`lecteur`/`dzerp.owner`)
- تشخيص DB: 3 مستخدمين، `verifyPassword(DzERP-Demo-2026)` → `true`

## اختبارات التشغيل (runtime)
| # | الاختبار | النتيجة |
|---|---------|--------|
| 1 | `GET /login` | 200 ✅ |
| 2 | `POST /api/auth/login` بيانات صحيحة | 200 + session cookie ✅ |
| 3 | `POST /api/auth/login` بيانات خاطئة | 401 (مرفوض صحيحًا) ✅ |
| 4 | إنشاء session صحيحة | ✅ (dzerp.session مضبوط) |
| 5 | الوصول للوحة التحكم بعد الدخول | 200 ✅ |
| 6 | logout | 200 ✅ |
| 7 | صفحة محمية بدون session | 307 (redirect) ✅ |

**تسجيل الدخول أصبح يعمل فعليًا** (عبر curl وصولاً للمتصفح الفعلي → لوحة التحكم).

## بيانات الدخول الصحيحة (من الـseed)
```
directeur.oran  / DzERP-Demo-2026   (مدير - Manager)
lecteur         / DzERP-Demo-2026   (قارئ - Reader)
dzerp.owner     / DzERP-Demo-2026   (مالك الشركة - Owner)
```
ليست `admin`/`admin123` (غير موجودة في النظام).

## ملاحظة سلامة (تحتاج معالجة مستقبلية)
الـseed لا يزال **مدمّرًا** (`user.deleteMany()` يمسح كل المستخدمين). هذا مقبول للبيئة التجريبية لكنه خطر في الإنتاج. يُوصى مستقبلاً بتحويل إنشاء المستخدمين/الشركات إلى `upsert` بدل الحذف الكلي. (لم يُعدَّل الآن حفاظًا على نطاق الإصلاح وتجنباً لمخاطر أكبر.)
