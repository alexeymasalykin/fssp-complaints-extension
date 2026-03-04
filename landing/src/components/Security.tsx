import { AnimateOnScroll } from "./AnimateOnScroll";

const points = [
  {
    title: "Данные остаются в вашем браузере",
    description:
      "Персональные данные сотрудников хранятся только в chrome.storage вашего браузера. При закрытии расширения — удаляются.",
  },
  {
    title: "Передача только на Госуслуги",
    description:
      "Данные передаются исключительно на портал Госуслуг через вашу авторизованную сессию. Промежуточных серверов нет.",
  },
  {
    title: "Сервер лицензий не знает ваших данных",
    description:
      "Сервер получает только лицензионный ключ и счётчик проверок. Никаких ФИО, номеров документов или дат рождения — никогда.",
  },
  {
    title: "Не требуется электронная подпись",
    description:
      "РКЛ Check работает с обычной подтверждённой учётной записью Госуслуг. Подойдёт даже аккаунт физлица — без ЭП-ключа или токена.",
  },
];

export function Security() {
  return (
    <section className="py-20 lg:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: Text */}
          <div>
            <AnimateOnScroll>
              <p className="text-sky-700 font-semibold text-sm uppercase tracking-wider mb-3">
                Безопасность
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
                Ваши данные под&nbsp;защитой
              </h2>
              <p className="text-slate-500 text-base leading-relaxed mb-8">
                Мы не собираем и не храним данные ваших сотрудников.
                Персональные данные никогда не покидают ваш компьютер
                и не попадают на сторонние серверы.
              </p>
            </AnimateOnScroll>

            <div className="space-y-5">
              {points.map((point, i) => (
                <AnimateOnScroll key={point.title} delay={i * 100}>
                  <div className="flex gap-4">
                    <div className="shrink-0 mt-0.5">
                      <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-emerald-600"
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
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 mb-1">
                        {point.title}
                      </h3>
                      <p className="text-slate-500 text-sm leading-relaxed">
                        {point.description}
                      </p>
                    </div>
                  </div>
                </AnimateOnScroll>
              ))}
            </div>
          </div>

          {/* Right: Data flow diagram */}
          <AnimateOnScroll delay={200}>
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="space-y-6">
                {/* Your PC */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-sky-50 rounded-xl flex items-center justify-center shrink-0">
                    <svg
                      className="w-6 h-6 text-sky-700"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Ваш компьютер
                    </div>
                    <div className="text-xs text-slate-500">
                      Данные сотрудников хранятся здесь
                    </div>
                  </div>
                </div>

                {/* Arrow down with label */}
                <div className="flex items-center gap-4 pl-5">
                  <div className="w-px h-8 bg-emerald-300 ml-0.5" />
                  <div className="text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                    Только на Госуслуги
                  </div>
                </div>

                {/* Gosuslugi */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                    <svg
                      className="w-6 h-6 text-blue-700"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Госуслуги / МВД
                    </div>
                    <div className="text-xs text-slate-500">
                      Официальный реестр контролируемых лиц
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-dashed border-slate-200 my-2" />

                {/* License server */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                    <svg
                      className="w-6 h-6 text-slate-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-500">
                      Сервер лицензий
                    </div>
                    <div className="text-xs text-slate-400">
                      Получает только: ключ + счётчик проверок
                    </div>
                    <div className="text-xs text-red-400 font-medium mt-0.5">
                      Никаких персональных данных
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </div>
    </section>
  );
}
