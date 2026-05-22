export const StatCard = ({ title, value, icon, bgColor, textColor, trend }) => (
  <div className="p-6 rounded-3xl shadow-xl border border-slate-800 flex items-center justify-between bg-slate-900 hover:shadow-primary-500/10 hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative">
    {/* Decorative Background Blob */}
    <div className={`absolute -right-4 -bottom-4 w-24 h-24 ${bgColor} opacity-10 rounded-full group-hover:scale-150 transition-transform duration-500`}></div>
    
    <div className="relative z-10">
      <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.15em] mb-2">{title}</h3>
      <div className="flex items-baseline gap-2">
        <p className={`text-4xl font-black ${textColor || 'text-slate-100'} tracking-tight`}>{value}</p>
        {trend && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${trend.positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            {trend.value}
          </span>
        )}
      </div>
    </div>
    
    <div className={`relative z-10 p-4 rounded-2xl ${bgColor} ${textColor} shadow-lg shadow-current/10 group-hover:rotate-12 transition-transform duration-300`}>
      {icon}
    </div>
  </div>
);
