import { useDispatch, useSelector, useStore } from 'react-redux';
import type { RootState, AppDispatch, AppStore } from './store';

// Use these pre-typed hooks throughout the application instead of plain useDispatch and useSelector.
// This guarantees static analysis check and proper autocomplete capabilities inside components.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
