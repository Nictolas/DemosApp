import { Classifica } from '../types';

export const getSuggestions = (classifica: Classifica[], leggeInput: string, showSuggestions: boolean): Classifica[] => {
  if (!leggeInput.trim() || !showSuggestions) return [];
  return classifica
    .filter(item => 
      item.legge.toLowerCase().includes(leggeInput.toLowerCase()) && 
      item.legge.toLowerCase() !== leggeInput.toLowerCase()
    )
    .slice(0, 5);
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

export const getLeggeStyle = (isTopThree: boolean): string => {
  if (isTopThree) {
    return "bg-white border-gray-200 hover:bg-gray-50";
  }
  return "bg-white border-gray-200 hover:bg-gray-50";
};

export const getLeggeNumberStyle = (isTopThree: boolean): string => {
  if (isTopThree) {
    return "bg-gradient-to-br from-yellow-400 to-yellow-600 group-hover:from-yellow-500 group-hover:to-yellow-700";
  }
  return "bg-gradient-to-br from-blue-400 to-indigo-600 group-hover:from-blue-500 group-hover:to-indigo-700";
};

export const getLeggeTextStyle = (isTopThree: boolean): string => {
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

export const getButtonStyle = (isTopThree: boolean): string => {
  if (isTopThree) {
    return "hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-700";
  }
  return "hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700";
};
