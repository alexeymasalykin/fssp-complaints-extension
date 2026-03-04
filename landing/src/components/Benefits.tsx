import { AnimateOnScroll } from "./AnimateOnScroll";

const benefits = [
  {
    title: "12 секунд на проверку",
    description:
      "Расширение автоматически заполняет форму на Госуслугах. 100 сотрудников — за 20 минут вместо 8 часов ручной работы.",
    accent: "В 24 раза быстрее",
    icon: (
      <svg
        className="w-7 h-7"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
        />
      </svg>
    ),
  },
  {
    title: "Данные не покидают браузер",
    description:
      "Персональные данные сотрудников передаются только на Госуслуги через вашу учётную запись. Никаких промежуточных серверов и баз данных.",
    accent: "Соответствие 152-ФЗ",
    icon: (
      <svg
        className="w-7 h-7"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
        />
      </svg>
    ),
  },
  {
    title: "Официальный реестр МВД",
    description:
      "Данные берутся напрямую с портала Госуслуг — из Реестра контролируемых лиц МВД России. Не из «открытых источников», а из первоисточника.",
    accent: "Госуслуги / МВД",
    icon: (
      <svg
        className="w-7 h-7"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
    ),
  },
];

export function Benefits() {
  return (
    <section id="features" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="text-center mb-16">
          <p className="text-sky-700 font-semibold text-sm uppercase tracking-wider mb-3">
            Преимущества
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 max-w-2xl mx-auto">
            Почему HR-отделы выбирают РКЛ&nbsp;Check
          </h2>
        </AnimateOnScroll>

        <div className="grid md:grid-cols-3 gap-8">
          {benefits.map((benefit, i) => (
            <AnimateOnScroll key={benefit.title} delay={i * 150}>
              <div className="relative bg-gradient-to-b from-slate-50 to-white rounded-2xl p-8 border border-slate-100 hover:shadow-lg hover:border-sky-100 transition-all duration-300 h-full group">
                {/* Icon */}
                <div className="w-14 h-14 bg-sky-50 rounded-xl flex items-center justify-center text-sky-700 mb-5 group-hover:bg-sky-100 transition-colors duration-300">
                  {benefit.icon}
                </div>

                {/* Accent badge */}
                <div className="inline-flex items-center bg-sky-50 text-sky-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                  {benefit.accent}
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  {benefit.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
