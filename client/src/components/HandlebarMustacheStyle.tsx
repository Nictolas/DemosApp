import React from "react";

interface HandlebarMustacheStyleProps {
  mustacheColor: string;
}

export function HandlebarMustacheStyle({ mustacheColor }: HandlebarMustacheStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* BAFFI A MANUBRIO IDENTICI ALL'AVATAR - CENTRATI più in alto a sinistra */}
      <g transform="translate(-50, 350) scale(0.12,-0.12)" fill={mustacheColor}>
        <path
          d="
            M1260 2051
            c-48 -15 -106 -50 -245 -148
            -184 -130 -249 -170 -382 -236
            -173 -87 -394 -156 -543 -169
            -33 -3 -30 -5 40 -31
            105 -38 289 -83 395 -96
            131 -16 389 -14 514 5
            233 34 403 95 555 199
            l67 45 47 -36
            c104 -80 325 -165 517 -200
            79 -15 151 -19 340 -19
            212 0 254 3 354 23
            110 22 317 85 334 101
            5 5 -20 11 -55 15
            -260 29 -552 162 -912 415
            -177 125 -201 136 -306 136
            -99 0 -172 -21 -258 -73
            l-57 -34 -75 40
            c-116 63 -248 88 -330 63 Z
          "
          stroke="#000000"
          strokeWidth="50"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
