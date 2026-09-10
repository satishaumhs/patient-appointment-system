import { CheckIcon } from "./icons";

const HIGHLIGHTS = [
  "Book appointments in seconds",
  "Track your visits in one place",
  "Trusted by patients and doctors",
];

const AuthLayout = ({ title, subtitle, children }) => (
  <div className="min-h-[calc(100vh-73px)] flex">
    <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-teal-600 to-teal-800 text-white flex-col justify-center px-14">
      <img src="/logo.jpg" alt="My Health School" className="w-14 h-14 rounded-xl object-cover mb-8" />
      <h2 className="text-3xl font-bold leading-tight mb-4">{title}</h2>
      <p className="text-teal-50/90 text-base mb-8 max-w-sm">{subtitle}</p>
      <ul className="space-y-3">
        {HIGHLIGHTS.map((item) => (
          <li key={item} className="flex items-center gap-3 text-sm text-teal-50">
            <span className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center shrink-0">
              <CheckIcon className="w-3 h-3" />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>

    <div className="flex-1 flex items-start lg:items-center justify-center px-6 py-10 lg:py-16">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  </div>
);

export default AuthLayout;
