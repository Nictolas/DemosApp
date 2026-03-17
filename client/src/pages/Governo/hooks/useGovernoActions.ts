import { useLocation } from "wouter";
import { Ministero } from "../types";

export const useGovernoActions = () => {
  const [, setLocation] = useLocation();

  const handleNavigateToMinistero = (ministero: Ministero) => {
    setLocation(`/governo/${ministero.slug}`);
  };

  return {
    handleNavigateToMinistero
  };
};
