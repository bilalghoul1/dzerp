import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "الأسئلة الشائعة — DzERP",
  description:
    "إجابات على الأسئلة الأكثر شيوعاً حول DzERP: تعدد الشركات والفروع، العربية والفرنسية، حماية البيانات، والنسخة التجريبية.",
};

const FAQS = [
  {
    q: "هل يدعم DzERP تعدد الشركات والفروع؟",
    a: "نعم. كل مستخدم يُربط بشركة نشطة، ويمكن للحسابات المدارة إدارة عدة شركات وعدة فروع ضمن كل شركة. تُعزل بيانات كل شركة عن الأخرى على مستوى الخادم، ولا يمكن لمستخدم الوصول إلى بيانات شركة لا يملك صلاحية عليها.",
  },
  {
    q: "هل الواجهة متاحة بالعربية والفرنسية؟",
    a: "نعم. الواجهة تدعم العربية (مع تخطيط RTL) والفرنسية، وهي مناسبة للبيئة الجزائرية وللمؤسسات التي تتعامل بلغتين.",
  },
  {
    q: "كيف تُحمى بيانات مؤسستي؟",
    a: "الوصول مقيد بالصلاحيات الممنوحة لكل مستخدم ويفحص على مستوى الخادم. تُعزل بيانات كل شركة، والاتصال مشفر عبر HTTPS، وتُسجَّل العمليات الحساسة في سجل تدقيق (Audit Log) دون تخزين كلمات المرور.",
  },
  {
    q: "هل توجد نسخة تجريبية وكيف أبدأ؟",
    a: "يمكنك بدء تجربة مجانية من الصفحة الرئيسية عبر زر «ابدأ تجريبتك المجانية». للاستفسار أو طلب عرض توضيحي تواصل معنا عبر الواتساب المذكور في الصفحة.",
  },
  {
    q: "هل يتوافق DzERP مع المتطلبات الجبائية الجزائرية؟",
    a: "يتضمن النظام مبادئ محاسبية جزائرية مثل المخطط المحاسبي المالي (SCF) وحسابات الضرائب (TVA، TAP) ضمن محركه. يُرجى مراجعة مستشارك الضريبي للتأكد من المطابقة التامة لحالتك الخاصة.",
  },
  {
    q: "من يستطيع تعديل إعدادات الشركة أو صلاحيات المستخدمين؟",
    a: "العمليات الحساسة مثل تغيير إعدادات الشركة أو الصلاحيات تخضع لصلاحيات محددة وتُسجَّل في سجل التدقيق. المشرف العام (Super Admin) له صلاحيات على مستوى المنصة.",
  },
];

export default function FaqPage() {
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
            الأسئلة الشائعة
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-400">
            إجابات واضحة على الأسئلة الأكثر شيوعاً حول DzERP.
          </p>
        </header>

        <div className="mt-10 space-y-4">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-white/10 bg-white/5 p-5 [&_summary]:cursor-pointer"
            >
              <summary className="flex items-center justify-between text-base font-semibold text-white">
                {f.q}
                <span className="text-emerald-300 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {f.a}
              </p>
            </details>
          ))}
        </div>

        <footer className="mt-12 border-t border-white/10 pt-6 text-sm text-slate-500">
          DzERP — نظام تخطيط موارد الجزائري.
        </footer>
      </div>
    </main>
  );
}
