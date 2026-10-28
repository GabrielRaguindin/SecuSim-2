'use client';

import { useEffect, useReducer, useState } from 'react';
import { createState, networkReducer } from '@/lib/networkReducer.js';

export function useNetwork(initialDoc) {
  const [state, dispatch] = useReducer(networkReducer, initialDoc, createState);
  return {
    doc: state.doc,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    dispatch,
  };
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}
