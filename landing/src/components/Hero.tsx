export function Hero() {
  return (
    <section className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* Grid pattern */}
      <div className="absolute inset-0 hero-grid" />

      {/* Gradient orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-sky-700/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 lg:pt-36 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 rounded-full px-4 py-1.5 mb-6">
              <svg
                className="w-4 h-4 text-sky-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.421 48.421 0 01-4.163-.3c.186 1.613.95 3.033 2.07 4.017v0a.64.64 0 01.142.777 5.667 5.667 0 01-.536.95c-.357.52-.392 1.199-.066 1.748a2.064 2.064 0 001.789 1.033h4.842a2.064 2.064 0 001.789-1.033c.326-.549.291-1.228-.066-1.748a5.667 5.667 0 01-.536-.95.64.64 0 01.142-.777c1.12-.984 1.884-2.404 2.07-4.017a48.421 48.421 0 01-4.163.3.64.64 0 01-.657-.643v0z"
                />
              </svg>
              <span className="text-sky-300 text-sm font-medium">
                Chrome-расширение для HR
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] mb-6">
              Проверка сотрудников по&nbsp;РКЛ{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">
                за&nbsp;12&nbsp;секунд
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-slate-300 mb-8 max-w-xl leading-relaxed">
              Автоматизируйте массовую проверку иностранных сотрудников через
              Госуслуги. Загрузите Excel&nbsp;&mdash; получите отчёт. Данные не
              покидают ваш браузер.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <a
                href="#pricing"
                className="bg-sky-700 hover:bg-sky-600 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all duration-200 hover:shadow-lg hover:shadow-sky-700/25 text-center cursor-pointer"
              >
                Попробовать бесплатно
              </a>
              <a
                href="#how-it-works"
                className="border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-semibold px-8 py-4 rounded-xl text-base transition-all duration-200 text-center cursor-pointer"
              >
                Как это работает
              </a>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-sky-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <span className="text-sm text-slate-400">Данные локально</span>
              </div>
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-sky-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
                  />
                </svg>
                <span className="text-sm text-slate-400">Без ЭП</span>
              </div>
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-sky-400"
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
                <span className="text-sm text-slate-400">
                  Официальный реестр МВД
                </span>
              </div>
            </div>
          </div>

          {/* Right: Product mockup */}
          <div className="hidden lg:block pb-8 pr-4">
            <div className="animate-float">
              {/* Browser window + popup wrapper */}
              <div className="relative">
              {/* Browser window */}
              <div className="bg-slate-800 rounded-2xl shadow-2xl shadow-black/50 border border-slate-700">
                {/* Browser bar */}
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/80 border-b border-slate-700 rounded-t-2xl">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                    <div className="w-3 h-3 rounded-full bg-green-400/80" />
                  </div>
                  <div className="flex-1 bg-slate-700/50 rounded-md px-3 py-1.5 text-xs text-slate-400 font-mono">
                    gosuslugi.ru/655781/1/form
                  </div>
                </div>

                {/* Page content */}
                <div className="p-6 bg-slate-50 relative min-h-[280px]">
                  {/* Form preview */}
                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-slate-800">
                      Поиск иностранца
                    </div>
                    <div className="bg-white rounded-lg border border-slate-200 p-3">
                      <div className="text-xs text-slate-400 mb-0.5">
                        Дата рождения
                      </div>
                      <div className="text-sm text-slate-800">15.03.1985</div>
                    </div>
                    <div className="bg-white rounded-lg border border-slate-200 p-3">
                      <div className="text-xs text-slate-400 mb-0.5">
                        Номер документа
                      </div>
                      <div className="text-sm text-slate-800">AB1234567</div>
                    </div>
                    <div className="bg-sky-700 text-white text-xs font-medium rounded-lg px-4 py-2.5 text-center">
                      Продолжить
                    </div>
                  </div>

                </div>
              </div>

              {/* Extension popup overlay — outside browser window to avoid clipping */}
              <div className="absolute -right-4 -bottom-6 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-10">
                {/* Popup header */}
                    <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between">
                      <span className="text-white text-sm font-bold">
                        РКЛ{" "}
                        <span className="text-sky-400">Check</span>
                      </span>
                      <span className="text-[10px] bg-sky-700/20 text-sky-300 font-medium px-2 py-0.5 rounded-full">
                        Бизнес
                      </span>
                    </div>

                    {/* Popup content */}
                    <div className="p-3 space-y-3">
                      {/* Progress */}
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                          <span>Прогресс</span>
                          <span className="font-medium">67 / 100</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full animate-progress w-0" />
                        </div>
                      </div>

                      {/* Results list */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-[11px]">
                          <svg
                            className="w-3.5 h-3.5 text-emerald-500 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          <span className="text-slate-600 truncate">
                            Иванов И.И.
                          </span>
                          <span className="text-emerald-600 font-medium ml-auto whitespace-nowrap">
                            Нет в РКЛ
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <svg
                            className="w-3.5 h-3.5 text-emerald-500 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          <span className="text-slate-600 truncate">
                            Петров П.П.
                          </span>
                          <span className="text-emerald-600 font-medium ml-auto whitespace-nowrap">
                            Нет в РКЛ
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <div className="w-3.5 h-3.5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin shrink-0" />
                          <span className="text-slate-600 truncate">
                            Сидоров С.С.
                          </span>
                          <span className="text-sky-600 font-medium ml-auto animate-pulse-dot whitespace-nowrap">
                            Проверка...
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}
