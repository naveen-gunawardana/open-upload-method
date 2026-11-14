// Each panorama has its own horizon and silhouettes. Keep the SVG coordinates proportional.
function Pines({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} fill="currentColor">
    <path d="m0 0 7-13H4l8-16h-3l8-17 8 17h-3l8 16h-4l7 13Zm26 0 6-10h-3l7-14h-2l6-13 6 13h-2l7 14h-3l6 10Z" />
  </g>;
}

function SkyMarks() {
  return <g className="sky-marks" fill="none" stroke="currentColor" strokeLinecap="round">
    <path d="M0 0q5-1 9 4 5-7 11-8m8 9q4-2 7 1 4-5 8-6" strokeWidth="1.8"/>
  </g>;
}

export default function AlpineLandscape() {
  return <>
    <svg className="panorama wide" viewBox="0 0 1440 480" preserveAspectRatio="xMidYMax meet" focusable="false">
      <g className="depth-far">
        <circle className="sun-halo" cx="748" cy="377" r="116"/><circle className="sun-disc" cx="748" cy="377" r="99"/>
        <g transform="translate(993 170)"><SkyMarks /></g>
        <path fill="var(--distant)" d="M-30 310 90 243 130 251 216 184 262 203 311 182 347 218 427 263 489 236 538 285 585 303 626 296 685 334 739 317 781 336 854 291 882 297 958 251 1018 279 1086 217 1106 224 1198 153 1263 194 1300 186 1470 268V500H-30Z"/>
        <path fill="var(--ice-lit)" d="m216 184-33 27 22-5 14-12 15 14 20-8Zm95-2-22 15 16-3 9 9 16 1Zm178 54-28 23 18-5 8-10 12 7 16 7Zm709-83-39 38 23-12 13-16 22 18 23 4Z"/>
      </g>
      <g className="depth-rock">
        <path fill="var(--rock-lit)" d="M-30 127 36 94 77 49 114 62 154 24 187 52 207 86 238 90 287 147 328 165 382 219 429 238 489 291 610 354 681 402H-30Z"/>
        <path fill="var(--rock-shade)" d="m154 24 33 28 20 34 31 4 49 57 41 18 54 54 47 19 60 53 121 63-111-19-86-45-61-46-62-22-80-93-19-8-57-66Z"/>
        <path fill="var(--snow-lit)" d="m-10 137 46-43 41-45 37 13 40-38 33 28 20 34 31 4 49 57-43-24-19-23-19 7-28-36-16-8-14-25-22 42-15-4-36 45 19-46-17-11-31 40Z"/>
        <path fill="var(--ice-lit)" d="m154 24 33 28 20 34-29-15-16-8-14-25-14 24Zm84 66 49 57-43-24-19-23Z"/>
        <path fill="var(--rock-detail)" d="m-20 243 96-102-47 75 86-73-72 97 126-107-76 99-48 41Zm180-136 27 34 32 17 56 72-65-48Zm102 50 58 46 44 49-63-46Z"/>
        <path fill="var(--rock-lit)" d="M821 389 928 316 984 289 1046 226 1086 206 1122 161 1156 147 1190 99 1214 96 1251 45 1271 50 1330-19 1354 13 1372 19 1420 91 1470 119V510H821Z"/>
        <path fill="var(--rock-shade)" d="m1330-19 24 32 18 6 48 72 50 28v249l-219-122 63-75-45 20 52-89-34 17 30-62-16 10Z"/>
        <path fill="var(--snow-lit)" d="m1330-19-59 69-20-5-37 51-24 3-34 48 48-32 17-5 29-36 17 1-20 40 47-42 18-43 14-11-8 59 26-39 20 15-9-31 37 37-20-40-18-6Z"/>
        <path fill="var(--ice-lit)" d="m1330-19-4 38-8 59 26-39 20 15-9-31 37 37-20-40-18-6Z"/>
        <path fill="var(--rock-detail)" d="m1257 114-29 52-73 71 42-61Zm-69 27-77 95-68 43 82-77Zm143-26-38 79-59 46 46-60Z"/>
      </g>
      <g className="depth-field">
        <path fill="var(--pines-far)" d="M-35 219q112-34 258 37t260 67q98 1 218 67 139-17 289-107t271-76q98-2 209-88v389H-35Z"/>
        <path fill="var(--meadow-lit)" d="M-35 246q135-40 288 39t256 63q117-3 224 50 96-41 182-54 82-15 175-24 138-14 218-72 85-62 162-78v337H-35Z"/>
        <path fill="var(--lake)" d="M577 378q81 7 156 20 81-34 171-50-32 23-117 49-26 9 39 12l68 12-179 9-90-19q139-9 54-19Z"/>
        <path fill="var(--meadow)" d="M-35 290q163-16 356 80t385 44q108-16 230-6 155 11 298-61t236-92v251H-35Z"/>
        <path fill="var(--path)" d="M871 403q-103 16-58 29 45 12 7 24l-54 24h-75q25-19 81-32 36-9 10-18-30-15 89-27Z"/>
        <g color="var(--fir)"><Pines x={36} y={341} scale={1.18}/><Pines x={96} y={339} scale={0.7}/><Pines x={327} y={382} scale={0.44}/><Pines x={1185} y={373} scale={.62}/><Pines x={1253} y={355}/><Pines x={1390} y={310} scale={1.65}/></g>
        <g fill="none" stroke="var(--rock-detail)" strokeWidth="2.4" opacity=".6">
          <path d="m108 123-19 24-31 23m76-54-19 29-16 9m30 31-16 19-44 29m178-52 29 33 36 22m885-12 34-31 16-26m39-63-20 36-19 21m74-28-18 26-10 26"/>
        </g>
        <path fill="none" stroke="var(--grass-line)" strokeWidth="2" d="M-30 325q121-9 209 31m-72 5q102 14 169 56m704 26q100 4 176-26m29-10q99-31 170-70"/>
      </g>
    </svg>
    <svg className="panorama portrait" viewBox="0 0 480 345" preserveAspectRatio="xMidYMax meet" focusable="false">
      <g className="depth-far"><circle className="sun-halo" cx="261" cy="230" r="74"/><circle className="sun-disc" cx="261" cy="230" r="63"/>
        <g transform="translate(307 142) scale(.55)"><SkyMarks /></g>
        <path fill="var(--distant)" d="M-20 211 65 134 87 145 123 116 163 161 190 165 227 194 244 182 274 203 321 169 347 177 406 117 501 185v195H-20Z"/>
        <path fill="var(--ice-lit)" d="m123 116-21 20 13-5 8-8 9 14 14 6Z"/></g>
      <g className="depth-rock">
        <path fill="var(--rock-lit)" d="M-28 72 6 35 21 39 39 18 60 46 79 54 112 99 129 102 156 134 181 147 215 189 259 231 300 269H-28Z"/>
        <path fill="var(--rock-shade)" d="m39 18 21 28 19 8 33 45 17 3 27 32 25 13 34 42 44 42-57-28-46-41-38-18-45-59Z"/>
        <path fill="var(--snow-lit)" d="m-26 76 32-41 15 4 18-21 21 28 19 8 33 45-27-21-10-16-15-8-7-15-9-8-12 26-7-5-17 17 10-21Z"/>
        <path fill="var(--rock-detail)" d="m-5 139 47-59-26 51 45-32-26 36-40 30Zm84-52 48 52-29-18Z"/>
        <path fill="var(--rock-lit)" d="m274 247 43-35 23-10 35-41 16-8 26-43 14-6 36-55 43 54v190H274Z"/>
        <path fill="var(--rock-shade)" d="m467 49 43 54v140l-91-29 33-52-20 6 28-51-18 9Z"/>
        <path fill="var(--snow-lit)" d="m467 49-36 55-14 6-18 29 26-20 7 1 24-35-7 30 17-17 8-24 16 16Z"/>
      </g>
      <g className="depth-field">
        <path fill="var(--pines-far)" d="M-20 162q55-15 117 32t116 40q36 6 61 25 45-28 105-45t124-70v221H-20Z"/>
        <path fill="var(--meadow-lit)" d="M-20 186q56-17 131 32t172 45q61-37 109-40t111-38v189H-20Z"/>
        <path fill="var(--lake)" d="M173 251q67 10 110 12 47-27 85-34-19 16-65 33-17 6 24 10l-80 18-52-16q89-8-22-23Z"/>
        <path fill="var(--meadow)" d="M-20 227q49-17 139 29t158 26q63-12 98-10 71-3 127-36v143H-20Z"/>
        <path fill="var(--path)" d="M315 278q-49 10-33 17 19 9 3 17l-46 33h-37q15-15 52-32 21-9 7-16-14-8 54-19Z"/>
        <g color="var(--fir)"><Pines x={-6} y={248} scale={.94}/><Pines x={42} y={249} scale={.54}/><Pines x={128} y={278} scale={.29}/><Pines x={399} y={277} scale={.44}/><Pines x={443} y={265} scale={.8}/></g>
      </g>
    </svg>
  </>;
}
