import type { Locale } from "@/lib/constants";

export const DZERP_WHATSAPP_NUMBER = "+213777321649";
export const WHATSAPP_DEFAULT_MESSAGE =
  "Bonjour, je souhaite essayer DzERP pour mon entreprise.";

export const PLAN_PRICES = [2900, 5900, 11900] as const;

export type ShowcaseStageKey =
  | "dashboard"
  | "sales"
  | "stock"
  | "accounting"
  | "taxes"
  | "final";

export type DemoKey = "payroll" | "invoice";

export interface ShowcaseStage {
  key: ShowcaseStageKey;
  icon: string;
  title: string;
  desc: string;
  term: string;
}

export interface Content {
  nav: {
    modules: string;
    workflow: string;
    pricing: string;
    faq: string;
    login: string;
    cta: string;
    dashboard: string;
    menu: string;
    langLabel: string;
  };
  hero: {
    badge: string;
    title1: string;
    title2: string;
    titleAccent: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    trust: string[];
    scrollHint: string;
  };
  stats: { value: string; label: string }[];
  showcase: {
    eyebrow: string;
    heading: string;
    sub: string;
    step: string;
    hint: string;
    stages: ShowcaseStage[];
  };
  modules: {
    heading: string;
    sub: string;
    hint: string;
    items: {
      icon: string;
      title: string;
      desc: string;
    }[];
  };
  workflow: {
    eyebrow: string;
    heading: string;
    sub: string;
    steps: { title: string; desc: string }[];
  };
  taxes: {
    eyebrow: string;
    heading: string;
    sub: string;
    badge: string;
    items: {
      code: string;
      label: string;
      desc: string;
    }[];
    note: string;
  };
  security: {
    eyebrow: string;
    heading: string;
    sub: string;
    items: {
      icon: string;
      title: string;
      desc: string;
    }[];
  };
  demo: {
    eyebrow: string;
    heading: string;
    sub: string;
    tabPayroll: string;
    tabInvoice: string;
    payroll: {
      title: string;
      gross: string;
      grossSel: string;
      employees: string;
      dailyWage: string;
      days: string;
      periodDays: string;
      baseLabel: string;
      cnase: string;
      cnaseDesc: string;
      casnos: string;
      casnosDesc: string;
      irg: string;
      irgDesc: string;
      net: string;
      employer: string;
    };
    invoice: {
      title: string;
      base: string;
      baseSel: string;
      rate: string;
      rateSel: string;
      quantity: string;
      discount: string;
      discountSel: string;
      pct: string;
      discountOff: string;
      tva: string;
      timbre: string;
      total: string;
      ht: string;
    };
    currency: string;
  };
  pricing: {
    eyebrow: string;
    heading: string;
    sub: string;
    month: string;
    popular: string;
    perMonth: string;
    start: string;
    note: string;
    plans: {
      name: string;
      tagline: string;
      features: string[];
      popular?: boolean;
    }[];
  };
  social: {
    eyebrow: string;
    heading: string;
    sub: string;
    badge: string;
    testimonials: { name: string; role: string; quote: string }[];
    logos: string;
  };
  faq: {
    eyebrow: string;
    heading: string;
    sub: string;
    items: { q: string; a: string }[];
  };
  finalCta: {
    heading: string;
    sub: string;
    ctaPrimary: string;
    ctaSecondary: string;
    note: string;
  };
  footer: {
    tagline: string;
    rights: string;
    whatsappLabel: string;
    columns: {
      title: string;
      links: { label: string; href: string; external?: boolean }[];
    }[];
  };
  whatsapp: {
    label: string;
  };
}

