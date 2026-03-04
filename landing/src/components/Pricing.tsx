"use client";

import { useState } from "react";
import { AnimateOnScroll } from "./AnimateOnScroll";

interface Plan {
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  limit: string;
  target: string;
  features: string[];
  popular?: boolean;
  trial?: boolean;
  cta: string;
}

const plans: Plan[] = [
  {
    name: "Пробный",
    description: "Для знакомства с продуктом",
    monthlyPrice: 0,
    annualPrice: 0,
    limit: "10 проверок",
    target: "Одноразово",
    features: [
      "10 проверок (разово)",
      "Все функции расширения",
      "Экспорт в Excel",
      "Email-поддержка",
    ],
    trial: true,
    cta: "Начать бесплатно",
  },
  {
    name: "Старт",
    description: "Для малого бизнеса",
    monthlyPrice: 2990,
    annualPrice: 2390,
    limit: "1 500 проверок/мес",
    target: "До 50 сотрудников",
    features: [
      "1 500 проверок в месяц",
      "Все функции расширения",
      "Экспорт в Excel",
      "Email-поддержка",
      "Обновления",
    ],
    cta: "Выбрать Старт",
  },
  {
    name: "Бизнес",
    description: "Для среднего бизнеса",
    monthlyPrice: 4990,
    annualPrice: 3990,
    limit: "6 000 проверок/мес",
    target: "До 200 сотрудников",
    features: [
      "6 000 проверок в месяц",
      "Все функции расширения",
      "Экспорт в Excel",
      "Приоритетная поддержка",
      "Обновления",
    ],
    popular: true,
    cta: "Выбрать Бизнес",
  },
  {
    name: "Корпорация",
    description: "Для крупного бизнеса",
    monthlyPrice: 9990,
    annualPrice: 7990,
    limit: "30 000 проверок/мес",
    target: "До 1 000 сотрудников",
    features: [
      "30 000 проверок в месяц",
      "Все функции расширения",
      "Экспорт в Excel",
      "Выделенная поддержка",
      "Обновления",
      "Индивидуальные условия",
    ],
    cta: "Выбрать Корпорацию",
  },
];

function formatPrice(price: number): string {
  if (price === 0) return "0";
  return price.toLocaleString("ru-RU");
}

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="py-20 lg:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="text-center mb-12">
          <p className="text-sky-700 font-semibold text-sm uppercase tracking-wider mb-3">
            Тарифы
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Простые и прозрачные цены
          </h2>
          <p className="text-slate-500 text-base max-w-xl mx-auto">
            Без скрытых платежей, без оплаты за каждую проверку. Фиксированная
            подписка — проверяйте сколько нужно в рамках лимита.
          </p>
        </AnimateOnScroll>

        {/* Monthly/Annual toggle */}
        <AnimateOnScroll className="flex items-center justify-center gap-4 mb-12">
          <span
            className={`text-sm font-medium transition-colors duration-200 ${
              !annual ? "text-slate-900" : "text-slate-400"
            }`}
          >
            Помесячно
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative w-14 h-7 rounded-full transition-colors duration-300 cursor-pointer ${
              annual ? "bg-sky-700" : "bg-slate-300"
            }`}
            aria-label="Переключить на годовую подписку"
          >
            <div
              className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300 ${
                annual ? "translate-x-7" : ""
              }`}
            />
          </button>
          <span
            className={`text-sm font-medium transition-colors duration-200 ${
              annual ? "text-slate-900" : "text-slate-400"
            }`}
          >
            Годовая
          </span>
          {annual && (
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
              -20%
            </span>
          )}
        </AnimateOnScroll>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, i) => {
            const price = annual ? plan.annualPrice : plan.monthlyPrice;
            const isPopular = plan.popular;

            return (
              <AnimateOnScroll key={plan.name} delay={i * 100}>
                <div
                  className={`relative rounded-2xl p-6 h-full flex flex-col transition-all duration-300 ${
                    isPopular
                      ? "bg-slate-900 text-white shadow-xl shadow-slate-900/20 ring-2 ring-sky-500 scale-[1.02] lg:scale-105"
                      : "bg-white border border-slate-200 hover:shadow-lg hover:border-sky-200"
                  }`}
                >
                  {/* Popular badge */}
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-sky-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                        Популярный
                      </span>
                    </div>
                  )}

                  {/* Plan name */}
                  <div className="mb-4">
                    <h3
                      className={`text-lg font-bold ${
                        isPopular ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {plan.name}
                    </h3>
                    <p
                      className={`text-sm ${
                        isPopular ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {plan.description}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-1">
                    <span
                      className={`text-4xl font-extrabold ${
                        isPopular ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {formatPrice(price)}
                    </span>
                    <span
                      className={`text-base ml-1 ${
                        isPopular ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {plan.trial ? "₽" : "₽/мес"}
                    </span>
                  </div>

                  {/* Target */}
                  <p
                    className={`text-xs mb-6 ${
                      isPopular ? "text-slate-400" : "text-slate-400"
                    }`}
                  >
                    {plan.target} &middot; {plan.limit}
                  </p>

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <svg
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            isPopular ? "text-sky-400" : "text-sky-600"
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span
                          className={`text-sm ${
                            isPopular ? "text-slate-200" : "text-slate-600"
                          }`}
                        >
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <a
                    href="#"
                    className={`block text-center py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer ${
                      isPopular
                        ? "bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/25"
                        : plan.trial
                        ? "bg-slate-900 hover:bg-slate-800 text-white"
                        : "bg-sky-700 hover:bg-sky-600 text-white"
                    }`}
                  >
                    {plan.cta}
                  </a>
                </div>
              </AnimateOnScroll>
            );
          })}
        </div>

        {/* Annual savings note */}
        <AnimateOnScroll className="text-center mt-8">
          <p className="text-slate-400 text-sm">
            Годовая подписка — скидка 20% (2 месяца бесплатно). Все цены
            указаны без НДС.
          </p>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
