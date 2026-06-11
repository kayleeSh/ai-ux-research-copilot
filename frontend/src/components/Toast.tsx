import { useState } from 'react';

export function useToast() {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);

  const showToast = (msg: string) => {
    setMessage(msg);
    setVisible(true);
    setTimeout(() => setVisible(false), 2500);
  };

  return { showToast, toastMessage: message, toastVisible: visible };
}

export function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div className={`toast${visible ? ' toast-visible' : ''}`}>
      {message}
    </div>
  );
}
