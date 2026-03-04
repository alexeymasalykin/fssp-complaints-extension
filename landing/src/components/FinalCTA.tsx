import { AnimateOnScroll } from "./AnimateOnScroll";

export function FinalCTA() {
  return (
    <section className="relative py-20 lg:py-28 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* Grid pattern */}
      <div className="absolute inset-0 hero-grid" />

      {/* Gradient orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-700/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl" />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <AnimateOnScroll>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-6 leading-tight">
            Начните проверять сотрудников уже&nbsp;сегодня
          </h2>
          <p className="text-lg text-slate-300 mb-10 max-w-xl mx-auto">
            10 бесплатных проверок — без привязки карты, без обязательств.
            Убедитесь, что РКЛ Check подходит вам.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#pricing"
              className="bg-sky-500 hover:bg-sky-400 text-white font-semibold px-10 py-4 rounded-xl text-base transition-all duration-200 hover:shadow-lg hover:shadow-sky-500/25 cursor-pointer"
            >
              Попробовать бесплатно
            </a>
            <a
              href="mailto:support@alexbottest.ru"
              className="border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-semibold px-10 py-4 rounded-xl text-base transition-all duration-200 cursor-pointer"
            >
              Связаться с нами
            </a>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
