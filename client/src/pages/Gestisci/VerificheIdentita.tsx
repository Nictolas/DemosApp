import React from "react";
import ProposteSoggetti from "./ProposteSoggetti";

// Reuse the existing verified CIE / videocall / representative-role workflow.
// Only the navigation scope changes; decisions remain governed by the same API.
export default function VerificheIdentita() {
  return <ProposteSoggetti scope="verification" />;
}
