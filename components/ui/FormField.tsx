'use client';

import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';

interface BaseFieldProps {
  label:     string;
  error?:    string | string[];
  required?: boolean;
  hint?:     string;
  className?: string;
}

type InputFieldProps = BaseFieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & { as?: 'input' };
type TextareaFieldProps = BaseFieldProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & { as: 'textarea' };
type SelectFieldProps = BaseFieldProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> & {
  as: 'select';
  children: React.ReactNode;
};

type FormFieldProps = InputFieldProps | TextareaFieldProps | SelectFieldProps;

const baseInput = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-iss-dark placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary transition-all bg-white disabled:bg-gray-50 disabled:text-gray-400';

export default function FormField(props: FormFieldProps) {
  const { label, error, required, hint, className = '', as = 'input', ...rest } = props;
  const errorMsg = Array.isArray(error) ? error.join(' ') : error;
  const hasError = !!errorMsg;

  const fieldClass = `${baseInput} ${hasError ? 'border-red-400 focus:border-red-400 focus:ring-red-200' : ''}`;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-sm font-medium text-iss-dark-soft">
        {label}
        {required && <span className="text-iss-secondary ml-1">*</span>}
      </label>

      {as === 'textarea' ? (
        <textarea
          className={fieldClass}
          rows={3}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : as === 'select' ? (
        <select
          className={fieldClass}
          {...(rest as SelectHTMLAttributes<HTMLSelectElement>)}
        >
          {(props as SelectFieldProps).children}
        </select>
      ) : (
        <input
          className={fieldClass}
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}

      {hint && !hasError && <p className="text-[11px] text-iss-gray">{hint}</p>}
      {hasError && <p className="text-[11px] text-red-600 font-medium">{errorMsg}</p>}
    </div>
  );
}
