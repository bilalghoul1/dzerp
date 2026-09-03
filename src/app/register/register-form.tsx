"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, ChevronDown, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Lang = "ar" | "fr" | "en";

const LANGS: { code: Lang; label: string }[] = [
  { code: "ar", label: "العربية" },
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
];

const COPY: Record<Lang, {
  badge: string;
  title: string;
  subtitle: string;
  fullName: string;
  fullNamePh: string;
  company: string;
  companyPh: string;
  username: string;
  usernamePh: string;
  email: string;
  emailPh: string;
  password: string;
  passwordPh: string;
  phone: string;
  phonePh: string;
  city: string;
  cityPh: string;
  submit: string;
  submitBusy: string;
  agreement: string;
  trialInfo: string;
  haveAccount: string;
  login: string;
  backHome: string;
  home: string;
  required: string;
  mismatch: string;
  success: string;
} > = {
  ar: {
    badge: "جرّب مجاناً لمدة 14 يوماً",
    title: "أنشئ حسابك وشركتك",
    subtitle: "املأ البيانات أدناه لبدء تجربتك المجانية. سيتم تسليمك بيانات الدخول فوراً.",
    fullName: "الاسم الكامل",
    fullNamePh: "مثال: محمد بن علي",
    company: "اسم الشركة",
    companyPh: "مثال: شركة النخبة",
    username: "اسم المستخدم",
    usernamePh: "اختر اسم مستخدم (بدون مسافات)",
    email: "البريد الإلكتروني",
    emailPh: "exemple@domaine.com",
    password: "كلمة المرور",
    passwordPh: "8 أحرف على الأقل",
    phone: "الهاتف",
    phonePh: "0500 00 00 00",
    city: "البلدية",
    cityPh: "الجزائر",
    submit: "ابدأ تجربتك المجانية",
    submitBusy: "جارٍ الإنشاء...",
    agreement: "بالتسجيل، أنت توافق على شروط الاستخدام.",
    trialInfo: "تجربتك تبدأ فوراً وتنتهي تلقائياً بعد 14 يوماً. عند انتهائها، قد يعاينها المسؤول ليقرّر تمديدها أو تعليقها.",
    haveAccount: "لديك حساب بالفعل؟",
    login: "تسجيل الدخول",
    backHome: "العودة إلى الصفحة الرئيسية",
    home: "الرئيسية",
    required: "جميع الحقول المطلوبة يجب أن تُملأ.",
    mismatch: "كلمتا المرور غير متطابقتين.",
    success: "تم إنشاء حسابك بنجاح!",
  },
  fr: {
    badge: "Essai gratuit de 14 jours",
    title: "Créez votre compte et votre société",
    subtitle: "Renseignez les informations ci-dessous pour démarrer votre essai. Vos accès vous sont remis immédiatement.",
    fullName: "Nom complet",
    fullNamePh: "Ex : Ahmed Benali",
    company: "Nom de la société",
    companyPh: "Ex : Société Elites",
    username: "Identifiant",
    usernamePh: "Choisissez un identifiant (sans espaces)",
    email: "Email",
    emailPh: "exemple@domaine.com",
    password: "Mot de passe",
    passwordPh: "8 caractères minimum",
    phone: "Téléphone",
    phonePh: "0500 00 00 00",
    city: "Commune",
    cityPh: "Alger",
    submit: "Démarrer l'essai gratuit",
    submitBusy: "Création en cours...",
    agreement: "En vous inscrivant, vous acceptez les conditions d'utilisation.",
    trialInfo: "Votre essai démarre immédiatement et prend fin automatiquement au bout de 14 jours. À l'issue, il peut être revu par un administrateur pour être prolongé ou suspendu.",
    haveAccount: "Vous avez déjà un compte ?",
    login: "Se connecter",
    backHome: "Retour à l'accueil",
    home: "Accueil",
    required: "Tous les champs obligatoires doivent être remplis.",
    mismatch: "Les mots de passe ne correspondent pas.",
    success: "Votre compte a été créé avec succès !",
  },
  en: {
    badge: "14-day free trial",
    title: "Create your account and company",
    subtitle: "Fill in the details below to start your free trial. Your access is handed over immediately.",
    fullName: "Full name",
    fullNamePh: "Ex : John Smith",
    company: "Company name",
    companyPh: "Ex : Elite Company",
    username: "Username",
    usernamePh: "Choose a username (no spaces)",
    email: "Email",
    emailPh: "example@domain.com",
    password: "Password",
    passwordPh: "8 characters minimum",
    phone: "Phone",
    phonePh: "0500 00 00 00",
    city: "City",
    cityPh: "Algiers",
    submit: "Start free trial",
    submitBusy: "Creating...",
    agreement: "By signing up you agree to the terms of use.",
    trialInfo: "Your trial starts immediately and ends automatically after 14 days. Afterwards it may be reviewed by an admin to be extended or suspended.",
    haveAccount: "Already have an account?",
    login: "Log in",
    backHome: "Back to home",
    home: "Home",
    required: "All required fields must be filled.",
    mismatch: "Passwords do not match.",
    success: "Your account was created successfully!",
  },
};

