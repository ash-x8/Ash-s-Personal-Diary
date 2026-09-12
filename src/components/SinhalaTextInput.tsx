import React, { useRef, useEffect } from 'react';

interface SinhalaTextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onValueChange: (val: string) => void;
  debounceMs?: number;
}

export const SinhalaTextInput: React.FC<SinhalaTextInputProps> = ({
  value,
  onValueChange,
  debounceMs = 300,
  className = '',
  style = {},
  ...props
}) => {
  const isComposing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync external value when input is NOT focused and not composing
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current && !isComposing.current) {
      inputRef.current.value = value;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Immediate local reflection is handled natively by the input element
    if (isComposing.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onValueChange(val);
    }, debounceMs);
  };

  const handleCompositionStart = () => {
    isComposing.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    isComposing.current = false;
    onValueChange(e.currentTarget.value);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isComposing.current) {
      onValueChange(e.currentTarget.value);
    }
  };

  return (
    <input
      ref={inputRef}
      defaultValue={value}
      dir="ltr"
      style={{
        direction: 'ltr',
        textAlign: 'left',
        unicodeBidi: 'plaintext',
        ...style
      }}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onBlur={handleBlur}
      className={`text-left ltr ${className}`}
      {...props}
    />
  );
};
