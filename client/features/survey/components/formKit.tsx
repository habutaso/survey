'use client';

import type { ReactNode } from 'react';

const inputStyle = {
  width: '100%',
  padding: '8px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  boxSizing: 'border-box' as const,
};

export const Field = (props: { label: string; children: ReactNode }) => (
  <label style={{ display: 'block', margin: '12px 0' }}>
    <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{props.label}</div>
    {props.children}
  </label>
);

export const TextInput = (props: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) => (
  <input
    style={inputStyle}
    value={props.value}
    placeholder={props.placeholder}
    onChange={(e) => props.onChange(e.target.value)}
  />
);

export const NumberInput = (props: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) => (
  <input
    type="number"
    style={inputStyle}
    value={props.value ?? ''}
    onChange={(e) => props.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
  />
);

export const SelectInput = <T extends string>(props: {
  value: T | undefined;
  options: readonly T[];
  labels: Record<T, string>;
  placeholder: string;
  onChange: (value: T) => void;
}) => (
  <select
    style={inputStyle}
    value={props.value ?? ''}
    onChange={(e) => props.onChange(e.target.value as T)}
  >
    <option value="" disabled>
      {props.placeholder}
    </option>
    {props.options.map((opt) => (
      <option key={opt} value={opt}>
        {props.labels[opt]}
      </option>
    ))}
  </select>
);

export const CheckboxField = (props: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
    <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
    <span>{props.label}</span>
  </label>
);
