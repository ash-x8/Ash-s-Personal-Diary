import React, { useEffect, useRef, useState } from 'react';

interface SinhalaTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
  id?: string;
}

/**
 * IME-composition-safe input & textarea for Sinhala / Unicode scripts.
 * Defers parent state propagation until compositionend completes so multi-keystroke
 * Sinhala conjuncts and kombuva vowel modifiers never get overwritten mid-stroke.
 */
export function SinhalaTextInput({
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 3,
  className = '',
  id,
}: SinhalaTextInputProps) {
  const [localVal, setLocalVal] = useState(value || '');
  const isComposingRef = useRef(false);

  useEffect(() => {
    if (!isComposingRef.current && value !== localVal) {
      setLocalVal(value || '');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const next = e.target.value;
    setLocalVal(next);
    if (!isComposingRef.current) {
      onChange(next);
    }
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (
    e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    isComposingRef.current = false;
    const finalVal = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
    setLocalVal(finalVal);
    onChange(finalVal);
  };

  const sharedStyle: React.CSSProperties = {
    direction: 'ltr',
    unicodeBidi: 'plaintext',
  };

  if (multiline) {
    return (
      <textarea
        id={id}
        rows={rows}
        value={localVal}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        placeholder={placeholder}
        dir="ltr"
        style={sharedStyle}
        className={className}
      />
    );
  }

  return (
    <input
      id={id}
      type="text"
      value={localVal}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      placeholder={placeholder}
      dir="ltr"
      style={sharedStyle}
      className={className}
    />
  );
}
