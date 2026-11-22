const PALETTE = {
  red: {
    base: '#b91c1c',
    dark: '#7f1d1d',
    light: '#dc2626',
    highlight: '#f87171',
    stitch: '#fecaca',
  },
  blue: {
    base: '#1d4ed8',
    dark: '#1e3a8a',
    light: '#2563eb',
    highlight: '#93c5fd',
    stitch: '#bfdbfe',
  },
  black: {
    base: '#1c1917',
    dark: '#0c0a09',
    light: '#292524',
    highlight: '#57534e',
    stitch: '#78716c',
  },
  white: {
    base: '#f5f5f4',
    dark: '#d6d3d1',
    light: '#fafaf9',
    highlight: '#ffffff',
    stitch: '#a8a29e',
  },
  green: {
    base: '#15803d',
    dark: '#14532d',
    light: '#16a34a',
    highlight: '#86efac',
    stitch: '#bbf7d0',
  },
  yellow: {
    base: '#eab308',
    dark: '#a16207',
    light: '#facc15',
    highlight: '#fde047',
    stitch: '#fef08a',
  },
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function renderTshirt(p, variant) {
  const oversized = variant.includes('oversized')
  const relaxed = variant.includes('relaxed')
  const pocket = variant.includes('pocket')
  const heavy = variant.includes('heavyweight')
  const extra = oversized ? 26 : relaxed ? 12 : 0
  const bodyL = 268 - extra
  const bodyR = 532 + extra
  const shoulderL = 300 - extra * 0.7
  const shoulderR = 500 + extra * 0.7
  const sleeveL = 175 - extra * 1.2
  const sleeveR = 625 + extra * 1.2
  const hemY = 742 + (oversized ? 18 : 0)
  const neckY = 306
  const bodyPath = `M${shoulderL} 250 L235 280 L${sleeveL} 400 L232 445 L${bodyL} 372 L${bodyL} ${hemY} Q400 ${hemY + 28} ${bodyR} ${hemY} L${bodyR} 372 L568 445 L${sleeveR} 400 L565 280 L${shoulderR} 250 Q462 ${neckY} 400 ${neckY} Q338 ${neckY} ${shoulderL} 250 Z`

  return `<g filter="url(#softShadow)">
    <path d="${bodyPath}" fill="url(#fabric)" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
    <path d="${bodyPath}" fill="url(#weave)" opacity=".9"/>
    <path d="M${shoulderL + 2} 252 Q338 ${neckY + 2} 400 ${neckY + 2} Q462 ${neckY + 2} ${shoulderR - 2} 252" fill="none" stroke="${p.dark}" stroke-width="${heavy ? 20 : 15}" stroke-linecap="round"/>
    <path d="M${shoulderL + 6} 259 Q340 ${neckY + 11} 400 ${neckY + 11} Q460 ${neckY + 11} ${shoulderR - 6} 259" fill="none" stroke="${p.stitch}" stroke-width="2.5" stroke-opacity=".65"/>
    <path d="M${shoulderL + 5} 260 L${bodyL + 4} 372" stroke="${p.dark}" stroke-opacity=".22" stroke-width="4"/>
    <path d="M${shoulderR - 5} 260 L${bodyR - 4} 372" stroke="${p.dark}" stroke-opacity=".22" stroke-width="4"/>
    <path d="M${bodyL + 12} ${hemY - 12} Q400 ${hemY + 14} ${bodyR - 12} ${hemY - 12}" fill="none" stroke="${p.stitch}" stroke-width="3" stroke-opacity=".55"/>
    <path d="M${bodyL + 6} ${hemY + 6} Q400 ${hemY + 32} ${bodyR - 6} ${hemY + 6}" fill="none" stroke="${p.dark}" stroke-opacity=".18" stroke-width="3"/>
    <path d="M214 416 L248 440" stroke="${p.dark}" stroke-opacity=".2" stroke-width="3"/>
    <path d="M586 416 L552 440" stroke="${p.dark}" stroke-opacity=".2" stroke-width="3"/>
    <path d="M334 420 Q352 555 332 ${hemY - 34}" fill="none" stroke="${p.dark}" stroke-opacity=".09" stroke-width="13"/>
    <path d="M470 420 Q452 570 470 ${hemY - 42}" fill="none" stroke="${p.dark}" stroke-opacity=".08" stroke-width="11"/>
    <path d="M388 330 Q400 390 392 445" fill="none" stroke="${p.highlight}" stroke-opacity=".18" stroke-width="10"/>
    ${pocket ? `<g>
      <rect x="320" y="468" width="98" height="108" rx="9" fill="${p.base}" stroke="${p.dark}" stroke-opacity=".55" stroke-width="3"/>
      <path d="M328 478 H410" stroke="${p.stitch}" stroke-width="3" stroke-opacity=".6"/>
      <path d="M330 564 Q369 574 408 564" fill="none" stroke="${p.dark}" stroke-opacity=".25" stroke-width="2.5"/>
    </g>` : ''}
  </g>`
}

function renderHoodie(p, variant) {
  const zip = variant.includes('zip')
  const boxy = variant.includes('boxy') ? 18 : 0
  const heavy = variant.includes('heavyweight')
  const bodyL = 268 - boxy
  const bodyR = 532 + boxy
  const shoulderL = 300 - boxy * 0.4
  const shoulderR = 500 + boxy * 0.4
  const bodyPath = `M${shoulderL} 258 L215 300 L175 620 L245 645 L282 470 L${bodyL} 470 L${bodyL} 762 Q400 790 ${bodyR} 762 L${bodyR} 470 L518 470 L555 645 L625 620 L585 300 L${shoulderR} 258 Q462 312 400 312 Q338 312 ${shoulderL} 258 Z`

  return `<g filter="url(#softShadow)">
    <path d="M305 262 Q298 160 400 154 Q502 160 495 262 Q460 316 400 316 Q340 316 305 262 Z" fill="url(#fabric)" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M305 262 Q298 160 400 154 Q502 160 495 262 Q460 316 400 316 Q340 316 305 262 Z" fill="url(#weave)" opacity=".8"/>
    <path d="M332 252 Q330 195 400 190 Q470 195 468 252 Q446 288 400 288 Q354 288 332 252 Z" fill="${p.dark}" opacity=".36"/>
    <path d="${bodyPath}" fill="url(#fabric)" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
    <path d="${bodyPath}" fill="url(#weave)" opacity=".9"/>
    <path d="M${shoulderL + 3} 260 Q340 315 400 315 Q460 315 ${shoulderR - 3} 260" fill="none" stroke="${p.dark}" stroke-width="${heavy ? 20 : 16}" stroke-linecap="round"/>
    <path d="M${shoulderL + 7} 267 Q342 321 400 321 Q458 321 ${shoulderR - 7} 267" fill="none" stroke="${p.stitch}" stroke-width="2.5" stroke-opacity=".55"/>
    <path d="M312 600 Q400 582 488 600 L500 700 Q400 720 300 700 Z" fill="${p.dark}" opacity=".17" stroke="${p.dark}" stroke-opacity=".28" stroke-width="3"/>
    <path d="M318 608 Q400 592 482 608" fill="none" stroke="${p.stitch}" stroke-width="3" stroke-opacity=".4"/>
    <path d="M215 300 L282 470" stroke="${p.dark}" stroke-opacity=".2" stroke-width="4"/>
    <path d="M585 300 L518 470" stroke="${p.dark}" stroke-opacity=".2" stroke-width="4"/>
    <path d="M182 606 L248 630" stroke="${p.dark}" stroke-opacity=".22" stroke-width="4"/>
    <path d="M618 606 L552 630" stroke="${p.dark}" stroke-opacity=".22" stroke-width="4"/>
    <path d="M178 624 L246 648" stroke="${p.stitch}" stroke-width="3" stroke-opacity=".4"/>
    <path d="M622 624 L554 648" stroke="${p.stitch}" stroke-width="3" stroke-opacity=".4"/>
    <path d="M340 430 Q356 560 338 742" fill="none" stroke="${p.dark}" stroke-opacity=".08" stroke-width="13"/>
    <path d="M464 430 Q448 570 464 742" fill="none" stroke="${p.dark}" stroke-opacity=".08" stroke-width="12"/>
    ${zip ? `<g>
      <path d="M400 312 L400 758" stroke="${p.dark}" stroke-width="7"/>
      <path d="M400 318 L400 754" stroke="${p.stitch}" stroke-width="2.5" stroke-dasharray="2 7"/>
      <rect x="388" y="338" width="24" height="46" rx="6" fill="${p.light}" stroke="${p.dark}" stroke-width="3"/>
      <circle cx="400" cy="352" r="4" fill="${p.dark}"/>
    </g>` : `<g>
      <path d="M362 316 L348 470" stroke="${p.stitch}" stroke-width="6" stroke-linecap="round"/>
      <path d="M438 316 L452 470" stroke="${p.stitch}" stroke-width="6" stroke-linecap="round"/>
      <circle cx="348" cy="478" r="8" fill="${p.stitch}" stroke="${p.dark}" stroke-width="2.5"/>
      <circle cx="452" cy="478" r="8" fill="${p.stitch}" stroke="${p.dark}" stroke-width="2.5"/>
    </g>`}
  </g>`
}

function renderShoes(p, variant) {
  const trail = variant.includes('trail')
  const court = variant.includes('court')
  const runner = variant.includes('runner')
  const canvas = variant.includes('canvas')
  const low = variant.includes('low')
  const outsole = trail ? '#292524' : '#a8a29e'
  const upperPath =
    'M136 692 C146 628 180 574 238 544 C286 518 330 522 356 558 C384 534 428 508 478 496 C534 484 588 502 622 552 C650 598 664 650 676 690 C560 724 242 724 136 692 Z'
  const solePath =
    'M118 690 C240 726 560 726 682 688 L680 722 C658 762 540 782 400 782 C258 782 144 762 116 730 Z'
  const midsolePath =
    'M118 690 C240 726 560 726 682 688 L682 706 C560 744 240 744 118 712 Z'

  const lugs = trail
    ? Array.from({ length: 12 }, (_, index) => {
        const x = 146 + index * 45
        return `<rect x="${x}" y="762" width="26" height="18" rx="5" fill="#292524" opacity=".82"/>`
      }).join('')
    : ''

  const perforations = court
    ? Array.from({ length: 8 }, (_, index) => {
        const x = 180 + (index % 4) * 26
        const y = 622 + Math.floor(index / 4) * 22
        return `<circle cx="${x}" cy="${y}" r="4" fill="${p.dark}" opacity=".3"/>`
      }).join('')
    : ''

  return `<g filter="url(#softShadow)">
    <path d="${solePath}" fill="${outsole}" stroke="#57534e" stroke-width="4" stroke-linejoin="round"/>
    <path d="${midsolePath}" fill="#f5f5f4" stroke="#d6d3d1" stroke-width="3"/>
    ${lugs}
    <path d="${upperPath}" fill="url(#fabric)" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
    <path d="${upperPath}" fill="${canvas ? 'url(#weave)' : runner ? 'url(#mesh)' : 'url(#weave)'}" opacity="${canvas ? '.95' : runner ? '.75' : '.45'}"/>
    <path d="M136 692 C146 628 180 574 238 544 C258 590 268 640 268 692 Z" fill="${p.light}" opacity=".58" stroke="${p.dark}" stroke-opacity=".3" stroke-width="3"/>
    <path d="M610 552 C640 604 662 652 676 690 L620 700 C600 650 590 600 600 552 Z" fill="${p.dark}" opacity=".24"/>
    <path d="M528 505 Q590 480 626 536 Q590 558 552 544 Z" fill="${p.dark}" opacity=".5"/>
    <path d="M536 512 Q590 492 616 532" fill="none" stroke="${p.stitch}" stroke-width="3" stroke-opacity=".55"/>
    <path d="M602 505 Q616 482 636 496" fill="none" stroke="${p.dark}" stroke-width="6" stroke-linecap="round"/>
    <path d="M352 558 Q416 526 478 510 L498 548 Q428 566 368 596 Z" fill="${p.light}" opacity=".24" stroke="${p.dark}" stroke-opacity=".35" stroke-width="3"/>
    <g stroke="${p.stitch}" stroke-width="7" stroke-linecap="round" opacity=".9">
      <path d="M380 552 L440 526"/>
      <path d="M400 578 L462 550"/>
      <path d="M420 604 L482 576"/>
      <path d="M442 630 L504 602"/>
    </g>
    <g stroke="${p.dark}" stroke-width="2.5" stroke-linecap="round" opacity=".38">
      <path d="M374 556 L434 530"/>
      <path d="M394 582 L456 554"/>
      <path d="M414 608 L476 580"/>
      <path d="M436 634 L498 606"/>
    </g>
    <g fill="${p.light}" stroke="${p.dark}" stroke-width="2" opacity=".8">
      <circle cx="374" cy="554" r="4"/>
      <circle cx="434" cy="528" r="4"/>
      <circle cx="394" cy="580" r="4"/>
      <circle cx="456" cy="552" r="4"/>
      <circle cx="414" cy="606" r="4"/>
      <circle cx="476" cy="578" r="4"/>
      <circle cx="436" cy="632" r="4"/>
      <circle cx="498" cy="604" r="4"/>
    </g>
    ${perforations}
    <path d="M250 610 Q360 580 520 596" fill="none" stroke="${p.highlight}" stroke-opacity="${runner ? '.55' : '.3'}" stroke-width="10" stroke-linecap="round"/>
    <path d="M620 540 Q638 570 650 612" fill="none" stroke="${p.dark}" stroke-opacity=".3" stroke-width="4"/>
    ${low ? `<path d="M540 555 Q590 542 618 575" fill="none" stroke="${p.stitch}" stroke-width="4" stroke-opacity=".6"/>` : `<path d="M532 528 Q590 508 625 550" fill="none" stroke="${p.stitch}" stroke-width="4" stroke-opacity=".55"/>`}
    ${court ? `<path d="M150 718 H660" stroke="#d6d3d1" stroke-width="4" opacity=".8"/>` : ''}
    ${runner ? `<path d="M150 704 Q400 738 650 700" fill="none" stroke="${p.dark}" stroke-opacity=".18" stroke-width="5"/>` : ''}
  </g>`
}

function renderHat(p, variant) {
  const beanie = variant.includes('beanie')
  const bucket = variant.includes('bucket')
  const trucker = variant.includes('trucker')
  const dad = variant.includes('dad')
  const corduroy = variant.includes('corduroy')
  const texture = corduroy ? 'url(#corduroy)' : 'url(#weave)'

  if (beanie) {
    const ribs = Array.from({ length: 11 }, (_, index) => {
      const x = 268 + index * 26
      return `<path d="M${x} 536 L${x - 5} 602" stroke="${p.dark}" stroke-opacity=".18" stroke-width="3"/>`
    }).join('')
    return `<g filter="url(#softShadow)">
      <path d="M252 540 Q244 300 400 282 Q556 300 548 540 L548 602 Q400 632 252 602 Z" fill="url(#fabric)" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M252 540 Q244 300 400 282 Q556 300 548 540 L548 602 Q400 632 252 602 Z" fill="${texture}" opacity=".9"/>
      <path d="M252 520 Q400 556 548 520 L548 602 Q400 632 252 602 Z" fill="${p.dark}" opacity=".22"/>
      ${ribs}
      <path d="M252 520 Q400 556 548 520" fill="none" stroke="${p.stitch}" stroke-width="4" stroke-opacity=".6"/>
      <path d="M270 574 Q400 602 530 574" fill="none" stroke="${p.dark}" stroke-opacity=".2" stroke-width="3"/>
      <path d="M400 286 Q404 220 400 196" fill="none" stroke="${p.dark}" stroke-opacity=".12" stroke-width="12"/>
    </g>`
  }

  if (bucket) {
    return `<g filter="url(#softShadow)">
      <path d="M270 455 Q270 310 400 298 Q530 310 530 455 Z" fill="url(#fabric)" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M270 455 Q270 310 400 298 Q530 310 530 455 Z" fill="${texture}" opacity=".9"/>
      <path d="M210 462 Q400 426 590 462 L610 522 Q400 562 190 522 Z" fill="url(#fabricSoft)" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M210 462 Q400 426 590 462 L610 522 Q400 562 190 522 Z" fill="${texture}" opacity=".65"/>
      <path d="M210 462 Q400 426 590 462" fill="none" stroke="${p.stitch}" stroke-width="4" stroke-opacity=".65"/>
      <path d="M200 520 Q400 556 600 520" fill="none" stroke="${p.dark}" stroke-opacity=".24" stroke-width="5"/>
      <path d="M292 350 Q400 328 508 350" fill="none" stroke="${p.highlight}" stroke-opacity=".2" stroke-width="12"/>
    </g>`
  }

  const crown = `<path d="M268 470 Q268 306 400 292 Q532 306 532 470 Z" fill="url(#fabric)" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M268 470 Q268 306 400 292 Q532 306 532 470 Z" fill="${texture}" opacity=".9"/>
    ${trucker ? `<path d="M400 292 Q532 306 532 470 L400 470 Z" fill="url(#mesh)" opacity=".9"/><path d="M268 470 Q268 306 400 292 L400 470 Z" fill="${p.light}" opacity=".24"/>` : ''}
    <path d="M400 294 V470" stroke="${p.dark}" stroke-opacity=".24" stroke-width="4"/>
    <path d="M300 350 Q400 330 500 350" fill="none" stroke="${p.highlight}" stroke-opacity=".18" stroke-width="12"/>`

  return `<g filter="url(#softShadow)">
    ${crown}
    <path d="${dad ? 'M185 512 Q400 472 615 512 Q622 568 400 580 Q178 568 185 512 Z' : 'M175 505 Q400 462 625 505 Q630 565 400 578 Q170 565 175 505 Z'}" fill="url(#fabricSoft)" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
    <path d="${dad ? 'M185 512 Q400 472 615 512 Q622 568 400 580 Q178 568 185 512 Z' : 'M175 505 Q400 462 625 505 Q630 565 400 578 Q170 565 175 505 Z'}" fill="${texture}" opacity=".7"/>
    <path d="M185 514 Q400 476 615 514" fill="none" stroke="${p.stitch}" stroke-width="4" stroke-opacity=".6"/>
    <circle cx="400" cy="292" r="15" fill="${p.light}" stroke="${p.dark}" stroke-width="3"/>
    <path d="M388 292 H412" stroke="${p.dark}" stroke-opacity=".3" stroke-width="3"/>
  </g>`
}

function renderTote(p) {
  return `<g filter="url(#softShadow)">
    <path d="M250 420 L550 420 L580 785 Q400 812 220 785 Z" fill="url(#fabric)" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M250 420 L550 420 L580 785 Q400 812 220 785 Z" fill="url(#weave)" opacity=".95"/>
    <path d="M310 420 C310 320 348 292 400 292 C452 292 490 320 490 420" fill="none" stroke="${p.dark}" stroke-width="20" stroke-linecap="round"/>
    <path d="M310 420 C310 320 348 292 400 292 C452 292 490 320 490 420" fill="none" stroke="${p.light}" stroke-width="7" stroke-linecap="round" stroke-opacity=".45"/>
    <path d="M238 468 H562" stroke="${p.dark}" stroke-opacity=".22" stroke-width="4"/>
    <rect x="310" y="556" width="180" height="112" rx="14" fill="${p.light}" opacity=".22" stroke="${p.dark}" stroke-opacity=".25" stroke-width="3"/>
    <path d="M336 594 H464 M336 622 H420" stroke="${p.stitch}" stroke-width="4" stroke-opacity=".55"/>
    <path d="M260 760 Q400 786 540 760" fill="none" stroke="${p.dark}" stroke-opacity=".2" stroke-width="4"/>
  </g>`
}

function renderWallet(p) {
  return `<g filter="url(#softShadow)">
    <rect x="230" y="360" width="340" height="430" rx="40" fill="url(#fabric)" stroke="${p.dark}" stroke-width="5"/>
    <rect x="230" y="360" width="340" height="430" rx="40" fill="url(#weave)" opacity=".8"/>
    <path d="M230 558 H570" stroke="${p.dark}" stroke-opacity=".32" stroke-width="5"/>
    <rect x="262" y="398" width="276" height="118" rx="20" fill="${p.light}" opacity=".22" stroke="${p.dark}" stroke-opacity=".25" stroke-width="3"/>
    <path d="M286 430 H514 M286 460 H460 M286 490 H500" stroke="${p.stitch}" stroke-width="4" stroke-opacity=".5"/>
    <circle cx="520" cy="732" r="20" fill="${p.light}" opacity=".35" stroke="${p.dark}" stroke-opacity=".3" stroke-width="3"/>
    <path d="M520 712 V752" stroke="${p.dark}" stroke-opacity=".3" stroke-width="3"/>
    <path d="M252 378 Q400 354 548 378" fill="none" stroke="${p.stitch}" stroke-width="3" stroke-opacity=".45"/>
  </g>`
}

function renderSocks(p) {
  const sock = `<g>
    <path d="M320 300 H450 V552 C450 604 480 638 532 660 C592 686 602 736 560 762 C520 788 470 772 430 746 L320 680 Z" fill="url(#fabric)" stroke="${p.dark}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M320 300 H450 V552 C450 604 480 638 532 660 C592 686 602 736 560 762 C520 788 470 772 430 746 L320 680 Z" fill="url(#knit)" opacity=".95"/>
    <path d="M320 300 H450 V382 H320 Z" fill="${p.dark}" opacity=".24"/>
    <path d="M330 320 H440 M330 344 H440 M330 368 H440" stroke="${p.stitch}" stroke-width="3" stroke-opacity=".45"/>
    <path d="M528 678 C566 700 578 730 552 752" fill="none" stroke="${p.dark}" stroke-opacity=".24" stroke-width="4"/>
    <path d="M332 664 Q382 700 430 730" fill="none" stroke="${p.dark}" stroke-opacity=".16" stroke-width="5"/>
  </g>`
  return `<g filter="url(#softShadow)">
    <g transform="translate(-88 24) rotate(-9 400 520)">${sock}</g>
    <g transform="translate(96 66) rotate(8 400 520)">${sock}</g>
  </g>`
}

function renderBottle(p) {
  return `<g filter="url(#softShadow)">
    <rect x="332" y="330" width="136" height="424" rx="48" fill="url(#fabric)" stroke="${p.dark}" stroke-width="5"/>
    <rect x="332" y="330" width="136" height="424" rx="48" fill="url(#weave)" opacity=".5"/>
    <rect x="350" y="268" width="100" height="82" rx="18" fill="${p.dark}" stroke="${p.dark}" stroke-width="4"/>
    <rect x="362" y="284" width="76" height="48" rx="10" fill="${p.light}" opacity=".24"/>
    <rect x="358" y="362" width="22" height="326" rx="11" fill="#ffffff" opacity=".28"/>
    <rect x="332" y="518" width="136" height="108" fill="${p.light}" opacity=".18"/>
    <path d="M332 518 H468 M332 626 H468" stroke="${p.stitch}" stroke-width="3" stroke-opacity=".5"/>
    <path d="M368 680 H432" stroke="${p.dark}" stroke-opacity=".24" stroke-width="4"/>
  </g>`
}

function renderKeyClip(p) {
  return `<g filter="url(#softShadow)">
    <path d="M400 268 C330 268 300 318 300 368 C300 428 340 458 400 458 C430 458 450 448 460 428" fill="none" stroke="${p.base}" stroke-width="38" stroke-linecap="round"/>
    <path d="M400 268 C330 268 300 318 300 368 C300 428 340 458 400 458 C430 458 450 448 460 428" fill="none" stroke="${p.light}" stroke-width="9" stroke-linecap="round" stroke-opacity=".42"/>
    <circle cx="400" cy="552" r="106" fill="none" stroke="${p.dark}" stroke-width="30"/>
    <circle cx="400" cy="552" r="106" fill="none" stroke="${p.light}" stroke-width="6" stroke-opacity=".32"/>
    <path d="M400 446 V460" stroke="${p.dark}" stroke-width="22"/>
    <g transform="rotate(-16 400 646)">
      <rect x="370" y="620" width="60" height="156" rx="18" fill="${p.base}" stroke="${p.dark}" stroke-width="4"/>
      <circle cx="400" cy="650" r="16" fill="${p.dark}" opacity=".4"/>
      <path d="M430 700 H462 V720 H430 M430 738 H454 V758 H430" fill="${p.base}" stroke="${p.dark}" stroke-width="4"/>
    </g>
    <g transform="rotate(18 470 676)">
      <rect x="444" y="646" width="52" height="134" rx="16" fill="${p.light}" stroke="${p.dark}" stroke-width="4"/>
      <circle cx="470" cy="674" r="14" fill="${p.dark}" opacity=".35"/>
      <path d="M496 718 H520 V736 H496 M496 752 H512 V770 H496" fill="${p.light}" stroke="${p.dark}" stroke-width="4"/>
    </g>
    <path d="M362 330 Q400 300 438 330" fill="none" stroke="${p.stitch}" stroke-width="5" stroke-opacity=".45"/>
  </g>`
}

function renderAccessory(p, variant) {
  if (variant.includes('wallet')) return renderWallet(p)
  if (variant.includes('socks')) return renderSocks(p)
  if (variant.includes('bottle')) return renderBottle(p)
  if (variant.includes('key')) return renderKeyClip(p)
  return renderTote(p)
}

const RENDERERS = {
  tshirt: renderTshirt,
  hoodie: renderHoodie,
  shoes: renderShoes,
  hat: renderHat,
  accessory: renderAccessory,
}

export function renderProductImage({ id = 1, name = '', category, color, variant = '' }) {
  const p = PALETTE[color] ?? PALETTE.black
  const normalizedVariant = String(variant).toLowerCase()
  const renderer = RENDERERS[category] ?? renderAccessory
  const art = renderer(p, normalizedVariant)
  const tilt = ((id % 5) - 2) * 0.8
  const accentX = 110 + ((id * 97) % 580)
  const accentY = 120 + ((id * 61) % 250)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000" role="img">
  <title>${escapeXml(name || `${color} ${category}`)}</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${id % 2 === 0 ? '1' : '0.4'}" y2="1">
      <stop offset="0%" stop-color="#fafaf9"/>
      <stop offset="100%" stop-color="#e7e5e4"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="32%" r="68%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity=".95"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fabric" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.light}"/>
      <stop offset="48%" stop-color="${p.base}"/>
      <stop offset="100%" stop-color="${p.dark}"/>
    </linearGradient>
    <linearGradient id="fabricSoft" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.light}"/>
      <stop offset="100%" stop-color="${p.base}"/>
    </linearGradient>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#292524" flood-opacity=".2"/>
    </filter>
    <pattern id="weave" width="14" height="14" patternUnits="userSpaceOnUse">
      <path d="M0 7H14M7 0V14" stroke="#1c1917" stroke-opacity=".055" stroke-width="1"/>
    </pattern>
    <pattern id="corduroy" width="14" height="14" patternUnits="userSpaceOnUse">
      <path d="M3 0V14M10 0V14" stroke="#1c1917" stroke-opacity=".14" stroke-width="2.5"/>
      <path d="M3 0V14M10 0V14" stroke="#ffffff" stroke-opacity=".14" stroke-width="1"/>
    </pattern>
    <pattern id="knit" width="12" height="12" patternUnits="userSpaceOnUse">
      <path d="M2 0V12M6 0V12M10 0V12" stroke="#1c1917" stroke-opacity=".12" stroke-width="1.5"/>
    </pattern>
    <pattern id="mesh" width="12" height="12" patternUnits="userSpaceOnUse">
      <circle cx="3" cy="3" r="1.1" fill="#1c1917" fill-opacity=".13"/>
      <circle cx="9" cy="9" r="1.1" fill="#1c1917" fill-opacity=".13"/>
    </pattern>
  </defs>
  <rect width="800" height="1000" fill="url(#bg)"/>
  <rect width="800" height="1000" fill="url(#glow)"/>
  <circle cx="${accentX}" cy="${accentY}" r="${170 + (id % 3) * 28}" fill="${p.base}" opacity=".07"/>
  <circle cx="${800 - accentX}" cy="${880 - (id % 4) * 38}" r="140" fill="${p.light}" opacity=".12"/>
  <path d="M0 820 Q400 790 800 820 L800 1000 L0 1000 Z" fill="#ffffff" opacity=".2"/>
  <ellipse cx="400" cy="832" rx="${208 + (id % 4) * 14}" ry="34" fill="#292524" opacity=".12" filter="url(#blur)"/>
  <g transform="rotate(${tilt} 400 540)">${art}</g>
</svg>
`
}
