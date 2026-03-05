import { AnimateOnScroll } from "./AnimateOnScroll";

const plans = [
  {
    name: "Пробный",
    description: "Для знакомства с продуктом",
    features: [
      "10 проверок (разово)",
      "Все функции расширения",
      "Экспорт в Excel",
      "Email-поддержка",
    ],
  },
  {
    name: "Старт",
    description: "Для малого бизнеса",
    features: [
      "До 1 500 проверок в месяц",
      "Все функции расширения",
      "Экспорт в Excel",
      "Email-поддержка",
      "Обновления",
    ],
  },
  {
    name: "Бизнес",
    description: "Для среднего бизнеса",
    popular: true,
    features: [
      "До 6 000 проверок в месяц",
      "Все функции расширения",
      "Экспорт в Excel",
      "Приоритетная поддержка",
      "Обновления",
    ],
  },
  {
    name: "Корпорация",
    description: "Для крупного бизнеса",
    features: [
      "До 30 000 проверок в месяц",
      "Все функции расширения",
      "Экспорт в Excel",
      "Выделенная поддержка",
      "Обновления",
      "Индивидуальные условия",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20 lg:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="text-center mb-12">
          <p className="text-sky-700 font-semibold text-sm uppercase tracking-wider mb-3">
            Тарифы
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Гибкие тарифы под ваш объём
          </h2>
          <p className="text-slate-500 text-base max-w-xl mx-auto">
            Фиксированная подписка без оплаты за каждую проверку.
            Точные цены появятся в ближайшее время.
          </p>
        </AnimateOnScroll>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, i) => {
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
                  <div className="mb-6">
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

                  {/* Price placeholder */}
                  <div className="mb-6">
                    <span
                      className={`text-sm font-medium px-3 py-1.5 rounded-full ${
                        isPopular
                          ? "bg-sky-500/20 text-sky-300"
                          : "bg-sky-50 text-sky-700"
                      }`}
                    >
                      Цена уточняется
                    </span>
                  </div>

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
                    href="mailto:bbk-it@mail.ru?subject=РКЛ Check — тариф «{plan.name}»"
                    className={`block text-center py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer ${
                      isPopular
                        ? "bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/25"
                        : "bg-sky-700 hover:bg-sky-600 text-white"
                    }`}
                  >
                    Узнать цену
                  </a>
                </div>
              </AnimateOnScroll>
            );
          })}
        </div>

        {/* Early access note */}
        <AnimateOnScroll className="text-center mt-10">
          <div className="inline-flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm">
            <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center shrink-0">
              <svg
                className="w-5 h-5 text-sky-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900">
                Пробный период — бесплатно
              </p>
              <p className="text-xs text-slate-500">
                10 проверок без регистрации и привязки карты
              </p>
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
