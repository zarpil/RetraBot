import React from 'react';
import { CheckCircle } from 'lucide-react';

interface ToastProps {
  toast: string;
  toastVisible: boolean;
}

export const Toast: React.FC<ToastProps> = ({ toast, toastVisible }) => {
  if (!toastVisible) return null;

  return (
    <div className="toast">
      <CheckCircle size={15} style={{ color: 'var(--green)', flexShrink: 0 }} />
      <span>{toast}</span>
    </div>
  );
};
