"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Building2,
  Users,
  Receipt,
  Check,
  Menu,
  X,
  ChevronDown,
  Sparkles,
  Globe,
  Wallet,
  FileText,
  Gauge,
  Landmark,
  Star,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types & i18n dictionary                                             */
/* ------------------------------------------------------------------ */

type Lang = "ar" | "fr" | "en";

type Content = {
  nav: { features: string; solutions: string; pricing: string; faq: string; login: string; cta: string };
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    trust: string[];
    security: string[];
  };
  features: { heading: string; sub: string; items: { title: string; desc: string }[] };
  tour: { heading: string; sub: string; sales: string; accounting: string; inventory: string; dashboard: string };
  demo: {
    heading: string;
    sub: string;
    tabPayroll: string;
    tabInvoice: string;
    payroll: { label: string; cnas: string; other: string; irg: string; net: string; disclaimer: string };
    invoice: { title: string; number: string; ht: string; tva: string; ttc: string };
    side: { title: string; desc: string }[];
  };
  pricing: {
    heading: string;
    sub: string;
    monthly: string;
    annual: string;
    popular: string;
    perMonth: string;
    billedYearly: string;
    billedMonthly: string;
    start: string;
  };
  plans: { name: string; features: string[]; popular: boolean }[];
  social: {
    heading: string;
    sub: string;
    badge: string;
    logos: string[];
    testimonials: { quote: string; name: string; role: string }[];
  };
  faq: { heading: string; sub: string; replyLabel: string; items: { q: string; a: string }[] };
  finalCta: { heading: string; sub: string; ctaPrimary: string; ctaSecondary: string };
  footer: { langs: string };
};