export default function RegisterForm() {
  const router = useRouter();
  const [lang, setLang] = React.useState<Lang>("ar");
  const c = COPY[lang];

  const [langOpen, setLangOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const [fullName, setFullName] = React.useState("");
  const [companyName, setCompanyName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [city, setCity] = React.useState("");

  React.useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !companyName || !username || !password) {
      toast.error(c.required);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          companyName,
          username,
          email: email || null,
          password,
          phone: phone || null,
          city: city || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Erreur");
        return;
      }
      toast.success(c.success);
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 z-0 opacity-40">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/40 via-primary/10 to-transparent" />
      </div>

      <main className="relative z-10 w-full max-w-md">
        <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <span className="material-symbols-outlined text-[28px]" aria-hidden="true">
                domain
              </span>
            </div>
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <SparkleIcon />
              {c.badge}
            </span>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{c.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{c.subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullname">{c.fullName}</Label>
              <Input
                id="fullname"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={c.fullNamePh}
                required
                autoComplete="name"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="company">{c.company}</Label>
              <Input
                id="company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={c.companyPh}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="username">{c.username}</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={c.usernamePh}
                  required
                  minLength={3}
                  autoComplete="username"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{c.password}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={c.passwordPh}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">{c.email}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={c.emailPh}
                autoComplete="email"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="phone">{c.phone}</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={c.phonePh}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">{c.city}</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={c.cityPh}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                c.submit
              )}
            </Button>
          </form>

          <p className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{c.trialInfo}</span>
          </p>

          <div className="mt-5 flex flex-col gap-3 border-t pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>
              {c.haveAccount}{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                {c.login}
              </Link>
            </p>
            <Link href="/" className="text-xs text-muted-foreground hover:underline">
              ← {c.home}
            </Link>
          </div>

          {/* Language switcher */}
          <div className="mt-4 flex items-center justify-center">
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangOpen((o) => !o)}
                aria-label="Langue"
                className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground transition-colors hover:bg-accent"
              >
                <Globe className="h-4 w-4 text-primary" />
                <span>{LANGS.find((l) => l.code === lang)?.label}</span>
                <ChevronDown className={langOpen ? "rotate-180" : ""} />
              </button>
              {langOpen && (
                <div className="absolute left-1/2 top-full z-20 mt-1 w-40 -translate-x-1/2 overflow-hidden rounded-lg border bg-card shadow-lg">
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => {
                        setLang(l.code);
                        setLangOpen(false);
                      }}
                      className={`block w-full px-3 py-2 text-left text-xs hover:bg-accent ${
                        l.code === lang ? "bg-accent font-medium" : ""
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          © 2024-2026 DzERP Algérie. Tous droits réservés.
        </p>
      </main>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M12 2l1.9 5.7a2 2 0 001.4 1.4L21 11l-5.7 1.9a2 2 0 00-1.4 1.4L12 20l-1.9-5.7a2 2 0 00-1.4-1.4L3 11l5.7-1.9a2 2 0 001.4-1.4L12 2z" />
    </svg>
  );
}