export const CONTENT: Record<Locale, Content> = {
  ar: {
    nav: {
      modules: "الوحدات",
      workflow: "سير العمل",
      pricing: "الأسعار",
      faq: "الأسئلة الشائعة",
      login: "تسجيل الدخول",
      cta: "ابدأ الآن",
      dashboard: "لوحة التحكم",
      menu: "القائمة",
      langLabel: "اللغة",
    },
    hero: {
      badge: "نظام مغاربي متكامل لإدارة الشركات",
      title1: "كل عمليات مؤسستك",
      title2: "في",
      titleAccent: "نظام واحد",
      subtitle:
        "DzERP يجمع المبيعات، الشراء، المخزون، المحاسبة، شؤون الموظفين والجباية في منصة واحدة. متوافق مع القوانين الجزائرية: TVA, TAP, IRG, CNAS، ومخطط SCF للمحاسبة.",
      ctaPrimary: "جرّب مجاناً",
      ctaSecondary: "اكتشف الطريقة",
      trust: [
        "تجربة مجانية 14 يوماً",
        "مرافق للقوانين الجزائرية",
        "متعدد الشركات والفروع",
      ],
      scrollHint: "مرّر لاستكشاف المنصة",
    },
    stats: [
      { value: "9", label: "وحدات متكاملة" },
      { value: "3", label: "لغات (AR / FR / EN)" },
      { value: "100%", label: "محلي للحوسبة الجزائرية" },
      { value: "14", label: "يوم تجربة مجانية" },
    ],
    showcase: {
      eyebrow: "استكشف المنصة",
      heading: "رحلة عبر الوحدات داخل الواجهة",
      sub: "مرّر لتشاهد كيف تتحول لوحة التحكم خطوة بخطوة مع كل وحدة من وحدات DzERP.",
      step: "المرحلة",
      hint: "مرّر أو انقر على المراحل",
      stages: [
        {
          key: "dashboard",
          icon: "space_dashboard",
          title: "لوحة تحكم أحادية",
          desc: "نظرة شاملة على المبيعات، العملاء، والمخزون في آن واحد، بدون الحاجة إلى عدة تطبيقات.",
          term: "الرؤية الشاملة",
        },
        {
          key: "sales",
          icon: "point_of_sale",
          title: "دورة المبيعات",
          desc: "من عرض السعر إلى أمر البيع ثم التسليم والفواتير، مع تتبع كل مستند بالحالة والدقة المطلوبة.",
          term: "المبيعات والتحصيل",
        },
        {
          key: "stock",
          icon: "inventory_2",
          title: "إدارة المخزون",
          desc: "تتبع المنتجات في المخازن والمواقع مع تحديث الكميات تلقائياً عند كل تسليم أو استلام.",
          term: "مخزون دقيق",
        },
        {
          key: "accounting",
          icon: "account_balance",
          title: "المحاسبة والمالية",
          desc: "يومية، تسوية، دفتر الأستاذ، وفق مخطط محاسب وطني SCF مع تقارير مالية متكاملة.",
          term: "مطابقة SCF",
        },
        {
          key: "taxes",
          icon: "calculate",
          title: "الجباية الجزائرية",
          desc: "احتساب TVA, TAP وIRG تلقائياً مع التصريح الشهري المطابق لمتطلبات الجباية.",
          term: "TVA · TAP · IRG",
        },
        {
          key: "final",
          icon: "hub",
          title: "مؤسستك كلها في نظام واحد",
          desc: "جدول قيادة واحد يربط كل الوحدات: من الطلب الأول إلى التصريح الجبائي، بلا تكرار ولا انقطاع.",
          term: "كل العمليات · نظام واحد",
        },
      ],
    },
    modules: {
      heading: "وحدات متكاملة",
      sub: "كل وحدة جزء من نظام واحد، البيانات تتدفق فيما بينها تلقائياً.",
      hint: "مرّر فوق بطاقة أو انقر عليها لترى الواجهة",
      items: [
        {
          icon: "point_of_sale",
          title: "المبيعات و المستندات",
          desc: "عروض أسعار، أوامر بيع، تسليمات وفواتير مع تحويلات بين المستندات.",
        },
        {
          icon: "groups",
          title: "العملاء و الموردون",
          desc: "سجل مركزي مع مسميات عربية وفرنسية، أرصدة ووثائق لكل طرف.",
        },
        {
          icon: "warehouse",
          title: "المخزون",
          desc: "منتجات، مخازن ومواقع، وتحويلات وحركات مع تحديث الكميات لحظياً.",
        },
        {
          icon: "local_shipping",
          title: "الشراء و التوريد",
          desc: "عروض الشراء، أوامر الشراء، الاستلام وفواتير الشراء.",
        },
        {
          icon: "account_balance",
          title: "المحاسبة",
          desc: "يومية، دفتر الأستاذ، سندات تسديد وأرصدة وفق SCF.",
        },
        {
          icon: "precision_manufacturing",
          title: "الإنتاج و MRP",
          desc: "قوائم مكونات BOM، أوامر الإنتاج بشيفرة جزائرية وفق ما تقتضيه القوانين.",
        },
        {
          icon: "badge",
          title: "شؤون الموظفين",
          desc: "ملفات الموظفين، الحضور، والأجور مع الاقتطاعات: CNAS, CASNOS وIRG.",
        },
        {
          icon: "receipt_long",
          title: "المراجع و الجباية",
          desc: "RTIMA, رقم التعريف الجبائي, وأرقام TAP مع التتبع القانوني المرتبط بها.",
        },
      ],
    },
    workflow: {
      eyebrow: "سير العمل",
      heading: "من البيع إلى التصريح الجبائي",
      sub: "مثال بسيط عن كيفية تنقل البيانات عبر الوحدات تلقائياً دون إعادة إدخال.",
      steps: [
        { title: "فاتورة البيع", desc: "وثيقة بمبلغ بدون ضريبة TVA 19%" },
        { title: "التسليم", desc: "ينقص الكميات من المخزون" },
        { title: "دفتر المحاسبة", desc: "توليد اليومية تلقائياً" },
        { title: "الاقتطاع IRG", desc: "احتساب الضريبة على الدخل" },
        { title: "تصريح TVA", desc: "جمع الضرائب للتصريح الشهري" },
      ],
    },
    taxes: {
      eyebrow: "مطابقة جزائرية",
      heading: "جباية تحترم القانون الجزائري",
      sub: "أعدّ لكل سيناريو جبائي في الجزائر — بلمسة واحدة.",
      badge: "متوافق",
      items: [
        { code: "TVA", label: "19%", desc: "الضريبة على القيمة المضافة للبيع والشراء" },
        { code: "TAP", label: "2%", desc: "الضريبة على النشاط المهني" },
        { code: "IRG", label: "الاقتطاع عند المصدر", desc: "مقيّد للدخل من الأجور" },
        { code: "SCF", label: "المخطط الوطني", desc: "مرجع موحد للبنية المحاسبية" },
        { code: "CNAS", label: "أجراء", desc: "الاشتراكات الاجتماعية لأصحاب العمل" },
        { code: "CASNOS", label: "غير أجراء", desc: "الضمان الاجتماعي للأشخاص غير الأجراء" },
      ],
      note: "تُنجز الترقيمات والاقتطاعات تلقائياً وفق سيناريوهات كل شركة.",
    },
    security: {
      eyebrow: "الأمان",
      heading: "أمان صارم في جوهر النظام",
      sub: "عزل مطلق بين الشركات وقواعد التحقق على الخادم.",
      items: [
        {
          icon: "domain_disabled",
          title: "عزل المتعدد الشركات",
          desc: "كل شركة معزولة بمجالها الخاص في الخادم، لا تسريب بين الشركات أو الفروع.",
        },
        {
          icon: "admin_panel_settings",
          title: "صلاحيات أدوار متقدمة",
          desc: "صلاحيات لكل دور عبر مفاتيح صلاحية، مع التحقق منها على الخادم دائماً.",
        },
        {
          icon: "history_edu",
          title: "سجل تدقيق كامل",
          desc: "كل عملية محسوبة، كل تغيير محفوظ، كل تحديث متتبَّع يحدده المستخدم.",
        },
        {
          icon: "vpn_lock",
          title: "جلسات مشفرة",
          desc: "جلسات آمنة، كلمات مرور مشفرة، سياسات كلمة مرور افتراضية في أول تسجيل دخول.",
        },
      ],
    },
    demo: {
      eyebrow: "جرّبه",
      heading: "احتساب الشهرية في ثوانٍ",
      sub: "جرب المحرك الفعلي للرواتب والفواتير في الجزائر مباشرة في هذه الصفحة.",
      tabPayroll: "احتساب الراتب",
      tabInvoice: "فاتورة مع TVA",
      payroll: {
        title: "احتساب الشهرية",
        gross: "الراتب الخام الشهري",
        grossSel: "الراتب الخام الشهري",
        employees: "عدد الأجراء",
        dailyWage: "الأجرة اليومية",
        days: "أيام العمل",
        periodDays: "أيام الفترة",
        baseLabel: "الأجر الخاضع للاقتطاع",
        cnase: "صندوق CNAS",
        cnaseDesc: "حصتك من النظام",
        casnos: "صندوق CASNOS",
        casnosDesc: "حصتك من النظام",
        irg: "اقتطاع IRG",
        irgDesc: "ضريبة على دخل الأجير",
        net: "الأجر الصافي",
        employer: "تكلفة صاحب العمل",
      },
      invoice: {
        title: "فاتورة البيع",
        base: "المبلغ بدون الضريبة",
        baseSel: "المبلغ بدون الضريبة",
        rate: "نسبة الضريبة",
        rateSel: "نسبة الضريبة",
        quantity: "الكمية",
        discount: "الخصم",
        discountSel: "الخصم",
        pct: "%",
        discountOff: "مبلغ الخصم",
        tva: "قيمة TVA",
        timbre: "طابع",
        total: "إجمالي الفاتورة",
        ht: "المجموع بدون الضريبة",
      },
      currency: "دج",
    },
    pricing: {
      eyebrow: "الأسعار",
      heading: "بسعر يناسب الجميع",
      sub: "بدون مصاريف خفية، بدون إعادة بيع. دفعة واحدة شهرياً.",
      month: "شهرياً",
      popular: "الأكثر طلباً",
      perMonth: "/ شهر",
      start: "ابدأ الآن",
      note: "أسعار بالدينار الجزائري (DZD). التجربة المجانية 14 يوماً دون بطاقة بنكية.",
      plans: [
        {
          name: "أساسية",
          tagline: "للشركات الصغيرة التي تبدأ",
          features: [
            "الحد الأقصى لـ 10 أجراء",
            "وحدات المحاسبة والمبيعات",
            "تسلسل المستندات الجزائري",
            "الدردشة وMessenger",
          ],
        },
        {
          name: "مؤسسة",
          tagline: "للنمو السريع",
          features: [
            "الحد الأقصى لـ 50 أجراء",
            "جميع الوحدات متكاملة",
            "تحديثات مجانية",
            "المساعدة في إعداد النظام",
            "طباعة تقارير كاملة",
          ],
          popular: true,
        },
        {
          name: "مؤسسة +",
          tagline: "للمؤسسات الكبيرة",
          features: [
            "أجراء غير محدود",
            "كل مزايا خطة المؤسسة",
            "15GB من التخزين",
            "التكامل مع RTIMA",
          ],
        },
      ],
    },
    social: {
      eyebrow: "آراء العملاء",
      heading: "موثوق من قبل الشركات",
      sub: "من محاسبين، مدراء ومؤسسين في جميع أنحاء الجزائر.",
      badge: "موثوق من",
      testimonials: [
        {
          name: "محاسب",
          role: "لشركة تصدير",
          quote: "الترقيم الجزائري وكشف التسوية وفواتير TVA؟ كل شيء جاهز.",
        },
        {
          name: "مدير شركة",
          role: "في قطاع البناء",
          quote: "حالاً قارن المبيعات اليومية، المخزون والرواتب من لوحة تحكم واحدة.",
        },
        {
          name: "مؤسِّس",
          role: "متحرر",
          quote: "الاحتساب الجزائري من CNAS وIRG يتحقق تلقائياً.",
        },
      ],
      logos: "عقود من علاقات الشركاء",
    },
    faq: {
      eyebrow: "الأسئلة الشائعة",
      heading: "من يصنع عن ماذا؟",
      sub: "إجابات قصيرة للأسئلة الأكثر شيوعاً حول DzERP.",
      items: [
        {
          q: "ما هي الوحدات المتوفرة؟",
          a: "المبيعات، الشراء، المخزون، المحاسبة، شؤون الموظفين، الإنتاج والجباية — كلها في نظام واحد متكامل.",
        },
        {
          q: "كيف تُدار الشركات المتعددة؟",
          a: "بوابة مسؤولة توحد الشركات، ويتخرج كل مستخدم مع دور محدد في كل شركة — مع عزل كامل للبيانات.",
        },
        {
          q: "هل تنفذ الترتيبات الجبائية؟",
          a: "مع TVA، TAP، IRG، CNAS، CASNOS وأنواع المستندات الجزائرية المتسقة مع RTIMA.",
        },
        {
          q: "هل يشتغل على الهاتف؟",
          a: "نعم، تجري النسخة الجديدة بتجاوب كامل على الهاتف — والتطبيقات القادمة قريباً قيد التطوير.",
        },
        {
          q: "كيف أرتبط؟",
          a: "قم بالتسجيل بدون بطاقة بنكية، ثم جهز لوحة التحكم عبر الإنترنت — مع واجهات عربية وفرنسية وإنجليزية.",
        },
        {
          q: "أين تخزين البيانات؟",
          a: "الخصوصية والأمان أساسيان: يتم تشفير البيانات والتقارير والتخزين في الجزائر — أجزاء المؤسسة مخصصة للاستضافة في الخارج.",
        },
      ],
    },
    finalCta: {
      heading: "كل أعمالك. نظام واحد.",
      sub: "انضم إلى الشركات التي تدير أعمالها بأمان مع DzERP.",
      ctaPrimary: "ابدأ الآن مجاناً",
      ctaSecondary: "تواصل معنا",
      note: "بدون بطاقة بنكية. إلغاء في أي وقت.",
    },
    footer: {
      tagline: "نظام ERP شامل لمؤسسات جزائرية بدوني صعوبات.",
      rights: "© 2026. DzERP. جميع الحقوق محفوظة.",
      whatsappLabel: "تواصل عبر واتساب",
      columns: [
        {
          title: "الوحدات",
          links: [
            { label: "المبيعات", href: "#modules" },
            { label: "المخزون", href: "#modules" },
            { label: "المحاسبة", href: "#modules" },
            { label: "الجباية", href: "#taxes" },
          ],
        },
        {
          title: "انطلق",
          links: [
            { label: "تجربة مجانية", href: "/register" },
            { label: "تسجيل الدخول", href: "/login" },
            { label: "الأسئلة الشائعة", href: "/faq" },
            { label: "الأمان", href: "/security" },
          ],
        },
        {
          title: "دعم",
          links: [
            { label: "تواصل معنا", href: "", external: true },
            { label: "الأسئلة الشائعة", href: "/faq" },
            { label: "خصوصية", href: "/security" },
          ],
        },
      ],
    },
    whatsapp: {
      label: "اتصل بنا",
    },
  },
  fr: {
    nav: {
      modules: "Modules",
      workflow: "Parcours",
      pricing: "Tarifs",
      faq: "FAQ",
      login: "Connexion",
      cta: "Commencer",
      dashboard: "Tableau de bord",
      menu: "Menu",
      langLabel: "Langue",
    },
    hero: {
      badge: "ERP algérien tout-en-un",
      title1: "Toute votre entreprise",
      title2: "dans",
      titleAccent: "un seul système",
      subtitle:
        "DzERP réunit ventes, achats, stock, comptabilité, RH et fiscalité dans une seule plateforme. Conforme aux règles algériennes : TVA, TAP, IRG, CNAS et plan comptable SCF.",
      ctaPrimary: "Essai gratuit",
      ctaSecondary: "Voir comment ça marche",
      trust: [
        "14 jours d'essai gratuit",
        "Conforme à la législation algérienne",
        "Multi-entreprises et multi-succursales",
      ],
      scrollHint: "Faites défiler pour explorer",
    },
    stats: [
      { value: "9", label: "modules intégrés" },
      { value: "3", label: "langues (AR / FR / EN)" },
      { value: "100%", label: "logique locale algérienne" },
      { value: "14", label: "jours d'essai gratuit" },
    ],
    showcase: {
      eyebrow: "Explorez la plateforme",
      heading: "Une histoire racontée par l'interface",
      sub: "Faites défiler pour voir le tableau de bord évoluer d'une étape à l'autre à travers les modules de DzERP.",
      step: "Étape",
      hint: "Défilez ou cliquez sur les étapes",
      stages: [
        {
          key: "dashboard",
          icon: "space_dashboard",
          title: "Tableau de bord unique",
          desc: "Ventes, clients et stock en un seul écran, sans jongler entre plusieurs applications.",
          term: "La vue d'ensemble",
        },
        {
          key: "sales",
          icon: "point_of_sale",
          title: "Cycle de vente",
          desc: "Du devis à l'encaissement : bon de livraison, facture et suivi après-vente, avec l'état de chaque document.",
          term: "Ventes et encaissements",
        },
        {
          key: "stock",
          icon: "inventory_2",
          title: "Gestion du stock",
          desc: "Produits et entrepôts avec mise à jour automatique des quantités à chaque livraison ou réception.",
          term: "Stock en temps réel",
        },
        {
          key: "accounting",
          icon: "account_balance",
          title: "Comptabilité & finance",
          desc: "Journaux, grand livre et rapprochements, alignés sur le plan comptable national SCF.",
          term: "Aligné SCF",
        },
        {
          key: "taxes",
          icon: "calculate",
          title: "Fiscalité algérienne",
          desc: "TVA, TAP et IRG calculés automatiquement, prêts pour la déclaration mensuelle.",
          term: "TVA · TAP · IRG",
        },
        {
          key: "final",
          icon: "hub",
          title: "Votre entreprise dans un seul système",
          desc: "Un cockpit qui relie tous les modules : de la première commande à la déclaration fiscale, sans redondance.",
          term: "Toutes les opérations · un seul système",
        },
      ],
    },
    modules: {
      heading: "Modules intégrés",
      sub: "Chaque module fait partie d'un même système : les données circulent automatiquement.",
      hint: "Survolez ou cliquez sur une carte pour voir l'interface",
      items: [
        {
          icon: "point_of_sale",
          title: "Ventes & documents",
          desc: "Devis, commandes, livraisons et factures avec conversions entre documents.",
        },
        {
          icon: "groups",
          title: "Clients & fournisseurs",
          desc: "Registre central avec double nom (ar/fr), soldes et documents par tiers.",
        },
        {
          icon: "warehouse",
          title: "Stock & entrepôts",
          desc: "Produits, emplacements, transferts et mouvements, quantités mises à jour.",
        },
        {
          icon: "local_shipping",
          title: "Achats & approvisionnement",
          desc: "Demandes, commandes fournisseur, réceptions et factures d'achat.",
        },
        {
          icon: "account_balance",
          title: "Comptabilité",
          desc: "Journaux, grand livre, paiements et balances alignés sur le SCF.",
        },
        {
          icon: "precision_manufacturing",
          title: "Production & MRP",
          desc: "Nomenclatures, ordres de fabrication, suivi de capacité et gammes.",
        },
        {
          icon: "badge",
          title: "Ressources humaines",
          desc: "Fiches employés, présence, paie avec cotisations CNAS, CASNOS et IRG.",
        },
        {
          icon: "receipt_long",
          title: "Références & fiscalité",
          desc: "NIF, RTIMA, registre du commerce et codes TAP suivis automatiquement.",
        },
      ],
    },
    workflow: {
      eyebrow: "Parcours",
      heading: "De la vente à la déclaration fiscale",
      sub: "Un exemple : les données traversent les modules automatiquement, sans ressaisie.",
      steps: [
        { title: "Facture de vente", desc: "document HT avec TVA 19%" },
        { title: "Livraison", desc: "déduit les quantités du stock" },
        { title: "Livre comptable", desc: "génère l'écriture automatiquement" },
        { title: "Retenue IRG", desc: "calcule l'impôt sur le salaire" },
        { title: "Déclaration TVA", desc: "agrège les taxes pour la déclaration" },
      ],
    },
    taxes: {
      eyebrow: "Conformité algérienne",
      heading: "Une fiscalité qui respecte la loi algérienne",
      sub: "Couvrez chaque scénario fiscal en Algérie — en un seul clic.",
      badge: "Conforme",
      items: [
        { code: "TVA", label: "19%", desc: "taxe sur la valeur ajoutée des ventes et achats" },
        { code: "TAP", label: "2%", desc: "taxe sur l'activité professionnelle" },
        { code: "IRG", label: "retenue à la source", desc: "impôt sur le revenu salarial" },
        { code: "SCF", label: "plan national", desc: "référentiel unique de la structure comptable" },
        { code: "CNAS", label: "salariés", desc: "cotisations sociales employeur/employé" },
        { code: "CASNOS", label: "non-salariés", desc: "sécurité sociale des travailleurs indépendants" },
      ],
      note: "Numérotations et retenues calculées automatiquement selon le scénario de chaque société.",
    },
    security: {
      eyebrow: "Sécurité",
      heading: "Une sécurité stricte au cœur du système",
      sub: "Isolation totale multi-entreprises et validation des permissions côté serveur.",
      items: [
        {
          icon: "domain_disabled",
          title: "Isolation multi-entreprises",
          desc: "Chaque société est isolée dans son propre champ côté serveur : aucune fuite entre sociétés ou succursales.",
        },
        {
          icon: "admin_panel_settings",
          title: "Permissions par rôle",
          desc: "Permissions granulaires par rôle via des clés d'autorisation, toujours vérifiées côté serveur.",
        },
        {
          icon: "history_edu",
          title: "Journal d'audit complet",
          desc: "Chaque opération est comptabilisée, chaque changement conservé, chaque mise à jour imputée à son auteur.",
        },
        {
          icon: "vpn_lock",
          title: "Sessions chiffrées",
          desc: "Sessions sécurisées, mots de passe chiffrés et politique de changement au premier login.",
        },
      ],
    },
    demo: {
      eyebrow: "Essayez",
      heading: "Calcul de paie en quelques secondes",
      sub: "Testez le vrai moteur de paie et de facturation algérien, directement dans cette page.",
      tabPayroll: "Calcul de paie",
      tabInvoice: "Facture avec TVA",
      payroll: {
        title: "Calcul de paie",
        gross: "Salaire brut mensuel",
        grossSel: "Salaire brut mensuel",
        employees: "Nombre d'employés",
        dailyWage: "Salaire journalier",
        days: "Jours travaillés",
        periodDays: "Jours de la période",
        baseLabel: "Base soumise à retenue",
        cnase: "Caisse CNAS",
        cnaseDesc: "Part employeur",
        casnos: "Caisse CASNOS",
        casnosDesc: "Part employeur",
        irg: "Retenue IRG",
        irgDesc: "Impôt sur le salaire",
        net: "Salaire net",
        employer: "Coût employeur",
      },
      invoice: {
        title: "Facture de vente",
        base: "Montant hors taxes",
        baseSel: "Montant hors taxes",
        rate: "Taux",
        rateSel: "Taux",
        quantity: "Quantité",
        discount: "Remise",
        discountSel: "Remise",
        pct: "%",
        discountOff: "Montant remise",
        tva: "TVA",
        timbre: "Timbre",
        total: "Total facture",
        ht: "Sous-total HT",
      },
      currency: "DZD",
    },
    pricing: {
      eyebrow: "Tarifs",
      heading: "Des prix simples et justes",
      sub: "Sans frais cachés, sans revendeurs. Un seul abonnement mensuel.",
      month: "par mois",
      popular: "Le plus populaire",
      perMonth: "/ mois",
      start: "Commencer",
      note: "Tarifs en dinar algérien (DZD). Essai gratuit de 14 jours, sans carte bancaire.",
      plans: [
        {
          name: "Starter",
          tagline: "Pour les petites structures",
          features: [
            "Jusqu'à 10 employés",
            "Modules compta, ventes, stock",
            "Numérotation des documents (algérienne)",
            "Devis, factures, bons de livraison",
          ],
        },
        {
          name: "Société",
          tagline: "Pour la croissance rapide",
          features: [
            "Jusqu'à 50 employés",
            "Tous les modules intégrés",
            "Mises à jour gratuites",
            "Assistance à la configuration",
            "Impression de rapports complets",
          ],
          popular: true,
        },
        {
          name: "Entreprise",
          tagline: "Pour les grandes organisations",
          features: [
            "Employés illimités",
            "Tous les avantages Société",
            "15 Go de stockage",
            "Intégration RTIMA",
          ],
        },
      ],
    },
    social: {
      eyebrow: "Témoignages",
      heading: "Approuvé par les entreprises",
      sub: "Comptables, directeurs et fondateurs à travers l'Algérie.",
      badge: "Ils nous font confiance",
      testimonials: [
        {
          name: "Comptable",
          role: "d'une société d'exportation",
          quote: "Numérotation algérienne, états de rapprochement et factures TVA ? Tout est prêt.",
        },
        {
          name: "Directeur",
          role: "dans la construction",
          quote: "Je compare ventes du jour, stock et paie depuis un seul tableau de bord.",
        },
        {
          name: "Fondateur",
          role: "indépendant",
          quote: "Le calcul algérien CNAS + IRG se fait automatiquement.",
        },
      ],
      logos: "Des années de partenariat",
    },
    faq: {
      eyebrow: "FAQ",
      heading: "Qui fait quoi ?",
      sub: "Des réponses courtes aux questions les plus fréquentes sur DzERP.",
      items: [
        {
          q: "Quels modules sont disponibles ?",
          a: "Ventes, achats, stock, comptabilité, RH, production et fiscalité — ensemble dans un seul système.",
        },
        {
          q: "Comment gérer plusieurs sociétés ?",
          a: "Un portail administrateur centralise les sociétés ; chaque utilisateur a un rôle défini dans chacune — avec une isolation complète.",
        },
        {
          q: "La conformité fiscale est-elle prise en charge ?",
          a: "Oui : TVA, TAP, IRG, CNAS, CASNOS et des types de documents algériens cohérents avec RTIMA.",
        },
        {
          q: "Fonctionne-t-il sur mobile ?",
          a: "Oui, une version réactive pour mobile est disponible — les applications mobiles sont en cours de développement.",
        },
        {
          q: "Comment démarrer ?",
          a: "Inscrivez-vous sans carte bancaire, puis configurez en ligne — avec des interfaces en arabe, français et anglais.",
        },
        {
          q: "Où sont stockées les données ?",
          a: "Confidentialité et sécurité essentielles : chiffrement et stockage sécurisé et local — l'hébergement hors production est possible en option.",
        },
      ],
    },
    finalCta: {
      heading: "Toute votre activité. Un seul système.",
      sub: "Rejoignez les entreprises qui pilotent leur activité sereinement avec DzERP.",
      ctaPrimary: "Commencer gratuitement",
      ctaSecondary: "Nous contacter",
      note: "Sans carte bancaire. Résiliable à tout moment.",
    },
    footer: {
      tagline: "L'ERP complet pour les entreprises algériennes, sans complexité.",
      rights: "© 2026. DzERP. Tous droits réservés.",
      whatsappLabel: "Écrivez-nous sur WhatsApp",
      columns: [
        {
          title: "Modules",
          links: [
            { label: "Ventes", href: "#modules" },
            { label: "Stock", href: "#modules" },
            { label: "Comptabilité", href: "#modules" },
            { label: "Fiscalité", href: "#taxes" },
          ],
        },
        {
          title: "Démarrer",
          links: [
            { label: "Essai gratuit", href: "/register" },
            { label: "Connexion", href: "/login" },
            { label: "FAQ", href: "/faq" },
            { label: "Sécurité", href: "/security" },
          ],
        },
        {
          title: "Support",
          links: [
            { label: "Nous contacter", href: "", external: true },
            { label: "FAQ", href: "/faq" },
            { label: "Confidentialité", href: "/security" },
          ],
        },
      ],
    },
    whatsapp: {
      label: "Contactez-nous",
    },
  },
  en: {
    nav: {
      modules: "Modules",
      workflow: "Journey",
      pricing: "Pricing",
      faq: "FAQ",
      login: "Login",
      cta: "Start",
      dashboard: "Dashboard",
      menu: "Menu",
      langLabel: "Language",
    },
    hero: {
      badge: "All-in-one Algerian ERP",
      title1: "Your whole business",
      title2: "in",
      titleAccent: "one system",
      subtitle:
        "DzERP brings sales, purchasing, inventory, accounting, HR and taxation into a single platform — compliant with Algerian rules: TVA, TAP, IRG, CNAS and the SCF chart of accounts.",
      ctaPrimary: "Free trial",
      ctaSecondary: "See how it works",
      trust: [
        "14-day free trial",
        "Compliant with Algerian law",
        "Multi-company and multi-branch",
      ],
      scrollHint: "Scroll to explore",
    },
    stats: [
      { value: "9", label: "integrated modules" },
      { value: "3", label: "languages (AR / FR / EN)" },
      { value: "100%", label: "Algerian local logic" },
      { value: "14", label: "days free trial" },
    ],
    showcase: {
      eyebrow: "Explore the platform",
      heading: "A story told by the interface",
      sub: "Scroll to watch the dashboard evolve step by step through the DzERP modules.",
      step: "Step",
      hint: "Scroll or click the steps",
      stages: [
        {
          key: "dashboard",
          icon: "space_dashboard",
          title: "A single dashboard",
          desc: "Sales, customers and stock on one screen, without switching between apps.",
          term: "The big picture",
        },
        {
          key: "sales",
          icon: "point_of_sale",
          title: "Sales funnel workflow",
          desc: "From quotation to payment: delivery note, invoice and follow-up, with the status of every document.",
          term: "Sales & receipts",
        },
        {
          key: "stock",
          icon: "inventory_2",
          title: "Inventory management",
          desc: "Products, warehouses and auto-updated quantities on every delivery or receipt.",
          term: "Real-time stock",
        },
        {
          key: "accounting",
          icon: "account_balance",
          title: "Accounting & finance",
          desc: "Journals, general ledger and reconciliations aligned to the SCF national plan.",
          term: "SCF aligned",
        },
        {
          key: "taxes",
          icon: "calculate",
          title: "Algerian taxation",
          desc: "TVA, TAP and IRG automatically computed, ready for the monthly declaration.",
          term: "TVA · TAP · IRG",
        },
        {
          key: "final",
          icon: "hub",
          title: "Your company in one system",
          desc: "A cockpit that links all modules: from the first order to the tax declaration, with no duplication.",
          term: "All operations · one system",
        },
      ],
    },
    modules: {
      heading: "Integrated modules",
      sub: "Each module is part of one system: data flows automatically.",
      hint: "Hover or tap a card to see the interface",
      items: [
        {
          icon: "point_of_sale",
          title: "Sales & documents",
          desc: "Quotes, sales orders, deliveries and invoices with document conversions.",
        },
        {
          icon: "groups",
          title: "Customers & suppliers",
          desc: "Central register with dual name (ar/en), balances and documents per party.",
        },
        {
          icon: "warehouse",
          title: "Stock & warehouses",
          desc: "Products, locations, transfers and movements with live quantities.",
        },
        {
          icon: "local_shipping",
          title: "Purchasing & supply",
          desc: "Requests, purchase orders, receipts and supplier invoices.",
        },
        {
          icon: "account_balance",
          title: "Accounting",
          desc: "Journals, general ledger, payments and balances aligned to SCF.",
        },
        {
          icon: "precision_manufacturing",
          title: "Production & MRP",
          desc: "BOMs, manufacturing orders, capacity tracking and routing.",
        },
        {
          icon: "badge",
          title: "Human resources",
          desc: "Employee records, attendance, payroll with CNAS, CASNOS and IRG.",
        },
        {
          icon: "receipt_long",
          title: "References & taxation",
          desc: "NIF, RTIMA, trade register and TAP codes tracked automatically.",
        },
      ],
    },
    workflow: {
      eyebrow: "The journey",
      heading: "From sale to tax declaration",
      sub: "An example: data flows through the modules automatically, with no re-entry.",
      steps: [
        { title: "Sales invoice", desc: "ex-VAT document with 19% TVA" },
        { title: "Delivery", desc: "reduces stock quantities" },
        { title: "Journal entry", desc: "generates the entry automatically" },
        { title: "IRG deduction", desc: "computes the income tax" },
        { title: "TVA declaration", desc: "aggregates taxes for the return" },
      ],
    },
    taxes: {
      eyebrow: "Algerian compliance",
      heading: "Taxation that respects Algerian law",
      sub: "Cover every Algerian tax scenario — in one click.",
      badge: "Compliant",
      items: [
        { code: "TVA", label: "19%", desc: "value added tax on sales & purchases" },
        { code: "TAP", label: "2%", desc: "professional activity tax" },
        { code: "IRG", label: "withholding tax", desc: "income tax on wages" },
        { code: "SCF", label: "national plan", desc: "single accounting framework" },
        { code: "CNAS", label: "employees", desc: "social contributions employer/employee" },
        { code: "CASNOS", label: "self-employed", desc: "social security for non-salaried" },
      ],
      note: "Numbering and deductions are computed automatically per company scenario.",
    },
    security: {
      eyebrow: "Security",
      heading: "Strict security at the core",
      sub: "Total multi-company isolation and server-side permission checks.",
      items: [
        {
          icon: "domain_disabled",
          title: "Multi-company isolation",
          desc: "Each company is isolated server-side: no leakage between companies or branches.",
        },
        {
          icon: "admin_panel_settings",
          title: "Role-based permissions",
          desc: "Granular per-role permissions via permission keys, always enforced server-side.",
        },
        {
          icon: "history_edu",
          title: "Full audit log",
          desc: "Every operation is recorded, every change preserved, every update attributed to its author.",
        },
        {
          icon: "vpn_lock",
          title: "Encrypted sessions",
          desc: "Secure sessions, hashed passwords and a mandatory password change on first login.",
        },
      ],
    },
    demo: {
      eyebrow: "Try it",
      heading: "Payroll calculated in seconds",
      sub: "Test the real Algerian payroll and invoicing engine, right here on this page.",
      tabPayroll: "Payroll calculation",
      tabInvoice: "Invoice with TVA",
      payroll: {
        title: "Payroll calculation",
        gross: "Monthly gross salary",
        grossSel: "Monthly gross salary",
        employees: "Number of employees",
        dailyWage: "Daily wage",
        days: "Working days",
        periodDays: "Period days",
        baseLabel: "Deduction base",
        cnase: "CNAS fund",
        cnaseDesc: "Employer share",
        casnos: "CASNOS fund",
        casnosDesc: "Employer share",
        irg: "IRG deduction",
        irgDesc: "Tax on the salary",
        net: "Net salary",
        employer: "Employer cost",
      },
      invoice: {
        title: "Sales invoice",
        base: "Amount ex. VAT",
        baseSel: "Amount ex. VAT",
        rate: "Rate",
        rateSel: "Rate",
        quantity: "Quantity",
        discount: "Discount",
        discountSel: "Discount",
        pct: "%",
        discountOff: "Discount amount",
        tva: "TVA amount",
        timbre: "Stamp",
        total: "Invoice total",
        ht: "Subtotal ex. VAT",
      },
      currency: "DZD",
    },
    pricing: {
      eyebrow: "Pricing",
      heading: "Simple, fair pricing",
      sub: "No hidden fees, no resellers. A single monthly plan.",
      month: "per month",
      popular: "Most popular",
      perMonth: "/ month",
      start: "Start now",
      note: "Prices in Algerian dinar (DZD). 14-day free trial, no credit card required.",
      plans: [
        {
          name: "Starter",
          tagline: "For growing teams",
          features: [
            "Up to 10 employees",
            "Accounting, sales, stock",
            "Algerian document numbering",
            "Quotes, invoices, delivery notes",
          ],
        },
        {
          name: "Company",
          tagline: "For fast growth",
          features: [
            "Up to 50 employees",
            "All integrated modules",
            "Free updates",
            "Setup assistance",
            "Full report printing",
          ],
          popular: true,
        },
        {
          name: "Enterprise",
          tagline: "For large organizations",
          features: [
            "Unlimited employees",
            "Everything in Company",
            "15 GB storage",
            "RTIMA integration",
          ],
        },
      ],
    },
    social: {
      eyebrow: "Testimonials",
      heading: "Trusted by companies",
      sub: "Bookkeepers, managers and founders from all over Algeria.",
      badge: "Trusted by",
      testimonials: [
        {
          name: "Accountant",
          role: "for an export company",
          quote: "Algerian numbering, reconciliation reports and TVA invoices? All ready.",
        },
        {
          name: "Manager",
          role: "in construction",
          quote: "I compare daily sales, stock and pay from a single dashboard.",
        },
        {
          name: "Founder",
          role: "solo entrepreneur",
          quote: "The Algerian CNAS + IRG calculation happens automatically.",
        },
      ],
      logos: "Years of partner relationships",
    },
    faq: {
      eyebrow: "FAQ",
      heading: "Who's doing what?",
      sub: "Short answers to the most frequent questions about DzERP.",
      items: [
        {
          q: "Which modules are included?",
          a: "Sales, purchasing, inventory, accounting, HR, production and taxation — together in one system.",
        },
        {
          q: "How do I manage multiple companies?",
          a: "An admin portal centralizes companies; every user has a defined role in each — with complete isolation.",
        },
        {
          q: "Is tax compliance handled?",
          a: "Yes: TVA, TAP, IRG, CNAS, CASNOS and Algerian document types consistent with RTIMA.",
        },
        {
          q: "Does it work on mobile?",
          a: "Yes, a fully responsive version is available — dedicated mobile apps are in development.",
        },
        {
          q: "How do I get started?",
          a: "Sign up without a credit card, then configure online — with interfaces in Arabic, French and English.",
        },
        {
          q: "Where is the data stored?",
          a: "Privacy and security are key: encrypted and securely stored data — on-premise hosting available for businesses.",
        },
      ],
    },
    finalCta: {
      heading: "All your operations. One system.",
      sub: "Join the companies running their business safely with DzERP.",
      ctaPrimary: "Start free now",
      ctaSecondary: "Contact us",
      note: "No credit card required. Cancel anytime.",
    },
    footer: {
      tagline: "The complete ERP for Algerian businesses, without the complexity.",
      rights: "© 2026. DzERP. All rights reserved.",
      whatsappLabel: "Chat with us on WhatsApp",
      columns: [
        {
          title: "Modules",
          links: [
            { label: "Sales", href: "#modules" },
            { label: "Stock", href: "#modules" },
            { label: "Accounting", href: "#modules" },
            { label: "Taxation", href: "#taxes" },
          ],
        },
        {
          title: "Start",
          links: [
            { label: "Free trial", href: "/register" },
            { label: "Login", href: "/login" },
            { label: "FAQ", href: "/faq" },
            { label: "Security", href: "/security" },
          ],
        },
        {
          title: "Support",
          links: [
            { label: "Contact us", href: "", external: true },
            { label: "FAQ", href: "/faq" },
            { label: "Privacy", href: "/security" },
          ],
        },
      ],
    },
    whatsapp: {
      label: "Contact us",
    },
  },
};