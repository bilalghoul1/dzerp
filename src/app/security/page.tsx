import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "الأمان والخصوصية — DzERP",
  description:
    "كيف يحمي DzERP بيانات مؤسستك: المصادقة، صلاحيات المستخدمين، عزل الشركات، والاتصال المشفر.",
};

const SECTIONS = [
  {
    title: "المصادقة (Authentication)",
    body: "يُصادق DzERP على المستخدمين عبر جلسات آمنة (Session Cookie بعلم httpOnly) موقّعة وتُتحقق من صلاحيتها عند كل طلب، مع التحقق من حالة المستخدم وتاريخ انتهاء الجلسة وإمكانية إلغائها (revoke). لا يمكن الوصول إلى أي بيانات دون جلسة صحيحة.",
  },
  {
    title: "صلاحيات المستخدمين (RBAC)",
    body: "يستند النظام إلى نموذج صلاحيات دقيق يتبع الصيغة «وحدة.مورد.إجراء» (مثل عرض/إنشاء/تعديل/حذف/إدارة). تُفحص الصلاحيات على مستوى الخادم (Server-side) لكل عملية حساسة، ولا يُعتمد على إخفاء الأزرار في الواجهة كوسيلة أمان.",
  },
  {
    title: "عزل بيانات الشركات (Multi-Company Isolation)",
    body: "كل عملية قراءة أو تعديل أو حذف مقيدة بالشركة النشطة للمستخدم. يُحلّ السياق الأمني (الشركة والفرع) من قاعدة البيانات عند كل طلب، ولا يُثق أبداً في مُعرّف الشركة أو الفرع الوارد من المتصفح بمفرده. لا يمكن لمستخدم شركة الوصول إلى بيانات شركة أخرى.",
  },
  {
    title: "الاتصال المشفر (HTTPS)",
    body: "يُنقل كل اتصال بين المتصفح وDzERP عبر HTTPS. تُضبط ملفات تعريف الجلسة بعلم secure في بيئة الإنتاج لضمان عدم انتقالها عبر قنوات غير مشفرة.",
  },
  {
    title: "حماية البيانات وتدقيق العمليات",
    body: "يُسجّل النظام عمليات حساسة محددة (إنشاء/تعديل/حذف سجلات مهمة، تغيير إعدادات الشركة، تغيير الصلاحيات، تبديل الشركة أو الفرع) في سجل تدقيق (Audit Log) يتضمن المستخدم والشركة ونوع العملية والتاريخ — دون تخزين كلمات المرور أو الرموز الحساسة.",
  },
  {
    title: "سلامة البيانات المحاسبية",
    body: "القيود المحاسبية تُولَّد ارتباطاً بالمستندات المصدرية بطريقة متسقة (idempotent)، ولا تُحذف القيود المؤكدة مباشرةً بل تُربط بحالتها المحاسبية لحفظ الأثر الرقابي.",
  },
];

export default function SecurityPage() {
  return (
    <main
      dir="rtl"
      lang="ar"
      className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 font-sans text-slate-200"
    >
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-emerald-300 hover:text-emerald-200"
        >
          ← العودة إلى الرئيسية
        </Link>

        <header className="mt-6">
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
            الأمان والخصوصية
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-400">
            هذه الصفحة تشرح فقط ما هو مُطبَّق فعلياً في بنية DzERP التقنية. لا
            تُقدَّم هنا أي ادعاءات أمنية غير موجودة في الكود أو البنية التحتية.
          </p>
        </header>

        <div className="mt-10 space-y-6">
          {SECTIONS.map((s) => (
            <section
              key={s.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <h2 className="text-lg font-semibold text-emerald-300">
                {s.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {s.body}
              </p>
            </section>
          ))}
        </div>

        <footer className="mt-12 border-t border-white/10 pt-6 text-sm text-slate-500">
          DzERP — نظام تخطيط موارد الجزائري. للاستفسارات الأمنية تواصل معنا عبر
          الواتساب من الصفحة الرئيسية.
        </footer>
      </div>
    </main>
  );
}
