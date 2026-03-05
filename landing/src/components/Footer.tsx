const footerLinks = [
  {
    title: "Продукт",
    links: [
      { label: "Возможности", href: "#features" },
      { label: "Тарифы", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Документы",
    links: [
      { label: "Политика конфиденциальности", href: "#" },
      { label: "Оферта", href: "#" },
    ],
  },
  {
    title: "Контакты",
    links: [
      { label: "bbk-it@mail.ru", href: "mailto:bbk-it@mail.ru" },
      { label: "+7 (995) 153-88-23", href: "tel:+79951538823" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Logo & description */}
          <div>
            <a href="#" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-sky-700 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
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
              </div>
              <span className="text-xl font-bold text-white">
                РКЛ <span className="text-sky-500">Check</span>
              </span>
            </a>
            <p className="text-sm text-slate-400 leading-relaxed">
              Автоматизация проверки иностранных сотрудников по Реестру
              контролируемых лиц МВД через Госуслуги.
            </p>
          </div>

          {/* Link groups */}
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h4 className="text-sm font-semibold text-slate-200 mb-4">
                {group.title}
              </h4>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-sky-400 transition-colors duration-200"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} РКЛ Check. Все права защищены.
          </p>
          <p className="text-xs text-slate-600">
            ООО «ЮНИТИ» · ИНН 7447259052 · КПП 773101001
          </p>
        </div>
      </div>
    </footer>
  );
}
