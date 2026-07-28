import { configureStore } from '@reduxjs/toolkit';
import chatReducer from './chatSlice';

// makeStore creates a new Redux store instance for every request/session.
// This is critical in Next.js SSR to avoid state leaking between multiple users or page visits.
export const makeStore = () => {
  return configureStore({
    reducer: {
      chat: chatReducer,
    },
    devTools: process.env.NODE_ENV !== 'production',
  });
};

// Infer the type of makeStore
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