const dict: Record<Lang, Content> = {
  ar: {
    nav: { features: "الخصائص", solutions: "الحلول", pricing: "الأسعار", faq: "الأسئلة الشائعة", login: "دخول", cta: "تجربة مجانية" },
    hero: {
      badge: "متوافق مع النظام الجبائي الجزائري",
      title: "المنصة المتكاملة لإدارة مؤسستك وتسيير حساباتك وفق النظام الجزائري",
      subtitle:
        "DzERP تجمع المحاسبة، الضرائب (TVA، TAP، IRG)، الأجور والضمان الاجتماعي (CNAS / CASNOS)، والمخطط المحاسبي المالي (SCF) في نظام واحد آمن ومتعدد الفروع.",
      ctaPrimary: "ابدأ تجريبتك المجانية",
      ctaSecondary: "طلب عرض توضيحي",
      trust: ["إعداد خلال دقائق", "دعم بالعربية والفرنسية", "بياناتك محمية"],
      security: ["تشفير 256-bit SSL", "لا حاجة لبطاقة بنكية", "عزل كامل للبيانات"],
    },
    features: {
      heading: "كل ما تحتاجه لتسيير مؤسستك",
      sub: "وحدات متكاملة تعمل معاً لتقديم رؤية موحدة لعملياتك المالية والتجارية.",
      items: [
        { title: "المحرك الضريبي الجزائري", desc: "احتساب تلقائي لـ TVA و TAP و IRG وفق القوانين الجزائرية، مع تقارير جاهزة للإقرار." },
        { title: "إدارة الأجور والضمان الاجتماعي", desc: "تسيير الرواتب، الاقتطاعات الاجتماعية (CNAS / CASNOS)، والعروض الفردية للأجور." },
        { title: "المخطط المحاسبي المالي (SCF)", desc: "مخطط محاسبي متوافق مع المعايير الجزائرية، قيود آلية وتقارير مالية دقيقة." },
        { title: "تعدد الفروع والمستخدمين", desc: "بنية متعددة المؤسسات (Multi-tenant) مع صلاحيات دقيقة لكل مستخدم وفرع." },
      ],
    },
    tour: {
      heading: "استكشف الوحدات",
      sub: "صور حقيقية من واجهة DzERP.",
      sales: "المبيعات",
      accounting: "المحاسبة",
      inventory: "المخزون",
      dashboard: "لوحة التحكم",
    },
    demo: {
      heading: "جرّب المحرك بنفسك",
      sub: "احسب الأجور والضرائب أو معاينة فاتورة ضريبية مباشرة داخل الصفحة.",
      tabPayroll: "حاسبة الأجور و IRG",
      tabInvoice: "معاينة فاتورة",
      payroll: {
        label: "الأجر الإجمالي الشهري",
        cnas: "الاقتطاعات الاجتماعية (CNAS 9%)",
        other: "اقتطاعات أخرى (تقديري 1%)",
        irg: "IRG (ضريبة الدخل)",
        net: "صافي الأجر الشهري (تقديري)",
        disclaimer:
          "* هذه الحسابية تقديرية لأغراض العرض فقط ولا تمثل فتوى جبائية. ترجع النسب الفعلية إلى التشريع الجزائري المعمول به.",
      },
      invoice: { title: "فاتورة ضريبية", number: "FAC-2026-0042", ht: "المبلغ قبل الضريبة (HT)", tva: "TVA (19%)", ttc: "الإجمالي (TTC)" },
      side: [
        { title: "دقة في الاحتساب", desc: "معادلات جاهزة للضرائب الجزائرية." },
        { title: "فوري", desc: "النتائج تتحدث مع كل تغيير." },
        { title: "موثوق", desc: "أساس محاسبي متوافق مع SCF." },
      ],
    },
    pricing: {
      heading: "أسعار بسيطة وشفافة",
      sub: "بالدينار الجزائري. الاشتراك السنوي يوفّر شهرين.",
      monthly: "شهري",
      annual: "سنوي (−17%)",
      popular: "الأكثر شعبية",
      perMonth: "/ شهر",
      billedYearly: "يدفع سنوياً",
      billedMonthly: "يدفع شهرياً",
      start: "ابدأ الآن",
    },
    plans: [
      { name: "مبتدئ", features: ["حتى 2 مستخدم", "محاسبة وتقارير SCF", "فواتير ضريبية", "دعم بالبريد"], popular: false },
      { name: "احترافي", features: ["حتى 10 مستخدم", "ضرائب TVA/TAP/IRG", "أجور CNAS / CASNOS", "فروع متعددة", "دعم متميز"], popular: true },
      { name: "مؤسسات", features: ["مستخدمون غير محدود", "كل وحدات DzERP", "API وتكاملات", "مدير حساب مخصص", "دعم على مدار الساعة"], popular: false },
    ],
    social: {
      heading: "موثوق به من مؤسسات جزائرية",
      sub: "من الأسماء التجارية المحلية إلى الشركات الصغيرة، تعتمد مؤسسات من مختلف القطاعات على DzERP في تسيير محاسبتها وضرائبها يومياً.",
      badge: "آراء عملائنا",
      logos: ["مجمع النور", "الشركة الساحلية", "مؤسسة الأطلس", "غروب الواحة", "المقاولات المتوسطية", "دار الصناعة"],
      testimonials: [
        { quote: "بفضل احتساب TVA و IRG التلقائي، نرحّز إقراراتنا في ساعات بدل أيام. المحاسبون ربحوا وقتاً كبيراً في الجرد.", name: "ك. بن يوسف", role: "المدير المالي — شركة الديار" },
        { quote: "التقارير المتوافقة مع SCF والسيطرة على الفروع جعلت التدقيق الداخلي أكثر سرعة وشفافية بكثير.", name: "ز. حمادي", role: "محاسب رئيسي — غروب النور" },
        { quote: "بدأنا بمستخدم واحد ووصلنا إلى عشرة أفرع. إدارة الصلاحيات والعزل بين الوحدات سهلت انفتاحنا.", name: "ت. مرداسي", role: "مدير عام — شركة المتوسط" },
      ],
    },
    faq: {
      heading: "الأسئلة الشائعة",
      sub: "إجابات واضحة على أكثر الأسئلة التي تلقّاها العملاء قبل اعتماد DzERP.",
      replyLabel: "الإجابة",
      items: [
        { q: "هل يتوافق DzERP مع التشريع الجبائي الجزائري؟", a: "نعم، المحرك الضريبي مبني لاحتساب TVA و TAP و IRG وفق القوانين الجزائرية، مع مخطط محاسبي متوافق مع SCF. على كل حال، ننصح بمراجعة مستشارك الضريبي للتأكد من المطابقة لحالتك الخاصة." },
        { q: "هل يمكن إدارة عدة فروع من نفس الحساب؟", a: "نعم. البنية متعددة المؤسسات (Multi-tenant) تتيح إدارة عدة فروع ضمن كل شركة، مع عزل كامل للبيانات بين الشركات وتحديد صلاحيات دقيقة لكل مستخدم وفرع على مستوى الخادم." },
        { q: "كيف تتم حماية بياناتي؟", a: "البيانات معزولة لكل مؤسسة ولا يمكن الوصول إليها عبر شركة أخرى. كل عملية حساسة تخضع لفحص صلاحيات على الخادم ويُحتفظ بها في سجل تدقيق (Audit Log) دون تخزين كلمات المرور، والاتصال مشفّر عبر HTTPS." },
        { q: "هل يدعم العربية والفرنسية؟", a: "نعم، الواجهة تدعم العربية (مع تخطيط RTL من اليمين إلى اليسار) والفرنسية، بما يناسب المؤسسات الجزائرية العاملة بلغتين." },
        { q: "هل توجد فترة تجريبية مجانية؟", a: "نعم، يمكنك البدء بتجربة مجانية فوراً دون الحاجة لبطاقة بنكية. ولطلب عرض توضيحي مخصّص، تواصل معنا عبر زر الواتساب في الصفحة." },
      ],
    },
    finalCta: {
      heading: "ابدأ بتسيير مؤسستك اليوم",
      sub: "انضم إلى المؤسسات الجزائرية التي تدير محاسبتها وأعمالها بثقة مع DzERP.",
      ctaPrimary: "ابدأ تجريبتك المجانية",
      ctaSecondary: "طلب عرض توضيحي",
    },
    footer: { langs: "العربية · Français" },
  },
  fr: {
    nav: { features: "Fonctionnalités", solutions: "Solutions", pricing: "Tarifs", faq: "FAQ", login: "Connexion", cta: "Essai gratuit" },
    hero: {
      badge: "Conforme à la fiscalité algérienne",
      title: "La plateforme complète pour gérer votre entreprise et votre comptabilité selon le système algérien",
      subtitle:
        "DzERP réunit la comptabilité, la fiscalité (TVA, TAP, IRG), la paie et la sécurité sociale (CNAS / CASNOS), et le plan comptable financier (SCF) dans un système unique, sécurisé et multi-succursales.",
      ctaPrimary: "Démarrer votre essai gratuit",
      ctaSecondary: "Demander une démo",
      trust: ["Configuré en quelques minutes", "Support en arabe et français", "Vos données sont protégées"],
      security: ["Chiffrement 256-bit SSL", "Sans carte bancaire", "Isolation complète des données"],
    },
    features: {
      heading: "Tout ce dont vous avez besoin pour gérer votre entreprise",
      sub: "Des modules intégrés qui offrent une vision unifiée de vos opérations financières et commerciales.",
      items: [
        { title: "Moteur fiscal algérien", desc: "Calcul automatique de la TVA, TAP et IRG selon la législation algérienne, avec des rapports prêts pour la déclaration." },
        { title: "Gestion de la paie et sécurité sociale", desc: "Gestion des salaires, des retenues sociales (CNAS / CASNOS) et des bulletins de paie individuels." },
        { title: "Plan comptable financier (SCF)", desc: "Plan comptable conforme aux normes algériennes, écritures automatiques et rapports financiers précis." },
        { title: "Multi-succursales et multi-utilisateurs", desc: "Architecture multi-tenant avec des permissions précises par utilisateur et par succursale." },
      ],
    },
    tour: {
      heading: "Explorez les modules",
      sub: "Captures réelles de l'interface DzERP.",
      sales: "Ventes",
      accounting: "Comptabilité",
      inventory: "Stock",
      dashboard: "Tableau de bord",
    },
    demo: {
      heading: "Essayez le moteur vous-même",
      sub: "Calculez la paie et les impôts ou prévisualisez une facture directement dans la page.",
      tabPayroll: "Calculateur de paie et IRG",
      tabInvoice: "Aperçu de facture",
      payroll: {
        label: "Salaire brut mensuel",
        cnas: "Retenues sociales (CNAS 9%)",
        other: "Autres retenues (estimé 1%)",
        irg: "IRG (impôt sur le revenu)",
        net: "Salaire net mensuel (estimé)",
        disclaimer:
          "* Ce calcul est une estimation à des fins de démonstration uniquement et ne constitue pas un avis fiscal. Les taux réels dépendent de la législation algérienne en vigueur.",
      },
      invoice: { title: "Facture fiscale", number: "FAC-2026-0042", ht: "Montant hors taxe (HT)", tva: "TVA (19%)", ttc: "Total (TTC)" },
      side: [
        { title: "Précision du calcul", desc: "Formules prêtes pour la fiscalité algérienne." },
        { title: "Immédiat", desc: "Les résultats se mettent à jour à chaque modification." },
        { title: "Fiable", desc: "Base comptable conforme au SCF." },
      ],
    },
    pricing: {
      heading: "Des tarifs simples et transparents",
      sub: "En dinar algérien. L'abonnement annuel fait économiser deux mois.",
      monthly: "Mensuel",
      annual: "Annuel (−17%)",
      popular: "Le plus populaire",
      perMonth: "/ mois",
      billedYearly: "Facturé annuellement",
      billedMonthly: "Facturé mensuellement",
      start: "Commencer",
    },
    plans: [
      { name: "Débutant", features: ["Jusqu'à 2 utilisateurs", "Comptabilité et rapports SCF", "Factures fiscales", "Support par e-mail"], popular: false },
      { name: "Professionnel", features: ["Jusqu'à 10 utilisateurs", "Taxes TVA/TAP/IRG", "Paie CNAS / CASNOS", "Succursales multiples", "Support prioritaire"], popular: true },
      { name: "Entreprises", features: ["Utilisateurs illimités", "Tous les modules DzERP", "API et intégrations", "Gestionnaire de compte dédié", "Support 24/7"], popular: false },
    ],
    social: {
      heading: "Approuvé par des entreprises algériennes",
      sub: "Des commerçants locaux aux petites entreprises, des structures de tous secteurs s'appuient sur DzERP pour leur comptabilité et leurs impôts au quotidien.",
      badge: "Témoignages clients",
      logos: ["Groupe El Nour", "Société Côtière", "Établissement Atlas", "Oasis Group", "Méditerranée BTP", "Maison d'Industrie"],
      testimonials: [
        { quote: "Grâce au calcul automatique de la TVA et de l'IRG, nous clôturons nos déclarations en heures au lieu de jours. Nos comptables gagnent un temps précieux.", name: "K. Benyoucef", role: "Directeur financier — Dar Immobilier" },
        { quote: "Les rapports conformes au SCF et le contrôle des succursales ont rendu l'audit interne beaucoup plus rapide et transparent.", name: "Z. Hammad", role: "Comptable principal — Groupe El Nour" },
        { quote: "Nous avons commencé avec un seul utilisateur et structuré jusqu'à dix succursales. La gestion des droits et l'isolation ont facilité notre croissance.", name: "T. Mardasi", role: "Directeur général — Méditerranée BTP" },
      ],
    },
    faq: {
      heading: "Questions fréquentes",
      sub: "Des réponses claires aux questions posées avant d'adopter DzERP.",
      replyLabel: "Réponse",
      items: [
        { q: "DzERP est-il conforme à la législation fiscale algérienne ?", a: "Oui, le moteur fiscal calcule la TVA, TAP et IRG selon la législation algérienne, avec un plan comptable conforme au SCF. Nous vous invitons néanmoins à confirmer la conformité avec votre conseiller fiscal selon votre cas." },
        { q: "Peut-on gérer plusieurs succursales depuis le même compte ?", a: "Oui. L'architecture multi-tenant permet de gérer plusieurs succursales par entreprise, avec une isolation complète des données entre sociétés et des permissions précises par utilisateur et par succursale, vérifiées côté serveur." },
        { q: "Comment mes données sont-elles protégées ?", a: "Les données sont isolées par entreprise et inaccessibles depuis une autre société. Chaque opération sensible est contrôlée côté serveur et conservée dans un journal d'audit (Audit Log) sans stockage des mots de passe, avec chiffrement en transit (HTTPS) et au repos." },
        { q: "DzERP prend-il en charge l'arabe et le français ?", a: "Oui, l'interface prend en charge l'arabe (avec une mise en page RTL de droite à gauche) et le français, adaptés aux entreprises algériennes bilingues." },
        { q: "Existe-t-il une période d'essai gratuite ?", a: "Oui, vous pouvez démarrer un essai gratuit immédiatement, sans carte bancaire. Pour une démo personnalisée, contactez-nous via le bouton WhatsApp." },
      ],
    },
    finalCta: {
      heading: "Commencez à gérer votre entreprise dès aujourd'hui",
      sub: "Rejoignez les entreprises algériennes qui gèrent leur comptabilité et leurs activités en toute confiance avec DzERP.",
      ctaPrimary: "Démarrer votre essai gratuit",
      ctaSecondary: "Demander une démo",
    },
    footer: { langs: "Arabe · Français" },
  },
  en: {
    nav: { features: "Features", solutions: "Solutions", pricing: "Pricing", faq: "FAQ", login: "Sign in", cta: "Free trial" },
    hero: {
      badge: "Compliant with Algerian tax law",
      title: "The all-in-one platform to manage your business and your accounting under the Algerian system",
      subtitle:
        "DzERP brings together accounting, taxes (VAT, TAP, IRG), payroll and social security (CNAS / CASNOS), and the financial chart of accounts (SCF) in a single, secure, multi-branch system.",
      ctaPrimary: "Start your free trial",
      ctaSecondary: "Request a demo",
      trust: ["Set up in minutes", "Support in Arabic and French", "Your data is protected"],
      security: ["256-bit SSL encryption", "No credit card required", "Full data isolation"],
    },
    features: {
      heading: "Everything you need to run your business",
      sub: "Integrated modules that deliver a unified view of your financial and commercial operations.",
      items: [
        { title: "Algerian tax engine", desc: "Automatic VAT, TAP and IRG calculation per Algerian law, with reports ready for filing." },
        { title: "Payroll & social security", desc: "Manage salaries, social contributions (CNAS / CASNOS), and individual pay slips." },
        { title: "Financial chart of accounts (SCF)", desc: "Chart of accounts aligned with Algerian standards, automated entries and accurate financial reports." },
        { title: "Multi-branch & multi-user", desc: "Multi-tenant architecture with precise permissions per user and branch." },
      ],
    },
    tour: {
      heading: "Explore the modules",
      sub: "Real screenshots from the DzERP interface.",
      sales: "Sales",
      accounting: "Accounting",
      inventory: "Inventory",
      dashboard: "Dashboard",
    },
    demo: {
      heading: "Try the engine yourself",
      sub: "Calculate payroll and taxes or preview a tax invoice right inside the page.",
      tabPayroll: "Payroll & IRG calculator",
      tabInvoice: "Invoice preview",
      payroll: {
        label: "Monthly gross salary",
        cnas: "Social contributions (CNAS 9%)",
        other: "Other deductions (est. 1%)",
        irg: "IRG (income tax)",
        net: "Net monthly salary (estimated)",
        disclaimer:
          "* This calculation is an estimate for demonstration only and is not tax advice. Actual rates follow applicable Algerian legislation.",
      },
      invoice: { title: "Tax invoice", number: "FAC-2026-0042", ht: "Amount before tax (HT)", tva: "VAT (19%)", ttc: "Total (incl. VAT)" },
      side: [
        { title: "Accurate", desc: "Ready-made formulas for Algerian taxation." },
        { title: "Instant", desc: "Results update with every change." },
        { title: "Reliable", desc: "Accounting base aligned with SCF." },
      ],
    },
    pricing: {
      heading: "Simple, transparent pricing",
      sub: "In Algerian dinars. Annual billing saves two months.",
      monthly: "Monthly",
      annual: "Annual (−17%)",
      popular: "Most popular",
      perMonth: "/ month",
      billedYearly: "Billed annually",
      billedMonthly: "Billed monthly",
      start: "Get started",
    },
    plans: [
      { name: "Starter", features: ["Up to 2 users", "Accounting & SCF reports", "Tax invoices", "Email support"], popular: false },
      { name: "Professional", features: ["Up to 10 users", "VAT/TAP/IRG taxes", "CNAS / CASNOS payroll", "Multiple branches", "Priority support"], popular: true },
      { name: "Enterprise", features: ["Unlimited users", "All DzERP modules", "API & integrations", "Dedicated account manager", "24/7 support"], popular: false },
    ],
    social: {
      heading: "Trusted by Algerian businesses",
      sub: "From local traders to small enterprises, structures across sectors rely on DzERP for their daily accounting and taxes.",
      badge: "Customer testimonials",
      logos: ["El Nour Group", "Coastal Company", "Atlas Establishment", "Oasis Group", "Mediterranean BTP", "Industry House"],
      testimonials: [
        { quote: "Thanks to automatic VAT and IRG computation, we file our returns in hours instead of days. Our accountants save a ton of time.", name: "K. Benyoucef", role: "CFO — Dar Immobilier" },
        { quote: "SCF-compliant reports and branch control made internal audits much faster and more transparent.", name: "Z. Hammad", role: "Lead Accountant — El Nour Group" },
        { quote: "We started with one user and scaled up to ten branches. Rights management and isolation made our growth easy.", name: "T. Mardasi", role: "CEO — Mediterranean BTP" },
      ],
    },
    faq: {
      heading: "Frequently asked questions",
      sub: "Clear answers to the questions asked before adopting DzERP.",
      replyLabel: "Answer",
      items: [
        { q: "Is DzERP compliant with Algerian tax law?", a: "Yes, the tax engine calculates VAT, TAP and IRG per Algerian law, with a chart of accounts aligned with SCF. We still recommend confirming compliance with your tax advisor for your specific case." },
        { q: "Can multiple branches be managed from one account?", a: "Yes. The multi-tenant architecture lets you manage multiple branches per company, with full data isolation between companies and precise server-side permissions per user and branch." },
        { q: "How is my data protected?", a: "Data is isolated per company and unreachable from another one. Every sensitive operation is checked server-side and kept in an audit log without storing passwords, with encryption in transit (HTTPS) and at rest." },
        { q: "Does it support Arabic and French?", a: "Yes, the interface supports Arabic (with right-to-left RTL layout) and French, suited to bilingual Algerian businesses." },
        { q: "Is there a free trial?", a: "Yes, you can start a free trial right away with no credit card required. For a personalized demo, reach out via the WhatsApp button on this page." },
      ],
    },
    finalCta: {
      heading: "Start running your business today",
      sub: "Join the Algerian businesses managing their accounting and operations with confidence using DzERP.",
      ctaPrimary: "Start your free trial",
      ctaSecondary: "Request a demo",
    },
    footer: { langs: "Arabic · French" },
  },
};

