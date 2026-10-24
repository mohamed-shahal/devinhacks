import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';
const storageKey = 'scenecraft:theme';

function readPreference(): { theme: Theme; storageError: boolean } {
  try {
    return {
      theme:
        window.localStorage.getItem(storageKey) === 'light' ? 'light' : 'dark',
      storageError: false,
    };
  } catch {
    return { theme: 'dark', storageError: true };
  }
}

export function useTheme() {
  const [preference, setPreference] = useState(readPreference);
  useEffect(() => {
    document.documentElement.dataset.theme = preference.theme;
  }, [preference.theme]);

  function setTheme(theme: Theme) {
    let storageError = false;
    try {
      window.localStorage.setItem(storageKey, theme);
    } catch {
      storageError = true;
    }
    setPreference({ theme, storageError });
  }
  return { ...preference, setTheme };
}
