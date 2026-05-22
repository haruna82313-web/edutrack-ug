import { ChevronDown } from 'lucide-react';

/**
 * Styled select with visible dropdown arrow (subjects, teachers, streams, etc.)
 */
const SelectField = ({
  label,
  icon: Icon,
  value,
  onChange,
  children,
  required = false,
  className = '',
  id,
}) => (
  <div className={`space-y-2 ${className}`}>
    {label && (
      <label
        htmlFor={id}
        className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1"
      >
        {label}
      </label>
    )}
    <div className="relative">
      <select
        id={id}
        className={`input-field w-full cursor-pointer appearance-none ${
          Icon ? 'pl-12' : 'pl-4'
        } pr-12`}
        value={value}
        onChange={onChange}
        required={required}
      >
        {children}
      </select>
      {Icon && (
        <Icon
          className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-aurora-cyan"
          size={18}
        />
      )}
      <ChevronDown
        className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-aurora-cyan"
        size={20}
        aria-hidden
      />
    </div>
  </div>
);

export default SelectField;
