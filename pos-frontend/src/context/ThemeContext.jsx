import { createContext, useContext, useState, useMemo } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const ColorModeContext = createContext({ mode: 'light', toggleColorMode: () => {} });

export const useColorMode = () => useContext(ColorModeContext);

export function AppThemeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem('themeMode') || 'light');

  const colorMode = useMemo(() => ({
    mode,
    toggleColorMode: () => {
      setMode(prev => {
        const next = prev === 'light' ? 'dark' : 'light';
        localStorage.setItem('themeMode', next);
        return next;
      });
    },
  }), [mode]);

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: { main: '#1976d2' },
      ...(mode === 'dark' && {
        background: { default: '#0f1117', paper: '#1a1d27' },
      }),
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            ...(theme.palette.mode === 'dark' && {
              backgroundImage: 'none',
              backgroundColor: '#1a1d27',
            }),
          }),
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            ...(theme.palette.mode === 'dark' && {
              backgroundColor: '#1a1d27',
            }),
          }),
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            ...(theme.palette.mode === 'dark' && {
              backgroundColor: '#12151e',
            }),
          }),
        },
      },
    },
  }), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