const PLAN_PRICES = [2900, 5900, 11900];

/* WhatsApp lead/support integration — set to the production number */
const DZERP_WHATSAPP_NUMBER = "+213777321649";
const WHATSAPP_DEFAULT_MESSAGE =
  "السلام عليكم، أريد طلب عرض توضيحي أو الاستفسار عن منصة DzERP";

function buildWhatsAppHref(message: string = WHATSAPP_DEFAULT_MESSAGE) {
  const phone = DZERP_WHATSAPP_NUMBER.replace(/[^0-9]/g, "");
  const text = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${text}`;
}

/* ------------------------------------------------------------------ */
/* Animation helper                                                    */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

function useReveal() {
  const reduce = useReducedMotion();
  return reduce
    ? {}
    : {
        initial: "hidden" as const,
        whileInView: "show" as const,
        viewport: { once: true, margin: "-80px" },
        variants: fadeUp,
      };
}

function formatDZD(n: number) {
  return new Intl.NumberFormat("fr-DZ", {
    style: "currency",
    currency: "DZD",
    maximumFractionDigits: 0,
  }).format(n);
}

/* Algerian monthly IRG brackets (indicative / تقديري) */
const IRG_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 20000, rate: 0 },
  { upTo: 35000, rate: 0.23 },
  { upTo: 50000, rate: 0.27 },
  { upTo: 70000, rate: 0.3 },
  { upTo: 100000, rate: 0.33 },
  { upTo: Infinity, rate: 0.35 },
];

function computeIrg(taxable: number): number {
  let remaining = taxable;
  let prev = 0;
  let irg = 0;
  for (const b of IRG_BRACKETS) {
    const band = Math.min(remaining, b.upTo - prev);
    if (band <= 0) break;
    irg += band * b.rate;
    remaining -= band;
    prev = b.upTo;
    if (remaining <= 0) break;
  }
  return irg;
}

/* ------------------------------------------------------------------ */
/* Language switcher                                                   */
/* ------------------------------------------------------------------ */

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: "ar", label: "العربية", flag: "🇩🇿" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

function LanguageSwitcher({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const [open, setOpen] = React.useState(false);
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Language"
        className="flex h-11 min-h-[44px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-sm text-slate-200 transition-colors hover:bg-white/10"
      >
        <Globe className="h-4 w-4 text-emerald-300" />
        <span>{current.flag}</span>
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute end-0 z-50 mt-2 w-40 overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 p-1 shadow-xl backdrop-blur">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setLang(l.code);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  l.code === lang ? "bg-emerald-500/15 text-emerald-300" : "text-slate-200 hover:bg-white/5",
                )}
              >
                <span>{l.flag}</span>
                {l.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Nav                                                                 */
/* ------------------------------------------------------------------ */

function Nav({ c, lang, setLang }: { c: Content; lang: Lang; setLang: (l: Lang) => void }) {
  const [open, setOpen] = React.useState(false);
  const links = [
    { label: c.nav.features, href: "#features" },
    { label: c.nav.solutions, href: "#solutions" },
    { label: c.nav.pricing, href: "#pricing" },
    { label: c.nav.faq, href: "#faq" },
  ];
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="#top" className="flex items-center gap-2 font-bold text-white">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-slate-950">
            <Landmark className="h-5 w-5" />
          </span>
          <span className="text-lg tracking-tight">DzERP</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher lang={lang} setLang={setLang} />
          <Button asChild variant="ghost" className="text-slate-200 hover:text-white">
            <Link href="/login">{c.nav.login}</Link>
          </Button>
          <Button asChild className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 hover:from-emerald-400 hover:to-emerald-500">
            <Link href="/register">{c.nav.cta}</Link>
          </Button>
        </div>

        <button
          type="button"
          aria-label="Menu"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg p-2 text-slate-200 hover:bg-white/5 md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/10 md:hidden"
          >
            <div className="space-y-1 px-4 py-3">
              {links.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
                  {l.label}
                </a>
              ))}
              <div className="flex items-center gap-2 pt-2">
                <LanguageSwitcher lang={lang} setLang={setLang} />
                <Button asChild variant="outline" className="flex-1 border-white/15 text-slate-200">
                  <Link href="/login">{c.nav.login}</Link>
                </Button>
                <Button asChild className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950">
                  <Link href="/register">{c.nav.cta}</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero + image                                                        */
/* ------------------------------------------------------------------ */

function HeroVisual() {
  const reveal = useReveal();
  return (
    <motion.div {...reveal} className="relative">
      <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-gradient-to-tr from-emerald-500/25 to-cyan-500/25 blur-2xl" />
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-2 shadow-2xl shadow-emerald-500/10 backdrop-blur">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl">
          <Image
            src="/landing/hero.png"
            alt="DzERP dashboard preview"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
      </div>
    </motion.div>
  );
}

function Hero({ c }: { c: Content }) {
  const reveal = useReveal();
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(13,148,136,0.25),transparent)]" />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
        <motion.div {...reveal} className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" /> {c.hero.badge}
          </span>
          <h1 className="text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
            {c.hero.title}
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-slate-300">{c.hero.subtitle}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 hover:from-emerald-400 hover:to-emerald-500">
              <Link href="/register">{c.hero.ctaPrimary}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-emerald-400/40 bg-white/5 text-slate-100 hover:border-emerald-300/60 hover:bg-white/10 hover:text-white">
              <a href={buildWhatsAppHref()} target="_blank" rel="noopener noreferrer">{c.hero.ctaSecondary}</a>
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {c.hero.security.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                <Lock className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" /> {s}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-2 text-sm text-slate-400">
            {c.hero.trust.map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-400" /> {t}
              </span>
            ))}
          </div>
        </motion.div>

        <HeroVisual />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Feature showcase                                                     */
/* ------------------------------------------------------------------ */

function Features({ c }: { c: Content }) {
  const reveal = useReveal();
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
      <motion.div {...reveal} className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">{c.features.heading}</h2>
        <p className="mt-3 text-[15px] text-slate-300">{c.features.sub}</p>
      </motion.div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {c.features.items.map((f, i) => (
          <motion.div
            key={f.title}
            {...reveal}
            transition={{ delay: i * 0.08 }}
            className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition-all hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-white/[0.07]"
          >
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-300 ring-1 ring-emerald-400/20">
              {i === 0 && <Receipt className="h-5 w-5" />}
              {i === 1 && <Users className="h-5 w-5" />}
              {i === 2 && <Landmark className="h-5 w-5" />}
              {i === 3 && <Building2 className="h-5 w-5" />}
            </div>
            <h3 className="text-lg font-bold text-white">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Module showcase (real screenshots)                                   */
/* ------------------------------------------------------------------ */

function Showcase({ c }: { c: Content }) {
  const reveal = useReveal();
  const imgs = [
    { src: "/landing/dz-sales.webp", label: c.tour.sales },
    { src: "/landing/dz-accounting.webp", label: c.tour.accounting },
    { src: "/landing/dz-inventory.webp", label: c.tour.inventory },
    { src: "/landing/dz-dashboard.webp", label: c.tour.dashboard },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <motion.div {...reveal} className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">{c.tour.heading}</h2>
        <p className="mt-3 text-[15px] text-slate-300">{c.tour.sub}</p>
      </motion.div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {imgs.map((im, i) => (
          <motion.div
            key={im.src}
            {...reveal}
            transition={{ delay: i * 0.06 }}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5"
          >
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={im.src}
                alt={im.label}
                fill
                sizes="(max-width: 640px) 100vw, 25vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent p-3 text-sm font-medium text-white">
              {im.label}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Interactive demo: IRG / Payroll + Invoice                            */
/* ------------------------------------------------------------------ */

function Row({ label, value, pct, tone }: { label: string; value: string; pct: number; tone: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-slate-400">{label}</span>
        <span className={cn("font-medium", tone)}>{value}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full rounded-full bg-current", tone)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function PayrollCalculator({ c }: { c: Content }) {
  const [gross, setGross] = React.useState(60000);
  const p = c.demo.payroll;
  const cnas = gross * 0.09;
  const other = gross * 0.01;
  const taxable = Math.max(0, gross - cnas - other);
  const irg = computeIrg(taxable);
  const net = gross - cnas - other - irg;
  const pct = (v: number) => (gross > 0 ? Math.round((v / gross) * 100) : 0);

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-slate-300">{p.label}</label>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2">
          <input
            type="range"
            min={15000}
            max={300000}
            step={1000}
            value={gross}
            onChange={(e) => setGross(Number(e.target.value))}
            className="flex-1 accent-emerald-500"
          />
          <span className="w-28 text-end text-sm font-semibold text-white">{formatDZD(gross)}</span>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <Row label={p.cnas} value={formatDZD(cnas)} pct={pct(cnas)} tone="text-cyan-300" />
        <Row label={p.other} value={formatDZD(other)} pct={pct(other)} tone="text-cyan-300" />
        <Row label={p.irg} value={formatDZD(irg)} pct={pct(irg)} tone="text-amber-300" />
      </div>

      <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-center">
        <p className="text-xs text-emerald-200/80">{p.net}</p>
        <p className="text-2xl font-bold text-emerald-300">{formatDZD(net)}</p>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-400">{p.disclaimer}</p>
    </div>
  );
}

function InvoicePreview({ c }: { c: Content }) {
  const [ht, setHt] = React.useState(100000);
  const inv = c.demo.invoice;
  const tva = ht * 0.19;
  const ttc = ht + tva;
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <FileText className="h-4 w-4 text-emerald-400" /> {inv.title}
        </span>
        <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">{inv.number}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">{inv.ht}</span>
        <input
          type="number"
          value={ht}
          min={0}
          step={1000}
          onChange={(e) => setHt(Math.max(0, Number(e.target.value)))}
          className="ms-auto w-32 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-end text-sm text-white outline-none focus:border-emerald-400/50"
        />
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-slate-400">
          <span>{inv.tva}</span>
          <span className="text-cyan-300">{formatDZD(tva)}</span>
        </div>
        <div className="flex justify-between border-t border-white/10 pt-1 font-semibold text-white">
          <span>{inv.ttc}</span>
          <span className="text-emerald-300">{formatDZD(ttc)}</span>
        </div>
      </div>
    </div>
  );
}

function Demo({ c }: { c: Content }) {
  const reveal = useReveal();
  const [tab, setTab] = React.useState<"payroll" | "invoice">("payroll");
  return (
    <section id="solutions" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
      <motion.div {...reveal} className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">{c.demo.heading}</h2>
        <p className="mt-3 text-[15px] text-slate-300">{c.demo.sub}</p>
      </motion.div>

      <motion.div {...reveal} className="mx-auto mt-10 grid max-w-3xl gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="border-white/10 bg-white/5 text-slate-200 shadow-xl">
          <CardContent className="p-5">
            <div className="mb-4 inline-flex rounded-lg bg-white/5 p-1 text-sm">
              <button
                onClick={() => setTab("payroll")}
                className={cn("min-h-[44px] rounded-md px-3 py-2 transition", tab === "payroll" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400")}
              >
                {c.demo.tabPayroll}
              </button>
              <button
                onClick={() => setTab("invoice")}
                className={cn("rounded-md px-3 py-1.5 transition", tab === "invoice" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400")}
              >
                {c.demo.tabInvoice}
              </button>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                {tab === "payroll" ? <PayrollCalculator c={c} /> : <InvoicePreview c={c} />}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {c.demo.side.map((s) => (
            <div key={s.title} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              {s.title === c.demo.side[0].title && <Wallet className="mt-0.5 h-5 w-5 text-emerald-400" />}
              {s.title === c.demo.side[1].title && <Gauge className="mt-0.5 h-5 w-5 text-emerald-400" />}
              {s.title === c.demo.side[2].title && <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-400" />}
              <div>
                <p className="text-sm font-semibold text-white">{s.title}</p>
                <p className="text-sm text-slate-400">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Pricing                                                             */
/* ------------------------------------------------------------------ */

function Pricing({ c }: { c: Content }) {
  const reveal = useReveal();
  const [annual, setAnnual] = React.useState(true);
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
      <motion.div {...reveal} className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">{c.pricing.heading}</h2>
        <p className="mt-3 text-[15px] text-slate-300">{c.pricing.sub}</p>
        <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 p-1 text-sm">
          <button onClick={() => setAnnual(false)} className={cn("rounded-full px-4 py-1.5", !annual ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400")}>
            {c.pricing.monthly}
          </button>
          <button onClick={() => setAnnual(true)} className={cn("rounded-full px-4 py-1.5", annual ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400")}>
            {c.pricing.annual}
          </button>
        </div>
      </motion.div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {c.plans.map((p, i) => {
          const price = annual ? Math.round((PLAN_PRICES[i] * 10) / 12) : PLAN_PRICES[i];
          return (
            <motion.div
              key={p.name}
              {...reveal}
              transition={{ delay: i * 0.08 }}
              className={cn(
                "relative rounded-3xl border p-6 transition-transform duration-300",
                p.popular
                  ? "border-emerald-400/70 bg-gradient-to-b from-emerald-500/15 to-cyan-500/5 shadow-xl shadow-emerald-500/20 ring-2 ring-emerald-400/40 lg:scale-[1.05]"
                  : "border-white/10 bg-white/5 hover:bg-white/[0.07]",
              )}
            >
              {p.popular && (
                <span className="absolute -top-3.5 right-1/2 translate-x-1/2 rtl:translate-x-[-50%] whitespace-nowrap rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-1 text-xs font-bold uppercase tracking-wide text-slate-950 shadow-lg shadow-emerald-500/30">
                  {c.pricing.popular}
                </span>
              )}
              <h3 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">{p.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight text-white sm:text-[42px] sm:leading-none">{formatDZD(price)}</span>
                <span className="pb-1 text-sm text-slate-300">{c.pricing.perMonth}</span>
              </div>
              <p className="mt-1 text-sm text-slate-400">{annual ? c.pricing.billedYearly : c.pricing.billedMonthly}</p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-slate-200">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" /> {f}
                  </li>
                ))}
              </ul>
              <Button asChild className={cn("mt-6 w-full", p.popular ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950" : "bg-white/10 text-white hover:bg-white/15")}>
                <Link href="/register">{c.pricing.start}</Link>
              </Button>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Social proof (témoignages)                                          */
/* ------------------------------------------------------------------ */

function Social({ c }: { c: Content }) {
  const reveal = useReveal();
  return (
    <section id="social" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
      <motion.div {...reveal} className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
          <Star className="h-3.5 w-3.5" /> {c.social.badge}
        </span>
        <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">{c.social.heading}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-[15px] text-slate-300">{c.social.sub}</p>
      </motion.div>

      {/* Bande « logos » : marques partenaires */}
      <motion.div {...reveal} className="mt-10 overflow-hidden">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {c.social.logos.map((logo) => (
            <span
              key={logo}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-400"
            >
              <Landmark className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              {logo}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Cartes témoignages */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {c.social.testimonials.map((item, i) => (
          <motion.figure
            key={item.name}
            {...reveal}
            transition={{ delay: i * 0.08 }}
            className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6"
          >
            <div className="flex text-emerald-400" aria-label="5 étoiles sur 5">
              {Array.from({ length: 5 }).map((_, s) => (
                <Star key={s} className="h-4 w-4 fill-current" aria-hidden="true" />
              ))}
            </div>
            <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-slate-300">
              « {item.quote} »
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 text-sm font-bold text-slate-950">
                {item.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">{item.name}</span>
                <span className="block text-xs text-slate-500">{item.role}</span>
              </span>
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

function Faq({ c }: { c: Content }) {
  const reveal = useReveal();
  const [openIdx, setOpenIdx] = React.useState<number | null>(0);
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
      <motion.div {...reveal} className="text-center">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">{c.faq.heading}</h2>
        <p className="mx-auto mt-3 max-w-xl text-[15px] text-slate-300">{c.faq.sub}</p>
      </motion.div>
      <div className="mt-8 space-y-3">
        {c.faq.items.map((item, i) => {
          const open = openIdx === i;
          return (
            <div key={item.q} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <button
                onClick={() => setOpenIdx(open ? null : i)}
                aria-expanded={open}
                aria-controls={`faq-answer-${i}`}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-5 py-4 text-right text-[15px] font-medium transition-colors",
                  open ? "text-white" : "text-slate-100 hover:text-white",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors", open ? "bg-gradient-to-br from-emerald-500 to-cyan-500 text-slate-950" : "bg-white/10 text-slate-400")}>
                    {i + 1}
                  </span>
                  {item.q}
                </span>
                <ChevronDown className={cn("h-5 w-5 shrink-0 transition-transform duration-300", open ? "rotate-180 text-emerald-300" : "text-slate-400")} />
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    key={item.q}
                    id={`faq-answer-${i}`}
                    role="region"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                    aria-hidden={!open}
                  >
                    <div className="relative mx-4 mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
                      <div className="mb-2 flex items-center gap-2 ">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500/15">
                          <Check className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                          {c.faq.replyLabel}
                        </span>
                      </div>
                      <p className="text-[15px] leading-relaxed text-slate-200">{item.a}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA + Footer                                                  */
/* ------------------------------------------------------------------ */

function FinalCta({ c }: { c: Content }) {
  const reveal = useReveal();
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <motion.div
        {...reveal}
        className="relative overflow-hidden rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-600/20 via-slate-900 to-cyan-600/20 px-6 py-12 text-center sm:px-12"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />
        <h2 className="text-2xl font-bold text-white sm:text-3xl">{c.finalCta.heading}</h2>
        <p className="mx-auto mt-3 max-w-xl text-[15px] text-slate-200">{c.finalCta.sub}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 hover:from-emerald-400 hover:to-emerald-500">
            <Link href="/register">{c.finalCta.ctaPrimary}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-emerald-400/40 bg-white/5 text-slate-100 hover:border-emerald-300/60 hover:bg-white/10 hover:text-white">
            <a href={buildWhatsAppHref()} target="_blank" rel="noopener noreferrer">{c.finalCta.ctaSecondary}</a>
          </Button>
        </div>
      </motion.div>
    </section>
  );
}

function Footer({ c }: { c: Content }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/10 bg-slate-950/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2 font-bold text-white">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 text-slate-950">
            <Landmark className="h-4 w-4" />
          </span>
          DzERP
        </div>
        <p className="text-[15px] text-slate-300">© {year} DzERP</p>
        <div className="flex items-center gap-3 text-slate-300">
          <Globe className="h-4 w-4" />
          <span className="text-[15px]">{c.footer.langs}</span>
        </div>
        <div className="flex items-center gap-4 text-[15px]">
          <Link href="/faq" className="text-slate-300 transition-colors hover:text-emerald-300">
            الأسئلة الشائعة
          </Link>
          <Link href="/security" className="text-slate-300 transition-colors hover:text-emerald-300">
            الأمان والخصوصية
          </Link>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Floating WhatsApp support button                                    */
/* ------------------------------------------------------------------ */

function WhatsAppButton() {
  return (
    <a
      href={buildWhatsAppHref()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp support"
      className="fixed bottom-4 end-4 z-50 grid h-12 w-12 place-items-center rounded-full bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 transition-transform hover:scale-105"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
        <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.157 5.327 5.484 0 12.054 0a11.92 11.92 0 018.453 3.518 11.94 11.94 0 013.508 8.464c-.003 6.557-5.338 11.892-11.904 11.892a11.9 11.9 0 01-5.76-1.466L.057 24zm6.597-3.594l.428.25c1.62.952 3.397 1.455 5.22 1.455 5.93 0 10.757-4.81 10.76-10.74 0-2.87-1.118-5.567-3.147-7.598a10.72 10.72 0 00-7.61-3.156c-5.93 0-10.758 4.81-10.76 10.74 0 1.786.43 3.52 1.246 5.083l.28.63-1.18 4.31zm11.357-8.48c-.064-.11-.232-.176-.488-.31-.256-.135-1.516-.78-1.75-.87-.236-.09-.407-.135-.578.135-.17.27-.66.868-.808 1.046-.148.18-.296.202-.552.068-.256-.135-1.083-.406-2.063-1.298-.762-.694-1.277-1.55-1.427-1.81-.15-.27-.016-.416.112-.55.116-.116.258-.302.387-.453.13-.15.172-.258.258-.43.086-.173.043-.324-.022-.46-.064-.135-.578-1.398-.792-1.91-.208-.5-.42-.43-.578-.44-.15-.008-.323-.01-.494-.01-.17 0-.448.064-.682.324-.234.26-.894.874-.894 2.13 0 1.256.918 2.47 1.046 2.64.13.17 1.82 2.78 4.408 3.895.616.266 1.096.426 1.47.546.617.197 1.18.17 1.625.103.496-.074 1.516-.62 1.73-1.22.214-.6.214-1.113.15-1.22-.064-.108-.236-.174-.496-.31z" />
      </svg>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function PublicHomePage() {
  const [lang, setLang] = React.useState<Lang>("ar");
  const c = dict[lang];
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 font-sans text-slate-200">
      <Nav c={c} lang={lang} setLang={setLang} />
      <main>
        <Hero c={c} />
        <Features c={c} />
        <Showcase c={c} />
        <Demo c={c} />
        <Pricing c={c} />
        <Social c={c} />
        <Faq c={c} />
        <FinalCta c={c} />
      </main>
      <Footer c={c} />
      <WhatsAppButton />
    </div>
  );
}
