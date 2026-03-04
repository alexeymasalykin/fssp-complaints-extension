"use client";

import { useState } from "react";
import { AnimateOnScroll } from "./AnimateOnScroll";

const faqs = [
  {
    question: "Как работает расширение?",
    answer:
      "РКЛ Check — это Chrome-расширение, которое автоматически заполняет форму проверки на портале Госуслуг. Вы загружаете Excel-файл со списком сотрудников, запускаете проверку, и расширение последовательно проверяет каждого сотрудника по Реестру контролируемых лиц МВД. Результаты отображаются в реальном времени и экспортируются в Excel.",
  },
  {
    question: "Безопасно ли это? Где хранятся данные сотрудников?",
    answer:
      "Абсолютно безопасно. Персональные данные сотрудников хранятся только в вашем браузере (chrome.storage) и передаются исключительно на портал Госуслуг через вашу авторизованную сессию. На наш сервер лицензий передаётся только ключ и счётчик проверок — никаких ФИО, номеров документов или дат рождения.",
  },
  {
    question: "Нужна ли электронная подпись?",
    answer:
      "Нет. РКЛ Check работает с обычной подтверждённой учётной записью Госуслуг — подойдёт даже аккаунт физлица. Не нужен ЭП-ключ, токен или привязка к организации.",
  },
  {
    question: "Что делать, если закончился лимит проверок?",
    answer:
      "Вы можете перейти на более высокий тариф в любой момент. Переход применяется мгновенно, и разница в стоимости пересчитывается пропорционально оставшемуся периоду подписки.",
  },
  {
    question: "Можно ли отменить подписку?",
    answer:
      "Да, подписку можно отменить в любой момент. Расширение продолжит работать до конца оплаченного периода. Никаких штрафов за отмену, никаких скрытых платежей.",
  },
  {
    question: "Какие браузеры поддерживаются?",
    answer:
      "Google Chrome, Яндекс.Браузер, Microsoft Edge и любые другие Chromium-браузеры. Расширение устанавливается из Chrome Web Store.",
  },
  {
    question: "Откуда берутся данные для проверки?",
    answer:
      "Данные берутся напрямую с портала Госуслуг — из официального Реестра контролируемых лиц МВД России. Это не кэшированная база данных и не «открытые источники», а актуальные данные первоисточника.",
  },
  {
    question: "Как быстро происходит проверка?",
    answer:
      "Одна проверка занимает примерно 12 секунд. Между проверками есть настраиваемая задержка (по умолчанию 10 секунд) для стабильной работы с порталом Госуслуг. 100 сотрудников проверяются за ~20 минут.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 lg:py-28 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="text-center mb-12">
          <p className="text-sky-700 font-semibold text-sm uppercase tracking-wider mb-3">
            FAQ
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Частые вопросы
          </h2>
        </AnimateOnScroll>

        <div className="space-y-3">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <AnimateOnScroll key={i} delay={i * 50}>
                <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="w-full flex items-center justify-between px-6 py-5 text-left cursor-pointer"
                    aria-expanded={isOpen}
                  >
                    <span className="text-base font-semibold text-slate-900 pr-4">
                      {faq.question}
                    </span>
                    <svg
                      className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                      />
                    </svg>
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      isOpen ? "max-h-96" : "max-h-0"
                    }`}
                  >
                    <p className="px-6 pb-5 text-slate-500 text-sm leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </AnimateOnScroll>
            );
          })}
        </div>
      </div>
    </section>
  );
}
