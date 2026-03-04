import { AnimateOnScroll } from "./AnimateOnScroll";

const stats = [
  {
    value: "1 000 000 ₽",
    label: "Штраф за нарушение",
    description:
      "За привлечение к труду иностранного гражданина, состоящего в Реестре контролируемых лиц",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        />
      </svg>
    ),
  },
  {
    value: "8 часов",
    label: "Ручная проверка 100 человек",
    description:
      "Каждого сотрудника нужно проверить вручную через форму Госуслуг — по 5 минут на человека",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    value: "Ошибки",
    label: "Риск ручного ввода",
    description:
      "Опечатка в номере документа или дате — и проверка даёт ложный результат. Цена ошибки — штраф",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    ),
  },
];

export function Problems() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="text-center mb-16">
          <p className="text-sky-700 font-semibold text-sm uppercase tracking-wider mb-3">
            Проблема
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 max-w-2xl mx-auto">
            Проверка иностранных сотрудников&nbsp;&mdash; головная боль HR
          </h2>
        </AnimateOnScroll>

        <div className="grid md:grid-cols-3 gap-8">
          {stats.map((stat, i) => (
            <AnimateOnScroll key={stat.label} delay={i * 150}>
              <div className="bg-slate-50 rounded-2xl p-8 hover:shadow-lg transition-shadow duration-300 border border-slate-100 h-full">
                <div className="text-red-500/80 mb-4">{stat.icon}</div>
                <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-2">
                  {stat.value}
                </div>
                <div className="text-lg font-semibold text-slate-800 mb-3">
                  {stat.label}
                </div>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {stat.description}
                </p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
