import { AnimateOnScroll } from "./AnimateOnScroll";

type CellValue = string | { text: string; color: "green" | "red" };

const rows: {
  label: string;
  manual: CellValue;
  rkl: CellValue;
  hronboard: CellValue;
  rklscan: CellValue;
  apicloud: CellValue;
}[] = [
  {
    label: "Тип решения",
    manual: "—",
    rkl: "Chrome-расширение",
    hronboard: "Chrome-расширение",
    rklscan: "Веб-сервис",
    apicloud: "API",
  },
  {
    label: "Стоимость",
    manual: "Бесплатно",
    rkl: "от 2 990 ₽/мес",
    hronboard: "350 000 ₽ разово",
    rklscan: "от 790 ₽/мес + за проверку",
    apicloud: "от 700 ₽/мес + 0.30 ₽/шт",
  },
  {
    label: "Порог входа",
    manual: "—",
    rkl: "Низкий",
    hronboard: "Очень высокий",
    rklscan: "Средний",
    apicloud: "Нужен разработчик",
  },
  {
    label: "Соответствие 152-ФЗ",
    manual: { text: "Да", color: "green" },
    rkl: { text: "Полное", color: "green" },
    hronboard: { text: "Да", color: "green" },
    rklscan: { text: "Риски", color: "red" },
    apicloud: { text: "Риски", color: "red" },
  },
  {
    label: "Данные на стороннем сервере",
    manual: { text: "Нет", color: "green" },
    rkl: { text: "Нет", color: "green" },
    hronboard: { text: "Нет", color: "green" },
    rklscan: { text: "Да", color: "red" },
    apicloud: { text: "Да", color: "red" },
  },
  {
    label: "Источник данных",
    manual: "Госуслуги",
    rkl: "Госуслуги / МВД",
    hronboard: "Госуслуги / МВД",
    rklscan: "Неизвестен",
    apicloud: "Сайт МВД (парсинг)",
  },
  {
    label: "Требует ЭП",
    manual: { text: "Нет", color: "green" },
    rkl: { text: "Нет", color: "green" },
    hronboard: { text: "Нет", color: "green" },
    rklscan: { text: "Нет", color: "green" },
    apicloud: { text: "Нет", color: "green" },
  },
  {
    label: "Скорость",
    manual: "~5 мин / чел",
    rkl: "~12 сек / чел",
    hronboard: "~12 сек / чел",
    rklscan: "Не указана",
    apicloud: "~6 сек / чел",
  },
];

function CellContent({ value }: { value: CellValue }) {
  if (typeof value === "object") {
    return (
      <span
        className={`font-medium ${
          value.color === "green" ? "text-emerald-600" : "text-red-500"
        }`}
      >
        {value.text}
      </span>
    );
  }
  return <span>{value}</span>;
}

export function Comparison() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimateOnScroll className="text-center mb-16">
          <p className="text-sky-700 font-semibold text-sm uppercase tracking-wider mb-3">
            Сравнение
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            РКЛ Check vs альтернативы
          </h2>
        </AnimateOnScroll>

        <AnimateOnScroll>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[800px] px-4 sm:px-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-4 pr-4 font-semibold text-slate-500 w-[180px]">
                      Параметр
                    </th>
                    <th className="py-4 px-3 font-medium text-slate-400 text-center">
                      Вручную
                    </th>
                    <th className="py-4 px-3 font-bold text-sky-700 text-center highlight-col rounded-t-xl">
                      <div className="flex items-center justify-center gap-1.5">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                          />
                        </svg>
                        РКЛ Check
                      </div>
                    </th>
                    <th className="py-4 px-3 font-medium text-slate-400 text-center">
                      HRonBoard
                    </th>
                    <th className="py-4 px-3 font-medium text-slate-400 text-center">
                      RKLScan
                    </th>
                    <th className="py-4 px-3 font-medium text-slate-400 text-center">
                      api-cloud
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={row.label}
                      className={`border-b border-slate-100 ${
                        i % 2 === 0 ? "bg-slate-50/50" : ""
                      }`}
                    >
                      <td className="py-3.5 pr-4 font-medium text-slate-700">
                        {row.label}
                      </td>
                      <td className="py-3.5 px-3 text-center text-slate-500">
                        <CellContent value={row.manual} />
                      </td>
                      <td className="py-3.5 px-3 text-center font-medium text-slate-900 highlight-col">
                        <CellContent value={row.rkl} />
                      </td>
                      <td className="py-3.5 px-3 text-center text-slate-500">
                        <CellContent value={row.hronboard} />
                      </td>
                      <td className="py-3.5 px-3 text-center text-slate-500">
                        <CellContent value={row.rklscan} />
                      </td>
                      <td className="py-3.5 px-3 text-center text-slate-500">
                        <CellContent value={row.apicloud} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Price anchoring callout */}
          <div className="mt-8 bg-sky-50 border border-sky-100 rounded-xl p-6 text-center">
            <p className="text-sky-900 font-semibold text-lg">
              В 100+ раз дешевле HRonBoard
            </p>
            <p className="text-sky-700 text-sm mt-1">
              2 990 ₽/мес вместо 350 000 ₽ разовой оплаты. Можно
              отказаться в любой момент.
            </p>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
