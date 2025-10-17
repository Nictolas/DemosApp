import { useState, useEffect } from "react";
import { ProponiOpinioneState } from "../types";

export const useProponiOpinioneActions = (user: any) => {
  const [proponiOpinioneState, setProponiOpinioneState] = useState<ProponiOpinioneState>({
    opinioni: [],
    loadingData: false,
    isVoting: false,
    testoInput: "",
    userVoti: [],
    submitting: false,
    selectedVoti: [],
    showConfirmDialog: false,
    isBlocked: false,
    unlockDate: null,
    showClassifica: false,
    showAdDialog: false,
    showVideo: false,
    videoTimer: 60
  });

  // Blocco settimanale
  useEffect(() => {
    if (!user) return;
    if (user.ruolo === "AD") {
      setProponiOpinioneState(prev => ({
        ...prev,
        isBlocked: false,
        unlockDate: null
      }));
      return;
    }
    const lastEdit = user.lastProponiOpinioneEdit ? new Date(user.lastProponiOpinioneEdit) : null;
    if (lastEdit) {
      const now = new Date();
      const diff = now.getTime() - lastEdit.getTime();
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      if (diff < weekMs) {
        setProponiOpinioneState(prev => ({
          ...prev,
          isBlocked: true,
          unlockDate: new Date(lastEdit.getTime() + weekMs)
        }));
      } else {
        setProponiOpinioneState(prev => ({
          ...prev,
          isBlocked: false,
          unlockDate: null
        }));
      }
    } else {
      setProponiOpinioneState(prev => ({
        ...prev,
        isBlocked: false,
        unlockDate: null
      }));
    }
  }, [user]);

  const updateField = (field: keyof ProponiOpinioneState, value: any) => {
    setProponiOpinioneState(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const setSubmitting = (value: boolean) => {
    updateField('submitting', value);
  };

  const setIsVoting = (value: boolean) => {
    updateField('isVoting', value);
  };

  const setOpinioni = (opinioni: any[]) => {
    updateField('opinioni', opinioni);
  };

  const setUserVoti = (voti: string[]) => {
    updateField('userVoti', voti);
    updateField('selectedVoti', voti);
  };

  const setLoadingData = (value: boolean) => {
    updateField('loadingData', value);
  };

  // Selezione batch
  const toggleSelezione = (id: string) => {
    if (proponiOpinioneState.isVoting || proponiOpinioneState.isBlocked) return;
    setProponiOpinioneState(prev => ({
      ...prev,
      selectedVoti: prev.selectedVoti.includes(id)
        ? prev.selectedVoti.filter(n => n !== id)
        : [...prev.selectedVoti, id]
    }));
  };

  // Salva batch con dialog di conferma
  const handleSalvaVoti = () => {
    updateField('showConfirmDialog', true);
  };

  const closeConfirmDialog = () => {
    updateField('showConfirmDialog', false);
  };

  // Pubblicità fittizia prima della classifica
  const handleShowClassifica = () => {
    updateField('showAdDialog', true);
  };

  const handleApproveAd = () => {
    updateField('showAdDialog', false);
    updateField('showVideo', true);
    updateField('videoTimer', 60);
    
    const interval = setInterval(() => {
      setProponiOpinioneState(prev => {
        if (prev.videoTimer <= 1) {
          clearInterval(interval);
          return {
            ...prev,
            showVideo: false,
            showClassifica: true,
            videoTimer: 0
          };
        }
        return {
          ...prev,
          videoTimer: prev.videoTimer - 1
        };
      });
    }, 1000);
  };

  const closeAdDialog = () => {
    updateField('showAdDialog', false);
  };

  const closeVideo = () => {
    updateField('showVideo', false);
    updateField('videoTimer', 0);
  };

  return {
    proponiOpinioneState,
    updateField,
    setSubmitting,
    setIsVoting,
    setOpinioni,
    setUserVoti,
    setLoadingData,
    toggleSelezione,
    handleSalvaVoti,
    closeConfirmDialog,
    handleShowClassifica,
    handleApproveAd,
    closeAdDialog,
    closeVideo
  };
};
