import { Classifica, GraziaData, GraziaVotingState } from '../types';

export const formatUnlockDate = (unlockDate?: string): string | null => {
  if (!unlockDate) return null;
  return new Date(unlockDate).toLocaleString('it-IT');
};

export const hasVotiChanged = (selectedVoti: string[], mieiVoti: string[]): boolean => {
  return JSON.stringify([...selectedVoti].sort()) !== JSON.stringify([...(mieiVoti || [])].sort());
};

export const getTopThreeClassifica = (classifica: Classifica[]): Classifica[] => {
  return classifica.slice(0, 3);
};

export const getRemainingClassifica = (classifica: Classifica[]): Classifica[] => {
  return classifica.slice(3);
};

export const isTopThree = (index: number): boolean => {
  return index < 3;
};

export const getCarceratoStyle = (isTopThree: boolean): string => {
  if (isTopThree) {
    return "bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200 hover:from-yellow-100 hover:to-yellow-200";
  }
  return "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100";
};

export const getCarceratoNumberStyle = (isTopThree: boolean): string => {
  if (isTopThree) {
    return "bg-gradient-to-br from-yellow-400 to-yellow-600 group-hover:from-yellow-500 group-hover:to-yellow-700";
  }
  return "bg-gradient-to-br from-blue-400 to-indigo-600 group-hover:from-blue-500 group-hover:to-indigo-700";
};

export const getCarceratoTextStyle = (isTopThree: boolean): string => {
  if (isTopThree) {
    return "group-hover:text-yellow-800";
  }
  return "group-hover:text-indigo-800";
};

export const getTrophyColor = (isTopThree: boolean): string => {
  if (isTopThree) {
    return "text-yellow-500";
  }
  return "text-blue-500";
};
