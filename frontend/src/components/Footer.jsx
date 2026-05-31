import yehyaLogo from '../assets/yehya-logo.svg'

export default function Footer() {
  return (
    <footer className="border-t border-white/10 mt-16 py-8">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <img src={yehyaLogo} alt="Yehya Logo" className="w-7 h-7 opacity-80" />
          <span className="text-gray-400 text-sm">
            Powered by <span className="text-white font-semibold">yehyahteit</span>
          </span>
        </div>
        <p className="text-gray-600 text-xs text-center">
          © {new Date().getFullYear()} yehyahteit. All rights reserved.
        </p>
        <p className="text-gray-700 text-xs text-center max-w-sm">
          AI-based estimates only. Not a medical, dermatological, or psychological diagnosis.
        </p>
      </div>
    </footer>
  )
}
